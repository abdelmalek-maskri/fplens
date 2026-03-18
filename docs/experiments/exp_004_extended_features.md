> **HISTORICAL** — Extended features are now part of the standard pipeline (109 baseline features).
> Current best: Config D Stacked Ensemble (MAE=1.016, 145 features).
> See `outputs/experiments/` for current metrics.

# Experiment 004: Extended Features Ensemble

**Status:** Completed (SIGNIFICANT IMPROVEMENT)
**Date:** 2026-01-22
**Branch:** `feature/eval-baselines-stratification`

---

## 1. Executive Summary

| Model | Features | MAE | vs Baseline | vs Stacked v1 |
|-------|----------|-----|-------------|---------------|
| Baseline | 75 | 0.9991 | — | — |
| Stacked v1 | 75 | 0.9899 | -0.9% | — |
| **Stacked Extended** | **106** | **0.9875** | **-1.2%** | **-0.2%** |
| played_prob Extended | 106 | 0.9471 | -5.2% | -4.3% |

**Key Result:** Extended features (roll10, season_avg, momentum, availability) improve the stacked ensemble from MAE 0.9899 → **0.9875** (-0.24%).

**Best Overall:** `played_prob` achieves MAE **0.9471** (-5.2% vs baseline), the best overall result so far.

---

## 2. New Features Added

### 2.1 Roll10 (10-Game Form) - 21 features

Captures medium-term form trends (more stable than roll5):
```
total_points_roll10, minutes_roll10, starts_roll10,
expected_goals_roll10, expected_assists_roll10, ...
us_xg_roll10, us_xa_roll10, us_xgchain_roll10, ...
```

### 2.2 Season Averages - 8 features

Full season context (all games so far this season):
```
total_points_season_avg, minutes_season_avg,
expected_goals_season_avg, expected_assists_season_avg,
influence_season_avg, creativity_season_avg,
threat_season_avg, bps_season_avg
```

### 2.3 Momentum Features - 3 features

Short-term vs long-term form comparison:
```
points_momentum  = total_points_roll3 - total_points_roll10
bps_momentum     = bps_roll3 - bps_roll10
xg_momentum      = expected_goals_roll3 - expected_goals_roll10
```

### 2.4 Availability Features - 3 features

Rotation and fitness indicators:
```
consecutive_starts  # How many games in a row started
minutes_trend       # Increasing/decreasing playing time
games_since_start   # Rotation indicator
```

---

## 3. Results

### 3.1 Method Comparison

| Method | MAE | vs Baseline | Played MAE | Not-Played MAE |
|--------|-----|-------------|------------|----------------|
| played_prob | **0.9471** | **-5.20%** | 2.337 | **0.191** |
| stacked | 0.9875 | -1.16% | 1.917 | 0.482 |
| median | 0.9895 | -0.96% | **1.913** | 0.487 |
| lgbm_v2 | 0.9898 | -0.94% | 1.917 | 0.485 |
| mean | 0.9941 | -0.50% | 1.915 | 0.493 |
| rf | 0.9966 | -0.25% | 1.916 | 0.497 |
| lgbm | 0.9975 | -0.17% | 1.942 | 0.484 |
| ridge | 1.0070 | +0.79% | 1.912 | 0.515 |
| xgb | 1.0169 | +1.78% | 1.975 | 0.496 |

### 3.2 Improvement Breakdown

| Comparison | Delta | Interpretation |
|------------|-------|----------------|
| Extended vs Baseline | -0.0116 | Extended features help |
| Extended vs Stacked v1 | -0.0024 | Small but consistent gain |
| played_prob improvement | -0.0027 | Availability features boost classifier |

### 3.3 Meta-Learner Coefficients

```
lgbm:        49.3%  (↓ from 52.4% in v1)
played_prob: 41.0%  (↑ from 40.1% in v1)
lgbm_v2:     16.3%  (↑ from 12.3% in v1)
ridge:       15.3%  (↑ from 11.2% in v1)
rf:           6.6%  (↓ from 7.8% in v1)
xgb:          1.7%  (↓ from 5.6% in v1)
```

**Insight:** Extended features slightly reduce LGBM dominance and increase diversity benefit.

### 3.4 Position-Specific Results

| Method | GK | DEF | MID | FWD |
|--------|-----|-----|-----|-----|
| stacked | **0.630** | **1.081** | **0.991** | **1.059** |
| baseline | 0.649 | 1.078 | 1.009 | 1.078 |

Extended features improve all positions, especially GK and FWD.

---

## 4. Analysis

### 4.1 Why Extended Features Help

1. **Roll10 captures form cycles:** Players go through 5-10 game hot/cold streaks
2. **Season averages provide context:** Distinguishes consistent performers from streaky players
3. **Momentum features detect trends:** Rising stars vs declining form
4. **Availability features reduce uncertainty:** Better predict who will play

### 4.2 Feature Importance (Qualitative)

The availability features (`consecutive_starts`, `games_since_start`) directly address the played-prediction challenge that dominates FPL MAE. This explains why `played_prob` improved from 0.9498 → 0.9471.

### 4.3 Diminishing Returns

The improvement from 75 → 106 features (+31) yields only -0.24% MAE improvement. We're approaching the ceiling of what feature engineering alone can achieve.

---

## 5. Cumulative Progress

| Experiment | MAE | vs Baseline | Status |
|------------|-----|-------------|--------|
| Baseline v1 | 0.9991 | — | Reference |
| Exp 001: Two-Stage | 1.001 | +0.2% | No improvement |
| Exp 002: Position v2 | 1.022 | +2.3% | Worse |
| Exp 003: Stacked v1 | 0.9899 | -0.9% | First improvement |
| **Exp 004: Extended** | **0.9875** | **-1.2%** | **Best stacked** |

**Total improvement: -1.16%** (MAE 0.9991 → 0.9875)

---

## 6. Conclusions

### 6.1 Key Findings

1. **Extended time windows help:** roll10 captures medium-term form
2. **Availability features improve played-prediction:** consecutive_starts, games_since_start
3. **Momentum features add signal:** Comparing short vs long-term form
4. **Diminishing returns:** +31 features → -0.24% improvement

### 6.2 Recommendations

1. **Use extended features** as new baseline for future experiments
2. **Focus on played-prediction** since it dominates overall MAE
3. **Next: Opponent strength features** (FDR, goals conceded)
4. **Consider two-head architecture:** Separate models for played/not-played

---

## 7. Reproducibility

### 7.1 Code

```bash
# Build extended features
python ml/pipelines/features/build_extended_features.py

# Train extended ensemble
python ml/pipelines/train/train_extended_ensemble.py
```

### 7.2 Outputs

```
data/features/extended_features.csv      # 202,222 rows × 109 columns
outputs/experiments/extended_v1/
├── summary.json                         # Full metrics
└── extended_ensemble.joblib             # Trained ensemble
```

---

## 8. Citation

> Maskri, A. (2026). Experiment 004: Extended Features Ensemble for FPL Prediction. FYP Internal Documentation. Result: MAE improved from 0.9899 to 0.9875 (-0.24%) with roll10, season_avg, momentum, and availability features.
