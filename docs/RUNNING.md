# Running the Project

## Prerequisites

* Python 3.10+
* Node.js 20.11.0+
* npm 10+

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

Note `requirements.txt` covers training and the full pipeline, so it pulls in heavy
NLP dependencies (torch, transformers, spaCy) that neither the API nor the snapshot
job needs. See [Deployment](#deployment) for the smaller files.

The backend starts without any trained models. It reads predictions from the
committed snapshot in `app/public/data/`.

## Running

### Backend (API server)

```bash
uvicorn api.main:app --reload
```

The API starts on `http://127.0.0.1:8000` in about a second, with no models loaded.
It serves two things: a manager's squad, which it fetches live from the FPL API, and
Guardian news, which cannot be stored. Predictions come from the snapshot on disk.

### Frontend (React dashboard)

```bash
cd app
npm run dev
```

Opens on `http://localhost:5173`. Most of the dashboard works without the backend,
because predictions, fixtures, player detail and model insights are read straight
from `app/public/data/`. Only **My Team** and **News** need the API running.

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
| `FPLENS_MODELS` | `showcase` | Which models to load. `showcase` is the nine-model published set, `all` is the full registry, or pass a comma-separated list of IDs. |
| `CORS_ORIGINS` | local Vite | Comma-separated allowed origins. Must include the deployed dashboard's URL. |
| `REFRESH_SECRET` | unset | Secret for `POST /api/refresh`. Unset disables the endpoint (503) rather than leaving a guessable default. |
| `FPLENS_SNAPSHOT_DIR` | `app/public/data` | Where the API reads predictions from. Override when the API is deployed apart from the site. |

`FPLENS_MODELS` applies to the snapshot job, not the API — the API loads no models at
all. The showcase set is nine models; `all` adds catboost_twohead, at roughly 350KB of
extra JSON (38KB gzipped) and 46MB in the release tarball.

## Deployment

Live now:

| Piece | URL | Host |
| ----- | --- | ---- |
| Dashboard | [fplens.abdelmalekmaskri18.workers.dev](https://fplens.abdelmalekmaskri18.workers.dev) | Cloudflare Workers |
| API | [fplens.onrender.com](https://fplens.onrender.com/api/health) | Render |
| Snapshot job | [Actions](https://github.com/abdelmalek-maskri/fplens/actions/workflows/snapshot.yml) | GitHub Actions |

Nothing here costs money. All three are on free plans.

### Three requirements files

Pick the smallest one that does the job.

| File | For | Leaves out |
| ---- | --- | ---------- |
| `requirements-api.txt` | serving | LightGBM, XGBoost, SHAP, scikit-learn, joblib (~200MB) |
| `requirements-job.txt` | `make snapshot` | torch, transformers, spaCy (~400MB) |
| `requirements.txt` | training | nothing, one flat freeze |

The API loads no models, which is why its file is the thin one. The job guards its
spaCy and transformers imports and falls back to regex player linking with keyword
sentiment, so news features still build without them.

### Dashboard on Cloudflare

The dashboard is a folder of files. There is no server, so there is nothing to keep
running and nothing to pay for.

| Setting | Value |
| ------- | ----- |
| Root directory | `app` |
| Build command | `npm run build` |
| Output directory | `dist` |

Set the root directory to `app`, not `/`. Left at the repo root, Cloudflare finds
`requirements.txt`, decides the project is Python, and installs torch and CUDA until
the build runs out of disk.

`app/wrangler.jsonc` sets `not_found_handling: single-page-application`. That makes
any unknown path return `index.html`, which React Router needs: the whole app is one
HTML file that reads the address and draws the right page. Without it, opening
`/transfers` directly returns 404, even though clicking through to it works.

**`VITE_API_URL` is a build variable, not a runtime one.** Vite writes its value
straight into the JavaScript bundle at build time. The running site never reads an
environment variable. So two things follow:

* It must be set as a **build** variable in Cloudflare, not a runtime one.
* Changing it does nothing until you rebuild and redeploy.

If the dashboard is calling `127.0.0.1:8000` in production, this is why. Check the
built bundle rather than the dashboard settings:

```bash
grep -o "https://[a-z0-9.-]*onrender[a-z.]*" app/dist/assets/*.js | head -1
```

Never put a secret in a `VITE_` variable. Anything with that prefix ships to every
visitor in plain text.

### API on Render

| Setting | Value |
| ------- | ----- |
| Build command | `pip install -r requirements-api.txt` |
| Start command | `uvicorn api.main:app --host 0.0.0.0 --port $PORT` |

`$PORT` is set by Render. Binding to a fixed port instead makes the deploy hang and
then time out, because Render waits for something to answer on the port it chose.

Environment variables to set:

| Variable | Value |
| -------- | ----- |
| `CORS_ORIGINS` | `https://fplens.abdelmalekmaskri18.workers.dev` |
| `GUARDIAN_API_KEY` | free key, for `/api/news` |
| `REFRESH_SECRET` | any long random string, or leave unset to disable `/api/refresh` |

`CORS_ORIGINS` has to match the browser's origin character for character: scheme,
host, no trailing slash, no path. `https://example.com/` fails against
`https://example.com`. Getting it wrong shows up only in the browser console as a
CORS error, never in the API logs, because the request does reach the server and the
browser throws the response away.

There is no default origin list beyond local Vite. A deployment that forgets this
breaks visibly rather than quietly allowing every site on the internet to call the API.

On the free plan the service sleeps after about 15 minutes with no traffic, so the
first request after a quiet period takes roughly a minute. Everything except **My
Team** and **News** is a static file, so a sleeping API does not stop the dashboard
from loading.

Visiting the API root returns 404. That is correct: every route lives under `/api`.
Use `/api/health` to check it is alive.

### Snapshot job on GitHub Actions

[`.github/workflows/snapshot.yml`](../.github/workflows/snapshot.yml) runs daily at
06:30 UTC, after FPL's overnight price changes. It rebuilds the snapshot and commits
it, which redeploys the dashboard.

Models are not in git. The job downloads them from a
[GitHub Release](https://github.com/abdelmalek-maskri/fplens/releases/tag/models-v1)
as a tarball. Publishing new models means uploading a new release asset, not pushing
to the repo.

One repository secret is needed: `GUARDIAN_API_KEY`. The push uses the built-in
`GITHUB_TOKEN`.

Two things about this file are deliberate and worth knowing:

* `persist-credentials: false` on checkout. The job runs `joblib.load`, which is
  arbitrary code execution by design, so no token should be sitting in `.git/config`
  while a pickle is being unpickled. The push step passes the token itself and it
  exists only for that step.
* `concurrency: snapshot`. Two runs would both try to push to the same branch. They
  queue instead of racing.

**Scheduled workflows only run from the default branch.** The file has to be merged
to `main` before it will ever fire. Sitting on a feature branch it is valid, visible
in the Actions tab, and completely inert. Use the `workflow_dispatch` trigger to test
it by hand first.

## Tests

```bash
# Python lint
ruff check ml/ api/ job/

# Frontend tests (99)
cd app && npm run test

# Python tests (113) — from the project root
python3 -m pytest -q

# API tests only
python3 -m pytest api/tests -q
```

Always use `python3 -m pytest` rather than bare `pytest`: the `-m` form puts the project
root on `sys.path`, which the `api.*`, `job.*` and `ml.*` imports rely on.

CI runs all of this: frontend lint, format, tests and build, plus `ruff` and the Python
tests on `ml/`, `api/` and `job/`. It installs `requirements-job.txt` and
`requirements-api.txt` together, which is how `job/tests/test_dependencies.py` earns its
keep: it fails if `job/` ever imports FastAPI again. That import once broke the scheduled
job while every test still passed locally.
