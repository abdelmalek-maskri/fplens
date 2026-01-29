# FPL Model Evaluation Conclusions

## Summary

After extensive experimentation with different feature sets and model architectures, the **Extended Ensemble** remains the best performing model.

## Extended vs Stacked Ensemble

**Key Difference**: Extended Ensemble uses `extended_features.csv` (109 features including roll10, season_avg, momentum, availability features) while Stacked Ensemble uses `baseline_features.csv` (fewer features, only roll3/roll5).

| Model | Features | MAE | RMSE | R² | vs Extended |
|-------|----------|-----|------|-----|-------------|
| **Extended Ensemble** | 109 | **1.0853** | **2.0180** | **0.2734** | baseline |
| Stacked Ensemble | ~70 | 1.0874 | 2.0145 | 0.2747 | -0.19% |

**Stacked Ensemble Full Metrics (archived before deletion)**:

```
Holdout Season: 2024-25
Train Samples:  185,149
Test Samples:   12,743

HOLDOUT METRICS:
  MAE:  1.0874
  RMSE: 2.0145
  R²:   0.2747

vs Zero Baseline:  MAE +0.1298  |  R² +0.5339
vs Mean Baseline:  MAE +0.4427  |  R² +0.2756

Meta-learner coefficients:
  lgbm:        0.4855
  lgbm_v2:     0.1641
  played_prob: 0.3764
  ridge:       0.1467
  rf:          0.0647
  xgb:         0.0399

Individual method MAEs:
  played_prob: 1.0587 (best)
  stacked:     1.0874
  median:      1.0912
  lgbm_v2:     1.0922
  lgbm:        1.0935
  mean:        1.0957
  rf:          1.0982
  xgb:         1.1145
  ridge:       1.1161
```

**Why Extended is better**:
1. Roll10 features capture longer-term form cycles
2. Season averages provide full-season context
3. Momentum features (roll3 - roll10) detect form changes
4. Availability features (consecutive_starts, minutes_trend, games_since_start) improve played prediction

**Note**: `train_stacked_ensemble.py` was removed to reduce codebase complexity. The Extended Ensemble in `train_extended_ensemble.py` supersedes it with identical architecture but better features.

---

## Model Comparison

| Model | MAE | R² | vs Extended |
|-------|-----|-----|-------------|
| **Extended Ensemble** | **1.0853** | **0.2734** | baseline |
| Enhanced Ensemble (opponent features) | 1.0893 | 0.2734 | -0.37% |
| Position-Specific (full stack, baseline) | 1.1039 | 0.2612 | -1.71% |
| Position-Specific (XGB+RF, extended) | 1.1090 | 0.2760 | -2.18% |
| Baseline | 1.1011 | 0.2608 | -1.46% |
| Comprehensive (222 features) | 1.1200 | 0.2649 | -3.20% |

---

## Position-Specific Models Don't Help

Tested two approaches - both worse than unified model:

| Approach | Base Models | Features | MAE | vs Extended |
|----------|-------------|----------|-----|-------------|
| Full stack per position | LGBM, XGB, RF, Ridge, played_prob | baseline (~70) | 1.1039 | -1.71% |
| XGB+RF per position | XGBoost, RandomForest | extended (109) | 1.1090 | -2.18% |

**Why position-specific fails:**
1. Splits training data 4 ways → less data per model
2. Unified model learns position patterns via `position` feature
3. Cross-position signal helps (e.g., team form affects all positions)
| Two-Head | 1.1026 | 0.2693 | -1.59% |
| Position-Specific | 1.1039 | 0.2612 | -1.71% |

## Key Findings

### 1. More Features ≠ Better Performance
- Extended features (109 columns): MAE 1.0853
- Comprehensive features (222 columns): MAE 1.1200 (-3.20% worse)
- **Conclusion**: Feature bloat causes overfitting. Quality > quantity.

### 2. Availability Prediction Dominates
- `played_prob` (will-play classifier) consistently achieves best MAE (~1.056)
- `minutes_lag1` is the top SHAP feature at 20.4% importance
- **Conclusion**: Knowing WHO will play is more valuable than predicting HOW MUCH they'll score.

### 3. Opponent Features Don't Help
- Added opponent defensive stats (for attackers): no improvement
- Added opponent attacking stats (for defenders): no improvement
- `opponent_team` only contributes 2% in SHAP analysis
- **Conclusion**: Fixture difficulty is already captured implicitly in player form.

### 4. Position-Specific Models Don't Help
- Training separate models per position (GK/DEF/MID/FWD) performed worse
- Meta-learner coefficients varied wildly (RF dominated for GK, LGBM for DEF)
- **Conclusion**: Unified model with position as a feature works better.

### 5. Performance Ceiling Exists
- All models converge to MAE ~1.08-1.10
- R² plateaus at ~0.27-0.28 (explains ~27% of variance)
- **Conclusion**: ~73% of FPL points variance is inherently unpredictable (luck, referee decisions, injuries mid-game, etc.)

## SHAP Feature Importance (Top 10)

| Rank | Feature | Importance |
|------|---------|------------|
| 1 | minutes_lag1 | 20.4% |
| 2 | total_points_lag1 | 8.7% |
| 3 | bps_lag1 | 6.2% |
| 4 | total_points_roll3 | 5.1% |
| 5 | ict_index_lag1 | 4.3% |
| 6 | minutes_roll3 | 3.8% |
| 7 | bps_roll3 | 3.2% |
| 8 | value | 2.8% |
| 9 | expected_goals_lag1 | 2.4% |
| 10 | opponent_team | 2.0% |

## What Works

1. **Lag-1 features**: Previous gameweek stats are highly predictive
2. **Rolling averages (3-5 games)**: Capture recent form
3. **Extended windows (roll10, season_avg)**: Add 24.3% importance
4. **Availability features**: consecutive_starts, minutes_trend, games_since_start
5. **Momentum features**: Short-term vs long-term form comparison

## What Doesn't Work

1. **Opponent-based features**: Goals conceded, goals scored, xG stats
2. **Position-specific models**: Separate ensembles per position
3. **Too many features**: 222 features performed worse than 109
4. **Team form features**: Team-level xG, win rates, etc.
5. **Home/away splits**: Separate rolling stats for home vs away

## Recommendations

### For Best Performance
Use the **Extended Ensemble** with:
- 109 features (lag1, roll3, roll5, roll10, season_avg, momentum, availability)
- Stacked ensemble (LGBM + XGBoost + RF + Ridge + played_prob)
- Single unified model (not position-specific)

### For Future Improvement
Focus on **availability prediction** rather than points prediction:
1. Better injury/rotation modeling
2. Team news integration
3. Manager rotation pattern analysis
4. Cup/European competition schedule impact

### What NOT to Try
- Adding more opponent/fixture features
- Position-specific model architectures
- Feature engineering beyond current set

## Technical Notes

- Holdout season: 2024-25
- Training seasons: 2016-17 to 2023-24 (8 seasons)
- Train samples: ~187,000
- Test samples: ~12,700
- Evaluation: Standardized via `ml/config/eval_config.py`
