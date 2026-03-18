> **HISTORICAL** — Superseded by Config D Stacked Ensemble (MAE=1.016).
> See `outputs/experiments/` for current metrics.

# Experiment 001: Two-Stage Classification-Regression Model

**Status:** Completed (No Improvement)
**Date:** 2026-01-21
**Branch:** `feature/eval-baselines-stratification`
**Git Commit:** `60c10d8`

---

## 1. Motivation

### 1.1 Problem Statement

Analysis of the baseline model (`baseline_v1`) revealed a **mixture problem** in the prediction task:

- **61.5%** of test samples are players who didn't play (scored 0 points)
- **38.5%** of test samples are players who played (scored 1+ points)

The baseline model achieves:
- **Full sample MAE: 0.999**
- **Played-only MAE: 2.005** (much harder)
- **Not-played MAE: 0.370** (easy - just predict ~0)

This suggests the prediction task has two distinct sub-problems:
1. **Selection uncertainty:** Will the player play?
2. **Performance prediction:** How many points if they play?

### 1.2 Hypothesis

A two-stage model that explicitly separates these sub-problems should outperform the single-stage baseline by:
1. Learning better "who plays" features in Stage 1
2. Training Stage 2 only on played samples for better point prediction
3. Combining predictions to avoid wasting capacity on the "easy" not-played predictions

### 1.3 Research Question

> Can explicitly decomposing the FPL prediction task into classification (will play?) + regression (points if played) improve overall MAE compared to direct regression?

---

## 2. Methodology

### 2.1 Model Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TWO-STAGE MODEL                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────┐                                       │
│  │  STAGE 1: Classifier     │                                       │
│  │  LGBMClassifier          │                                       │
│  │  Target: will_play_next  │  ──────► P(play) ∈ [0,1]              │
│  │  (binary: played or not) │                                       │
│  └──────────────────────────┘                                       │
│                                                                      │
│  ┌──────────────────────────┐                                       │
│  │  STAGE 2: Regressor      │                                       │
│  │  LGBMRegressor           │                                       │
│  │  Target: points_next_gw  │  ──────► points_if_played ∈ ℝ         │
│  │  Train on: played only   │                                       │
│  └──────────────────────────┘                                       │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  COMBINATION METHODS                                          │   │
│  │                                                               │   │
│  │  Hard Threshold:                                              │   │
│  │    pred = points_if_played  if P(play) > 0.5  else 0         │   │
│  │                                                               │   │
│  │  Soft Blending:                                               │   │
│  │    pred = P(play) × points_if_played                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Stage 1: Play Classifier

**Objective:** Predict whether a player will participate in the next gameweek.

**Target Variable:** `will_play_next = (points_next_gw > 0)` (binary)

**Model Configuration:**
```python
LGBMClassifier(
    n_estimators=500,
    learning_rate=0.05,
    num_leaves=63,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    objective="binary",
    metric="auc",
)
```

**Training Data:** All rows (174,223 samples)

### 2.3 Stage 2: Points Regressor

**Objective:** Predict FPL points given that the player plays.

**Target Variable:** `points_next_gw` (integer)

**Model Configuration:**
```python
LGBMRegressor(
    n_estimators=800,
    learning_rate=0.05,
    num_leaves=63,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
)
```

**Training Data:** Only played rows (72,832 samples, 41.8% of total)

### 2.4 Prediction Methods

**Method A: Hard Threshold (τ = 0.5)**
```
final_pred = stage2_pred  if stage1_prob > 0.5  else 0
```

Intuition: Binary decision - either player plays (use regression) or doesn't (predict 0).

**Method B: Soft Blending**
```
final_pred = stage1_prob × stage2_pred
```

Intuition: Weight predicted points by probability of playing. If 80% likely to play and predicted 5 points, output 4 points.

### 2.5 Evaluation Protocol

Same as baseline:
- **Rolling-season CV:** 7 folds (train on seasons 1..i-1, test on season i)
- **Holdout evaluation:** Train on all except 2023-24, test on 2023-24
- **Primary metric:** MAE on full test sample

---

## 3. Results

### 3.1 Holdout Performance (Season 2023-24)

| Metric | Baseline v1 | Two-Stage Hard | Two-Stage Soft | Delta (Soft) |
|--------|-------------|----------------|----------------|--------------|
| **Full Sample MAE** | **0.999** | 1.061 | 1.001 | **+0.002** |
| Full Sample RMSE | 1.994 | 2.078 | 1.986 | -0.008 |
| Played-only MAE | 2.005 | 2.227 | **1.960** | **-0.045** |
| Not-played MAE | 0.370 | 0.427 | 0.480 | +0.110 |

### 3.2 Stage 1 Classification Metrics

| Metric | Value |
|--------|-------|
| **AUC-ROC** | **0.903** |
| Accuracy | 0.835 |
| Precision | 0.752 |
| Recall | 0.792 |
| F1 Score | 0.772 |

The classifier achieves excellent discrimination (AUC=0.90), meaning it can reliably distinguish players who will play from those who won't.

### 3.3 Rolling Cross-Validation Results

| Test Season | Stage 1 AUC | MAE Hard | MAE Soft | Played MAE (Soft) |
|-------------|-------------|----------|----------|-------------------|
| 2019-20 | 0.877 | 1.374 | 1.305 | 2.017 |
| 2020-21 | 0.886 | 1.214 | 1.176 | 2.014 |
| 2021-22 | 0.883 | 1.214 | 1.167 | 2.059 |
| 2022-23 | 0.901 | 1.149 | 1.090 | 1.905 |
| 2023-24 | 0.900 | 1.056 | 1.006 | 1.966 |
| 2024-25 | 0.894 | 1.168 | 1.100 | 1.859 |
| 2025-26 | 0.906 | 1.113 | 1.085 | 1.986 |
| **Mean** | **0.892** | **1.184** | **1.133** | **1.972** |

### 3.4 Baseline Comparison Summary

| Method | Full MAE | vs Baseline | Verdict |
|--------|----------|-------------|---------|
| Baseline v1 | 0.999 | — | Reference |
| Two-Stage Hard | 1.061 | +0.062 (worse) | ❌ Rejected |
| Two-Stage Soft | 1.001 | +0.002 (tied) | ❌ No improvement |

---

## 4. Analysis

### 4.1 Why Didn't Two-Stage Improve?

**Finding 1: Baseline already captures "who plays" signal**

The baseline model implicitly learns play prediction through features like:
- `played_lag1` (binary: played last GW)
- `minutes_lag1`, `starts_lag1` (availability history)
- `minutes_roll5` (recent playing time trend)

Feature importance in baseline shows these features are used, meaning joint optimization already captures both sub-problems.

**Finding 2: Trade-off in error distribution**

| Subset | Baseline MAE | Soft MAE | Change |
|--------|--------------|----------|--------|
| Played only | 2.005 | 1.960 | -2.2% ✓ |
| Not-played only | 0.370 | 0.480 | +29.7% ✗ |

Soft blending **improves** played-only predictions but **degrades** not-played predictions. Since 61.5% of samples are not-played, this trade-off hurts overall MAE.

**Finding 3: Hard threshold too aggressive**

Hard threshold predicts exactly 0 for P(play) < 0.5, losing nuance. Players with P(play)=0.4 who do play get 0 predicted, causing large errors.

**Finding 4: Soft blending underestimates played samples**

For a player with P(play)=0.8 predicted to score 5 points:
- Actual if played: 5 points
- Soft prediction: 0.8 × 5 = 4 points
- Error: 1 point (systematic underestimation)

This multiplicative formulation inherently underestimates for players who do play.

### 4.2 Feature Importance Comparison

**Stage 1 (Classification) - Top 10:**
1. team (2748)
2. opponent_team (1620)
3. value (1411)
4. GW (1263)
5. creativity_roll5 (723)
6. minutes_roll5 (688)
7. us_xgchain_roll5 (679)
8. us_time_roll5 (676)
9. influence_roll5 (664)
10. ict_index_roll5 (622)

**Stage 2 (Regression) - Top 10:**
1. team (3805)
2. opponent_team (3246)
3. GW (1663)
4. value (1390)
5. us_xgbuildup_roll5 (1138)
6. us_xgchain_lag1 (1100)
7. us_xgbuildup_roll3 (1070)
8. us_xgchain_roll3 (1047)
9. influence_roll5 (1032)
10. bps_roll5 (1016)

**Observation:** Both stages heavily rely on team/opponent context. Stage 1 prioritizes availability signals (minutes_roll5), while Stage 2 prioritizes performance metrics (xgbuildup, bps).

### 4.3 When Does Two-Stage Help?

Looking at the played-only MAE improvement (1.960 vs 2.005), the two-stage approach **does** better predict points for players who actually play. This could be valuable for:

1. **Conditional predictions:** "If player X plays, they'll score Y points"
2. **Risk assessment:** Separating selection uncertainty from performance uncertainty
3. **User-facing explanations:** "70% chance to play, expected 4.2 points if selected"

However, for the **unconditional prediction task** (predict points regardless of whether they play), the simpler baseline performs equally well.

---

## 5. Conclusions

### 5.1 Main Finding

> **The two-stage decomposition does not improve overall MAE** because the baseline model already implicitly learns both sub-problems through joint optimization. Explicitly separating them introduces a trade-off that slightly hurts performance on the majority class (not-played samples).

### 5.2 Secondary Findings

1. **Play prediction is highly achievable** (AUC=0.90) using historical features
2. **Played-only prediction improves** with stage-specific training (-2.2% MAE)
3. **Soft blending outperforms hard threshold** in all scenarios
4. **Team/opponent context dominates** both classification and regression

### 5.3 Recommendations

1. **Keep baseline v1** as the primary model for point prediction
2. **Consider two-stage for interpretability** if user-facing explanations are needed
3. **Explore hybrid approaches:** Use Stage 1 probability as an additional feature for baseline
4. **Alternative decomposition:** Position-specific models or injury-aware models may be more effective

---

## 6. Reproducibility

### 6.1 Code Implementation

The experiment was implemented in:
- `ml/pipelines/train/train_twostage_model.py` (main training script)
- `ml/pipelines/features/build_baseline_features.py` (added `will_play_next` column)
- `ml/config/mlflow_config.py` (MLflow tracking configuration)

**Note:** These changes were **not merged** into main as they showed no improvement.

### 6.2 Artifacts

All experiment artifacts are preserved in:
```
outputs/experiments/twostage/
├── models/
│   ├── stage1_classifier.joblib    # Trained LGBMClassifier
│   └── stage2_regressor.joblib     # Trained LGBMRegressor
├── metrics/
│   ├── experiment.json             # Full holdout metrics
│   ├── rolling_cv.csv              # Per-fold CV results
│   ├── feature_importance_s1.csv   # Stage 1 feature importance
│   └── feature_importance_s2.csv   # Stage 2 feature importance
```

### 6.3 MLflow Tracking

Experiment tracked in MLflow:
```bash
mlflow ui --backend-store-uri file:./mlruns --port 5000
```

Experiment: `fpl-prediction`
Run: `twostage_v1`

### 6.4 Key Parameters

| Parameter | Value |
|-----------|-------|
| Stage 1 estimators | 500 |
| Stage 2 estimators | 800 |
| Learning rate | 0.05 |
| Num leaves | 63 |
| Hard threshold | 0.5 |
| Holdout season | 2023-24 |
| Random seed | 42 |

---

## 7. Appendix

### 7.1 Full Holdout Metrics

```json
{
  "stage1_auc": 0.9028,
  "stage1_accuracy": 0.8349,
  "stage1_precision": 0.7525,
  "stage1_recall": 0.7920,
  "stage1_f1": 0.7717,
  "mae_full_hard": 1.0609,
  "mae_full_soft": 1.0013,
  "rmse_full_hard": 2.0784,
  "rmse_full_soft": 1.9860,
  "mae_played_hard": 2.2266,
  "mae_played_soft": 1.9598,
  "mae_not_played_hard": 0.4268,
  "mae_not_played_soft": 0.4799,
  "n_train": 174223,
  "n_train_played": 72832,
  "n_test": 27999,
  "n_test_played": 9865,
  "pct_test_played": 35.23,
  "baseline_mae": 0.9991,
  "delta_vs_baseline_hard": -0.0618,
  "delta_vs_baseline_soft": -0.0022
}
```

### 7.2 Sample Distribution

| Split | Total | Played | Not Played | % Played |
|-------|-------|--------|------------|----------|
| Train | 174,223 | 72,832 | 101,391 | 41.8% |
| Test | 27,999 | 9,865 | 18,134 | 35.2% |

### 7.3 Related Work

This experiment was motivated by findings from the mixture diagnostic analysis in baseline v1, which showed:
- Oracle baseline (perfect play knowledge + mean prediction): MAE = 0.995
- Gap from model to oracle: 0.004

The small oracle gap suggested that knowing "who plays" wouldn't dramatically improve predictions, which this experiment confirmed.

---

## 8. Citation

If referencing this experiment in reports:

> Maskri, A. (2026). Experiment 001: Two-Stage Classification-Regression Model for FPL Point Prediction. FYP Internal Documentation. Result: No improvement over baseline (MAE 1.001 vs 0.999).
