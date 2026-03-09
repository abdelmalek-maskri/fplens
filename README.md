# Fantasy Foresight

A tool that predicts how many Fantasy Premier League points each player will score next week — and helps you pick the best team based on those predictions.

FPL is a game where 11 million people pick a squad of real Premier League footballers and earn points based on how they perform each week (goals, assists, clean sheets, etc.). Fantasy Foresight uses machine learning to forecast those points, then tells you who to start, who to captain, who to transfer in, and when to play your chips.

## What It Does

**Predictions** — Every player gets a predicted score for the upcoming gameweek, with a confidence range showing how certain the model is. You can filter by position, search by name, and see what's driving each prediction (which stats matter most for this player right now).

**Best XI** — The model picks the best possible starting 11 from all 820+ Premier League players for the upcoming week. No budget, no restrictions — just the highest-scoring combination across all valid formations.

**My Team** — Enter your FPL ID and the app pulls your actual squad. It tells you who to start, who to bench, who to captain, and suggests transfers (who to sell, who to buy, and how much you'd gain).

**Season Planner** — At the start of the season, the model picks an optimal 15-man squad within the FPL budget (£100m, max 3 players per team). Uses mathematical optimisation to find the best possible combination.

**Fixtures** — A grid showing every team's upcoming opponents colour-coded by difficulty. Helps you spot good runs of fixtures for planning transfers ahead.

**Player Comparison** — Put two players side by side with a radar chart comparing their stats, form, and predictions.

**News & Sentiment** — Real Guardian articles about Premier League players, linked to the right FPL player and scored for positive/negative sentiment. Flags injury news.

**Model Insights** — See how the model works: which features matter most (SHAP analysis), how different data sources improve accuracy (ablation study), and how well predictions are calibrated.

## How the Model Works

The model is a stacked ensemble — it combines predictions from 6 different models (2 LightGBMs, XGBoost, Random Forest, Ridge, and a classifier) through a Ridge meta-learner that learns which model to trust in which situation.

It's trained on 10 seasons of FPL data (2015-16 to 2024-25) with 141 features per player per gameweek:

- **FPL stats** — points, minutes, goals, assists, bonus, ICT index, form
- **Understat** — expected goals (xG), expected assists (xA), shot data, key passes
- **Rolling windows** — how a player has performed over the last 3, 5, and 10 games
- **Injury data** — current status, chance of playing, NLP-extracted injury type from FPL news text
- **Guardian news** — how often a player is mentioned, article sentiment, injury context

The target is simple: how many FPL points will this player score next gameweek?

### Ablation Study

Each data source was tested individually to measure its contribution:

| Config | Data Sources | Features | MAE |
| ------ | ------------ | -------- | --- |
| A | FPL + Understat | 109 | 1.060 |
| B | + Injury | 121 | 1.051 |
| C | + News | ~117 | 1.058 |
| **D** | **+ Both** | **141** | **1.043** |

Config D (all sources combined) is the deployed model. Injury and news features have a synergy effect — together they reduce error more than either does alone.

## Architecture

```text
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  React App  │────▶│  FastAPI API  │────▶│  ML Pipeline     │
│  Vite 5     │     │  10 endpoints │     │  Stacked Ensemble│
│  Tailwind   │     │  TTL cache    │     │  141 features    │
└─────────────┘     └──────────────┘     └──────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        FPL API      Guardian API   Understat
```

**ML pipeline** (Python) — fetches live data from the FPL API, engineers features to match the training set, runs the model, and returns predictions with uncertainty estimates.

**API** (FastAPI) — serves predictions, runs the squad/XI solvers, fetches user teams, and caches everything to avoid hammering the FPL API on every request.

**App** (React) — 13 pages, dark theme, all data visualised with sparklines, pitch views, radar charts, and SHAP breakdowns. Works with mock data for development or live API data in production.

## API Endpoints

```text
GET  /api/predictions              All players with predicted points + uncertainty
GET  /api/best-xi                  Best starting 11 from all players
GET  /api/best-squad?budget=100    Best 15-man squad within budget (ILP solver)
GET  /api/fixtures?num_gws=6       Fixture difficulty grid by team
GET  /api/team/{fpl_id}            User's squad with suggestions
GET  /api/player/{element_id}      Player detail, history, SHAP breakdown
GET  /api/news?days=7              Guardian articles with sentiment + player links
GET  /api/model-insights           Training metrics and ablation results
POST /api/refresh                  Clear cache (requires auth header)
GET  /api/health                   Server status
```

## Project Structure

```text
ml/
├── config/                 Evaluation config, season definitions
├── pipelines/
│   ├── features/           Feature engineering (lag, rolling, momentum)
│   ├── fpl/                FPL API data processing
│   ├── understat/          xG/xA scraping and mapping
│   ├── injury/             Injury feature extraction (structured + NLP)
│   ├── news/               Guardian articles, spaCy NER, RoBERTa sentiment
│   ├── train/              Model training and ablation study
│   └── inference/          Live prediction pipeline
├── analysis/               SHAP analysis
├── evaluation/             Metrics suite
└── utils/                  Helpers

api/
├── main.py                 FastAPI app, model loading, cache
├── cache.py                Thread-safe TTL cache
├── solvers.py              Best XI, squad optimiser, transfer suggestions
└── routers/                Endpoint handlers

app/src/
├── pages/                  13 pages
├── components/             40+ UI components
├── hooks/                  12 data hooks (mock or API)
├── mocks/                  Mock data for development
└── lib/                    API client, constants, theme
```

## Setup

```bash
# Python
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# Node
nvm use
cd app && npm ci
```

Copy `.env.example` to `.env` and set:

```bash
GUARDIAN_API_KEY=your-key-here    # https://open-platform.theguardian.com/access/
REFRESH_SECRET=your-secret-here  # for POST /api/refresh
```

## Running

```bash
# Start the API server
uvicorn api.main:app --reload

# Start the React app
cd app && npm run dev

# Run ML inference on its own
python -m ml.pipelines.inference.predict

# Train the model from scratch
python -m ml.pipelines.train.train_stacked_ensemble
```

## Testing

```bash
# Frontend
cd app && npm test              # Vitest + happy-dom
cd app && npm run lint          # ESLint
cd app && npm run format:check  # Prettier

# Backend
ruff check ml/ api/             # Lint
ruff format ml/ api/            # Format
pytest tests/ ml/tests/         # Tests
```

CI runs 4 parallel jobs on every push: lint/format, test, build, Python lint.

## Tech Stack

| Layer | What |
| ----- | ---- |
| ML | Python, LightGBM, XGBoost, scikit-learn, SHAP, spaCy, Transformers |
| API | FastAPI, uvicorn, scipy (ILP solver), joblib |
| App | React 19, Vite 5, Tailwind CSS 3.4, React Router 7 |
| CI | GitHub Actions, Ruff, Prettier, ESLint, Vitest |
