# Architecture

## System overview

```text
┌─────────────┐     ┌───────────────┐     ┌──────────────────┐
│  React App  │────▶│  FastAPI API  │────▶│  ML Pipeline     │
│  Vite 5     │     │  12 endpoints │     │  Stacked Ensemble│
│  Tailwind   │     │  TTL cache    │     │  155 features    │
└─────────────┘     └───────────────┘     └──────────────────┘
                            │
               ┌────────────┼────────────┐
               ▼            ▼            ▼
         FPL API      Guardian API   Understat
```

**ML pipeline** fetches live data from three external APIs, computes features matching the training schema, and returns predictions with uncertainty and per-player SHAP.

**API** serves predictions, runs the ILP squad optimiser, fetches user teams, and caches with per-key TTL.

**App** renders 10 routes: dashboard, optimal XI, my team, transfers, fixtures, comparison, news, watchlist, insights, player detail.

## Repository layout

```text
api/          FastAPI backend
  main.py       app entry, model registry, lifespan loader
  inference.py  shared live-data + prediction cache (all routers read through this)
  cache.py      thread-safe TTL cache with per-key locking
  solvers.py    ILP squad optimiser, best XI, transfer suggestions
  routers/      endpoint handlers
ml/
  config/       evaluation config, season definitions
  pipelines/
    features/   lag, rolling, momentum, season averages
    fpl/        FPL table and fixture builders
    understat/  xG scraping and gameweek mapping
    mappings/   cross-source entity resolution
    injury/     injury features (structured + NLP)
    news/       Guardian articles, spaCy NER, RoBERTa sentiment
    train/      one script per architecture
    inference/  live prediction pipeline
  evaluation/   stratified, calibration, and business metrics
  analysis/     SHAP analysis
app/src/
  pages/        10 routes + NotFound
  components/   29 shared components
  hooks/        11 data hooks, all returning { data, isLoading, error }
  lib/          API client, constants, theme
```

## API reference

```text
GET  /api/predictions?model=       All players with predicted points + uncertainty
GET  /api/models                   Available trained models
GET  /api/best-squad?budget=100    Optimal 15-man squad (ILP)
GET  /api/predictions/multi-gw     Multi-horizon predictions (GW+1/2/3)
GET  /api/fixtures?num_gws=6       Fixture difficulty grid by team
GET  /api/team/{fpl_id}            A user's squad with transfer suggestions
GET  /api/player/{element_id}      Player detail, history, SHAP breakdown
GET  /api/news?days=7              Guardian articles with sentiment
GET  /api/model-insights           Ablation results and SHAP importance
GET  /api/health                   Liveness, loaded models, cache status
GET  /api/status                   Current gameweek and next deadline
POST /api/refresh                  Invalidate cache (needs X-Refresh-Secret)
```

## Caching

The expensive step is fetching per-player gameweek history — roughly one FPL API call per player, about 30 seconds for ~825 players via a thread pool. That result is cached once under `live_data` and shared across every model; switching models only re-runs the cheap `predict()` call on top of it.

Every cache key gets its own lock, so concurrent requests for the same key wait on a single in-flight fetch rather than starting duplicates. All routers read predictions through `api/inference.py` — calling the inference pipeline directly from a router would fetch behind the cache's back and write the same key with a different TTL.

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
