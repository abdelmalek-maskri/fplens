"""
Statistical tests for comparing prediction models.

Provides Diebold-Mariano test and paired bootstrap confidence intervals
for rigorous comparison of ablation configs (A vs B, B vs C, etc.).
"""

import numpy as np
from scipy import stats


def diebold_mariano(
    errors_1: np.ndarray,
    errors_2: np.ndarray,
    loss: str = "absolute",
) -> tuple[float, float]:
    """Diebold-Mariano test for equal predictive accuracy.

    Tests H0: E[L(e1)] = E[L(e2)] where L is the loss function.
    A negative DM statistic means model 1 has lower loss (is better).

    Args:
        errors_1: Prediction errors from model 1 (y_true - y_pred_1).
        errors_2: Prediction errors from model 2 (y_true - y_pred_2).
        loss: Loss function — "absolute" (|e|) or "squared" (e²).

    Returns:
        (dm_statistic, p_value) — two-sided test.
    """
    if loss == "absolute":
        d = np.abs(errors_1) - np.abs(errors_2)
    elif loss == "squared":
        d = errors_1**2 - errors_2**2
    else:
        raise ValueError(f"Unknown loss: {loss}")

    n = len(d)
    mean_d = np.mean(d)

    # Newey-West HAC variance estimate (lag = floor(n^(1/3)))
    max_lag = max(1, int(np.floor(n ** (1 / 3))))
    gamma_0 = np.var(d, ddof=0)
    gamma_sum = 0.0

    for k in range(1, max_lag + 1):
        weight = 1 - k / (max_lag + 1)  # Bartlett kernel
        gamma_k = np.mean((d[k:] - mean_d) * (d[:-k] - mean_d))
        gamma_sum += 2 * weight * gamma_k

    var_d = (gamma_0 + gamma_sum) / n

    if var_d <= 0:
        return 0.0, 1.0

    dm_stat = mean_d / np.sqrt(var_d)
    p_value = 2 * stats.norm.sf(abs(dm_stat))

    return float(dm_stat), float(p_value)


def paired_bootstrap_ci(
    y_true: np.ndarray,
    pred_a: np.ndarray,
    pred_b: np.ndarray,
    n_boot: int = 10000,
    alpha: float = 0.05,
    seed: int = 42,
) -> tuple[float, float, float]:
    """Paired bootstrap confidence interval for MAE difference.

    Computes MAE(A) - MAE(B) across bootstrap resamples.
    Positive delta = A has higher MAE = B is better.

    Args:
        y_true: Actual values.
        pred_a: Predictions from model A (baseline).
        pred_b: Predictions from model B (new model).
        n_boot: Number of bootstrap resamples.
        alpha: Significance level (0.05 = 95% CI).
        seed: Random seed for reproducibility.

    Returns:
        (mean_delta, ci_lower, ci_upper) — MAE(A) - MAE(B).
    """
    rng = np.random.RandomState(seed)
    n = len(y_true)
    deltas = np.empty(n_boot)

    abs_err_a = np.abs(y_true - pred_a)
    abs_err_b = np.abs(y_true - pred_b)

    for i in range(n_boot):
        idx = rng.randint(0, n, size=n)
        deltas[i] = abs_err_a[idx].mean() - abs_err_b[idx].mean()

    mean_delta = float(np.mean(deltas))
    ci_lower = float(np.percentile(deltas, 100 * alpha / 2))
    ci_upper = float(np.percentile(deltas, 100 * (1 - alpha / 2)))

    return mean_delta, ci_lower, ci_upper


def print_comparison(
    name_a: str,
    name_b: str,
    y_true: np.ndarray,
    pred_a: np.ndarray,
    pred_b: np.ndarray,
) -> dict:
    """Run DM test + bootstrap CI and print results.

    Returns dict with test results for JSON serialisation.
    """
    errors_a = y_true - pred_a
    errors_b = y_true - pred_b

    mae_a = float(np.mean(np.abs(errors_a)))
    mae_b = float(np.mean(np.abs(errors_b)))

    dm_stat, dm_p = diebold_mariano(errors_a, errors_b)
    mean_delta, ci_lo, ci_hi = paired_bootstrap_ci(y_true, pred_a, pred_b)

    sig = "Yes" if dm_p < 0.05 else "No"
    direction = "better" if mae_b < mae_a else "worse" if mae_b > mae_a else "same"

    print(f"\n  {name_a} vs {name_b}")
    print(f"    MAE {name_a}: {mae_a:.4f}")
    print(f"    MAE {name_b}: {mae_b:.4f}")
    print(f"    Delta (A-B):  {mean_delta:+.4f}  [{ci_lo:+.4f}, {ci_hi:+.4f}]")
    print(f"    DM statistic: {dm_stat:+.4f}  (p={dm_p:.4f}, sig={sig})")
    print(f"    {name_b} is {direction}")

    return {
        "mae_a": mae_a,
        "mae_b": mae_b,
        "mae_delta": mean_delta,
        "ci_lower": ci_lo,
        "ci_upper": ci_hi,
        "dm_statistic": dm_stat,
        "dm_p_value": dm_p,
        "significant": dm_p < 0.05,
        "direction": direction,
    }
