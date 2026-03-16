# ml/analysis/shap_analysis.py

"""
SHAP Analysis for FPL Prediction Models
Provides:
1. Global feature importance (which features matter most?)
2. Position-specific importance (what matters for GK vs FWD?)
3. Feature interactions (which features work together?)
4. Individual prediction explanations
"""

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap

from ml.config.eval_config import (
    CAT_COLS,
    DROP_COLS,
    HOLDOUT_SEASON,
    TARGET_COL,
)

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


try:
    from ml.pipelines.train.train_stacked_with_injury import StackedEnsembleInjury
except Exception:

    class StackedEnsembleInjury:
        pass


OUT_DIR = Path("outputs/analysis/shap")
FEATURES_PATH = Path("data/features/extended_features.csv")
SAMPLE_SIZE = 5000  # For SHAP computation (full dataset is slow)


def load_data(features_path: Path):
    """Load and prepare data for SHAP analysis."""
    print("Loading data...")
    print(f"Using holdout season: {HOLDOUT_SEASON}")
    df = pd.read_csv(features_path, low_memory=False)

    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    # use holdout season for analysis
    test_df = df[df["season"] == HOLDOUT_SEASON].copy().reset_index(drop=True)

    # prepare features
    y = test_df[TARGET_COL].values
    drop = set([TARGET_COL] + DROP_COLS)
    X = test_df.drop(columns=[c for c in drop if c in test_df.columns])

    # store position for stratified analysis
    positions = test_df["position"].values if "position" in test_df.columns else None

    return X, y, positions, test_df


def load_model(model_path: Path):

    print(f"Loading model from: {model_path}")
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found at {model_path}.")

    return joblib.load(model_path)


def get_interpretable_model(model, positions: np.ndarray | None = None):
    # extract the primary LightGBM model from the ensemble for SHAP analysis.
    if hasattr(model, "regressor") and model.regressor is not None:
        print("Using TwoHeadModel regressor for SHAP analysis...")
        return model.regressor

    if hasattr(model, "models") and isinstance(model.models, dict) and model.models:
        if positions is not None:
            pos_values, pos_counts = np.unique(positions, return_counts=True)
            pos = pos_values[int(np.argmax(pos_counts))]
            if pos in model.models:
                print(f"Using position-specific model for SHAP analysis: {pos}")
                return model.models[pos]
        first_key = list(model.models.keys())[0]
        print(f"Using position-specific model fallback: {first_key}")
        return model.models[first_key]

    if not hasattr(model, "base_models"):
        print("Using provided model directly for SHAP analysis...")
        return model

    print("Extracting primary LightGBM from ensemble for SHAP analysis...")

    # get the main lgbm model (highest contribution to ensemble)
    if "lgbm" in model.base_models:
        lgbm_model, model_type = model.base_models["lgbm"]
        print(f"  Using 'lgbm' base model (type: {model_type})")
        return lgbm_model
    else:
        # fallback: use first available model
        first_name = list(model.base_models.keys())[0]
        model, _ = model.base_models[first_name]
        print(f"  Using '{first_name}' base model as fallback")
        return model


def compute_shap_values(model, X: pd.DataFrame, positions: np.ndarray, sample_size: int = 5000):
    """Compute SHAP values for the model."""
    print(f"Computing SHAP values (sample size: {sample_size})...")

    # sample for speed
    if len(X) > sample_size:
        sample_idx = np.random.RandomState(42).choice(len(X), sample_size, replace=False)
        X_sample = X.iloc[sample_idx].reset_index(drop=True)
        positions_sample = positions[sample_idx] if positions is not None else None
    else:
        X_sample = X
        positions_sample = positions

    # use TreeExplainer for tree-based models
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)

    return shap_values, X_sample, positions_sample, explainer


def global_importance(shap_values: np.ndarray, X_sample: pd.DataFrame) -> pd.DataFrame:
    """Compute global feature importance from SHAP values."""
    print("Computing global importance...")

    # Mean absolute SHAP value per feature
    importance = np.abs(shap_values).mean(axis=0)
    importance_df = pd.DataFrame(
        {
            "feature": X_sample.columns,
            "importance": importance,
            "importance_pct": importance / importance.sum() * 100,
        }
    ).sort_values("importance", ascending=False)

    return importance_df


def position_specific_importance(
    shap_values: np.ndarray,
    X_sample: pd.DataFrame,
    positions_sample: np.ndarray,
) -> dict:
    """Compute SHAP importance per position."""
    print("Computing position-specific importance...")

    if positions_sample is None:
        return {}

    results = {}

    for pos in ["GK", "DEF", "MID", "FWD"]:
        mask = positions_sample == pos
        if mask.sum() < 10:
            continue

        pos_shap = shap_values[mask]
        pos_importance = np.abs(pos_shap).mean(axis=0)

        importance_df = pd.DataFrame(
            {
                "feature": X_sample.columns,
                "importance": pos_importance,
                "importance_pct": pos_importance / pos_importance.sum() * 100,
            }
        ).sort_values("importance", ascending=False)

        results[pos] = importance_df

    return results


def feature_interactions(shap_values: np.ndarray, X_sample: pd.DataFrame, top_n: int = 10):
    """Analyze feature interactions using SHAP interaction values."""
    print("Analyzing feature interactions...")

    # get top features
    importance = np.abs(shap_values).mean(axis=0)
    top_features = X_sample.columns[np.argsort(-importance)[:top_n]].tolist()

    # compute correlation between SHAP values
    shap_df = pd.DataFrame(shap_values, columns=X_sample.columns)
    top_shap = shap_df[top_features]

    interaction_corr = top_shap.corr()

    return interaction_corr, top_features


def explain_predictions(
    model,
    X: pd.DataFrame,
    y: np.ndarray,
    test_df: pd.DataFrame,
    n_examples: int = 5,
) -> list:
    # generate explanations for specific predictions (without per-row SHAP)
    print("Generating example explanations...")

    examples = []

    # find interesting cases
    preds = model.predict(X)
    errors = np.abs(y - preds)

    # High-error cases (where model was wrong)
    high_error_idx = np.argsort(-errors)[:n_examples]

    for idx in high_error_idx:
        example = {
            "type": "high_error",
            "player": test_df.iloc[idx]["name"] if "name" in test_df.columns else f"Player {idx}",
            "position": str(test_df.iloc[idx]["position"]) if "position" in test_df.columns else "Unknown",
            "actual": float(y[idx]),
            "predicted": float(preds[idx]),
            "error": float(errors[idx]),
        }
        examples.append(example)

    # High-value predictions (potential captain picks)
    high_pred_idx = np.argsort(-preds)[:n_examples]

    for idx in high_pred_idx:
        if idx not in high_error_idx:
            example = {
                "type": "high_prediction",
                "player": test_df.iloc[idx]["name"] if "name" in test_df.columns else f"Player {idx}",
                "position": str(test_df.iloc[idx]["position"]) if "position" in test_df.columns else "Unknown",
                "actual": float(y[idx]),
                "predicted": float(preds[idx]),
                "error": float(errors[idx]),
            }
            examples.append(example)

    return examples


def generate_summary_report(
    global_imp: pd.DataFrame,
    position_imp: dict,
    interaction_corr: pd.DataFrame,
    examples: list,
    model_name: str,
) -> dict:

    report = {
        "overview": {
            "description": "SHAP analysis of FPL prediction model",
            "model": model_name,
            "holdout_season": HOLDOUT_SEASON,
        },
        "global_importance": {
            "top_10": global_imp.head(10).to_dict(orient="records"),
            "top_feature": global_imp.iloc[0]["feature"],
            "top_feature_pct": float(global_imp.iloc[0]["importance_pct"]),
        },
        "position_insights": {},
        "key_findings": [],
    }

    # position-specific insights
    for pos, imp_df in position_imp.items():
        top_3 = imp_df.head(3)["feature"].tolist()
        report["position_insights"][pos] = {
            "top_3_features": top_3,
            "top_feature": top_3[0],
        }

    # key findings
    findings = []

    # finding 1: most important feature overall
    findings.append(
        f"Most important feature: {global_imp.iloc[0]['feature']} "
        f"({global_imp.iloc[0]['importance_pct']:.1f}% of total importance)"
    )

    # finding 2: position differences
    gk_top = position_imp.get("GK", pd.DataFrame()).head(1)
    fwd_top = position_imp.get("FWD", pd.DataFrame()).head(1)
    if not gk_top.empty and not fwd_top.empty:
        findings.append(
            f"Position differences: GK relies on '{gk_top.iloc[0]['feature']}', "
            f"FWD relies on '{fwd_top.iloc[0]['feature']}'"
        )

    # finding 3: availability features
    avail_features = ["consecutive_starts", "games_since_start", "minutes_trend", "played_lag1"]
    avail_importance = global_imp[global_imp["feature"].isin(avail_features)]["importance_pct"].sum()
    findings.append(f"Availability features contribute {avail_importance:.1f}% of total importance")

    # finding 4: extended features value
    extended_features = [c for c in global_imp["feature"] if "_roll10" in c or "_season_avg" in c or "_momentum" in c]
    extended_importance = global_imp[global_imp["feature"].isin(extended_features)]["importance_pct"].sum()
    findings.append(
        f"Extended features (roll10, season_avg, momentum) contribute {extended_importance:.1f}% of importance"
    )

    report["key_findings"] = findings

    return report


def run() -> None:
    parser = argparse.ArgumentParser(description="Run SHAP analysis for a given model.")
    parser.add_argument(
        "--model-path",
        required=True,
        help="Path to trained model (joblib).",
    )
    parser.add_argument(
        "--features-path",
        default=str(FEATURES_PATH),
        help="Path to features CSV.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(OUT_DIR),
        help="Directory to save SHAP outputs.",
    )
    parser.add_argument(
        "--model-name",
        default=None,
        help="Optional label for report. Defaults to model filename.",
    )
    args = parser.parse_args()

    model_path = Path(args.model_path)
    features_path = Path(args.features_path)
    output_dir = Path(args.output_dir)

    print("=" * 60)
    print("SHAP Analysis for FPL Prediction")
    print("=" * 60)

    # create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # load data
    X, y, positions, test_df = load_data(features_path)
    print(f"Holdout data: {len(X)} samples, {len(X.columns)} features")

    # load model and extract interpretable component
    loaded_model = load_model(model_path)
    model = get_interpretable_model(loaded_model, positions)

    # compute shap values
    shap_values, X_sample, positions_sample, explainer = compute_shap_values(model, X, positions, SAMPLE_SIZE)

    model_name = args.model_name or model_path.stem

    # global importance
    global_imp = global_importance(shap_values, X_sample)
    global_imp.to_csv(output_dir / f"{model_name}_global_importance.csv", index=False)

    print("\nTOP 15 GLOBAL FEATURES:")
    print(global_imp.head(15).to_string(index=False))

    # position-specific importance
    position_imp = position_specific_importance(shap_values, X_sample, positions_sample)

    for pos, imp_df in position_imp.items():
        imp_df.to_csv(output_dir / f"{model_name}_{pos.lower()}_importance.csv", index=False)

    print("\nTOP 5 FEATURES BY POSITION:")
    for pos in ["GK", "DEF", "MID", "FWD"]:
        if pos in position_imp:
            top5 = position_imp[pos].head(5)["feature"].tolist()
            print(f"  {pos}: {', '.join(top5)}")

    # feature interactions
    interaction_corr, top_features = feature_interactions(shap_values, X_sample)
    interaction_corr.to_csv(output_dir / f"{model_name}_feature_interactions.csv")

    # example explanations
    examples = explain_predictions(model, X, y, test_df, n_examples=5)

    # summary report
    model_name = args.model_name or model_path.stem
    report = generate_summary_report(global_imp, position_imp, interaction_corr, examples, model_name=model_name)
    report["examples"] = examples

    (output_dir / f"{model_name}_shap_report.json").write_text(json.dumps(report, indent=2, default=str))

    # print key findings
    print("\nKEY FINDINGS:")
    for i, finding in enumerate(report["key_findings"], 1):
        print(f"  {i}. {finding}")

    # save model for future use
    joblib.dump(model, output_dir / f"{model_name}_interpretable_model.joblib")
    joblib.dump(explainer, output_dir / f"{model_name}_shap_explainer.joblib")

    print(f"\nAnalysis saved to: {output_dir}")
    print("=" * 60)


if __name__ == "__main__":
    run()
