> **HISTORICAL** — This experiment used 2023-24 as holdout with 72 baseline features.
> Current best: Config D Stacked Ensemble (MAE=1.016, 145 features, 2024-25 holdout).
> See `outputs/experiments/` for current metrics.

# Baseline v1 (Frozen): FPL + Understat + LightGBM

## Purpose
Baseline v1 is the frozen structured-data reference model used throughout this project.
It serves as the comparison point for:
- multi-stream fusion models (injuries, news embeddings),
- ablation studies (RQ2),
- optimisation and UI experiments.

Once frozen, this baseline is not modified further.

---

## Data lineage (reproducible pipeline)

1. **Build base FPL table**
   - Command:  
     `python3 -m ml.pipelines.fpl.build_fpl_table`
   - Output:  
     `data/processed/merged/fpl_base.csv`

2. **Understat ingestion and GW aggregation**
   - Command:  
     `python3 -m ml.pipelines.runners.run_understat_all`
   - Outputs (key):
     - `data/processed/external/understat/understat_gw_<season>.csv`
     - fixture/team mappings in `data/processed/mappings/`

3. **Merge Understat into FPL**
   - Command:  
     `python3 -m ml.pipelines.merge.enrich_fpl_with_understat_all`
   - Output:  
     `data/processed/merged/fpl_base_enriched.csv`

4. **Create supervised target**
   - Command:  
     `python3 -m ml.pipelines.features.create_target`
   - Input:  
     `fpl_base_enriched.csv`
   - Output:  
     `data/processed/merged/fpl_with_target.csv`
   - Target variable:  
     `points_next_gw`

5. **Build baseline features**
   - Command:  
     `python3 -m ml.pipelines.features.build_baseline_features`
   - Output:  
     `data/features/baseline_features.csv`
   - Notes:
     - Lag features: `<col>_lag1`
     - Rolling mean features: `<col>_roll3`, `<col>_roll5`
     - All Understat features are automatically included via `us_*` columns

6. **Train and evaluate model**
   - Command:  
     `python3 -m ml.pipelines.train.train_baseline_model`
   - Artifacts:
     - `outputs/models/lgbm_baseline_v1.joblib`
     - `outputs/metrics/baseline_v1.json`
     - `outputs/metrics/baseline_v1_cv.csv`
     - `outputs/metrics/baseline_v1_feature_importance.csv`

---

## Feature streams included
- **S1 — FPL player statistics**
  - minutes, total_points, ICT, BPS, etc.
- **S2 — Understat statistics**
  - xG, xA, xGChain, xGBuildup (all `us_*` features)
- **Availability history**
  - lagged minutes/starts indicators

**Not included in this baseline:**
- explicit injury status,
- news or textual embeddings,
- neural fusion models.

---

## Model configuration
- Model: LightGBM Regressor
- Objective: regression (predict next-GW points)
- Trees: 800
- Learning rate: 0.05
- Categoricals:
  - season
  - position
  - team
  - opponent_team

---

## Evaluation protocol

### Rolling-season cross-validation
- Minimum training seasons: 3
- Fold structure:
  - Train on seasons `[1 … i-1]`
  - Test on season `[i]`
- Total folds: 7 (2019-20 → 2025-26)

### Final holdout evaluation
- Holdout season: **2023-24**
- Model trained on **all other seasons**
- Used as the primary generalisation metric

---

## Results

### Rolling-season CV (mean over 7 folds)

- **MAE (mean):** **1.1365**
- **RMSE (mean):** **2.0977**
- **MAE improvement vs zero baseline:** **+0.1037**
- **MAE improvement vs mean baseline:** **+0.4672**

This indicates stable learning across seasons and consistent improvement over trivial baselines.

---

### Final holdout performance (2023-24)

- **Model MAE:** **0.9991**
- **Model RMSE:** **1.9943**

Baselines:
- Zero baseline MAE: **1.0721**
- Mean baseline MAE: **1.5451** (mean prediction = **1.3038**)

Improvements:
- **MAE vs zero baseline:** **+0.0729**
- **MAE vs mean baseline:** **+0.5459**

---

## Notes on CV vs holdout discrepancy
The rolling CV fold corresponding to season 2023-24 yields a slightly higher MAE (~1.003)
than the final holdout MAE (0.9991).  
This difference is expected and arises because:
- rolling CV trains fold-specific models with season-dependent feature availability,
- the final holdout model is trained once on the full training set with a slightly larger
  effective feature set.

The difference is negligible (<0.01 MAE) and well within expected variance.

---

## Interpretation
- An MAE ≈ **1.0 FPL point** represents strong predictive performance given the stochastic
  nature of football outcomes.
- The large gap versus the mean baseline confirms the model learns meaningful structure.
- Remaining error is dominated by unobserved factors (injuries, rotation, late news),
  motivating the addition of further data streams in subsequent stages.

Baseline v1 therefore provides a strong, reproducible foundation for multi-stream
fusion experiments and user-facing decision support.
