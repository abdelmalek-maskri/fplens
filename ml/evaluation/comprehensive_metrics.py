# ml/evaluation/comprehensive_metrics.py
"""
Comprehensive Evaluation Framework for FPL Prediction

Addresses key gaps in standard MAE/RMSE evaluation:
1. Stratified performance (played vs not-played, by position)
2. Calibration analysis
3. High-value player focus
4. Business-relevant metrics (captain pick accuracy)
5. Stability across seasons
"""

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.metrics import mean_absolute_error, mean_squared_error

from ml.config.eval_config import (
    CAT_COLS,
    DROP_COLS,
    HOLDOUT_SEASON,
    TARGET_COL,
)

# Import model classes for unpickling saved joblib files.
# Keep these optional to avoid hard deps (e.g., xgboost) when not needed.
try:
    from ml.pipelines.train.train_stacked_ensemble import StackedEnsemble
except Exception:

    class StackedEnsemble:
        pass


try:
    from ml.pipelines.train.train_twohead_model import TwoHeadModel
except Exception:

    class TwoHeadModel:
        pass


try:
    from ml.pipelines.train.train_position_specific import PositionSpecificLGBMModel
except Exception:

    class PositionSpecificLGBMModel:
        pass


@dataclass
class StratifiedMetrics:
    """Performance breakdown by subgroup."""

    mae_overall: float
    rmse_overall: float

    # Played vs not-played
    mae_played: float
    mae_not_played: float
    n_played: int
    n_not_played: int
    pct_played: float

    # By position
    mae_gk: float | None = None
    mae_def: float | None = None
    mae_mid: float | None = None
    mae_fwd: float | None = None

    # High-value players (>= 5 points actual)
    mae_high_return: float | None = None
    n_high_return: int = 0


@dataclass
class CalibrationMetrics:
    """Prediction calibration analysis."""

    mean_predicted: float
    mean_actual: float
    std_predicted: float
    std_actual: float
    correlation: float
    spearman_rho: float

    # Binned calibration (predicted vs actual by decile)
    decile_mae: list  # MAE within each prediction decile


@dataclass
class BusinessMetrics:
    """FPL-specific business metrics."""

    # Captain pick accuracy (highest predicted = highest actual?)
    top1_accuracy: float  # Did top predicted player have highest actual?
    top3_accuracy: float  # Did top 3 contain the actual top 1?
    top5_accuracy: float  # Did top 5 contain the actual top 1?

    # Points capture
    optimal_captain_points: float  # If we always picked best
    predicted_captain_points: float  # Using our predictions
    captain_efficiency: float  # predicted / optimal


@dataclass
class StabilityMetrics:
    """Stability across evaluation folds/seasons."""

    mae_mean: float
    mae_std: float
    mae_min: float
    mae_max: float
    coefficient_of_variation: float  # std / mean
    seasons: list
    per_season_mae: list


def compute_stratified_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    positions: np.ndarray | None = None,
) -> StratifiedMetrics:
    """Compute stratified performance metrics."""

    # Overall
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))

    # Played vs not-played
    played_mask = y_true > 0
    n_played = int(played_mask.sum())
    n_not_played = int((~played_mask).sum())

    mae_played = mean_absolute_error(y_true[played_mask], y_pred[played_mask]) if n_played > 0 else 0.0
    mae_not_played = mean_absolute_error(y_true[~played_mask], y_pred[~played_mask]) if n_not_played > 0 else 0.0

    # High-return players (>=5 points)
    high_return_mask = y_true >= 5
    n_high_return = int(high_return_mask.sum())
    mae_high_return = (
        mean_absolute_error(y_true[high_return_mask], y_pred[high_return_mask]) if n_high_return > 0 else None
    )

    result = StratifiedMetrics(
        mae_overall=float(mae),
        rmse_overall=float(rmse),
        mae_played=float(mae_played),
        mae_not_played=float(mae_not_played),
        n_played=n_played,
        n_not_played=n_not_played,
        pct_played=float(100 * n_played / len(y_true)),
        mae_high_return=float(mae_high_return) if mae_high_return else None,
        n_high_return=n_high_return,
    )

    # By position (if provided)
    if positions is not None:
        for pos, attr in [("GK", "mae_gk"), ("DEF", "mae_def"), ("MID", "mae_mid"), ("FWD", "mae_fwd")]:
            mask = positions == pos
            if mask.sum() > 0:
                setattr(result, attr, float(mean_absolute_error(y_true[mask], y_pred[mask])))

    return result


def compute_calibration_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    n_bins: int = 10,
) -> CalibrationMetrics:
    """Compute calibration metrics."""

    # Basic statistics
    mean_pred = float(np.mean(y_pred))
    mean_actual = float(np.mean(y_true))
    std_pred = float(np.std(y_pred))
    std_actual = float(np.std(y_true))

    # Correlation
    correlation = float(np.corrcoef(y_true, y_pred)[0, 1])
    spearman_rho = float(stats.spearmanr(y_true, y_pred)[0])

    # Decile calibration
    try:
        deciles = pd.qcut(y_pred, q=n_bins, labels=False, duplicates="drop")
    except ValueError:
        # Handle case with too few unique values
        deciles = pd.cut(y_pred, bins=n_bins, labels=False, duplicates="drop")

    decile_mae = []
    for d in range(int(deciles.max()) + 1):
        mask = deciles == d
        if mask.sum() > 0:
            decile_mae.append(float(mean_absolute_error(y_true[mask], y_pred[mask])))

    return CalibrationMetrics(
        mean_predicted=mean_pred,
        mean_actual=mean_actual,
        std_predicted=std_pred,
        std_actual=std_actual,
        correlation=correlation,
        spearman_rho=spearman_rho,
        decile_mae=decile_mae,
    )


def compute_business_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    gameweek_ids: np.ndarray,
) -> BusinessMetrics:
    """
    Compute FPL business metrics.

    Args:
        y_true: Actual points
        y_pred: Predicted points
        gameweek_ids: Identifier for each gameweek (to compute per-GW captain picks)
    """

    unique_gws = np.unique(gameweek_ids)

    top1_correct = 0
    top3_correct = 0
    top5_correct = 0

    optimal_points = 0
    predicted_points = 0

    for gw in unique_gws:
        mask = gameweek_ids == gw
        gw_true = y_true[mask]
        gw_pred = y_pred[mask]

        if len(gw_true) == 0:
            continue

        # Indices sorted by prediction (descending)
        pred_order = np.argsort(-gw_pred)

        # Actual best player
        actual_best_idx = np.argmax(gw_true)
        actual_best_points = gw_true[actual_best_idx]

        # Check if our top predictions contain the actual best
        top1_correct += int(pred_order[0] == actual_best_idx)
        top3_correct += int(actual_best_idx in pred_order[:3])
        top5_correct += int(actual_best_idx in pred_order[:5])

        # Points captured
        optimal_points += actual_best_points
        predicted_points += gw_true[pred_order[0]]  # Points of our top pick

    n_gws = len(unique_gws)

    return BusinessMetrics(
        top1_accuracy=float(top1_correct / n_gws) if n_gws > 0 else 0.0,
        top3_accuracy=float(top3_correct / n_gws) if n_gws > 0 else 0.0,
        top5_accuracy=float(top5_correct / n_gws) if n_gws > 0 else 0.0,
        optimal_captain_points=float(optimal_points),
        predicted_captain_points=float(predicted_points),
        captain_efficiency=float(predicted_points / optimal_points) if optimal_points > 0 else 0.0,
    )


def compute_stability_metrics(
    cv_results: pd.DataFrame,
    mae_col: str = "mae",
    season_col: str = "test_season",
) -> StabilityMetrics:
    """Compute stability metrics from CV results."""

    mae_values = cv_results[mae_col].values

    return StabilityMetrics(
        mae_mean=float(np.mean(mae_values)),
        mae_std=float(np.std(mae_values)),
        mae_min=float(np.min(mae_values)),
        mae_max=float(np.max(mae_values)),
        coefficient_of_variation=float(np.std(mae_values) / np.mean(mae_values)),
        seasons=cv_results[season_col].tolist(),
        per_season_mae=mae_values.tolist(),
    )


class ComprehensiveEvaluator:
    """
    Unified evaluator that computes all metrics.
    """

    def __init__(self, output_dir: Path):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def evaluate_holdout(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        positions: np.ndarray | None = None,
        gameweek_ids: np.ndarray | None = None,
        experiment_name: str = "experiment",
    ) -> dict:
        """Full holdout evaluation."""

        results = {}

        # Stratified metrics
        strat = compute_stratified_metrics(y_true, y_pred, positions)
        results["stratified"] = asdict(strat)

        # Calibration
        calib = compute_calibration_metrics(y_true, y_pred)
        results["calibration"] = asdict(calib)

        # Business metrics (if GW IDs provided)
        if gameweek_ids is not None:
            biz = compute_business_metrics(y_true, y_pred, gameweek_ids)
            results["business"] = asdict(biz)

        # Naive baselines for comparison
        results["baselines"] = self._compute_baselines(y_true, positions)

        # Save
        out_path = self.output_dir / f"{experiment_name}_comprehensive.json"
        out_path.write_text(json.dumps(results, indent=2, default=str))

        return results

    def _compute_baselines(
        self,
        y_true: np.ndarray,
        positions: np.ndarray | None = None,
    ) -> dict:
        """Compute naive baselines for comparison."""

        baselines = {}

        # Zero baseline
        zero_pred = np.zeros_like(y_true)
        baselines["zero_mae"] = float(mean_absolute_error(y_true, zero_pred))

        # Mean baseline
        mean_pred = np.full_like(y_true, np.mean(y_true), dtype=float)
        baselines["mean_mae"] = float(mean_absolute_error(y_true, mean_pred))

        # Position-specific mean baseline
        if positions is not None:
            pos_pred = np.zeros_like(y_true, dtype=float)
            for pos in np.unique(positions):
                mask = positions == pos
                pos_pred[mask] = np.mean(y_true[mask])
            baselines["position_mean_mae"] = float(mean_absolute_error(y_true, pos_pred))

        # Conditional played-mean baseline
        played_mask = y_true > 0
        cond_pred = np.zeros_like(y_true, dtype=float)
        cond_pred[played_mask] = np.mean(y_true[played_mask])
        baselines["played_cond_mean_mae"] = float(mean_absolute_error(y_true, cond_pred))

        return baselines

    def print_summary(self, results: dict, experiment_name: str = "Experiment"):
        """Print formatted evaluation summary."""

        print(f"\n{'=' * 60}")
        print(f"COMPREHENSIVE EVALUATION: {experiment_name}")
        print(f"{'=' * 60}")

        strat = results["stratified"]
        print("\nSTRATIFIED METRICS")
        print(f"  Overall MAE:     {strat['mae_overall']:.4f}")
        print(f"  Overall RMSE:    {strat['rmse_overall']:.4f}")
        print(f"  Played MAE:      {strat['mae_played']:.4f} (n={strat['n_played']:,})")
        print(f"  Not-played MAE:  {strat['mae_not_played']:.4f} (n={strat['n_not_played']:,})")

        if strat.get("mae_high_return"):
            print(f"  High-return MAE: {strat['mae_high_return']:.4f} (n={strat['n_high_return']:,}, ≥5 pts)")

        if strat.get("mae_gk"):
            print("\n  By Position:")
            print(f"    GK:  {strat['mae_gk']:.4f}")
            print(f"    DEF: {strat['mae_def']:.4f}")
            print(f"    MID: {strat['mae_mid']:.4f}")
            print(f"    FWD: {strat['mae_fwd']:.4f}")

        calib = results["calibration"]
        print("\nCALIBRATION")
        print(f"  Mean predicted: {calib['mean_predicted']:.4f}")
        print(f"  Mean actual:    {calib['mean_actual']:.4f}")
        print(f"  Correlation:    {calib['correlation']:.4f}")
        print(f"  Spearman rho:   {calib['spearman_rho']:.4f}")

        if "business" in results:
            biz = results["business"]
            print("\nBUSINESS METRICS (Captain Picks)")
            print(f"  Top-1 accuracy: {biz['top1_accuracy'] * 100:.1f}%")
            print(f"  Top-3 accuracy: {biz['top3_accuracy'] * 100:.1f}%")
            print(f"  Top-5 accuracy: {biz['top5_accuracy'] * 100:.1f}%")
            print(f"  Captain efficiency: {biz['captain_efficiency'] * 100:.1f}%")

        base = results["baselines"]
        print("\nBASELINES (for context)")
        print(f"  Zero baseline MAE:        {base['zero_mae']:.4f}")
        print(f"  Mean baseline MAE:        {base['mean_mae']:.4f}")
        print(f"  Played-cond mean MAE:     {base['played_cond_mean_mae']:.4f}")

        # Delta vs baselines
        delta_zero = base["zero_mae"] - strat["mae_overall"]
        delta_mean = base["mean_mae"] - strat["mae_overall"]
        delta_played = base["played_cond_mean_mae"] - strat["mae_overall"]

        print("\nMODEL IMPROVEMENT")
        print(f"  vs Zero:        {delta_zero:+.4f} ({delta_zero / base['zero_mae'] * 100:+.1f}%)")
        print(f"  vs Mean:        {delta_mean:+.4f} ({delta_mean / base['mean_mae'] * 100:+.1f}%)")
        print(f"  vs Played-cond: {delta_played:+.4f} ({delta_played / base['played_cond_mean_mae'] * 100:+.1f}%)")

        print(f"\n{'=' * 60}\n")


def _prepare_xy(df: pd.DataFrame):
    y = df[TARGET_COL].values
    drop = set([TARGET_COL] + DROP_COLS)
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y


def _load_holdout_data(features_path: Path) -> tuple[pd.DataFrame, np.ndarray, np.ndarray, np.ndarray]:
    df = pd.read_csv(features_path, low_memory=False)

    # Convert categoricals for models that expect category dtype (e.g., LightGBM)
    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    if HOLDOUT_SEASON not in set(df["season"].dropna().unique()):
        raise ValueError(f"Holdout season {HOLDOUT_SEASON} not in data")

    holdout_df = df[df["season"] == HOLDOUT_SEASON].copy().reset_index(drop=True)

    positions = holdout_df["position"].values if "position" in holdout_df.columns else None
    gameweek_ids = holdout_df["GW"].values if "GW" in holdout_df.columns else None

    X, y = _prepare_xy(holdout_df)
    return X, y, positions, gameweek_ids


def _align_features_for_model(X: pd.DataFrame, model) -> pd.DataFrame:
    if hasattr(model, "feature_name_"):
        feature_names = list(model.feature_name_)
        missing = [c for c in feature_names if c not in X.columns]
        if missing:
            raise ValueError(f"Missing features required by model: {missing}")
        return X[feature_names]
    return X


def _predict_model(model, X: pd.DataFrame, positions: np.ndarray | None) -> np.ndarray:
    try:
        preds = model.predict(X)
    except TypeError:
        if positions is None:
            raise
        preds = model.predict(X, positions)
    if isinstance(preds, tuple):
        primary = preds[0]
        return np.asarray(primary)
    if isinstance(preds, dict):
        if "soft" in preds:
            return np.asarray(preds["soft"])
        if "stacked" in preds:
            return np.asarray(preds["stacked"])
        if "mean" in preds:
            return np.asarray(preds["mean"])
    return np.asarray(preds)


def run_from_cli() -> None:
    parser = argparse.ArgumentParser(description="Run comprehensive evaluation on holdout data.")
    parser.add_argument("--model-path", required=True, help="Path to trained model (joblib).")
    parser.add_argument(
        "--features-path",
        default="data/features/baseline_features.csv",
        help="Path to baseline features CSV.",
    )
    parser.add_argument(
        "--output-dir",
        default="outputs/metrics/comprehensive",
        help="Directory to save comprehensive metrics JSON.",
    )
    parser.add_argument(
        "--experiment-name",
        default=None,
        help="Optional name for output file. Defaults to model filename.",
    )

    args = parser.parse_args()

    model_path = Path(args.model_path)
    features_path = Path(args.features_path)
    output_dir = Path(args.output_dir)

    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")
    if not features_path.exists():
        raise FileNotFoundError(f"Features not found: {features_path}")

    model = joblib.load(model_path)
    X, y_true, positions, gameweek_ids = _load_holdout_data(features_path)
    X = _align_features_for_model(X, model)
    y_pred = _predict_model(model, X, positions)

    evaluator = ComprehensiveEvaluator(output_dir)
    experiment_name = args.experiment_name or model_path.stem
    results = evaluator.evaluate_holdout(
        y_true=y_true,
        y_pred=y_pred,
        positions=positions,
        gameweek_ids=gameweek_ids,
        experiment_name=experiment_name,
    )
    evaluator.print_summary(results, experiment_name)


if __name__ == "__main__":
    run_from_cli()
