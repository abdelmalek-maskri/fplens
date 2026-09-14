# Architecture

## System overview

Predictions are the same for every visitor and change once per gameweek, so
they are computed on a schedule and written to files rather than computed per
request. Only two things genuinely need a server.

```text
  once per gameweek deadline
  ┌────────────────┐   ~800 calls, ~40s   ┌────────────────────────────┐
  │  job/snapshot  │────────────────────▶ │ FPL · Understat · Guardian │
  └───────┬────────┘                      └────────────────────────────┘
          │ loads the models, writes JSON
          ▼
  ┌────────────────────────┐
  │  app/public/data/      │  12 files, ~2.9 MB raw / ~200 KB gzipped
  └───────────┬────────────┘
              │ served as static files
              ▼
  ┌────────────────────────┐   2 endpoints    ┌──────────────────┐
  │  React app, 10 routes  │────────────────▶ │ FastAPI          │──▶ FPL API
  └────────────────────────┘                  │ no model loaded  │
  every request                               └──────────────────┘
```

**Job** fetches live data from three external APIs, rebuilds the training
features, runs every showcase model, and writes the JSON the site reads. It is
the only thing that loads a model.

**App** reads those files directly. Ten routes: dashboard, optimal XI, my team,
transfers, fixtures, comparison, news, watchlist, insights, player detail.

**API** answers what a file cannot: what is in a given manager's squad, and
Guardian news, whose licence forbids retaining content beyond 24 hours so it can
never be committed.

## Repository layout

```text
api/          FastAPI backend — two endpoints, no ML or scipy
  main.py       app entry and lifespan
  snapshot.py   reads the predictions the job wrote
  cache.py      thread-safe TTL cache, for per-user squads and the news feed
  schemas.py    response models
  routers/      news.py, team.py
job/          everything that runs on a schedule
  snapshot.py     writes the site's JSON
  solvers.py      ILP squad optimiser, best XI, transfer suggestions
  fetch_live_data.py  FPL, Understat and injury features
  predict.py      feature alignment, prediction, per-player SHAP
  multi_gw.py     GW+2 and GW+3 horizons
  news.py         Guardian articles, spaCy NER, RoBERTa sentiment
  models.py       model registry and loading
ml/           training only
  config/       evaluation config, season definitions
  pipelines/
    features/   lag, rolling, momentum, season averages
    fpl/        FPL table and fixture builders
    understat/  xG scraping and gameweek mapping
    mappings/   cross-source entity resolution
    injury/     injury features (structured + NLP)
    news/       Guardian article linking and sentiment
    train/      one script per architecture
  evaluation/   stratified, calibration, and business metrics
  analysis/     SHAP analysis
app/src/
  pages/        10 routes + NotFound
  components/   29 shared components
  hooks/        11 data hooks, all returning { data, isLoading, error }
  lib/          API client, constants, theme
```

## The snapshot

`make snapshot` runs `job/snapshot.py`, which writes into `app/public/data/`:

```text
manifest.json              gameweek, deadline, model list, feature coverage
models.json                what fills the model selector
predictions_<model>.json   one per showcase model, ~650 players each
players.json               full detail: history, fixtures, SHAP
multi_gw.json              GW+1/2/3 predictions
best_squad.json            optimal 15 at £100m, solved by ILP
fixtures.json              team x gameweek difficulty grid, 10 GWs
model_insights.json        ablation results and global SHAP importance
```

It is built in a sibling `.staging` directory and swapped into place at the
end, so a run that dies partway leaves the previous snapshot serving rather
than a mixture of two gameweeks. It refuses to publish if no model loaded, and
`--max-zero-filled N` makes it refuse when too much of a model's input is
absent.

Each run also appends to `data/predictions_log.csv`, the record of what was
predicted before a gameweek was played. That is the only way to score the model
on real outcomes later.

## API reference

```text
GET  /api/news                     Guardian articles (cannot be precomputed)
GET  /api/team/{fpl_id}            A manager's squad with transfer suggestions
GET  /api/health                   Liveness and cache status
POST /api/refresh                  Drop cached squads (needs X-Refresh-Secret)
```

Everything else the site shows is a file. The API reads the same
`predictions_*.json` the frontend does, so the two can never disagree about
what a player is predicted to score. Parsing it costs about 3ms, so it is read
per request rather than cached, which also means a new snapshot is live the
moment it lands.

`api/cache.py` survives for one job: a manager's squad has to be fetched from
the FPL API on demand, because there are millions of possible IDs and nothing
can be precomputed until someone types theirs in.

## Models

Ten architectures were trained and are selectable in the dashboard. Holdout is the full 2024-25 season (26,000 player-gameweeks).

| Model | Spearman ρ | MAE | RMSE | R² | Features |
| ----- | ---------- | --- | ---- | -- | -------- |
| Config D — stacked + injury + news *(production)* | 0.687 | 1.029 | 2.078 | 0.256 | 155 |
| Config B — stacked + injury | 0.685 | 1.032 | 2.083 | 0.253 | 148 |
| Config C — stacked + news | 0.675 | 1.037 | 2.089 | 0.248 | 123 |
| Config A — stacked, FPL + Understat | 0.674 | 1.039 | 2.091 | 0.247 | 116 |
| Stacked ensemble (Ridge meta) | 0.669 | 1.080 | 2.083 | 0.253 | 116 |
| CatBoost two-head | 0.667 | 1.097 | 2.093 | 0.246 | 116 |
| LightGBM Tweedie | 0.662 | 1.021 | 2.121 | 0.221 | 116 |
| Single LightGBM | 0.661 | 1.091 | 2.109 | 0.234 | 71 |
| Two-head hurdle | 0.655 | 1.087 | 2.110 | 0.233 | 116 |
| Position-specific (4× LightGBM) | 0.633 | 1.095 | 2.117 | 0.228 | 116 |

### Base learners

Stacking only helps when base models make *uncorrelated* errors, so the six were chosen for structural diversity:

- **Two LightGBMs** at different capacities (800 trees / 63 leaves, and 600 trees / 31 leaves)
- **XGBoost** — grows trees depth-wise where LightGBM grows leaf-wise, so it fails differently
- **Random Forest** — bagging rather than boosting, giving structurally independent errors
- **Ridge** — captures linear relationships in one coefficient that trees can only approximate with splits
- **LightGBM classifier** for P(points > 0) ≡ P(plays); no regressor models availability directly

Out-of-fold predictions are combined by inverse-MAE weighting, which beat Ridge, RidgeCV, and NNLS (OOF MAE 1.115 vs 1.164). Adding CatBoost as a seventh learner was tested and rejected — its errors were too correlated with the existing boosted models.

## Why not MAE

The target is 59.8% zeros — most players don't feature in a given gameweek. MAE is minimised by the conditional median, so on this distribution it rewards predicting low regardless of predictive skill.

This is not theoretical. The LightGBM Tweedie model has the lowest MAE in the project (1.021, beating the production model's 1.029), but its live output ranked José Sá — a backup goalkeeper — as the top pick at 1.6 predicted points, with Haaland scoring the same. Its mean prediction was 0.957 against an actual mean of 1.204: it had learned to compress everything toward zero.

The same effect applies to the production model. Multiplying Config D's predictions by a constant 0.7 — adding no information whatsoever — drops MAE from 1.029 to 0.975, which would beat every model in the table above, while RMSE gets worse.

Naive baselines on the same holdout: predicting zero for everyone gives MAE 1.210; predicting the training mean gives 1.561.

So the evaluation uses four metric groups rather than one:

- **Accuracy** — MAE, RMSE, R²
- **Ranking** — Spearman ρ, Pearson r
- **Stratified** — MAE split by played/not-played, high-return (≥5 pts), and position
- **Business** — captain accuracy and captain efficiency

Config D is production because FPL is a top-N selection problem: you pick 15 players and never need an exact score.

## Leakage prevention

- Every rolling and lag feature applies `.shift(1)` before the window, so the 3-game average at gameweek 10 uses gameweeks 7–9 and never 10.
- Targets are built within `(season, player)` groups, so they never cross a season boundary.
- Injury snapshots are shifted forward one gameweek — the snapshot taken after GW10 is a feature for GW11. Without that shift, 8.58% of consecutive gameweek pairs would carry status information not yet known at prediction time, including 3.70% where a player went from available to injured.
- The holdout is an entire future season, never a random split.

## Known limitations

- `team` is stored as numeric IDs for 2016-17 → 2019-20 and club names from 2020-21 on. FPL team IDs are alphabetical per season and shift with promotion, so the feature carries little signal for the earlier seasons.
- Diebold-Mariano tests treat player-gameweek panel data as a time series; clustering by gameweek would widen the intervals.
- `chance_delta` and `recovery_trajectory` are zero-filled at inference — they need per-gameweek `chance_of_playing` history the live API doesn't expose.
- Players with no gameweek history (new signings) fall back to approximated rolling features.
- Models are trained on the 2016-17 to 2023-24 scoring rules. FPL added `defensive_contribution` in 2025-26, which raised defenders' mean points by 28% and midfielders' by 9% for 60-minute appearances. The served model has never seen that rule and will underrate defensive players until it is retrained.
