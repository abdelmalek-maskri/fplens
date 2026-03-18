> **HISTORICAL** — Superseded by Config D Stacked Ensemble (MAE=1.016).
> See `outputs/experiments/` for current metrics.

# Experiment 002: Position-Specific Models

**Status:** Completed (No Improvement)
**Date:** 2026-01-22
**Branch:** `feature/eval-baselines-stratification`

---

## 1. Motivation

### 1.1 Problem Statement

State-of-the-art FPL prediction models (OpenFPL, arXiv 2508.09992) use **position-specific models** as a key architectural choice. Different positions have fundamentally different scoring patterns:

- **GK:** Clean sheets, saves, bonus points (low variance)
- **DEF:** Clean sheets + occasional assists/goals (moderate variance)
- **MID:** Goals + assists + bonus (high variance, balanced)
- **FWD:** Goals primarily (highest variance)

### 1.2 Prior Work

An existing position-specific implementation (`train_lgbm_by_position.py`) achieved:
- **Weighted MAE: 1.033** (3.4% worse than baseline 0.999)

Issues identified:
1. Fewer trees (600 vs baseline 800)
2. No position-specific feature selection
3. Same model capacity for all positions

### 1.3 Hypothesis

Improving position-specific models with:
1. Matching baseline hyperparameters (800 trees)
2. SOTA-inspired position-specific feature selection
3. Proper holdout evaluation

Should improve performance over baseline by leveraging position-specific patterns.

---

## 2. Methodology

### 2.1 Model Configuration

```python
LGBMRegressor(
    n_estimators=800,      # Matched baseline (was 600)
    learning_rate=0.05,
    num_leaves=63,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
)
```

### 2.2 Position-Specific Features

Based on OpenFPL research, each position received tailored features:

| Position | Features | Focus |
|----------|----------|-------|
| GK | 28 | Clean sheets (`expected_goals_conceded_*`), saves (`influence_*`, `bps_*`) |
| DEF | 55 | Clean sheets + attacking (`us_xa_*`, `creativity_*`, `us_xgchain_*`) |
| MID | 70 | Goals + assists (`us_xg_*`, `us_xa_*`, `threat_*`, all ICT) |
| FWD | 58 | Goals primary (`us_xg_*`, `us_shots_*`, `threat_*`) |

**Key Design Decisions:**
- GK: Removed xG/xA features (irrelevant)
- DEF: Added xG chain/buildup (attacking fullbacks)
- MID: Full feature set (balanced role)
- FWD: Removed `expected_goals_conceded_*` (irrelevant)

### 2.3 Evaluation Protocol

Same as baseline:
- **Holdout season:** 2023-24
- **Training:** All other seasons (2016-17 to 2025-26, excluding holdout)
- **Metric:** Weighted MAE across positions

---

## 3. Results

### 3.1 Holdout Performance (2023-24)

| Metric | Baseline | Position v1 | Position v2 | Delta v2 |
|--------|----------|-------------|-------------|----------|
| **Full MAE** | **0.999** | 1.033 | 1.022 | **+0.023** |
| RMSE | 1.994 | — | 2.017 | +0.023 |
| Played MAE | 2.005 | — | 1.993 | -0.012 |
| Not-played MAE | 0.370 | — | 0.493 | +0.123 |

### 3.2 Per-Position Results

| Position | Rows Test | MAE | Zero Baseline | vs Zero | Top Feature |
|----------|-----------|-----|---------------|---------|-------------|
| **GK** | 3,215 | **0.706** | 0.727 | -0.021 ✓ | influence_roll5 |
| **DEF** | 9,055 | 1.115 | 1.009 | +0.106 ✗ | team |
| **MID** | 12,101 | **1.012** | 1.179 | -0.167 ✓ | team |
| **FWD** | 3,628 | **1.104** | 1.178 | -0.074 ✓ | team |

**Critical Finding:** DEF model performs **worse than predicting 0** for all samples. This is the key failure mode.

### 3.3 Rolling CV Results

| Test Season | Weighted MAE |
|-------------|--------------|
| 2019-20 | 1.334 |
| 2020-21 | 1.183 |
| 2021-22 | 1.203 |
| 2022-23 | 1.192 |
| 2023-24 | 1.034 |
| 2024-25 | 1.118 |
| 2025-26 | 1.112 |
| **Mean** | **1.168** |

---

## 4. Analysis

### 4.1 Why Position-Specific Models Underperform

**Finding 1: DEF Model Failure**

The DEF position model achieves MAE 1.115 but the zero baseline is only 1.009. This means:
- 66.5% of DEF samples are non-players (vs 64.8% overall)
- The model overcomplicates predictions for a position where "predict 0" is a strong heuristic

**Finding 2: Data Splitting Hurts Small Positions**

| Position | Training Rows | % of Total |
|----------|--------------|------------|
| GK | 18,751 | 10.7% |
| DEF | 59,191 | 33.9% |
| MID | 73,012 | 41.8% |
| FWD | 23,168 | 13.3% |

GK and FWD have significantly less training data, limiting model capacity.

**Finding 3: Baseline Already Learns Position Patterns**

The baseline model uses `position` as a categorical feature, allowing it to:
- Learn position-specific tree splits
- Share patterns across positions when beneficial
- Maintain statistical power from full dataset

### 4.2 What Works

Despite overall failure, position-specific models show promise in:

1. **GK Model (MAE 0.706):** Significantly outperforms mean baseline (1.338)
2. **Played-only MAE (1.993):** Slightly better than baseline (2.005)
3. **Feature Importance:** Position-specific patterns emerge (influence for GK, team for outfield)

### 4.3 Why OpenFPL Succeeds Where We Don't

OpenFPL uses:
1. **Ensemble of 50 models** per position (we use 1)
2. **Entropy-based sample weighting** (we use uniform)
3. **Extended time windows** (1,3,5,10,38 vs our 1,3,5)
4. **Larger feature set** (196-206 vs our 28-70)

---

## 5. Conclusions

### 5.1 Main Finding

> **Position-specific models do not improve MAE** when using a single model per position. The baseline's joint optimization across positions is more effective than explicit decomposition.

### 5.2 Key Insights

1. **DEF position is the bottleneck:** Model performs worse than zero baseline
2. **Data splitting reduces statistical power:** Small positions suffer
3. **Baseline already captures position patterns** through categorical feature
4. **GK is the easiest position** to predict (lowest variance)

### 5.3 Recommendations

1. **Keep baseline** as primary model
2. **Try ensemble methods** (Exp 003) - OpenFPL's real advantage
3. **Consider position-weighted loss** instead of separate models
4. **Add extended time windows** (Exp 004) before more architectural changes

---

## 6. Reproducibility

### 6.1 Code

```bash
# Run experiment
python ml/pipelines/train/train_position_models_v2.py
```

### 6.2 Outputs

```
outputs/experiments/position_v2/
├── summary.json                    # Full metrics
├── rolling_cv.csv                  # Per-fold CV results
├── models/
│   ├── gk_model.joblib
│   ├── def_model.joblib
│   ├── mid_model.joblib
│   └── fwd_model.joblib
└── feature_importance/
    ├── gk_importance.csv
    ├── def_importance.csv
    ├── mid_importance.csv
    └── fwd_importance.csv
```

---

## 7. Comparison Summary

| Experiment | MAE | vs Baseline | Verdict |
|------------|-----|-------------|---------|
| Baseline v1 | 0.999 | — | Reference |
| Exp 001: Two-Stage | 1.001 | +0.002 | ❌ No improvement |
| Exp 002: Position v2 | 1.022 | +0.023 | ❌ Worse |

---

## 8. Citation

> Maskri, A. (2026). Experiment 002: Position-Specific Models for FPL Prediction. FYP Internal Documentation. Result: No improvement over baseline (MAE 1.022 vs 0.999).
