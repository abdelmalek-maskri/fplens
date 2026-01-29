# Experiment 003: Stacked Ensemble with Meta-Learning

**Status:** Completed (Mixed Results)
**Date:** 2026-01-22
**Branch:** `feature/eval-baselines-stratification`

---

## 1. Executive Summary

| Metric | Baseline | Stacked | Best (played_prob) |
|--------|----------|---------|-------------------|
| **Overall MAE** | 0.9991 | **0.9899** | **0.9498** |
| Played MAE | 1.9633 | 1.9339 | 2.3415 |
| Not-played MAE | 0.4746 | 0.4763 | **0.1928** |
| High-return MAE | 5.24 | 5.24 | 7.01 |

**Key Finding:** The played-probability classifier alone achieves the best overall MAE (0.9498, **-4.9% vs baseline**), but this is misleading. It excels at predicting non-players (MAE 0.19) while being significantly worse for played players (MAE 2.34).

**Practical Winner:** The **stacked ensemble** achieves MAE **0.9899 (-0.9%)** with balanced performance across all subgroups.

---

## 2. Architecture

### 2.1 Base Learners (Level 0)

| Model | Type | Purpose |
|-------|------|---------|
| LightGBM | Regressor | Primary model (matches baseline) |
| LightGBM-v2 | Regressor | Diversity (different hyperparams) |
| XGBoost | Regressor | Algorithm diversity |
| Random Forest | Regressor | Different tree structure |
| Ridge | Linear | Linear baseline |
| Played Classifier | Classifier | P(will play) signal |

### 2.2 Meta-Learner (Level 1)

Ridge regression combining out-of-fold predictions from base learners.

**Learned Coefficients:**
```
lgbm:        0.524   (52.4% weight)
played_prob: 0.401   (40.1% weight - key insight!)
lgbm_v2:     0.123   (12.3% weight)
ridge:       0.112   (11.2% weight)
rf:          0.078   (7.8% weight)
xgb:         0.056   (5.6% weight)
intercept:  -0.032
```

**Key Insight:** The meta-learner assigns 40% weight to the played-probability signal, confirming that predicting who plays is a major component of FPL prediction.

---

## 3. Results

### 3.1 Overall Performance

| Method | MAE | vs Baseline | Status |
|--------|-----|-------------|--------|
| played_prob | 0.9498 | **-4.93%** | Best overall (but see caveats) |
| stacked | 0.9899 | **-0.93%** | Best balanced |
| median | 0.9952 | -0.40% | Simple but effective |
| lgbm_v2 | 0.9960 | -0.31% | Slight variant helps |
| lgbm | 0.9991 | 0.00% | Baseline reference |
| mean | 0.9996 | +0.04% | No improvement |
| rf | 1.0015 | +0.23% | Slightly worse |
| xgb | 1.0169 | +1.78% | Worse on this data |
| ridge | 1.0210 | +2.18% | Worst |

### 3.2 Stratified Analysis

| Method | Played MAE | Not-Played MAE | Trade-off |
|--------|------------|----------------|-----------|
| **lgbm** | 1.963 | 0.475 | Balanced |
| **stacked** | **1.934** | 0.476 | Best played |
| **played_prob** | 2.341 | **0.193** | Best not-played |

**Critical Observation:**
- `played_prob` achieves best overall MAE by predicting ~0 for everyone, then adjusting
- This hurts played-player predictions significantly (+19% worse)
- The stacked ensemble balances both subgroups better

### 3.3 Position-Specific Results

| Method | GK | DEF | MID | FWD |
|--------|-----|-----|-----|-----|
| lgbm | 0.649 | 1.078 | 1.009 | 1.078 |
| stacked | **0.618** | **1.069** | 1.002 | 1.081 |
| played_prob | 0.620 | **0.946** | 1.011 | **1.046** |

**Finding:** `played_prob` dramatically improves DEF predictions (0.946 vs 1.078) because DEF has the highest not-played rate (66.5%).

### 3.4 High-Return Players (≥5 points)

| Method | MAE | n_samples |
|--------|-----|-----------|
| xgb | **5.17** | ~2,500 |
| lgbm_v2 | 5.22 | ~2,500 |
| stacked | 5.24 | ~2,500 |
| lgbm | 5.24 | ~2,500 |
| played_prob | **7.01** | ~2,500 |

**Critical:** For captain picks (high-return players), the played_prob approach is **terrible**. The stacked ensemble maintains similar performance to baseline.

---

## 4. Analysis

### 4.1 Why Played-Probability Dominates Overall MAE

The FPL prediction problem has severe class imbalance:
- 64.8% of samples score 0 points (didn't play)
- 35.2% of samples score >0 points (played)

A model that perfectly predicts who plays (and predicts ~0 for non-players) will achieve excellent overall MAE even if it poorly predicts scores for played players.

**Mathematical breakdown:**
```
Overall MAE = 0.648 × MAE_not_played + 0.352 × MAE_played

played_prob:  0.648 × 0.19 + 0.352 × 2.34 = 0.95
stacked:      0.648 × 0.48 + 0.352 × 1.93 = 0.99
```

### 4.2 Meta-Learner Insights

The coefficients reveal what matters:
1. **LightGBM (52%):** Still the best single predictor
2. **Played probability (40%):** Critical signal for overall MAE
3. **Other models (8%):** Marginal diversity benefit

### 4.3 When to Use Each Approach

| Use Case | Best Method | Rationale |
|----------|-------------|-----------|
| Overall prediction | stacked | Balanced performance |
| Minimize false positives | played_prob | Best at predicting 0s |
| Captain picks | lgbm or xgb | Best high-return MAE |
| DEF/GK predictions | played_prob | Clean sheet positions |
| FWD/MID predictions | stacked | Goal-scoring positions |

---

## 5. Conclusions

### 5.1 Main Findings

1. **Stacked ensemble improves baseline by 0.9%** (MAE 0.9899 vs 0.9991)
2. **Played-probability is a critical signal** (40% meta-learner weight)
3. **Overall MAE is misleading** for FPL due to class imbalance
4. **Different methods suit different use cases** (overall vs captain picks)

### 5.2 Recommendations

1. **For production:** Use stacked ensemble for balanced predictions
2. **For captain picks:** Use lgbm or xgb directly (better high-return MAE)
3. **For evaluation:** Always report stratified metrics (played/not-played)
4. **Future work:** Explore conditional models (one for played, one for not-played)

### 5.3 Comparison to Previous Experiments

| Experiment | MAE | vs Baseline | Verdict |
|------------|-----|-------------|---------|
| Baseline v1 | 0.999 | — | Reference |
| Exp 001: Two-Stage | 1.001 | +0.2% | No improvement |
| Exp 002: Position v2 | 1.022 | +2.3% | Worse |
| **Exp 003: Stacked** | **0.990** | **-0.9%** | **First improvement** |

---

## 6. Reproducibility

### 6.1 Code

```bash
python ml/pipelines/train/train_stacked_ensemble.py
```

### 6.2 Outputs

```
outputs/experiments/stacked_v1/
├── summary.json                # Full metrics
└── stacked_ensemble.joblib     # Trained ensemble
```

### 6.3 Configuration

```python
N_INNER_FOLDS = 3  # For OOF predictions
TEST_SEASON = "2023-24"
BASE_MODELS = ["lgbm", "lgbm_v2", "rf", "ridge", "played_prob", "xgb"]
META_MODEL = Ridge(alpha=1.0)
```

---

## 7. Next Steps

1. **Investigate two-head model:** Separate predictors for played/not-played
2. **Add more features:** Extend time windows (roll10, season_avg)
3. **Captain-optimized model:** Optimize for high-return accuracy
4. **SHAP analysis:** Understand feature contributions by position

---

## 8. Citation

> Maskri, A. (2026). Experiment 003: Stacked Ensemble with Meta-Learning for FPL Prediction. FYP Internal Documentation. Result: First improvement over baseline (MAE 0.990 vs 0.999, -0.9%).
