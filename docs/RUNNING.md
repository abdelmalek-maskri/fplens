# Running the Project

## Prerequisites

- Python 3.10+
- Node.js 20.11.0+
- npm 10+

## Setup

```bash
# Clone the repository (with the historical FPL data submodule)
git clone --recurse-submodules https://github.com/abdelmalek-maskri/fplens.git
cd fplens

# Install Python dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd app && npm install && cd ..
```

Note `requirements.txt` covers both training and serving, so it pulls in heavy NLP
dependencies (torch, transformers, spaCy) that the API itself does not need.

Before the backend will start you need trained models — see [Models](#models) below.

## Running

### Backend (API server)

```bash
uvicorn api.main:app --reload
```

The API starts on `http://127.0.0.1:8000`. On first request, it fetches live player data from the FPL API (~60 seconds), then caches it. Subsequent requests are instant.

### Frontend (React dashboard)

```bash
cd app
npm run dev
```

Opens on `http://localhost:5173`. Requires the backend to be running.

## Models

**Trained models are not committed, and the site does not need them.** `outputs/` and
`*.joblib` are gitignored because they are large and reproducible. The snapshot in
`app/public/data/` **is** committed, so a fresh clone serves the whole dashboard with no
model on disk.

Models are needed for two things only: rebuilding the snapshot, and training.

```bash
make snapshot   # ~800 FPL API calls, ~30s, rewrites app/public/data/
```

That needs `outputs/experiments/ablation/config_D/model.joblib` at minimum. The other
registry models are optional — the job skips any whose `.joblib` is missing and simply
publishes fewer options in the selector. The GW+2 and GW+3 horizon models are optional
too; without them `multi_gw.json` degrades to GW+1 only.

| Path | Purpose |
| ---- | ------- |
| `outputs/experiments/ablation/config_D/model.joblib` | Production stacked ensemble (GW+1) |
| `outputs/experiments/multi_horizon/gw2/lgbm_reduced/model.joblib` | GW+2 horizon (optional) |
| `outputs/experiments/multi_horizon/gw3/lgbm_reduced/model.joblib` | GW+3 horizon (optional) |
| `outputs/experiments/ablation/ablation_summary.json` | Model Insights page |
| `outputs/evaluation/shap/` | SHAP reports for Model Insights |

To produce them, build the feature tables and train:

```bash
make ml.full        # stages 1-6: FPL table → Understat → target → features → injury → train
```

This needs the raw data first — the `external/vaastav_fpl` submodule supplies historical
gameweek CSVs:

```bash
git submodule update --init --recursive
```

Expect the full pipeline to take a while (Understat fetching and training dominate). Stage
order and per-stage detail are in [PIPELINE_ORDER.md](PIPELINE_ORDER.md).

To train just the production model once features exist:

```bash
python3 -m ml.pipelines.train.run_injury_ablation
```

## Configuration

All read from the environment, and `.env` in the project root is loaded automatically.

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `GUARDIAN_API_KEY` | unset | Live news sentiment. Without it, news features are zero-filled at inference. Free key from [the Guardian Open Platform](https://open-platform.theguardian.com). |
| `FPLENS_MODELS` | `showcase` | Which models to load. `showcase` is the five-model deploy set, `all` is the full registry, or pass a comma-separated list of IDs. |
| `CORS_ORIGINS` | local Vite | Comma-separated allowed origins. Must include the deployed dashboard's URL. |
| `REFRESH_SECRET` | unset | Secret for `POST /api/refresh`. Unset disables the endpoint (503) rather than leaving a guessable default. |
| `FPLENS_SNAPSHOT_DIR` | `app/public/data` | Where the API reads predictions from. Override when the API is deployed apart from the site. |

`FPLENS_MODELS` applies to the snapshot job, not the API — the API loads no models at
all. The showcase set is five models; `all` publishes every one you have on disk, at
roughly 350KB of extra JSON each.

## Deploying the API

Three requirements files, smallest first:

| File | For | Notably excludes |
| ---- | --- | ---------------- |
| `requirements-api.txt` | serving | LightGBM, XGBoost, SHAP, scikit-learn, joblib (~200MB) |
| `requirements-job.txt` | `make snapshot` | torch, transformers, spaCy (~400MB) |
| `requirements.txt` | training | nothing; one flat freeze |

The API loads no models, which is why its file is the thin one. The job guards its
spaCy and transformers imports and falls back to regex player linking with keyword
sentiment, so news features still build without them.

```bash
python3 -m pip install -r requirements-api.txt
uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

A clean serving environment boots the five showcase models plus both horizon models at
roughly 304MB resident.

## Tests

```bash
# Python lint
ruff check ml/ api/

# Frontend tests (83)
cd app && npm run test

# Python tests (78) — from the project root
python3 -m pytest -q

# API tests only (9)
python3 -m pytest api/tests -q
```

Always use `python3 -m pytest` rather than bare `pytest`: the `-m` form puts the project
root on `sys.path`, which the `api.*` and `ml.*` imports rely on.

Note CI currently runs the frontend checks plus `ruff` on `ml/` only — the Python tests
and `api/` linting are not yet wired into `.github/workflows/ci.yml`.
