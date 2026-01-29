# SHAP Analysis: Model Interpretability Report

**Date:** 2026-01-22
**Model:** LightGBM Regressor (800 trees)
**Test Season:** 2023-24
**Sample Size:** 5,000 (for computational efficiency)

---

## 1. Executive Summary

SHAP (SHapley Additive exPlanations) analysis reveals that **availability prediction dominates the FPL model**. The top 3 features are all related to whether a player will play:

1. **minutes_lag1** (14.7%) - Did they play last week?
2. **total_points_season_avg** (5.2%) - Season context
3. **played_lag1** (4.7%) - Binary played indicator

**Key Insight:** Nearly 25% of model importance comes from "will this player be selected?" - confirming that availability prediction is the primary challenge in FPL forecasting.

---

## 2. Global Feature Importance

### Top 15 Features (by mean |SHAP value|)

| Rank | Feature | Importance | % of Total | Category |
|------|---------|------------|------------|----------|
| 1 | **minutes_lag1** | 0.461 | **14.7%** | Availability |
| 2 | total_points_season_avg | 0.163 | 5.2% | Extended |
| 3 | played_lag1 | 0.147 | 4.7% | Availability |
| 4 | value | 0.125 | 4.0% | Context |
| 5 | team | 0.110 | 3.5% | Context |
| 6 | opponent_team | 0.108 | 3.4% | Context |
| 7 | creativity_season_avg | 0.080 | 2.5% | Extended |
| 8 | ict_index_lag1 | 0.067 | 2.1% | Performance |
| 9 | minutes_roll3 | 0.053 | 1.7% | Availability |
| 10 | expected_goals_conceded_lag1 | 0.046 | 1.5% | Defensive |
| 11 | ict_index_roll3 | 0.044 | 1.4% | Performance |
| 12 | threat_season_avg | 0.043 | 1.4% | Extended |
| 13 | expected_goals_conceded_roll10 | 0.042 | 1.3% | Defensive |
| 14 | minutes_season_avg | 0.037 | 1.2% | Extended |
| 15 | total_points_roll10 | 0.036 | 1.2% | Extended |

### Feature Category Breakdown

| Category | Features | Total Importance |
|----------|----------|------------------|
| **Availability** | minutes_lag1, played_lag1, minutes_roll3, etc. | **~25%** |
| **Extended (New)** | season_avg, roll10, momentum | **31.1%** |
| **Context** | team, opponent_team, value, GW | ~12% |
| **Performance** | ict_index, bps, total_points | ~15% |
| **Expected Stats** | xG, xA, xGC | ~10% |

---

## 3. Position-Specific Insights

### Top 3 Features by Position

| Position | #1 | #2 | #3 |
|----------|----|----|-----|
| **GK** | minutes_lag1 | played_lag1 | total_points_season_avg |
| **DEF** | minutes_lag1 | total_points_season_avg | played_lag1 |
| **MID** | minutes_lag1 | total_points_season_avg | played_lag1 |
| **FWD** | minutes_lag1 | total_points_season_avg | played_lag1 |

**Finding:** `minutes_lag1` is the most important feature for **all positions**. This uniformity suggests the model has learned that availability prediction is universally critical, regardless of position.

### Position-Specific Nuances

While the top features are similar, deeper analysis shows:

- **GK:** Higher importance on `opponent_team` (clean sheet probability)
- **DEF:** `expected_goals_conceded_roll10` ranks higher (clean sheet context)
- **MID:** `creativity_season_avg` more important (playmaking)
- **FWD:** `threat_season_avg` more important (goal-scoring)

---

## 4. Extended Features Value

The new features added in Experiment 004 contribute **31.1%** of total model importance:

| Feature Type | Contribution | Key Features |
|--------------|--------------|--------------|
| **season_avg** | ~15% | total_points_season_avg, creativity_season_avg |
| **roll10** | ~12% | ict_index_roll10, total_points_roll10 |
| **momentum** | ~3% | points_momentum |
| **availability** | ~1% | consecutive_starts, minutes_trend |

**Validation:** Extended features provide substantial signal, justifying their inclusion.

---

## 5. Prediction Examples

### High-Accuracy Predictions (Captain Picks)

| Player | Position | Actual | Predicted | Error |
|--------|----------|--------|-----------|-------|
| Cole Palmer | MID | 26 | 24.1 | 1.9 |
| Ollie Watkins | FWD | 23 | 21.8 | 1.2 |
| Erling Haaland | FWD | 21 | 19.8 | 1.2 |
| Joško Gvardiol | DEF | 21 | 19.7 | 1.3 |

**Finding:** For established, consistently-playing stars, the model predicts accurately.

### High-Error Predictions (Failure Cases)

| Player | Position | Actual | Predicted | Error | Likely Reason |
|--------|----------|--------|-----------|-------|---------------|
| Conor Bradley | DEF | 21 | 1.5 | **19.5** | Breakthrough player, no history |
| David Fofana | FWD | 11 | 0.2 | 10.8 | Rarely played, then scored |
| Gonzalo Montiel | DEF | 12 | 2.0 | 10.0 | Limited minutes, then haul |
| Michael Olise | MID | 10 | 0.6 | 9.4 | Injury return, no recent form |

**Finding:** Model fails when:
1. **Breakthrough players** with no historical data suddenly start
2. **Rotation players** get unexpected minutes and score
3. **Returning from injury** with no recent form data

---

## 6. Key Findings for Research

### Finding 1: Availability > Performance

The model's primary function is predicting who will play, not how many points they'll score. This aligns with the FPL problem structure where ~65% of samples are non-players.

### Finding 2: Extended Features Justify Complexity

The 31 new features (roll10, season_avg, momentum) contribute 31.1% of importance - roughly 1% per feature. This is efficient feature engineering.

### Finding 3: Position Homogeneity

All positions rely on the same core availability features. Position-specific models failed (Exp 002) because position-specific features are secondary to availability.

### Finding 4: Failure Modes are Predictable

Model errors cluster around:
- New/breakthrough players
- Rotation players
- Injury returns

These could be addressed with:
- News sentiment analysis
- Team sheet monitoring
- Injury recovery timelines

---

## 7. Recommendations

### For Model Improvement

1. **Add injury status features** - Explicit injury/availability flags
2. **Weight recent players higher** - Players with 0 minutes history are hardest
3. **Ensemble with news model** - Capture team sheet information

### For Research Report

1. **Cite SHAP** for model trust and interpretability
2. **Highlight availability insight** as key contribution
3. **Show position uniformity** to explain Exp 002 failure

### For Production

1. **Flag low-confidence predictions** - Players with sparse history
2. **Captain picks focus** - Model is most accurate for consistent starters
3. **Avoid rotation players** - Highest prediction error

---

## 8. Files Generated

```
outputs/analysis/shap/
├── shap_report.json           # Full analysis report
├── global_importance.csv      # 106 features ranked
├── gk_importance.csv          # GK-specific importance
├── def_importance.csv         # DEF-specific importance
├── mid_importance.csv         # MID-specific importance
├── fwd_importance.csv         # FWD-specific importance
├── feature_interactions.csv   # Correlation matrix
├── interpretable_model.joblib # Trained model
└── shap_explainer.joblib      # SHAP explainer object
```

---

## 9. Citation

> Maskri, A. (2026). SHAP Analysis of FPL Prediction Model. FYP Internal Documentation. Key finding: Availability features (minutes_lag1, played_lag1) contribute ~25% of model importance, confirming that predicting who plays is the primary challenge.
