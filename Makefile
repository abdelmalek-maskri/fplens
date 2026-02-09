# ==============================================================================
# Fantasy Foresight - Makefile
# ==============================================================================

# --- Development servers ---

.PHONY: api.run web.dev dev test

api.run:
	cd api && uvicorn main:app --reload --port 8000

web.dev:
	cd app && npm run dev

dev:
	@echo "Starting API and frontend..."
	$(MAKE) api.run &
	$(MAKE) web.dev

# --- Tests ---

test:
	cd api && pytest -q

test.api:
	cd api && pytest -q

web.build:
	cd app && npm run build

web.lint:
	cd app && npm run lint

# --- ML Pipeline: Full reproduction from raw data ---
# Run stages in order. Each depends on the previous.

# Stage 1: Build base FPL table from raw GW CSVs
.PHONY: ml.fpl
ml.fpl:
	python3 -m ml.pipelines.fpl.build_fpl_table

# Stage 2: Fetch Understat data, build mappings, merge with FPL
.PHONY: ml.understat
ml.understat:
	python3 -m ml.pipelines.runners.run_understat_all

# Stage 3: Create prediction target (points_next_gw)
.PHONY: ml.target
ml.target:
	python3 -m ml.pipelines.features.create_target

# Stage 4: Build features
.PHONY: ml.features.baseline ml.features.extended
ml.features.baseline:
	python3 -m ml.pipelines.features.build_baseline_features

ml.features.extended:
	python3 -m ml.pipelines.features.build_extended_features

# Stage 5: Injury pipeline
.PHONY: ml.injury
ml.injury:
	python3 -m ml.pipelines.injury.download_historical
	python3 -m ml.pipelines.injury.merge_with_fpl
	python3 -m ml.pipelines.injury.build_injury_features

# Stage 6: Training
.PHONY: ml.train.baseline ml.train.ablation ml.train.all
ml.train.baseline:
	python3 -m ml.pipelines.train.train_baseline_model

ml.train.ablation:
	python3 -m ml.pipelines.train.run_ablation

ml.train.all:
	python3 -m ml.pipelines.train.train_baseline_model
	python3 -m ml.pipelines.train.run_ablation
	python3 -m ml.pipelines.train.train_twohead_model
	python3 -m ml.pipelines.train.train_stacked_ensemble
	python3 -m ml.pipelines.train.train_position_specific

# Stage 6b: Injury ablation study (A vs B, later + C, D)
.PHONY: ml.ablation.injury
ml.ablation.injury:
	python3 -m ml.pipelines.train.run_injury_ablation

# Stage 7: Inference (requires live FPL API)
.PHONY: ml.predict
ml.predict:
	python3 -m ml.pipelines.inference.predict

# Stage 8: Analysis (optional)
.PHONY: ml.shap
ml.shap:
	python3 -m ml.analysis.shap_analysis

# --- Composite targets ---

# Baseline pipeline (original make baseline_v1)
.PHONY: baseline_v1
baseline_v1: ml.fpl ml.understat ml.target ml.features.baseline ml.train.baseline

# Full pipeline: data → features → all models
.PHONY: ml.full
ml.full: ml.fpl ml.understat ml.target ml.features.extended ml.injury ml.train.all

# Data only (no training)
.PHONY: ml.data
ml.data: ml.fpl ml.understat ml.target ml.features.extended ml.injury
