# ml/analysis/shap_analysis.py
"""
SHAP feature importance analysis for trained FPL prediction models.

Computes global importance, per-position breakdowns, feature interaction
correlations, and example prediction explanations on the holdout season.
Outputs saved to outputs/evaluation/shap/{model_name}/.
"""

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap

from ml.config.eval_config import CAT_COLS, DROP_COLS, HOLDOUT_SEASON, TARGET_COL

# joblib needs these classes in scope to unpickle saved ensemble models
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


try:
    from ml.pipelines.train.train_catboost_position import CatBoostPositionModel
except Exception:

    class CatBoostPositionModel:
        pass


try:
    from ml.pipelines.train.train_catboost_twohead import CatBoostTwoHead
except Exception:

    class CatBoostTwoHead:
        pass


OUT_DIR = Path("outputs/evaluation/shap")
FEATURES_PATH = Path("data/features/extended_features.csv")
SAMPLE_SIZE = 10000


def load_data(features_path: Path):
    df = pd.read_csv(features_path, low_memory=False)
    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    test_df = df[df["season"] == HOLDOUT_SEASON].copy().reset_index(drop=True)
    y = test_df[TARGET_COL].values
    drop = set([TARGET_COL] + DROP_COLS)
    X = test_df.drop(columns=[c for c in drop if c in test_df.columns])
    positions = test_df["position"].values if "position" in test_df.columns else None

    return X, y, positions, test_df


def load_model(model_path: Path):
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found at {model_path}.")
    return joblib.load(model_path)


def get_interpretable_model(model, positions: np.ndarray | None = None):
    """Extract a tree model that TreeExplainer can handle.

    For ensembles/wrappers, extracts the primary tree component.
    This means SHAP explains one base learner, not the full ensemble logic.
    """
    if hasattr(model, "regressor") and model.regressor is not None:
        print("  extracting TwoHeadModel regressor")
        return model.regressor

    # PositionSpecific: pick the most common position's model
    if hasattr(model, "models") and isinstance(model.models, dict) and model.models:
        if positions is not None:
            pos_values, pos_counts = np.unique(positions, return_counts=True)
            pos = pos_values[int(np.argmax(pos_counts))]
            if pos in model.models:
                print(f"  extracting position-specific model: {pos}")
                return model.models[pos]
        first_key = list(model.models.keys())[0]
        print(f"  extracting position-specific model (fallback): {first_key}")
        return model.models[first_key]

    if not hasattr(model, "base_models"):
        return model

    # Stacked ensemble: use the primary LightGBM (highest meta-learner weight)
    print("  extracting primary LightGBM from stacked ensemble")
    if "lgbm" in model.base_models:
        lgbm_model, _ = model.base_models["lgbm"]
        return lgbm_model

    first_name = list(model.base_models.keys())[0]
    fallback, _ = model.base_models[first_name]
    print(f"  using '{first_name}' as fallback")
    return fallback


def compute_shap_values(model, X: pd.DataFrame, positions: np.ndarray, sample_size: int = SAMPLE_SIZE):
    # SHAP on 230K rows is too slow; random sample gives stable top-15 importance
    if len(X) > sample_size:
        idx = np.random.RandomState(42).choice(len(X), sample_size, replace=False)
        X_sample = X.iloc[idx].reset_index(drop=True)
        pos_sample = positions[idx] if positions is not None else None
    else:
        X_sample = X
        pos_sample = positions

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)

    return shap_values, X_sample, pos_sample, explainer


def global_importance(shap_values: np.ndarray, X_sample: pd.DataFrame) -> pd.DataFrame:
    imp = np.abs(shap_values).mean(axis=0)
    return pd.DataFrame({
        "feature": X_sample.columns,
        "importance": imp,
        "importance_pct": imp / imp.sum() * 100,
    }).sort_values("importance", ascending=False)


def position_importance(shap_values: np.ndarray, X_sample: pd.DataFrame, positions: np.ndarray) -> dict:
    if positions is None:
        return {}

    results = {}
    for pos in ["GK", "DEF", "MID", "FWD"]:
        mask = positions == pos
        if mask.sum() < 10:
            continue
        imp = np.abs(shap_values[mask]).mean(axis=0)
        results[pos] = pd.DataFrame({
            "feature": X_sample.columns,
            "importance": imp,
            "importance_pct": imp / imp.sum() * 100,
        }).sort_values("importance", ascending=False)

    return results


def feature_interactions(shap_values: np.ndarray, X_sample: pd.DataFrame, top_n: int = 10):
    """Proxy for SHAP interaction values: correlation between SHAP columns.

    True shap_interaction_values() is O(N*F^2*T) and takes 30+ minutes.
    SHAP value correlation captures the same directional insight at ~0 cost.
    """
    imp = np.abs(shap_values).mean(axis=0)
    top_cols = X_sample.columns[np.argsort(-imp)[:top_n]].tolist()
    shap_df = pd.DataFrame(shap_values, columns=X_sample.columns)
    return shap_df[top_cols].corr(), top_cols


def explain_predictions(model, X, y, test_df, n_examples: int = 5) -> list:
    preds = model.predict(X)
    errors = np.abs(y - preds)
    examples = []

    def _make(idx, kind):
        return {
            "type": kind,
            "player": test_df.iloc[idx].get("name", f"Player {idx}"),
            "position": str(test_df.iloc[idx].get("position", "?")),
            "actual": float(y[idx]),
            "predicted": float(preds[idx]),
            "error": float(errors[idx]),
        }

    for idx in np.argsort(-errors)[:n_examples]:
        examples.append(_make(idx, "high_error"))

    seen = {e["player"] for e in examples}
    for idx in np.argsort(-preds)[:n_examples]:
        name = test_df.iloc[idx].get("name", f"Player {idx}")
        if name not in seen:
            examples.append(_make(idx, "high_prediction"))

    return examples


def build_report(global_imp, pos_imp, interactions, examples, model_name):
    report = {
        "model": model_name,
        "holdout_season": HOLDOUT_SEASON,
        "global_top_10": global_imp.head(10).to_dict(orient="records"),
        "top_feature": global_imp.iloc[0]["feature"],
        "top_feature_pct": float(global_imp.iloc[0]["importance_pct"]),
        "position_top_3": {},
        "findings": [],
        "examples": examples,
    }

    for pos, df in pos_imp.items():
        report["position_top_3"][pos] = df.head(3)["feature"].tolist()

    report["findings"].append(
        f"Most important: {report['top_feature']} ({report['top_feature_pct']:.1f}%)"
    )

    gk = pos_imp.get("GK", pd.DataFrame())
    fwd = pos_imp.get("FWD", pd.DataFrame())
    if not gk.empty and not fwd.empty:
        report["findings"].append(
            f"GK relies on '{gk.iloc[0]['feature']}', FWD on '{fwd.iloc[0]['feature']}'"
        )

    avail = ["consecutive_starts", "games_since_start", "minutes_trend", "played_lag1"]
    avail_pct = global_imp[global_imp["feature"].isin(avail)]["importance_pct"].sum()
    report["findings"].append(f"Availability features: {avail_pct:.1f}% of importance")

    ext = [c for c in global_imp["feature"] if "_roll10" in c or "_season_avg" in c or "_momentum" in c]
    ext_pct = global_imp[global_imp["feature"].isin(ext)]["importance_pct"].sum()
    report["findings"].append(f"Extended features (roll10/season_avg/momentum): {ext_pct:.1f}%")

    # Extract top interacting pairs from the SHAP correlation matrix
    top_pairs = []
    for i in range(len(interactions.columns)):
        for j in range(i + 1, len(interactions.columns)):
            top_pairs.append({
                "feature_a": interactions.columns[i],
                "feature_b": interactions.columns[j],
                "correlation": float(interactions.iloc[i, j]),
            })
    top_pairs.sort(key=lambda x: abs(x["correlation"]), reverse=True)
    report["top_interactions"] = top_pairs[:5]

    if top_pairs:
        p = top_pairs[0]
        report["findings"].append(
            f"Strongest interaction: {p['feature_a']} + {p['feature_b']} (r={p['correlation']:.2f})"
        )

    return report


def run() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--features-path", default=str(FEATURES_PATH))
    parser.add_argument("--output-dir", default=str(OUT_DIR))
    parser.add_argument("--model-name", default=None)
    args = parser.parse_args()

    model_path = Path(args.model_path)
    features_path = Path(args.features_path)
    model_name = args.model_name or model_path.stem

    if args.output_dir == str(OUT_DIR):
        output_dir = OUT_DIR / model_name
    else:
        output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print(f"SHAP Analysis: {model_name}")
    print("=" * 60)

    X, y, positions, test_df = load_data(features_path)
    print(f"  holdout: {HOLDOUT_SEASON}, {len(X)} samples, {len(X.columns)} features")

    loaded_model = load_model(model_path)
    model = get_interpretable_model(loaded_model, positions)

    print(f"  computing SHAP values (sample={SAMPLE_SIZE})...")
    shap_values, X_sample, pos_sample, explainer = compute_shap_values(model, X, positions, SAMPLE_SIZE)

    global_imp = global_importance(shap_values, X_sample)
    global_imp.to_csv(output_dir / "global_importance.csv", index=False)
    print(f"\n  top 15 features:")
    print(global_imp.head(15).to_string(index=False))

    pos_imp = position_importance(shap_values, X_sample, pos_sample)
    for pos, df in pos_imp.items():
        df.to_csv(output_dir / f"{pos.lower()}_importance.csv", index=False)
    print(f"\n  top 5 by position:")
    for pos in ["GK", "DEF", "MID", "FWD"]:
        if pos in pos_imp:
            top5 = ", ".join(pos_imp[pos].head(5)["feature"].tolist())
            print(f"    {pos}: {top5}")

    corr, _ = feature_interactions(shap_values, X_sample)
    corr.to_csv(output_dir / "feature_interactions.csv")

    examples = explain_predictions(model, X, y, test_df)

    report = build_report(global_imp, pos_imp, corr, examples, model_name)
    (output_dir / "shap_report.json").write_text(json.dumps(report, indent=2, default=str))

    print(f"\n  findings:")
    for f in report["findings"]:
        print(f"    - {f}")

    joblib.dump(explainer, output_dir / "explainer.joblib")

    print(f"\n  saved to: {output_dir}/")
    print("=" * 60)


if __name__ == "__main__":
    run()
