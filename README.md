# Fantasy Foresight

Predicting Fantasy Premier League player points using a stacked ensemble (LightGBM + XGBoost + RF + Ridge) trained on 10 seasons of FPL data enriched with Understat xG stats, injury features, and Guardian news sentiment. Results are served through a React dashboard with SHAP explanations, team optimisation, and fixture analysis.

## Results

| Model | MAE | RMSE | Pearson r | Spearman ρ |
| ----- | --- | ---- | --------- | ---------- |
| Baseline LightGBM | 1.060 | — | — | — |
| + Injury features | 1.051 | — | — | — |
| + News features | 1.058 | — | — | — |
| **+ Both (Config D)** | **1.043** | **2.095** | **0.500** | **0.667** |

## Project Structure

```text
FYP/
├── ml/                     # ML pipeline (Python)
│   ├── config/             # Eval config, season definitions
│   ├── pipelines/
│   │   ├── features/       # Lag, rolling, momentum features (109 → 141)
│   │   ├── fpl/            # FPL API data processing
│   │   ├── understat/      # xG/xA scraping and mapping
│   │   ├── injury/         # Injury feature extraction (structured + NLP)
│   │   ├── news/           # Guardian articles → sentiment features
│   │   ├── train/          # Model training + ablation study
│   │   └── inference/      # Live prediction pipeline
│   ├── analysis/           # SHAP analysis
│   ├── evaluation/         # Comprehensive metrics
│   └── utils/              # IO, name normalisation, eval helpers
├── app/                    # React dashboard (Vite + Tailwind)
│   └── src/
│       ├── pages/          # 12 feature pages
│       ├── components/     # Reusable UI (badges, charts, pitch view)
│       ├── hooks/          # Data hooks (mock → API migration)
│       └── mocks/          # Mock datasets for development
├── api/                    # FastAPI backend (in progress)
├── outputs/                # Training outputs (metrics, SHAP, figures)
├── docs/                   # Literature review, evaluation report
├── notebooks/              # Experiment visualisations
└── data/                   # Raw + processed data (gitignored)
```

## Setup

```bash
# Python (ML pipeline)
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# Node (React app)
nvm use           # reads .nvmrc → Node 20
cd app && npm ci
```

## Usage

```bash
# Run the React dev server
cd app && npm run dev

# Run ML inference (requires live FPL API)
python -m ml.pipelines.inference.predict

# Run full training pipeline
make ml.full

# Linting
cd app && npm run lint          # JS (ESLint)
cd app && npm run format:check  # JS (Prettier)
ruff check ml/                  # Python (Ruff)
```

## Tech Stack

- **ML:** Python 3.10, LightGBM, XGBoost, scikit-learn, SHAP, spaCy, Transformers
- **App:** React 19, Vite 5, Tailwind CSS 3.4, React Router 7
- **CI:** GitHub Actions (4 parallel jobs: JS lint, test, build, Python lint)
