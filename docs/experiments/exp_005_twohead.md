> **HISTORICAL** — Superseded by Config D Stacked Ensemble (MAE=1.016).
> See `outputs/experiments/` for current metrics.

# Experiment 005: Two-Head Model

**Status:** Completed (No Improvement over Extended)
**Date:** 2026-01-22
**Duration:** ~30 minutes

---

## 1. Summary

| Model | MAE | vs Baseline | vs Extended |
|-------|-----|-------------|-------------|
| Baseline | 0.9991 | — | — |
| Extended Stacked | 0.9875 | -1.2% | — |
| **Two-Head (soft)** | **0.9975** | **-0.16%** | **+1.0%** |

**Result:** Two-head architecture does not improve over the stacked ensemble with extended features.

---

## 2. Architecture

```
Input Features (106)
        │
        ├──► Head 1: LGBMClassifier ──► P(will play)
        │         (500 trees)
        │
        └──► Head 2: LGBMRegressor ──► E[points | played]
                  (800 trees, trained on played samples only)

Final: P(play) × E[points | played]
```

---

## 3. Results

| Method | MAE | Played MAE | Not-Played MAE |
|--------|-----|------------|----------------|
| soft | 0.9975 | 1.947 | 0.481 |
| hard (threshold 0.5) | 1.0637 | 2.227 | 0.431 |

**Classifier Performance:** AUC = 0.909 (strong)

---

## 4. Analysis

### Why It Didn't Work

1. **Stacked ensemble already captures this signal:** The meta-learner assigns 40% weight to `played_prob`, effectively learning the two-head combination.

2. **Regressor trained on biased sample:** Head 2 only sees played samples, missing context about non-players.

3. **Information loss:** Separating the heads loses interaction effects between availability and performance features.

### What We Learned

- Explicit decomposition doesn't beat implicit learning
- The stacked ensemble's meta-learner is already optimal
- **SHAP insight confirmed:** Availability is critical, but the baseline already handles it

---

## 5. Conclusion

**Freeze the baseline at Extended Stacked Ensemble (MAE 0.9875).**

Further baseline optimization yields diminishing returns. Time to pivot to multi-modal fusion.

---

## 6. Final Baseline Summary

| Experiment | MAE | vs Original | Status |
|------------|-----|-------------|--------|
| Original Baseline | 0.9991 | — | Reference |
| Exp 001: Two-Stage | 1.001 | +0.2% | Failed |
| Exp 002: Position | 1.022 | +2.3% | Failed |
| Exp 003: Stacked | 0.9899 | -0.9% | Improved |
| Exp 004: Extended | **0.9875** | **-1.2%** | **Best** |
| Exp 005: Two-Head | 0.9975 | -0.16% | No improvement |

**Final baseline: MAE 0.9875 (1.2% improvement)**

---

## 7. Next Steps

Pivot to multi-modal fusion:
1. News embeddings pipeline
2. Injury signal extraction
3. Hybrid fusion model
4. Optimization engine
5. Interactive UI
