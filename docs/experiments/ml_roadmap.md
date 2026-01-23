# ML Engineering Roadmap: FPL Prediction

## Executive Summary

**Current State:**
- Baseline MAE: **0.999** (LightGBM, 2023-24 holdout)
- Experiments 001-002 failed (Two-Stage, Position-Specific)
- Experiment 003 (Simple Ensemble) running

**Critical Insight:**
Your model barely outperforms a "played-conditional mean" baseline (MAE 0.989). Most of the model's value comes from predicting **who will play**, not predicting scores for played players.

**Target:** MAE < 0.98 with improved played-player predictions

---

## Phase 1: Evaluation & Baseline Audit (Immediate)

### 1.1 Implement Comprehensive Evaluation ✓

**File:** `ml/evaluation/comprehensive_metrics.py`

New metrics:
- Stratified MAE (played/not-played, by position)
- High-return player MAE (≥5 points)
- Calibration analysis
- Business metrics (captain pick accuracy)
- Stability across seasons

### 1.2 Audit Baseline Against Smart Baselines

Current naive baselines are too weak. Add:

| Baseline | Description | Expected MAE |
|----------|-------------|--------------|
| Played-conditional mean | Predict pos-mean if played, 0 otherwise | ~0.989 |
| Player-specific roll5 | Predict player's 5-game average | ~1.02 |
| Last-week points | Predict lag-1 points | ~1.05 |

**Key question:** How much does the model improve over player-specific baselines?

---

## Phase 2: Ensemble Methods (Current)

### 2.1 Simple Ensemble (Running - Exp 003)

- LightGBM × 5 seeds
- XGBoost × 5 seeds
- RandomForest × 5 seeds
- Combination: mean, median, weighted

**Expected outcome:** 0-2% improvement over baseline

### 2.2 Stacked Ensemble (Exp 003b) ✓

**File:** `ml/pipelines/train/train_stacked_ensemble.py`

Architecture:
```
Level 0: LightGBM, LightGBM-v2, XGBoost, RF, Ridge, Played-Classifier
Level 1: Ridge meta-learner on OOF predictions
```

Key improvements:
- Out-of-fold predictions prevent leakage
- Played-probability as explicit signal
- Meta-learner learns optimal weights
- Diverse base learners (trees + linear)

**Expected outcome:** 1-3% improvement

### 2.3 Position-Ensemble Hybrid (Future)

Combine position-specific ensembles:
- Train ensemble per position (like OpenFPL)
- Use 10+ models per position
- Median aggregation (robust to outliers)

---

## Phase 3: Feature Engineering (High Impact)

### 3.1 Extended Time Windows

**Current:** lag1, roll3, roll5
**Add:** roll10, season_avg

```python
# Implementation
for window in [10]:
    for col in numeric_cols:
        df[f"{col}_roll{window}"] = df.groupby("element")[col].transform(
            lambda x: x.rolling(window, min_periods=1).mean()
        )

# Season average (all games in current season)
df[f"{col}_season_avg"] = df.groupby(["element", "season"])[col].transform("mean")
```

**Expected impact:** MEDIUM (captures form cycles)

### 3.2 Opponent Strength Features

**Current:** `opponent_team` categorical only
**Add:**

```python
# Team defensive strength
opponent_goals_conceded_roll5 = df.groupby("opponent_team")["goals_conceded"].transform(
    lambda x: x.rolling(5, min_periods=1).mean()
)

# Team clean sheet rate
opponent_cs_rate_roll5 = df.groupby("opponent_team")["clean_sheet"].transform(
    lambda x: x.rolling(5, min_periods=1).mean()
)

# FPL Fixture Difficulty Rating (from API)
fdr = df["fdr"]  # 1-5 scale
```

**Expected impact:** MEDIUM (especially for DEF/GK clean sheets)

### 3.3 Team Form Features

```python
# Team points last 5 games
team_form = df.groupby("team")["team_points"].transform(
    lambda x: x.rolling(5, min_periods=1).mean()
)

# Team goals scored
team_attack_form = df.groupby("team")["team_goals"].transform(
    lambda x: x.rolling(5, min_periods=1).mean()
)
```

**Expected impact:** MEDIUM

### 3.4 Availability/Injury Features

This is the HIGHEST IMPACT missing feature:

```python
# Consecutive starts (momentum)
consecutive_starts = df.groupby("element")["starts"].transform(
    lambda x: (x * (x.groupby((x != x.shift()).cumsum()).cumcount() + 1))
)

# Minutes trend (increasing = more likely to play)
minutes_trend = df.groupby("element")["minutes"].transform(
    lambda x: x.diff().rolling(3).mean()
)

# Rest days (congestion indicator)
# Would need fixture dates - not currently available
```

**Expected impact:** HIGH (directly addresses played prediction)

---

## Phase 4: Model Interpretability

### 4.1 SHAP Analysis

```python
import shap

# Global importance
explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X_test)

# Position-specific insights
for pos in ["GK", "DEF", "MID", "FWD"]:
    mask = positions == pos
    shap.summary_plot(shap_values[mask], X_test[mask], title=f"{pos} SHAP")
```

**Purpose:**
- Identify redundant features for pruning
- Understand position-specific patterns
- Build trust for research report

### 4.2 Error Analysis

```python
# Where does the model fail?
errors = y_true - y_pred

# High-error cases
high_errors = test_df[np.abs(errors) > 3]  # >3 point error

# Analyze patterns
print(high_errors.groupby("position").size())
print(high_errors.groupby("team").size())
print(high_errors["total_points_lag1"].describe())
```

---

## Phase 5: Research Alignment

### 5.1 Multi-Modal Fusion Preparation

Your goal is future multi-modal integration. Current architecture should:

1. **Modular features:** Separate feature modules for FPL, Understat, future sources
2. **Ensemble-ready:** Base learners can incorporate new modalities
3. **Clean interfaces:** Standard fit/predict API for all models

### 5.2 Experiment Tracking

Current tracking is good. Enhance with:

```python
# MLflow or Weights & Biases integration
import mlflow

mlflow.log_params({...})
mlflow.log_metrics({...})
mlflow.log_artifact("models/ensemble.joblib")
```

---

## Prioritized Next Steps

| Priority | Task | Expected Impact | Effort |
|----------|------|-----------------|--------|
| 1 | Wait for Exp 003 results | Baseline for ensemble | Low |
| 2 | Run stacked ensemble (Exp 003b) | 1-3% improvement | Low |
| 3 | Add comprehensive evaluation | Better metrics | Medium |
| 4 | Add roll10 + season_avg features | 1-2% improvement | Low |
| 5 | Add opponent strength features | 1-2% improvement | Medium |
| 6 | SHAP interpretability | Research value | Medium |
| 7 | Position-ensemble hybrid | 2-4% improvement | High |

---

## Success Criteria

| Metric | Current | Target | SOTA Reference |
|--------|---------|--------|----------------|
| Holdout MAE | 0.999 | <0.98 | OpenFPL: ~0.95* |
| Played-only MAE | 2.005 | <1.95 | Key improvement area |
| High-return MAE | ~4.0 | <3.5 | Critical for captains |
| CV Stability (CoV) | ~10% | <8% | Robust across seasons |

*OpenFPL uses different evaluation, so not directly comparable

---

## File Structure After Implementation

```
ml/
├── evaluation/
│   ├── metrics.py              # Basic metrics (existing)
│   └── comprehensive_metrics.py # Full evaluation (NEW)
├── pipelines/
│   └── train/
│       ├── train_baseline_model.py
│       ├── train_ensemble_model.py      # Simple ensemble (Exp 003)
│       ├── train_stacked_ensemble.py    # Stacked (Exp 003b, NEW)
│       └── train_position_ensemble.py   # Future (Exp 004)
└── features/
    └── extended_features.py    # Extended windows (TODO)

outputs/experiments/
├── ensemble_v1/        # Exp 003
├── stacked_v1/         # Exp 003b
└── position_ensemble/  # Future
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Ensemble overfits | Medium | High | Use OOF predictions, regularization |
| Feature engineering leaks | Low | Critical | Strict time-aware transforms |
| Diminishing returns | High | Medium | Focus on played-only MAE |
| Computation time | High | Low | Parallelize, cache features |

---

## Conclusion

The current baseline is strong. Expected improvement from ensemble methods is **1-3%** (MAE 0.97-0.99). Larger gains require:

1. Better availability prediction (injury/rotation signals)
2. New data sources (news, team sheets)
3. Player-specific modeling for high-value players

The stacked ensemble with played-classifier signal is the highest-impact next step.
