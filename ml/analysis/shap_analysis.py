# ml/analysis/shap_analysis.py
"""
SHAP Analysis for FPL Prediction Models

Provides:
1. Global feature importance (which features matter most?)
2. Position-specific importance (what matters for GK vs FWD?)
3. Feature interactions (which features work together?)
4. Individual prediction explanations

For research report and model trust.
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from lightgbm import LGBMRegressor

# Paths
FEATURES_PATH = Path("data/features/extended_features.csv")
MODEL_PATH = Path("outputs/experiments/extended_v1/extended_ensemble.joblib")
OUT_DIR = Path("outputs/analysis/shap")

# Configuration
TEST_SEASON = "2023-24"
CAT_COLS = ["season", "position", "team", "opponent_team"]
DROP_COLS = ["name", "element", "points_next_gw", "will_play_next"]
SAMPLE_SIZE = 5000  # For SHAP computation (full dataset is slow)


def load_data():
    """Load and prepare data for SHAP analysis."""
    print("Loading data...")
    df = pd.read_csv(FEATURES_PATH, low_memory=False)

    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    # Use test season for analysis
    test_df = df[df["season"] == TEST_SEASON].copy().reset_index(drop=True)

    # Prepare features
    y = test_df["points_next_gw"].values
    drop = set(DROP_COLS)
    X = test_df.drop(columns=[c for c in drop if c in test_df.columns])

    # Store position for stratified analysis
    positions = test_df["position"].values if "position" in test_df.columns else None

    return X, y, positions, test_df


def train_interpretable_model(X: pd.DataFrame, y: np.ndarray) -> LGBMRegressor:
    """Train a single LightGBM model for SHAP analysis."""
    print("Training interpretable model...")

    # Convert categoricals for LightGBM
    cat_cols = [c for c in CAT_COLS if c in X.columns]

    model = LGBMRegressor(
        n_estimators=800,
        learning_rate=0.05,
        num_leaves=63,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )

    model.fit(X, y, categorical_feature=cat_cols)
    return model


def compute_shap_values(model: LGBMRegressor, X: pd.DataFrame, positions: np.ndarray, sample_size: int = 5000):
    """Compute SHAP values for the model."""
    print(f"Computing SHAP values (sample size: {sample_size})...")

    # Sample for speed
    if len(X) > sample_size:
        sample_idx = np.random.RandomState(42).choice(len(X), sample_size, replace=False)
        X_sample = X.iloc[sample_idx].reset_index(drop=True)
        positions_sample = positions[sample_idx] if positions is not None else None
    else:
        X_sample = X
        positions_sample = positions

    # Use TreeExplainer for tree-based models (fast)
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)

    return shap_values, X_sample, positions_sample, explainer


def global_importance(shap_values: np.ndarray, X_sample: pd.DataFrame) -> pd.DataFrame:
    """Compute global feature importance from SHAP values."""
    print("Computing global importance...")

    # Mean absolute SHAP value per feature
    importance = np.abs(shap_values).mean(axis=0)

    importance_df = pd.DataFrame({
        "feature": X_sample.columns,
        "importance": importance,
        "importance_pct": importance / importance.sum() * 100,
    }).sort_values("importance", ascending=False)

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

        importance_df = pd.DataFrame({
            "feature": X_sample.columns,
            "importance": pos_importance,
            "importance_pct": pos_importance / pos_importance.sum() * 100,
        }).sort_values("importance", ascending=False)

        results[pos] = importance_df

    return results


def feature_interactions(shap_values: np.ndarray, X_sample: pd.DataFrame, top_n: int = 10):
    """Analyze feature interactions using SHAP interaction values."""
    print("Analyzing feature interactions...")

    # Get top features
    importance = np.abs(shap_values).mean(axis=0)
    top_features = X_sample.columns[np.argsort(-importance)[:top_n]].tolist()

    # Compute correlation between SHAP values (proxy for interaction)
    shap_df = pd.DataFrame(shap_values, columns=X_sample.columns)
    top_shap = shap_df[top_features]

    interaction_corr = top_shap.corr()

    return interaction_corr, top_features


def explain_predictions(
    model: LGBMRegressor,
    X: pd.DataFrame,
    y: np.ndarray,
    test_df: pd.DataFrame,
    n_examples: int = 5,
) -> list:
    """Generate explanations for specific predictions (without per-row SHAP)."""
    print("Generating example explanations...")

    examples = []

    # Find interesting cases
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
) -> dict:
    """Generate a summary report for the research paper."""

    report = {
        "overview": {
            "description": "SHAP analysis of FPL prediction model",
            "model": "LightGBM Regressor (800 trees)",
            "test_season": TEST_SEASON,
        },
        "global_importance": {
            "top_10": global_imp.head(10).to_dict(orient="records"),
            "top_feature": global_imp.iloc[0]["feature"],
            "top_feature_pct": float(global_imp.iloc[0]["importance_pct"]),
        },
        "position_insights": {},
        "key_findings": [],
    }

    # Position-specific insights
    for pos, imp_df in position_imp.items():
        top_3 = imp_df.head(3)["feature"].tolist()
        report["position_insights"][pos] = {
            "top_3_features": top_3,
            "top_feature": top_3[0],
        }

    # Key findings
    findings = []

    # Finding 1: Most important feature overall
    findings.append(
        f"Most important feature: {global_imp.iloc[0]['feature']} "
        f"({global_imp.iloc[0]['importance_pct']:.1f}% of total importance)"
    )

    # Finding 2: Position differences
    gk_top = position_imp.get("GK", pd.DataFrame()).head(1)
    fwd_top = position_imp.get("FWD", pd.DataFrame()).head(1)
    if not gk_top.empty and not fwd_top.empty:
        findings.append(
            f"Position differences: GK relies on '{gk_top.iloc[0]['feature']}', "
            f"FWD relies on '{fwd_top.iloc[0]['feature']}'"
        )

    # Finding 3: Availability features
    avail_features = ["consecutive_starts", "games_since_start", "minutes_trend", "played_lag1"]
    avail_importance = global_imp[global_imp["feature"].isin(avail_features)]["importance_pct"].sum()
    findings.append(
        f"Availability features contribute {avail_importance:.1f}% of total importance"
    )

    # Finding 4: Extended features value
    extended_features = [c for c in global_imp["feature"] if "_roll10" in c or "_season_avg" in c or "_momentum" in c]
    extended_importance = global_imp[global_imp["feature"].isin(extended_features)]["importance_pct"].sum()
    findings.append(
        f"Extended features (roll10, season_avg, momentum) contribute {extended_importance:.1f}% of importance"
    )

    report["key_findings"] = findings

    return report


def run():
    """Main entry point."""
    print("=" * 60)
    print("SHAP Analysis for FPL Prediction")
    print("=" * 60)

    # Create output directory
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load data
    X, y, positions, test_df = load_data()
    print(f"Test data: {len(X)} samples, {len(X.columns)} features")

    # Train model (or load existing)
    model = train_interpretable_model(X, y)

    # Compute SHAP values
    shap_values, X_sample, positions_sample, explainer = compute_shap_values(model, X, positions, SAMPLE_SIZE)

    # Global importance
    global_imp = global_importance(shap_values, X_sample)
    global_imp.to_csv(OUT_DIR / "global_importance.csv", index=False)

    print("\n📊 TOP 15 GLOBAL FEATURES:")
    print(global_imp.head(15).to_string(index=False))

    # Position-specific importance
    position_imp = position_specific_importance(shap_values, X_sample, positions_sample)

    for pos, imp_df in position_imp.items():
        imp_df.to_csv(OUT_DIR / f"{pos.lower()}_importance.csv", index=False)

    print("\n📍 TOP 5 FEATURES BY POSITION:")
    for pos in ["GK", "DEF", "MID", "FWD"]:
        if pos in position_imp:
            top5 = position_imp[pos].head(5)["feature"].tolist()
            print(f"  {pos}: {', '.join(top5)}")

    # Feature interactions
    interaction_corr, top_features = feature_interactions(shap_values, X_sample)
    interaction_corr.to_csv(OUT_DIR / "feature_interactions.csv")

    # Example explanations
    examples = explain_predictions(model, X, y, test_df, n_examples=5)

    # Summary report
    report = generate_summary_report(global_imp, position_imp, interaction_corr, examples)
    report["examples"] = examples

    (OUT_DIR / "shap_report.json").write_text(json.dumps(report, indent=2, default=str))

    # Print key findings
    print("\n🔍 KEY FINDINGS:")
    for i, finding in enumerate(report["key_findings"], 1):
        print(f"  {i}. {finding}")

    # Save model for future use
    joblib.dump(model, OUT_DIR / "interpretable_model.joblib")
    joblib.dump(explainer, OUT_DIR / "shap_explainer.joblib")

    print(f"\n✅ Analysis saved to: {OUT_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    run()
