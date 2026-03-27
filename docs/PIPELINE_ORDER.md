# ML Pipeline Execution Order

Scripts must run in this order. Each step reads from disk outputs of previous steps.

## Prerequisites

```bash
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

Raw FPL data must be in `data/raw/fpl/` (vaastav's Fantasy-Premier-League repo as a git submodule in `external/vaastav_fpl`).

## Phase 1: FPL Data Processing

```bash
# Step 1: Extract gameweek date windows (kickoff times for temporal alignment)
python -m ml.pipelines.fpl.build_gw_windows

# Step 2: Build base dataset (246K rows × 39 columns across 10 seasons)
python -m ml.pipelines.fpl.build_fpl_table

# Step 3: Extract fixture table (home/away teams, kickoff times)
python -m ml.pipelines.fpl.build_fpl_fixtures_from_gws
```

## Phase 2: Understat Integration

```bash
# Step 4: Build team name and fixture-to-GW mappings
python -m ml.pipelines.mappings.build_team_name_map
python -m ml.pipelines.mappings.build_fixture_to_gw

# Step 5: Scrape Understat (~5000 async API calls, ~10 min)
python -m ml.pipelines.understat.fetch_understat

# Step 6: Match Understat matches to FPL fixtures (by date + team name)
python -m ml.pipelines.understat.understat_map_fixture

# Step 7: Add gameweek numbers to Understat matches
python -m ml.pipelines.understat.understat_add_gw_by_fixture

# Step 8: Match FPL players to Understat players (name matching)
python -m ml.pipelines.mappings.build_fpl_understat_mapping

# Step 9: Aggregate Understat to per-player-per-GW level
python -m ml.pipelines.understat.build_understat_gw

# Step 10: Merge FPL + Understat into unified table
python -m ml.pipelines.merge.enrich_fpl_with_understat_all
```

Or run Steps 5-10 together:
```bash
python -m ml.pipelines.runners.run_data_pipeline
```

## Phase 3: Feature Engineering

```bash
# Step 11: Create target variable (points_next_gw via shift)
python -m ml.pipelines.features.create_target

# Step 12: Baseline features (lag-1, roll-3, roll-5 = 71 features)
python -m ml.pipelines.features.build_baseline_features

# Step 13: Extended features (+roll-10, season avg, momentum = 116 features)
python -m ml.pipelines.features.build_extended_features

# Step 14: Future fixture features (opponent_gw2/3, FDR for multi-horizon)
python -m ml.pipelines.features.build_future_fixtures
```

## Phase 4: Injury & News Features

```bash
# Step 15: Download historical injury snapshots from vaastav Git commits
python -m ml.pipelines.injury.download_historical

# Step 16: Merge injury data with FPL (+1 GW shift for leakage prevention)
python -m ml.pipelines.injury.merge_with_fpl

# Step 17: Engineer 32 injury features (structured + NLP)
python -m ml.pipelines.injury.build_injury_features

# Step 18: Fetch Guardian articles (requires GUARDIAN_API_KEY)
python -m ml.pipelines.news.fetch_guardian

# Step 19: Link articles to FPL players (spaCy NER + regex)
python -m ml.pipelines.news.link_articles_to_players

# Step 20: Build 7 per-player-per-GW news features
python -m ml.pipelines.news.build_news_features

# Step 21: Merge all features into 4 ablation configs (A/B/C/D)
python -m ml.pipelines.news.merge_with_features
```

## Phase 5: Model Training

```bash
# Baseline models
python -m ml.pipelines.train.train_baseline_model       # Single LightGBM (71 features)
python -m ml.pipelines.train.train_baseline_tweedie      # LightGBM with Tweedie loss
python -m ml.pipelines.train.train_position_specific     # 4 positional LightGBMs
python -m ml.pipelines.train.train_twohead_model         # Classifier + regressor
python -m ml.pipelines.train.train_catboost_twohead      # CatBoost two-head variant
python -m ml.pipelines.train.train_stacked_ensemble      # 6-base stacked ensemble

# Ablation study (trains Config A/B/C/D on same architecture)
python -m ml.pipelines.train.run_injury_ablation

# Multi-horizon experiments (GW+1/2/3, multiple configs)
python -m ml.pipelines.train.train_multi_horizon
```

## Phase 6: Evaluation & Analysis

```bash
# Comprehensive metrics for each trained model
python -m ml.evaluation.comprehensive_metrics

# SHAP feature importance analysis
python -m ml.analysis.shap_analysis
```

## Phase 7: Inference (Live)

These run automatically when the API server starts:

```bash
# Start the API (loads models, fetches live data on first request)
uvicorn api.main:app --reload

# Or run inference standalone
python -m ml.pipelines.inference.predict
```
