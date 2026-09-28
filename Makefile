# FPLens
#
# make          list the targets below
# make dev      run the site locally
# make test     run everything
#
# Three groups: develop, operate (what the daily job runs), train.

.DEFAULT_GOAL := help

.PHONY: help
help:
	@grep -E '^[a-zA-Z0-9._-]+:.*## ' $(MAKEFILE_LIST) \
		| sed 's/:.*## /\t/' \
		| awk -F'\t' '{printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# --- Develop ---------------------------------------------------------------

.PHONY: api.run web.dev dev test test.api test.job web.build web.lint

# Two endpoints, no models. The dashboard reads app/public/data directly, so it
# works without this running; only My Team and News need it.
api.run: ## Start the API on :8000
	uvicorn api.main:app --reload --port 8000

web.dev: ## Start the dashboard on :5173
	cd app && npm run dev

# trap + wait, not a bare `&`. Backgrounding the API without them left uvicorn
# holding :8000 after Ctrl-C, so the next run failed with "address already in use".
dev: ## Run both, and stop both on Ctrl-C
	@trap 'kill 0' EXIT INT TERM; \
	$(MAKE) api.run & $(MAKE) web.dev; \
	wait

# python -m pytest (not bare pytest) so the project root lands on sys.path
# and the api.* / job.* / ml.* package imports resolve.
test: ## Run the Python tests
	python3 -m pytest api/tests job/tests -q

test.api: ## Python tests for the API only
	python3 -m pytest api/tests -q

test.job: ## Python tests for the job only
	python3 -m pytest job/tests -q

web.build: ## Build the dashboard
	cd app && npm run build

web.lint: ## Lint the dashboard
	cd app && npm run lint

# --- Operate ---------------------------------------------------------------
# What the daily GitHub Action runs, in this order.

.PHONY: snapshot accuracy

snapshot: ## Rebuild the site's JSON (~800 FPL calls, ~40s, needs models)
	python3 -m job.snapshot

accuracy: ## Score the last finished gameweek (2 FPL calls, no models needed)
	python3 -m job.accuracy

# --- Train -----------------------------------------------------------------
# Each step reads the previous one's output from disk, so the order is fixed.

.PHONY: ml.fpl ml.understat ml.target ml.features.baseline ml.features.extended
.PHONY: ml.injury ml.news ml.news.fetch ml.news.link ml.news.features ml.news.merge
.PHONY: ml.train.baseline ml.train.ablation ml.train.all ml.shap ml.predict
.PHONY: ml.data ml.full baseline_v1

ml.fpl: ## 1. Build the base FPL table from raw gameweek CSVs
	python3 -m ml.pipelines.fpl.build_fpl_table

# run_data_pipeline covers the whole FPL + Understat chain, including the ml.fpl
# build above, so running it alone is enough.
ml.understat: ## 2. Fetch Understat, map players and fixtures, merge
	python3 -m ml.pipelines.runners.run_data_pipeline

ml.target: ## 3. Create the prediction target
	python3 -m ml.pipelines.features.create_target

ml.features.baseline: ## 4a. Lag-1, roll-3, roll-5 only
	python3 -m ml.pipelines.features.build_baseline_features

ml.features.extended: ## 4b. Adds roll-10, season averages, momentum
	python3 -m ml.pipelines.features.build_extended_features

ml.injury: ## 5. Injury features, reconstructed from git history
	python3 -m ml.pipelines.injury.download_historical
	python3 -m ml.pipelines.injury.merge_with_fpl
	python3 -m ml.pipelines.injury.build_injury_features

ml.news.fetch:
	python3 -m ml.pipelines.news.fetch_guardian

ml.news.link:
	python3 -m ml.pipelines.news.link_articles_to_players

ml.news.features:
	python3 -m ml.pipelines.news.build_news_features

# merge_with_features writes the four ablation tables, so this has to finish
# before training: config_C and config_D have nothing to read without it.
ml.news.merge:
	python3 -m ml.pipelines.news.merge_with_features

ml.news: ml.news.fetch ml.news.link ml.news.features ml.news.merge ## 6. Guardian news features (needs GUARDIAN_API_KEY)

ml.train.baseline: ## 7a. Single LightGBM
	python3 -m ml.pipelines.train.train_baseline_model

ml.train.ablation: ## 7b. The A/B/C/D ablation, which produces the production model
	python3 -m ml.pipelines.train.run_injury_ablation

# The ablation runs last because it needs the injury and news feature tables.
ml.train.all: ## 7c. Every model in job/models.py's MODEL_REGISTRY
	python3 -m ml.pipelines.train.train_baseline_model
	python3 -m ml.pipelines.train.train_baseline_tweedie
	python3 -m ml.pipelines.train.train_twohead_model
	python3 -m ml.pipelines.train.train_catboost_twohead
	python3 -m ml.pipelines.train.train_position_specific
	python3 -m ml.pipelines.train.train_stacked_ensemble
	python3 -m ml.pipelines.train.run_injury_ablation

ml.shap: ## 8. SHAP importances for the Model Insights page
	python3 -m ml.analysis.shap_analysis

ml.predict: ## Predict once from the live API, without writing the snapshot
	python3 -m job.predict

# --- Composite -------------------------------------------------------------

ml.data: ml.fpl ml.understat ml.target ml.features.extended ml.injury ml.news ## Steps 1-6: everything up to training
ml.full: ml.data ml.train.all ## Steps 1-7: data, features, and every model

baseline_v1: ml.fpl ml.understat ml.target ml.features.baseline ml.train.baseline ## The original single-model pipeline
