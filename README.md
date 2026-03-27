# Fantasy Lens

Predicts how many Fantasy Premier League points each player will score next week, and helps you pick the best team based on those predictions.

FPL is a game where 11 million people pick a squad of real Premier League footballers and earn points based on how they perform each week (goals, assists, clean sheets, etc.). Fantasy Lens uses machine learning to forecast those points, then tells you who to start, who to captain, who to transfer in, and how to plan transfers across multiple future gameweeks.

**Quick start:** See [docs/RUNNING.md](docs/RUNNING.md) for setup instructions, appendices are in `docs/`. The full pipeline execution order is in [docs/PIPELINE_ORDER.md](docs/PIPELINE_ORDER.md).

## What It Does

**Predictions**: every player gets a predicted score for the upcoming gameweek, with a confidence range. You can filter by position, search by name, switch between 10 trained models, and see what's driving each prediction (SHAP breakdown).

**Optimal XI**: uses integer linear programming to pick the best 15-man squad from all 820+ players within the FPL budget (£100m, max 3 per team), then selects the best starting 11 from that squad.

**My Team**: enter your FPL ID and the app pulls your actual squad. It tells you who to start, who to bench, who to captain, and suggests transfers.

**Transfers**: multi-horizon transfer planning with a 1-3 week horizon toggle. Uses separately trained models for GW+1, GW+2, and GW+3 to evaluate whether a transfer is worth taking now or waiting.

**Fixtures**: a grid showing every team's upcoming opponents colour-coded by difficulty.

**Player Comparison**: two players side by side with a radar chart comparing stats, form, and predictions.

**News & Sentiment**: Guardian articles about Premier League players, linked to FPL players and scored for positive/negative sentiment. Flags injury news.

**Model Insights**: which features matter most (SHAP), how different data sources improve accuracy (ablation study), and how well predictions are calibrated.

## How the Model Works

The model is a stacked ensemble. It combines predictions from 6 different models (2 LightGBMs, XGBoost, Random Forest, Ridge, and a classifier) through inverse-MAE weighting.

Trained on 10 seasons of FPL data (2016-17 to 2024-25) with 155 features per player per gameweek:

- **FPL stats**: points, minutes, goals, assists, bonus, ICT index, form
- **Understat**: expected goals (xG), expected assists (xA), shot data, key passes
- **Rolling windows**: performance over the last 3, 5, and 10 games
- **Injury data**: status, chance of playing, NLP-extracted injury type from FPL news text
- **Guardian news**: mention count, article sentiment, injury context

Target: how many FPL points will this player score next gameweek?

### Ablation Study

Each data source tested individually:

| Config | Data Sources | Features | MAE |
| ------ | ------------ | -------- | --- |
| A | FPL + Understat | 116 | 1.039 |
| B | + Injury | 148 | 1.032 |
| C | + News | 123 | 1.037 |
| **D** | **+ Both** | **155** | **1.029** |

Config D is the production model. Injury and news features interact synergistically: together they reduce error more than either does alone.

## Architecture

```text
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  React App  │────▶│  FastAPI API  │────▶│  ML Pipeline     │
│  Vite 5     │     │  8 endpoints  │     │  Stacked Ensemble│
│  Tailwind   │     │  TTL cache    │     │  155 features    │
└─────────────┘     └──────────────┘     └──────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        FPL API      Guardian API   Understat
```

**ML pipeline** (Python): fetches live data from the FPL, Understat, and Guardian APIs, computes features, runs the model, returns predictions with uncertainty and per-player SHAP.

**API** (FastAPI): serves predictions, runs the ILP squad optimiser, fetches user teams, caches with per-key TTL.

**App** (React): 11 pages, dark theme, sparklines, pitch views, radar charts, SHAP breakdowns.

## API Endpoints

```text
GET  /api/predictions              All players with predicted points + uncertainty
GET  /api/best-squad?budget=100    Optimal 15-man squad (ILP solver)
GET  /api/predictions/multi-gw     Multi-horizon predictions (GW+1/2/3)
GET  /api/fixtures?num_gws=6       Fixture difficulty grid by team
GET  /api/team/{fpl_id}            User's squad with suggestions
GET  /api/player/{element_id}      Player detail, history, SHAP breakdown
GET  /api/news?days=7              Guardian articles with sentiment + player links
GET  /api/model-insights           Training metrics and ablation results
```

## Project Structure

```text
ml/
├── config/                 Evaluation config, season definitions
├── pipelines/
│   ├── features/           Feature engineering (lag, rolling, momentum)
│   ├── fpl/                FPL data processing
│   ├── understat/          xG/xA scraping and mapping
│   ├── injury/             Injury feature extraction (structured + NLP)
│   ├── news/               Guardian articles, spaCy NER, RoBERTa sentiment
│   ├── train/              Model training and ablation study
│   ├── inference/          Live prediction pipeline
│   └── runners/            Pipeline orchestrator
├── analysis/               SHAP analysis
├── evaluation/             Metrics
└── utils/                  CSV parsing, name normalisation

api/
├── main.py                 FastAPI app, model loading, cache
├── cache.py                Thread-safe TTL cache with per-key locking
├── solvers.py              ILP squad optimiser, transfer suggestions
└── routers/                Endpoint handlers

app/src/
├── pages/                  11 pages
├── components/             40+ UI components
├── hooks/                  Data hooks (API calls)
└── lib/                    API client, constants, theme
```

## Setup & Running

See [docs/RUNNING.md](docs/RUNNING.md) for full setup instructions.

```bash
pip install -r requirements.txt
uvicorn api.main:app --reload    # Backend on http://127.0.0.1:8000
cd app && npm install && npm run dev  # Frontend on http://localhost:5173
```

To reproduce all models from scratch, see [docs/PIPELINE_ORDER.md](docs/PIPELINE_ORDER.md).

## Testing

```bash
cd app && npm test              # Frontend (Vitest + happy-dom)
ruff check ml/ api/             # Python lint
pytest api/tests/ ml/tests/     # Python tests
```

## Tech Stack

| Layer | What |
| ----- | ---- |
| ML | Python, LightGBM, XGBoost, scikit-learn, SHAP, spaCy, Transformers |
| API | FastAPI, uvicorn, scipy (ILP solver), joblib |
| App | React 19, Vite 5, Tailwind CSS 3.4, React Router 7 |
| CI | GitHub Actions, Ruff, Prettier, ESLint, Vitest |
