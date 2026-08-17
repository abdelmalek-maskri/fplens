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

**Trained models are not committed to the repository.** `outputs/` and `*.joblib` are
gitignored (they are large and reproducible), so a fresh clone contains no models and the
API will refuse to start:

```text
FileNotFoundError: Model file not found: outputs/experiments/ablation/config_D/model.joblib
```

The API needs at minimum:

| Path | Purpose |
| ---- | ------- |
| `outputs/experiments/ablation/config_D/model.joblib` | Production stacked ensemble (GW+1). Required — startup fails without it. |
| `outputs/experiments/multi_horizon/gw2/lgbm_reduced/model.joblib` | GW+2 horizon (optional; `/api/predictions/multi-gw` degrades without it) |
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

The other registry models (baseline, two-head, position-specific, etc.) are optional — the
API skips any whose `.joblib` is missing and simply offers fewer options in the model
selector. Reproduce them with the scripts in `ml/pipelines/train/`.

## Configuration

All read from the environment, and `.env` in the project root is loaded automatically.

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `GUARDIAN_API_KEY` | unset | Live news sentiment. Without it, news features are zero-filled at inference. Free key from [the Guardian Open Platform](https://open-platform.theguardian.com). |
| `FPLENS_MODELS` | `showcase` | Which models to load. `showcase` is the five-model deploy set, `all` is the full registry, or pass a comma-separated list of IDs. |
| `CORS_ORIGINS` | local Vite | Comma-separated allowed origins. Must include the deployed dashboard's URL. |
| `REFRESH_SECRET` | unset | Secret for `POST /api/refresh`. Unset disables the endpoint (503) rather than leaving a guessable default. |
| `MODEL_PATH` | Config D | Fallback model path if `config_d` is not in the loaded set. |

Loading all ten models needs about 764MB of RAM; the showcase set needs about 326MB,
which is why it is the default. `FPLENS_MODELS=all` lists every model you have on disk.

## Deploying the API

`requirements-api.txt` holds serving dependencies only — 455MB installed against
1.3GB for the full `requirements.txt`. It omits torch, transformers, and spaCy, which
exist for building injury and news features during training. The live news endpoint
guards those imports and falls back to regex player linking and keyword sentiment, so
it still works without them.

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
