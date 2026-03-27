# Running the Project

## Prerequisites

- Python 3.10+
- Node.js 20.11.0+
- npm 10+

## Setup

```bash
# Clone the repository
git clone https://git.cs.bham.ac.uk/projects-2025-26/axm1962.git
cd axm1962

# Install Python dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd app && npm install && cd ..
```

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

Only the essential models are committed to the repository:

- **Config D** (`outputs/experiments/ablation/config_D/model.joblib`) — the production stacked ensemble
- **GW+2 horizon** (`outputs/experiments/multi_horizon/gw2/lgbm_reduced/model.joblib`)
- **GW+3 horizon** (`outputs/experiments/multi_horizon/gw3/lgbm_reduced/model.joblib`)
- **Ablation summaries** and **SHAP reports** for the Model Insights page

Other models (baseline, two-head, position-specific, etc...) can be reproduced by running the training scripts in `ml/pipelines/train/`. The full data pipeline is in `ml/pipelines/` and runs in dependency order — see `ml/pipelines/runners/run_data_pipeline.py` for the execution sequence.

## Optional

- Set `GUARDIAN_API_KEY` environment variable (from [The Guardian Open Platform](https://open-platform.theguardian.com)) for live news sentiment features. Without it, news features are zero-filled at inference.

## Tests

```bash
# ML linting
ruff check ml/

# Frontend tests
cd app && npm run test

# API tests
python -m pytest api/tests/ -v
```
