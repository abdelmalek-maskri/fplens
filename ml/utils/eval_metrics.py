# ml/utils/eval_metrics.py
"""
Shared evaluation metrics for all models.
"""

import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """
    Compute standard regression metrics.
    Returns dict with mae, rmse, r2.
    """
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }


def compute_baselines(y_true: np.ndarray, y_train: np.ndarray) -> dict:
    """
    Compute baseline predictions and their metrics.

    Baselines:
      - zero: predict 0 for everything
      - mean: predict training set mean for everything

    Returns dict with baseline values and metrics.
    """
    zero_preds = np.zeros_like(y_true)
    mean_value = float(np.mean(y_train))
    mean_preds = np.full_like(y_true, mean_value, dtype=float)

    return {
        "zero_baseline": compute_metrics(y_true, zero_preds),
        "mean_baseline": {
            "mean_value": mean_value,
            **compute_metrics(y_true, mean_preds),
        },
    }


def compute_improvements(model_metrics: dict, baselines: dict) -> dict:
    """
    Compute how much the model improves over baselines.
    Positive values = model is better.
    """
    return {
        "vs_zero": {
            "mae_improve": baselines["zero_baseline"]["mae"] - model_metrics["mae"],
            "rmse_improve": baselines["zero_baseline"]["rmse"] - model_metrics["rmse"],
            "r2_improve": model_metrics["r2"] - baselines["zero_baseline"]["r2"],
        },
        "vs_mean": {
            "mae_improve": baselines["mean_baseline"]["mae"] - model_metrics["mae"],
            "rmse_improve": baselines["mean_baseline"]["rmse"] - model_metrics["rmse"],
            "r2_improve": model_metrics["r2"] - baselines["mean_baseline"]["r2"],
        },
    }


def full_evaluation(y_true: np.ndarray, y_pred: np.ndarray, y_train: np.ndarray) -> dict:
    """
    Complete evaluation: model metrics, baselines, and improvements.
    """
    model_metrics = compute_metrics(y_true, y_pred)
    baselines = compute_baselines(y_true, y_train)
    improvements = compute_improvements(model_metrics, baselines)

    return {
        "model": model_metrics,
        "baselines": baselines,
        "improvements": improvements,
    }


def print_evaluation(eval_result: dict, prefix: str = "") -> None:
    m = eval_result["model"]
    b = eval_result["baselines"]
    imp = eval_result["improvements"]

    print(f"\n{prefix}Model metrics:")
    print(f"  MAE:  {m['mae']:.4f}")
    print(f"  RMSE: {m['rmse']:.4f}")
    print(f"  R²:   {m['r2']:.4f}")

    print(f"\n{prefix}Baselines:")
    print(f"  Zero baseline MAE:  {b['zero_baseline']['mae']:.4f}")
    print(f"  Mean baseline MAE:  {b['mean_baseline']['mae']:.4f} (mean={b['mean_baseline']['mean_value']:.4f})")

    print(f"\n{prefix}Improvements (positive = model better):")
    print(f"  vs Zero - MAE: {imp['vs_zero']['mae_improve']:+.4f}, R²: {imp['vs_zero']['r2_improve']:+.4f}")
    print(f"  vs Mean - MAE: {imp['vs_mean']['mae_improve']:+.4f}, R²: {imp['vs_mean']['r2_improve']:+.4f}")


def print_final_summary(
    model_name: str,
    holdout_season: str,
    train_seasons: list,
    n_train: int,
    n_test: int,
    eval_result: dict,
    output_dir: str = None,
) -> None:
    
    m = eval_result["model"]
    b = eval_result["baselines"]
    imp = eval_result["improvements"]

    print("\n")
    print("=" * 65)
    print(f"  {model_name.upper()}")
    print("=" * 65)

    print(f"\n  Holdout Season: {holdout_season}")
    print(f"  Train Seasons:  {train_seasons[0]} to {train_seasons[-1]} ({len(train_seasons)} seasons)")
    print(f"  Train Samples:  {n_train:,}")
    print(f"  Test Samples:   {n_test:,}")

    print("\n" + "-" * 65)
    print("  HOLDOUT METRICS")
    print("-" * 65)
    print(f"  {'Metric':<20} {'Model':<12} {'Zero Base':<12} {'Mean Base':<12}")
    print(f"  {'-'*20} {'-'*12} {'-'*12} {'-'*12}")
    print(f"  {'MAE':<20} {m['mae']:<12.4f} {b['zero_baseline']['mae']:<12.4f} {b['mean_baseline']['mae']:<12.4f}")
    print(f"  {'RMSE':<20} {m['rmse']:<12.4f} {b['zero_baseline']['rmse']:<12.4f} {b['mean_baseline']['rmse']:<12.4f}")
    print(f"  {'R²':<20} {m['r2']:<12.4f} {b['zero_baseline']['r2']:<12.4f} {b['mean_baseline']['r2']:<12.4f}")

    print("\n" + "-" * 65)
    print("  IMPROVEMENT vs BASELINES (positive = better)")
    print("-" * 65)
    print(f"  vs Zero:  MAE {imp['vs_zero']['mae_improve']:+.4f}  |  R² {imp['vs_zero']['r2_improve']:+.4f}")
    print(f"  vs Mean:  MAE {imp['vs_mean']['mae_improve']:+.4f}  |  R² {imp['vs_mean']['r2_improve']:+.4f}")

    if output_dir:
        print("\n" + "-" * 65)
        print("  OUTPUT FILES")
        print("-" * 65)
        print(f"  {output_dir}")

    print("\n" + "=" * 65)
