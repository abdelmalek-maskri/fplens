# ml/evaluation/deep_comparison.py
"""
Deep Model Comparison: unified evaluation of all 9 key models.

Produces:
    outputs/comparison/master_comparison.json
    outputs/comparison/master_comparison.csv
    outputs/comparison/dm_tests.json
    outputs/comparison/dm_significance_matrix.csv
    outputs/comparison/error_analysis.json
    outputs/comparison/shap_comparison.json
"""

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


MODELS = [
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
        "catboost_tweedie",
        "ff9b",
        "outputs/experiments/multi_horizon/gw1/catboost_tweedie_vp1.5/model.joblib",
        "data/features/extended_features.csv",
        "catboost",
    ),
    ModelSpec(
        "gbm_avg_3seeds",
        "ff9b",
        "outputs/experiments/multi_horizon/gw1/gbm_avg_3seeds",
        "data/features/extended_features.csv",
        "gbm_avg",
    ),
    ModelSpec(
        "lgbm_ff9b",
        "ff9b",
        "outputs/experiments/multi_horizon/gw1/lgbm_baseline/model.joblib",
        "data/features/extended_features.csv",
        "plain",
    ),
]


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def load_holdout(features_csv: str) -> tuple[pd.DataFrame, np.ndarray]:
    """Load holdout data and return (full DataFrame, y_true)."""
    df = pd.read_csv(features_csv, low_memory=False)
    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    holdout = df[df["season"] == HOLDOUT_SEASON].copy().reset_index(drop=True)
    y = holdout[TARGET_COL].values
    return holdout, y


def prepare_X(holdout_df: pd.DataFrame) -> pd.DataFrame:
    """Drop target + identifiers to get feature matrix."""
    drop = set(DROP_COLS + [TARGET_COL])
    return holdout_df.drop(columns=[c for c in drop if c in holdout_df.columns])


# ---------------------------------------------------------------------------
# Model loading & prediction
# ---------------------------------------------------------------------------


def load_and_predict(spec: ModelSpec, holdout_df: pd.DataFrame) -> np.ndarray:
    """Load a model and generate holdout predictions."""
    X = prepare_X(holdout_df)

    if spec.model_type == "gbm_avg":
        # Load 3 seed models and average
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

    model = joblib.load(spec.model_path)

    if spec.model_type in ("stacked", "stacked_injury"):
        X_aligned = _align(X, model)
        result = model.predict(X_aligned)
        return result[0] if isinstance(result, tuple) else result

    if spec.model_type == "twohead":
        # TwoHeadModel has .classifier and .regressor — align using the regressor's features
        inner = getattr(model, "regressor", model)
        X_aligned = _align(X, inner)
        preds = model.predict(X_aligned)
        return preds["soft"]

    if spec.model_type == "position":
        positions = holdout_df["position"].values if "position" in holdout_df.columns else None
        X_aligned = _align(X, model)
        return model.predict(X_aligned, positions)

    if spec.model_type == "catboost":
        X_aligned = _align(X, model)
        return model.predict(X_aligned)

    # plain LightGBM / other
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
    # For stacked ensembles, extract from first base learner
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
# Main orchestrator
# ---------------------------------------------------------------------------


def run():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 65)
    print("  DEEP MODEL COMPARISON")
    print("=" * 65)

    # -- Load data per features CSV (cache to avoid re-reading) --
    data_cache: dict[str, tuple[pd.DataFrame, np.ndarray]] = {}
    all_predictions: dict[str, np.ndarray] = {}
    all_metrics: dict[str, dict] = {}
    canonical_y_true = None
    canonical_positions = None
    canonical_gw_ids = None
    canonical_teams = None

    # -- Generate predictions for each model --
    for spec in MODELS:
        print(f"\n--- {spec.name} ({spec.family}) ---")

        if not Path(spec.model_path).exists():
            print(f"  SKIP: model not found at {spec.model_path}")
            continue

        # Load holdout data (cached by CSV path)
        if spec.features_csv not in data_cache:
            print(f"  Loading {spec.features_csv}...")
            holdout_df, y_true = load_holdout(spec.features_csv)
            data_cache[spec.features_csv] = (holdout_df, y_true)
        else:
            holdout_df, y_true = data_cache[spec.features_csv]

        # Store canonical metadata from first model
        if canonical_y_true is None:
            canonical_y_true = y_true
            canonical_positions = holdout_df["position"].values if "position" in holdout_df.columns else None
            canonical_gw_ids = holdout_df["GW"].values if "GW" in holdout_df.columns else None
            canonical_teams = holdout_df["team"].values if "team" in holdout_df.columns else None

        # Predict
        try:
            y_pred = load_and_predict(spec, holdout_df)
            print(f"  Predictions: {len(y_pred)} players, range [{y_pred.min():.2f}, {y_pred.max():.2f}]")
        except Exception as e:
            print(f"  ERROR predicting: {e}")
            continue

        # Verify y_true alignment — when holdouts differ (different feature CSVs
        # may drop different rows), use model-specific metadata arrays so
        # positions/gw_ids/teams stay aligned with y_true.
        holdout_aligned = len(y_true) == len(canonical_y_true) and np.allclose(y_true, canonical_y_true, equal_nan=True)
        if not holdout_aligned:
            print(
                f"  WARNING: y_true mismatch ({len(y_true)} vs {len(canonical_y_true)}), "
                "excluded from pairwise DM tests and error correlations"
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

        # Only include in pairwise comparisons if holdout aligns
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
        metrics["n_features"] = int(holdout_df.shape[1]) - len(DROP_COLS) - 1  # approx
        all_metrics[spec.name] = metrics

        mae = metrics["stratified"]["mae_overall"]
        rho = metrics["calibration"]["spearman_rho"]
        print(f"  MAE={mae:.4f}  ρ={rho:.4f}")

    # -- Pairwise DM tests --
    print(f"\n{'=' * 65}")
    print("  PAIRWISE STATISTICAL TESTS")
    print(f"{'=' * 65}")

    pairwise = run_pairwise_tests(all_predictions, canonical_y_true)
    n_significant = sum(1 for v in pairwise.values() if v["significant_005"])
    print(f"  {len(pairwise)} pairs tested, {n_significant} significant at p<0.05")

    sig_matrix = build_significance_matrix(pairwise, list(all_predictions.keys()))

    # -- Error correlations --
    print("\n  Computing error correlations...")
    error_corr = compute_error_correlations(all_predictions, canonical_y_true)

    # -- SHAP comparison --
    print("\n  Loading SHAP data...")
    shap_comparison = load_shap_comparison()
    print(f"  Found SHAP for {len(shap_comparison)} models")

    # -- Save all outputs --
    print(f"\n{'=' * 65}")
    print("  SAVING OUTPUTS")
    print(f"{'=' * 65}")

    # Master comparison JSON
    (OUT_DIR / "master_comparison.json").write_text(json.dumps(all_metrics, indent=2, default=str))
    print("  Saved master_comparison.json")

    # Master comparison CSV (flat table)
    rows = []
    for name, m in all_metrics.items():
        row = {
            "model": name,
            "family": m["family"],
            "n_features": m.get("n_features", ""),
            "mae": m["stratified"]["mae_overall"],
            "rmse": m["stratified"]["rmse_overall"],
            "r2": m["calibration"].get("correlation", 0) ** 2,  # R² from correlation
            "spearman_rho": m["calibration"]["spearman_rho"],
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
    csv_df.to_csv(OUT_DIR / "master_comparison.csv", index=False)
    print(f"  Saved master_comparison.csv ({len(csv_df)} models)")

    # DM tests
    (OUT_DIR / "dm_tests.json").write_text(json.dumps(pairwise, indent=2, default=str))
    sig_matrix.to_csv(OUT_DIR / "dm_significance_matrix.csv")
    print("  Saved dm_tests.json + dm_significance_matrix.csv")

    # Error analysis
    error_analysis = {
        "error_correlations": error_corr.to_dict(),
    }
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

    (OUT_DIR / "error_analysis.json").write_text(json.dumps(error_analysis, indent=2, default=str))
    print("  Saved error_analysis.json")

    # SHAP comparison
    (OUT_DIR / "shap_comparison.json").write_text(json.dumps(shap_comparison, indent=2, default=str))
    print("  Saved shap_comparison.json")

    # -- Print summary --
    print(f"\n{'=' * 65}")
    print("  RESULTS SUMMARY")
    print(f"{'=' * 65}")
    print(f"\n{'Model':<25s} {'MAE':>7s} {'RMSE':>7s} {'ρ':>7s} {'Capt%':>7s} {'Family':>12s}")
    print(f"{'-' * 25} {'-' * 7} {'-' * 7} {'-' * 7} {'-' * 7} {'-' * 12}")
    for _, row in csv_df.iterrows():
        cap = (
            f"{row.get('captain_efficiency', 0) * 100:.1f}" if pd.notna(row.get("captain_efficiency", None)) else "N/A"
        )
        print(
            f"  {row['model']:<23s} {row['mae']:7.4f} {row['rmse']:7.4f} {row['spearman_rho']:7.4f} {cap:>7s} {row['family']:>12s}"
        )

    print(f"\n  Best model: {csv_df.iloc[0]['model']} (MAE={csv_df.iloc[0]['mae']:.4f})")
    print(f"\n  All outputs saved to {OUT_DIR}/")
    print(f"{'=' * 65}")


if __name__ == "__main__":
    run()
