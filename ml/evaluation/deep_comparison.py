# ml/evaluation/deep_comparison.py
"""
Deep Model Comparison: unified evaluation across all horizons.

Produces per-horizon outputs in:
    outputs/comparison/gw{h}/master_comparison.json
    outputs/comparison/gw{h}/master_comparison.csv
    outputs/comparison/gw{h}/dm_tests.json
    outputs/comparison/gw{h}/dm_significance_matrix.csv
    outputs/comparison/gw{h}/error_analysis.json
Plus cross-horizon summary:
    outputs/comparison/cross_horizon_summary.csv

Run all horizons:
    python -m ml.evaluation.deep_comparison
Run a single horizon:
    python -m ml.evaluation.deep_comparison --horizon 1
"""

import argparse
import contextlib
import itertools
import json
from dataclasses import asdict, dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.metrics import mean_absolute_error

from ml.config.eval_config import (
    CAT_COLS,
    DROP_COLS,
    HOLDOUT_SEASON,
    HORIZON_TARGETS,
    TARGET_COL,
)
from ml.evaluation.comprehensive_metrics import (
    compute_business_metrics,
    compute_calibration_metrics,
    compute_stratified_metrics,
)
from ml.utils.statistical_tests import diebold_mariano, paired_bootstrap_ci

# Model class imports needed for joblib.load() unpickling — these are used
# implicitly, not referenced directly in code.
with contextlib.suppress(Exception):
    from ml.pipelines.train.train_stacked_ensemble import StackedEnsemble  # noqa: F401
with contextlib.suppress(Exception):
    from ml.pipelines.train.train_stacked_with_injury import StackedEnsembleInjury  # noqa: F401
with contextlib.suppress(Exception):
    from ml.pipelines.train.train_twohead_model import TwoHeadModel  # noqa: F401
with contextlib.suppress(Exception):
    from ml.pipelines.train.train_position_specific import PositionSpecificLGBMModel  # noqa: F401

OUT_DIR = Path("outputs/comparison")
FF9B_ROOT = Path("outputs/experiments/multi_horizon")
FEATURES_CSV = "data/features/extended_features.csv"


# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------


@dataclass
class ModelSpec:
    name: str
    family: str  # production / ablation / ff9b
    model_path: str  # path to .joblib (or directory for multi-model)
    features_csv: str
    model_type: str  # plain / stacked / stacked_injury / twohead / position / gbm_avg / catboost


# GW+1: full comparison (production + ablation + ff9b)
MODELS_GW1 = [
    ModelSpec(
        "baseline", "production", "outputs/models/baseline.joblib", "data/features/extended_features.csv", "plain"
    ),
    ModelSpec(
        "twohead", "production", "outputs/models/twohead.joblib", "data/features/extended_features.csv", "twohead"
    ),
    ModelSpec(
        "position_specific",
        "production",
        "outputs/models/position_specific.joblib",
        "data/features/extended_features.csv",
        "position",
    ),
    ModelSpec(
        "stacked_ensemble",
        "production",
        "outputs/models/stacked_ensemble.joblib",
        "data/features/extended_features.csv",
        "stacked",
    ),
    ModelSpec(
        "config_A",
        "ablation",
        "outputs/experiments/ablation_injury/config_A/model.joblib",
        "data/features/extended_features.csv",
        "stacked_injury",
    ),
    ModelSpec(
        "config_D",
        "ablation",
        "outputs/experiments/ablation_injury/config_D/model.joblib",
        "data/features/extended_with_injury_and_news.csv",
        "stacked_injury",
    ),
    ModelSpec(
        "catboost_tweedie_vp1.2",
        "ff9b",
        "outputs/experiments/multi_horizon/gw1/catboost_tweedie_vp1.2/model.joblib",
        FEATURES_CSV,
        "catboost",
    ),
    ModelSpec(
        "catboost_tweedie_vp1.5",
        "ff9b",
        "outputs/experiments/multi_horizon/gw1/catboost_tweedie_vp1.5/model.joblib",
        FEATURES_CSV,
        "catboost",
    ),
    ModelSpec(
        "catboost_tweedie_vp1.8",
        "ff9b",
        "outputs/experiments/multi_horizon/gw1/catboost_tweedie_vp1.8/model.joblib",
        FEATURES_CSV,
        "catboost",
    ),
    ModelSpec(
        "gbm_avg_3seeds",
        "ff9b",
        "outputs/experiments/multi_horizon/gw1/gbm_avg_3seeds",
        FEATURES_CSV,
        "gbm_avg",
    ),
    ModelSpec(
        "lgbm_baseline",
        "ff9b",
        "outputs/experiments/multi_horizon/gw1/lgbm_baseline/model.joblib",
        FEATURES_CSV,
        "plain",
    ),
    ModelSpec(
        "lgbm_reduced",
        "ff9b",
        "outputs/experiments/multi_horizon/gw1/lgbm_reduced/model.joblib",
        FEATURES_CSV,
        "plain",
    ),
    ModelSpec(
        "hurdle_soft",
        "ff9b",
        "outputs/experiments/multi_horizon/gw1/hurdle_soft",
        FEATURES_CSV,
        "hurdle",
    ),
    ModelSpec(
        "loss_asymmetric_a1.5",
        "ff9b",
        "outputs/experiments/multi_horizon/gw1/loss_asymmetric_a1.5/model.joblib",
        FEATURES_CSV,
        "plain",
    ),
]


def _build_ff9b_models(horizon: int) -> list[ModelSpec]:
    """Build model registry for GW+2 or GW+3 top candidates."""
    h = horizon
    root = str(FF9B_ROOT / f"gw{h}")
    candidates = [
        ("lgbm_reduced", f"{root}/lgbm_reduced/model.joblib", "plain"),
        ("lgbm_baseline", f"{root}/lgbm_baseline/model.joblib", "plain"),
        ("gbm_avg_3seeds", f"{root}/gbm_avg_3seeds", "gbm_avg"),
        ("catboost_tweedie_vp1.2", f"{root}/catboost_tweedie_vp1.2/model.joblib", "catboost"),
        ("catboost_tweedie_vp1.5", f"{root}/catboost_tweedie_vp1.5/model.joblib", "catboost"),
        ("catboost_tweedie_vp1.8", f"{root}/catboost_tweedie_vp1.8/model.joblib", "catboost"),
        ("hurdle_soft", f"{root}/hurdle_soft", "hurdle"),
    ]
    return [ModelSpec(name, "ff9b", path, FEATURES_CSV, mtype) for name, path, mtype in candidates]


HORIZON_MODELS = {
    1: MODELS_GW1,
    2: _build_ff9b_models(2),
    3: _build_ff9b_models(3),
}


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def load_holdout(features_csv: str, target_col: str = TARGET_COL) -> tuple[pd.DataFrame, np.ndarray]:
    """Load holdout data for a specific target column.

    Drops rows where the target is NaN (important for GW+2/3 where
    the last 1-2 gameweeks of the season have no target).
    """
    df = pd.read_csv(features_csv, low_memory=False)
    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    holdout = df[df["season"] == HOLDOUT_SEASON].copy()
    holdout = holdout.dropna(subset=[target_col]).reset_index(drop=True)
    y = holdout[target_col].values.astype(float)
    return holdout, y


def prepare_X(holdout_df: pd.DataFrame, target_col: str = TARGET_COL) -> pd.DataFrame:
    """Drop target + identifiers to get feature matrix."""
    drop = set(DROP_COLS + [target_col])
    return holdout_df.drop(columns=[c for c in drop if c in holdout_df.columns])


# ---------------------------------------------------------------------------
# Model loading & prediction
# ---------------------------------------------------------------------------


def load_and_predict(spec: ModelSpec, holdout_df: pd.DataFrame, target_col: str = TARGET_COL) -> np.ndarray:
    """Load a model and generate holdout predictions."""
    X = prepare_X(holdout_df, target_col)

    if spec.model_type == "gbm_avg":
        model_dir = Path(spec.model_path)
        seed_files = sorted(model_dir.glob("model_seed*.joblib"))
        if not seed_files:
            raise FileNotFoundError(f"No model_seed*.joblib files found in {model_dir}")
        preds_list = []
        for seed_file in seed_files:
            m = joblib.load(seed_file)
            X_aligned = _align(X, m)
            preds_list.append(m.predict(X_aligned))
        return np.mean(preds_list, axis=0)

    if spec.model_type == "hurdle":
        model_dir = Path(spec.model_path)
        clf_path = model_dir / "classifier.joblib"
        reg_path = model_dir / "regressor.joblib"
        if not clf_path.exists() or not reg_path.exists():
            raise FileNotFoundError(f"Missing classifier/regressor in {model_dir}")
        clf = joblib.load(clf_path)
        reg = joblib.load(reg_path)
        X_aligned = _align(X, reg)
        play_prob = clf.predict_proba(X_aligned)[:, 1]
        points_if_play = reg.predict(X_aligned)
        return play_prob * points_if_play

    model = joblib.load(spec.model_path)

    if spec.model_type in ("stacked", "stacked_injury"):
        X_aligned = _align(X, model)
        result = model.predict(X_aligned)
        return result[0] if isinstance(result, tuple) else result

    if spec.model_type == "twohead":
        inner = getattr(model, "regressor", model)
        X_aligned = _align(X, inner)
        preds = model.predict(X_aligned)
        return preds["soft"]

    if spec.model_type == "position":
        positions = holdout_df["position"].values if "position" in holdout_df.columns else None
        X_aligned = _align(X, model)
        return model.predict(X_aligned, positions)

    # plain LightGBM / CatBoost / other
    X_aligned = _align(X, model)
    return model.predict(X_aligned)


def _align(X: pd.DataFrame, model) -> pd.DataFrame:
    """Align features to what the model expects."""
    feature_names = None
    if hasattr(model, "feature_name_"):
        feature_names = list(model.feature_name_)
    elif hasattr(model, "feature_names_"):
        feature_names = list(model.feature_names_)
    elif hasattr(model, "feature_names_in_"):
        feature_names = list(model.feature_names_in_)
    elif hasattr(model, "feature_cols"):
        feature_names = list(model.feature_cols)
    elif hasattr(model, "base_models"):
        for name in getattr(model, "base_names", list(model.base_models.keys())):
            m, _ = model.base_models[name]
            if hasattr(m, "feature_name_"):
                feature_names = list(m.feature_name_)
                break

    if feature_names is None:
        return X

    for col in feature_names:
        if col not in X.columns:
            X = X.copy()
            X[col] = 0
    return X[feature_names]


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------


def evaluate_model(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    positions: np.ndarray | None,
    gw_ids: np.ndarray | None,
    teams: np.ndarray | None,
) -> dict:
    """Compute all metrics for a single model."""
    result = {}

    # Stratified metrics
    strat = compute_stratified_metrics(y_true, y_pred, positions)
    result["stratified"] = asdict(strat)

    # Calibration
    calib = compute_calibration_metrics(y_true, y_pred)
    result["calibration"] = asdict(calib)

    # Business metrics
    if gw_ids is not None:
        biz = compute_business_metrics(y_true, y_pred, gw_ids)
        result["business"] = asdict(biz)

    # Baselines
    zero_mae = float(mean_absolute_error(y_true, np.zeros_like(y_true)))
    mean_pred = np.full_like(y_true, np.mean(y_true), dtype=float)
    mean_mae = float(mean_absolute_error(y_true, mean_pred))
    result["baselines"] = {
        "zero_mae": zero_mae,
        "mean_mae": mean_mae,
        "mae_vs_zero": zero_mae - result["stratified"]["mae_overall"],
        "mae_vs_mean": mean_mae - result["stratified"]["mae_overall"],
    }

    # High-value thresholds
    for threshold in [5, 8, 10]:
        mask = y_true >= threshold
        n = int(mask.sum())
        if n > 0:
            result[f"mae_gte_{threshold}pts"] = float(mean_absolute_error(y_true[mask], y_pred[mask]))
            result[f"n_gte_{threshold}pts"] = n

    # Per-GW stability
    if gw_ids is not None:
        gw_maes = []
        for gw in np.unique(gw_ids):
            mask = gw_ids == gw
            if mask.sum() > 0:
                gw_maes.append(float(mean_absolute_error(y_true[mask], y_pred[mask])))
        result["stability"] = {
            "gw_mae_mean": float(np.mean(gw_maes)),
            "gw_mae_std": float(np.std(gw_maes)),
            "gw_mae_cov": float(np.std(gw_maes) / np.mean(gw_maes)) if np.mean(gw_maes) > 0 else 0,
            "gw_mae_min": float(np.min(gw_maes)),
            "gw_mae_max": float(np.max(gw_maes)),
            "per_gw": gw_maes,
        }

    # Per-team MAE
    if teams is not None:
        team_maes = {}
        for team in np.unique(teams):
            mask = teams == team
            if mask.sum() > 0:
                team_maes[str(team)] = float(mean_absolute_error(y_true[mask], y_pred[mask]))
        result["per_team_mae"] = team_maes

    # Residual stats
    residuals = y_true - y_pred
    result["residuals"] = {
        "mean": float(np.mean(residuals)),
        "std": float(np.std(residuals)),
        "skewness": float(stats.skew(residuals)),
        "kurtosis": float(stats.kurtosis(residuals)),
    }

    return result


# ---------------------------------------------------------------------------
# Pairwise statistical tests
# ---------------------------------------------------------------------------


def run_pairwise_tests(
    all_predictions: dict[str, np.ndarray],
    y_true: np.ndarray,
) -> dict:
    """Run DM tests and bootstrap CIs for all model pairs."""
    results = {}
    names = list(all_predictions.keys())

    for a, b in itertools.combinations(names, 2):
        pred_a = all_predictions[a]
        pred_b = all_predictions[b]
        errors_a = y_true - pred_a
        errors_b = y_true - pred_b

        dm_stat, dm_p = diebold_mariano(errors_a, errors_b)
        mean_delta, ci_lo, ci_hi = paired_bootstrap_ci(y_true, pred_a, pred_b, n_boot=5000)

        mae_a = float(mean_absolute_error(y_true, pred_a))
        mae_b = float(mean_absolute_error(y_true, pred_b))

        results[f"{a}_vs_{b}"] = {
            "mae_a": mae_a,
            "mae_b": mae_b,
            "dm_statistic": dm_stat,
            "dm_p_value": dm_p,
            "significant_005": dm_p < 0.05,
            "significant_001": dm_p < 0.01,
            "bootstrap_mean_delta": mean_delta,
            "bootstrap_ci_lower": ci_lo,
            "bootstrap_ci_upper": ci_hi,
            "better_model": a if mae_a < mae_b else b,
        }

    return results


def build_significance_matrix(pairwise_tests: dict, model_names: list[str]) -> pd.DataFrame:
    """Build an NxN matrix of DM test p-values."""
    matrix = pd.DataFrame(1.0, index=model_names, columns=model_names)

    for key, result in pairwise_tests.items():
        parts = key.split("_vs_")
        a, b = parts[0], parts[1]
        if a in model_names and b in model_names:
            matrix.loc[a, b] = result["dm_p_value"]
            matrix.loc[b, a] = result["dm_p_value"]

    np.fill_diagonal(matrix.values, 0.0)
    return matrix


# ---------------------------------------------------------------------------
# Error correlation (ensemble diversity)
# ---------------------------------------------------------------------------


def compute_error_correlations(
    all_predictions: dict[str, np.ndarray],
    y_true: np.ndarray,
) -> pd.DataFrame:
    """Compute pairwise correlation of absolute errors between models."""
    errors = {name: np.abs(y_true - preds) for name, preds in all_predictions.items()}
    error_df = pd.DataFrame(errors)
    return error_df.corr()


# ---------------------------------------------------------------------------
# SHAP comparison
# ---------------------------------------------------------------------------


def load_shap_comparison() -> dict:
    """Load SHAP global importance for all models that have it."""
    shap_dir = Path("outputs/analysis/shap")
    result = {}

    for csv_file in shap_dir.glob("*_global_importance.csv"):
        model_name = csv_file.stem.replace("_global_importance", "")
        try:
            df = pd.read_csv(csv_file)
            top10 = df.head(10)
            result[model_name] = [
                {"feature": row.iloc[0], "importance": round(float(row.iloc[1]), 4)} for _, row in top10.iterrows()
            ]
        except Exception:
            continue

    return result


# ---------------------------------------------------------------------------
# Save outputs for a single horizon
# ---------------------------------------------------------------------------


def _save_horizon_outputs(
    out_dir: Path,
    all_metrics: dict,
    all_predictions: dict,
    canonical_y_true: np.ndarray,
    horizon: int,
) -> pd.DataFrame:
    """Save all output files for one horizon. Returns the CSV DataFrame."""
    out_dir.mkdir(parents=True, exist_ok=True)

    # Master comparison JSON
    (out_dir / "master_comparison.json").write_text(json.dumps(all_metrics, indent=2, default=str))

    # Master comparison CSV (flat table)
    rows = []
    for name, m in all_metrics.items():
        row = {
            "model": name,
            "family": m["family"],
            "n_features": m.get("n_features", ""),
            "mae": m["stratified"]["mae_overall"],
            "rmse": m["stratified"]["rmse_overall"],
            "spearman_rho": m["calibration"]["spearman_rho"],
            "correlation": m["calibration"].get("correlation", ""),
            "mae_played": m["stratified"]["mae_played"],
            "mae_not_played": m["stratified"]["mae_not_played"],
            "mae_high_return": m["stratified"].get("mae_high_return", ""),
            "mae_gk": m["stratified"].get("mae_gk", ""),
            "mae_def": m["stratified"].get("mae_def", ""),
            "mae_mid": m["stratified"].get("mae_mid", ""),
            "mae_fwd": m["stratified"].get("mae_fwd", ""),
        }
        if "business" in m:
            row["captain_top1"] = m["business"]["top1_accuracy"]
            row["captain_top3"] = m["business"]["top3_accuracy"]
            row["captain_top5"] = m["business"]["top5_accuracy"]
            row["captain_efficiency"] = m["business"]["captain_efficiency"]
        if "stability" in m:
            row["gw_mae_std"] = m["stability"]["gw_mae_std"]
            row["gw_mae_cov"] = m["stability"]["gw_mae_cov"]
        row["mae_vs_zero"] = m["baselines"]["mae_vs_zero"]
        row["mae_vs_mean"] = m["baselines"]["mae_vs_mean"]
        rows.append(row)

    csv_df = pd.DataFrame(rows).sort_values("mae")
    csv_df.to_csv(out_dir / "master_comparison.csv", index=False)

    # DM tests
    if len(all_predictions) >= 2:
        pairwise = run_pairwise_tests(all_predictions, canonical_y_true)
        n_sig = sum(1 for v in pairwise.values() if v["significant_005"])
        print(f"  {len(pairwise)} pairs tested, {n_sig} significant at p<0.05")

        sig_matrix = build_significance_matrix(pairwise, list(all_predictions.keys()))
        (out_dir / "dm_tests.json").write_text(json.dumps(pairwise, indent=2, default=str))
        sig_matrix.to_csv(out_dir / "dm_significance_matrix.csv")

        # Error correlations
        error_corr = compute_error_correlations(all_predictions, canonical_y_true)
    else:
        pairwise = {}
        error_corr = pd.DataFrame()

    # Error analysis
    error_analysis = {"error_correlations": error_corr.to_dict() if not error_corr.empty else {}}
    for name, m in all_metrics.items():
        error_analysis[name] = {
            "residuals": m.get("residuals", {}),
            "stability": m.get("stability", {}),
            "per_team_mae": m.get("per_team_mae", {}),
        }
        for t in [5, 8, 10]:
            k = f"mae_gte_{t}pts"
            if k in m:
                error_analysis[name][k] = m[k]

    (out_dir / "error_analysis.json").write_text(json.dumps(error_analysis, indent=2, default=str))

    # SHAP (only for GW+1 — SHAP models are horizon-specific)
    if horizon == 1:
        shap_comparison = load_shap_comparison()
        (out_dir / "shap_comparison.json").write_text(json.dumps(shap_comparison, indent=2, default=str))
        print(f"  Found SHAP for {len(shap_comparison)} models")

    print(f"  Saved outputs to {out_dir}/")
    return csv_df


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------


def run_horizon(horizon: int, models: list[ModelSpec], out_dir: Path):
    """Run full evaluation for a single horizon."""
    target_col = HORIZON_TARGETS[horizon]

    print(f"\n{'=' * 65}")
    print(f"  DEEP COMPARISON — GW+{horizon} (target: {target_col})")
    print(f"{'=' * 65}")

    data_cache: dict[str, tuple[pd.DataFrame, np.ndarray]] = {}
    all_predictions: dict[str, np.ndarray] = {}
    all_metrics: dict[str, dict] = {}
    canonical_y_true = None
    canonical_positions = None
    canonical_gw_ids = None
    canonical_teams = None

    for spec in models:
        print(f"\n--- {spec.name} ({spec.family}) ---")

        if not Path(spec.model_path).exists():
            print(f"  SKIP: model not found at {spec.model_path}")
            continue

        # Load holdout data (cached by CSV + target)
        cache_key = f"{spec.features_csv}::{target_col}"
        if cache_key not in data_cache:
            print(f"  Loading {spec.features_csv} (target={target_col})...")
            holdout_df, y_true = load_holdout(spec.features_csv, target_col)
            data_cache[cache_key] = (holdout_df, y_true)
        else:
            holdout_df, y_true = data_cache[cache_key]

        # Store canonical metadata from first model
        if canonical_y_true is None:
            canonical_y_true = y_true
            canonical_positions = holdout_df["position"].values if "position" in holdout_df.columns else None
            canonical_gw_ids = holdout_df["GW"].values if "GW" in holdout_df.columns else None
            canonical_teams = holdout_df["team"].values if "team" in holdout_df.columns else None

        # Predict
        try:
            y_pred = load_and_predict(spec, holdout_df, target_col)
            print(f"  Predictions: {len(y_pred)} rows, range [{y_pred.min():.2f}, {y_pred.max():.2f}]")
        except Exception as e:
            print(f"  ERROR predicting: {e}")
            continue

        # Verify y_true alignment
        holdout_aligned = len(y_true) == len(canonical_y_true) and np.allclose(y_true, canonical_y_true, equal_nan=True)
        if not holdout_aligned:
            print(
                f"  WARNING: y_true mismatch ({len(y_true)} vs {len(canonical_y_true)}), "
                "excluded from pairwise DM tests"
            )
            model_y_true = y_true
            model_positions = holdout_df["position"].values if "position" in holdout_df.columns else None
            model_gw_ids = holdout_df["GW"].values if "GW" in holdout_df.columns else None
            model_teams = holdout_df["team"].values if "team" in holdout_df.columns else None
        else:
            model_y_true = canonical_y_true
            model_positions = canonical_positions
            model_gw_ids = canonical_gw_ids
            model_teams = canonical_teams

        if holdout_aligned:
            all_predictions[spec.name] = y_pred

        # Evaluate
        print("  Computing metrics...")
        metrics = evaluate_model(
            model_y_true,
            y_pred,
            positions=model_positions,
            gw_ids=model_gw_ids,
            teams=model_teams,
        )
        metrics["family"] = spec.family
        metrics["n_features"] = int(holdout_df.shape[1]) - len(DROP_COLS) - 1
        all_metrics[spec.name] = metrics

        mae = metrics["stratified"]["mae_overall"]
        rho = metrics["calibration"]["spearman_rho"]
        print(f"  MAE={mae:.4f}  ρ={rho:.4f}")

    if not all_metrics:
        print("  No models evaluated — skipping output.")
        return

    # Save outputs
    print(f"\n{'=' * 65}")
    print(f"  SAVING GW+{horizon} OUTPUTS")
    print(f"{'=' * 65}")

    csv_df = _save_horizon_outputs(out_dir, all_metrics, all_predictions, canonical_y_true, horizon)

    # Print summary
    print(f"\n{'Model':<25s} {'MAE':>7s} {'RMSE':>7s} {'ρ':>7s} {'Capt%':>7s} {'Family':>12s}")
    print(f"{'-' * 25} {'-' * 7} {'-' * 7} {'-' * 7} {'-' * 7} {'-' * 12}")
    for _, row in csv_df.iterrows():
        cap = (
            f"{row.get('captain_efficiency', 0) * 100:.1f}" if pd.notna(row.get("captain_efficiency", None)) else "N/A"
        )
        print(
            f"  {row['model']:<23s} {row['mae']:7.4f} {row['rmse']:7.4f} "
            f"{row['spearman_rho']:7.4f} {cap:>7s} {row['family']:>12s}"
        )

    print(f"\n  Best model: {csv_df.iloc[0]['model']} (MAE={csv_df.iloc[0]['mae']:.4f})")


def generate_cross_horizon_summary():
    """Combine per-horizon results into a single cross-horizon table."""
    rows = []
    for h in [1, 2, 3]:
        csv_path = OUT_DIR / f"gw{h}" / "master_comparison.csv"
        if not csv_path.exists():
            continue
        df = pd.read_csv(csv_path)
        df.insert(0, "horizon", h)
        rows.append(df)

    if not rows:
        return

    combined = pd.concat(rows, ignore_index=True)
    combined.to_csv(OUT_DIR / "cross_horizon_summary.csv", index=False)

    # Best per horizon
    best = {}
    for h in [1, 2, 3]:
        sub = combined[combined.horizon == h]
        if len(sub) == 0:
            continue
        top = sub.iloc[0]  # already sorted by MAE within each horizon
        best[f"gw_plus_{h}"] = {
            "model": top["model"],
            "mae": float(top["mae"]),
            "rmse": float(top["rmse"]),
            "spearman_rho": float(top["spearman_rho"]),
            "captain_top3": float(top["captain_top3"]) if pd.notna(top.get("captain_top3")) else None,
        }

    (OUT_DIR / "cross_horizon_summary.json").write_text(json.dumps(best, indent=2))
    print(f"\n  Cross-horizon summary saved to {OUT_DIR}/")


def run():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for h in [1, 2, 3]:
        models = HORIZON_MODELS[h]
        run_horizon(h, models, OUT_DIR / f"gw{h}")

    generate_cross_horizon_summary()

    print(f"\n{'=' * 65}")
    print("  ALL DONE")
    print(f"{'=' * 65}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deep model comparison across horizons")
    parser.add_argument("--horizon", type=int, choices=[1, 2, 3], help="Single horizon to evaluate (default: all)")
    args = parser.parse_args()

    if args.horizon:
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        run_horizon(args.horizon, HORIZON_MODELS[args.horizon], OUT_DIR / f"gw{args.horizon}")
    else:
        run()
