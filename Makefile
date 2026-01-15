.PHONY: api.run web.dev test

api.run:
	cd api && uvicorn main:app --reload --port 8000

web.dev:
	cd app && npm run dev

test:
	cd api && pytest -q

.PHONY: baseline_v1

baseline_v1:
	python3 -m ml.pipelines.fpl.build_fpl_table
	python3 -m ml.pipelines.runners.run_understat_all
	python3 -m ml.pipelines.merge.enrich_fpl_with_understat_all
	python3 -m ml.pipelines.features.create_target
	python3 -m ml.pipelines.features.build_baseline_features
	python3 -m ml.pipelines.train.train_baseline_model

