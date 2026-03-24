# ml/evaluation/comprehensive_metrics.py
"""
Comprehensive evaluation beyond MAE/RMSE: stratified performance,
calibration, captain pick accuracy, and per-GW stability.
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

from ml.config.eval_config import CAT_COLS, DROP_COLS, HOLDOUT_SEASON, TARGET_COL

# joblib needs these classes in scope to unpickle saved ensemble models
try:
    from ml.pipelines.train.train_stacked_ensemble import StackedEnsemble
except Exception:

    class StackedEnsemble:
        pass


try:
    from ml.pipelines.train.train_stacked_with_injury import StackedEnsembleInjury
except Exception:

    class StackedEnsembleInjury:
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
    mae_overall: float
    rmse_overall: float
    mae_played: float
    mae_not_played: float
    n_played: int
    n_not_played: int
    pct_played: float
    mae_gk: float | None = None
    mae_def: float | None = None
    mae_mid: float | None = None
    mae_fwd: float | None = None
    # players scoring >= 5 pts (the ones that matter for captain/transfer decisions)
    mae_high_return: float | None = None
    n_high_return: int = 0


@dataclass
class CalibrationMetrics:
    mean_predicted: float
    mean_actual: float
    std_predicted: float
    std_actual: float
    correlation: float
    spearman_rho: float
    decile_mae: list


@dataclass
class BusinessMetrics:
    """Captain pick accuracy: did our top prediction match the actual top scorer each GW?"""

    top1_accuracy: float
    top3_accuracy: float
    top5_accuracy: float
    optimal_captain_points: float
    predicted_captain_points: float
    captain_efficiency: float


@dataclass
class StabilityMetrics:
    mae_mean: float
    mae_std: float
    mae_min: float
    mae_max: float
    coefficient_of_variation: float
    seasons: list
    per_season_mae: list


def compute_stratified_metrics(y_true, y_pred, positions=None) -> StratifiedMetrics:
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))

    # ~60% of rows are 0-point (player didn't feature); split matters for interpretation
    played = y_true > 0
    n_played = int(played.sum())
    n_not = int((~played).sum())
    mae_played = mean_absolute_error(y_true[played], y_pred[played]) if n_played > 0 else 0.0
    mae_not = mean_absolute_error(y_true[~played], y_pred[~played]) if n_not > 0 else 0.0

    high = y_true >= 5
    n_high = int(high.sum())
    mae_high = mean_absolute_error(y_true[high], y_pred[high]) if n_high > 0 else None

    result = StratifiedMetrics(
        mae_overall=float(mae),
        rmse_overall=float(rmse),
        mae_played=float(mae_played),
        mae_not_played=float(mae_not),
        n_played=n_played,
        n_not_played=n_not,
        pct_played=float(100 * n_played / len(y_true)),
        mae_high_return=float(mae_high) if mae_high else None,
        n_high_return=n_high,
    )

    if positions is not None:
        for pos, attr in [("GK", "mae_gk"), ("DEF", "mae_def"), ("MID", "mae_mid"), ("FWD", "mae_fwd")]:
            mask = positions == pos
            if mask.sum() > 0:
                setattr(result, attr, float(mean_absolute_error(y_true[mask], y_pred[mask])))

    return result


def compute_calibration_metrics(y_true, y_pred, n_bins=10) -> CalibrationMetrics:
    correlation = float(np.corrcoef(y_true, y_pred)[0, 1])
    rho = float(stats.spearmanr(y_true, y_pred)[0])

    try:
        deciles = pd.qcut(y_pred, q=n_bins, labels=False, duplicates="drop")
    except ValueError:
        deciles = pd.cut(y_pred, bins=n_bins, labels=False, duplicates="drop")

    decile_mae = []
    for d in range(int(deciles.max()) + 1):
        mask = deciles == d
        if mask.sum() > 0:
            decile_mae.append(float(mean_absolute_error(y_true[mask], y_pred[mask])))

    return CalibrationMetrics(
        mean_predicted=float(np.mean(y_pred)),
        mean_actual=float(np.mean(y_true)),
        std_predicted=float(np.std(y_pred)),
        std_actual=float(np.std(y_true)),
        correlation=correlation,
        spearman_rho=rho,
        decile_mae=decile_mae,
    )


def compute_business_metrics(y_true, y_pred, gameweek_ids) -> BusinessMetrics:
    """Per-GW captain accuracy: does our top predicted player actually score highest?"""
    top1 = top3 = top5 = 0
    optimal_pts = pred_pts = 0

    for gw in np.unique(gameweek_ids):
        mask = gameweek_ids == gw
        gt, gp = y_true[mask], y_pred[mask]
        if len(gt) == 0:
            continue

        pred_order = np.argsort(-gp)
        best_idx = np.argmax(gt)

        top1 += int(pred_order[0] == best_idx)
        top3 += int(best_idx in pred_order[:3])
        top5 += int(best_idx in pred_order[:5])

        optimal_pts += gt[best_idx]
        pred_pts += gt[pred_order[0]]

    n = len(np.unique(gameweek_ids))
    return BusinessMetrics(
        top1_accuracy=float(top1 / n) if n else 0.0,
        top3_accuracy=float(top3 / n) if n else 0.0,
        top5_accuracy=float(top5 / n) if n else 0.0,
        optimal_captain_points=float(optimal_pts),
        predicted_captain_points=float(pred_pts),
        captain_efficiency=float(pred_pts / optimal_pts) if optimal_pts > 0 else 0.0,
    )


def compute_stability_metrics(cv_results, mae_col="mae", season_col="test_season") -> StabilityMetrics:
    vals = cv_results[mae_col].values
    return StabilityMetrics(
        mae_mean=float(np.mean(vals)),
        mae_std=float(np.std(vals)),
        mae_min=float(np.min(vals)),
        mae_max=float(np.max(vals)),
        coefficient_of_variation=float(np.std(vals) / np.mean(vals)),
        seasons=cv_results[season_col].tolist(),
        per_season_mae=vals.tolist(),
    )


class ComprehensiveEvaluator:
    def __init__(self, output_dir: Path):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def evaluate_holdout(self, y_true, y_pred, positions=None, gameweek_ids=None, experiment_name="experiment") -> dict:
        results = {}
        results["stratified"] = asdict(compute_stratified_metrics(y_true, y_pred, positions))
        results["calibration"] = asdict(compute_calibration_metrics(y_true, y_pred))

        if gameweek_ids is not None:
            results["business"] = asdict(compute_business_metrics(y_true, y_pred, gameweek_ids))

        results["baselines"] = self._baselines(y_true, positions)

        out = self.output_dir / f"{experiment_name}_comprehensive.json"
        out.write_text(json.dumps(results, indent=2, default=str))
        return results

    def _baselines(self, y_true, positions=None) -> dict:
        b = {}
        b["zero_mae"] = float(mean_absolute_error(y_true, np.zeros_like(y_true)))
        b["mean_mae"] = float(mean_absolute_error(y_true, np.full_like(y_true, np.mean(y_true), dtype=float)))

        if positions is not None:
            pos_pred = np.zeros_like(y_true, dtype=float)
            for pos in np.unique(positions):
                mask = positions == pos
                pos_pred[mask] = np.mean(y_true[mask])
            b["position_mean_mae"] = float(mean_absolute_error(y_true, pos_pred))

        # "predict mean if played, 0 if not" baseline
        played = y_true > 0
        cond = np.zeros_like(y_true, dtype=float)
        cond[played] = np.mean(y_true[played])
        b["played_cond_mean_mae"] = float(mean_absolute_error(y_true, cond))

        return b

    def print_summary(self, results: dict, name: str = "Experiment"):
        s = results["stratified"]
        c = results["calibration"]

        print(f"\n{'=' * 60}")
        print(f"  {name}")
        print(f"{'=' * 60}")
        print(f"  MAE: {s['mae_overall']:.4f}  RMSE: {s['rmse_overall']:.4f}  ρ: {c['spearman_rho']:.4f}")
        print(f"  played: {s['mae_played']:.4f} (n={s['n_played']:,})  not-played: {s['mae_not_played']:.4f}")

        if s.get("mae_high_return"):
            print(f"  high-return (≥5): {s['mae_high_return']:.4f} (n={s['n_high_return']:,})")

        if s.get("mae_gk"):
            print(f"  GK: {s['mae_gk']:.4f}  DEF: {s['mae_def']:.4f}  MID: {s['mae_mid']:.4f}  FWD: {s['mae_fwd']:.4f}")

        if "business" in results:
            b = results["business"]
            print(f"  captain: top1={b['top1_accuracy']*100:.1f}%  top3={b['top3_accuracy']*100:.1f}%  eff={b['captain_efficiency']*100:.1f}%")

        base = results["baselines"]
        delta = base["zero_mae"] - s["mae_overall"]
        print(f"  vs zero: {delta:+.4f} ({delta/base['zero_mae']*100:+.1f}%)")
        print(f"{'=' * 60}\n")


def _prepare_xy(df):
    y = df[TARGET_COL].values
    drop = set([TARGET_COL] + DROP_COLS)
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y


def _load_holdout(features_path: Path):
    df = pd.read_csv(features_path, low_memory=False)
    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    if HOLDOUT_SEASON not in set(df["season"].dropna().unique()):
        raise ValueError(f"Holdout season {HOLDOUT_SEASON} not in data")

    h = df[df["season"] == HOLDOUT_SEASON].copy().reset_index(drop=True)
    positions = h["position"].values if "position" in h.columns else None
    gw_ids = h["GW"].values if "GW" in h.columns else None
    X, y = _prepare_xy(h)
    return X, y, positions, gw_ids


def _align_features(X: pd.DataFrame, model) -> pd.DataFrame:
    """Ensure X has exactly the columns the model expects, in the right order."""
    names = None
    if hasattr(model, "feature_name_"):
        names = list(model.feature_name_)
    elif hasattr(model, "feature_names_"):
        names = list(model.feature_names_)

    if names is not None:
        missing = [c for c in names if c not in X.columns]
        if missing:
            raise ValueError(f"Missing features: {missing}")
        return X[names]
    return X


def _predict(model, X, positions=None):
    """Handle varying predict() signatures across model types."""
    try:
        preds = model.predict(X)
    except TypeError:
        if positions is None:
            raise
        preds = model.predict(X, positions)

    # Some models return dicts or tuples instead of arrays
    if isinstance(preds, tuple):
        return np.asarray(preds[0])
    if isinstance(preds, dict):
        for key in ("soft", "stacked", "mean"):
            if key in preds:
                return np.asarray(preds[key])
    return np.asarray(preds)


def run_from_cli() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--features-path", default="data/features/extended_features.csv")
    parser.add_argument("--output-dir", default="outputs/evaluation/metrics")
    parser.add_argument("--experiment-name", default=None)
    args = parser.parse_args()

    model_path = Path(args.model_path)
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")

    model = joblib.load(model_path)
    X, y_true, positions, gw_ids = _load_holdout(Path(args.features_path))
    X = _align_features(X, model)
    y_pred = _predict(model, X, positions)

    evaluator = ComprehensiveEvaluator(Path(args.output_dir))
    name = args.experiment_name or model_path.stem
    results = evaluator.evaluate_holdout(y_true, y_pred, positions, gw_ids, name)
    evaluator.print_summary(results, name)


if __name__ == "__main__":
    run_from_cli()
