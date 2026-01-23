# ml/pipelines/train/train_stacked_ensemble.py
"""
Experiment 003b: Stacked Ensemble with Meta-Learning

Improvements over simple averaging:
1. Diverse base learners (different algorithms + a linear baseline)
2. Explicit played-probability signal
3. Ridge meta-learner learns optimal combination
4. Out-of-fold predictions prevent leakage

Architecture:
  Level 0: LightGBM, XGBoost, RandomForest, Ridge, PlayedClassifier
  Level 1: Ridge meta-learner on base predictions
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier, LGBMRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import KFold

try:
    from xgboost import XGBRegressor
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False
    print("XGBoost not installed, excluding from ensemble")


# Paths
IN_PATH = Path("data/features/baseline_features.csv")
OUT_DIR = Path("outputs/experiments/stacked_v1")
BASELINE_METRICS = Path("outputs/metrics/baseline_v1.json")

# Configuration
TEST_SEASON = "2023-24"
DROP_COLS = ["name", "element", "points_next_gw", "will_play_next"]
CAT_COLS = ["season", "position", "team", "opponent_team"]
MIN_TRAIN_SEASONS = 3
N_INNER_FOLDS = 3  # For generating out-of-fold base predictions


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))


def build_lgbm() -> LGBMRegressor:
    return LGBMRegressor(
        n_estimators=800,
        learning_rate=0.05,
        num_leaves=63,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )


def build_lgbm_v2() -> LGBMRegressor:
    """Variant with different hyperparameters for diversity."""
    return LGBMRegressor(
        n_estimators=600,
        learning_rate=0.03,
        num_leaves=31,
        subsample=0.7,
        colsample_bytree=0.7,
        random_state=123,
        n_jobs=-1,
        verbose=-1,
    )


def build_xgboost() -> "XGBRegressor":
    return XGBRegressor(
        n_estimators=800,
        learning_rate=0.05,
        max_depth=7,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        verbosity=0,
    )


def build_rf() -> RandomForestRegressor:
    return RandomForestRegressor(
        n_estimators=200,
        max_depth=12,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1,
    )


def build_ridge() -> Ridge:
    return Ridge(alpha=1.0, random_state=42)


def build_played_classifier() -> LGBMClassifier:
    """Binary classifier for played/not-played."""
    return LGBMClassifier(
        n_estimators=500,
        learning_rate=0.05,
        num_leaves=31,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )


def prepare_xy(df: pd.DataFrame):
    y = df["points_next_gw"].values
    drop = set(DROP_COLS)
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y


def to_numeric(X: pd.DataFrame) -> pd.DataFrame:
    """Convert categorical columns to numeric for sklearn models and handle NaNs."""
    X_num = X.copy()
    for c in CAT_COLS:
        if c in X_num.columns and hasattr(X_num[c], 'cat'):
            X_num[c] = X_num[c].cat.codes
        elif c in X_num.columns:
            X_num[c] = X_num[c].astype("category").cat.codes

    # Fill NaN values with 0 for sklearn models (LightGBM handles NaN natively)
    X_num = X_num.fillna(0)
    return X_num


class StackedEnsemble:
    """
    Two-level stacked ensemble.

    Level 0: Base learners (LGBM, XGB, RF, Ridge, Played-Classifier)
    Level 1: Ridge meta-learner combining base predictions
    """

    def __init__(self, n_inner_folds: int = 3):
        self.n_inner_folds = n_inner_folds
        self.base_models = {}
        self.meta_model = None
        self.base_names = []

    def _get_base_learners(self):
        """Define base learners."""
        learners = {
            "lgbm": (build_lgbm, "lgbm"),  # (builder, type: lgbm/sklearn)
            "lgbm_v2": (build_lgbm_v2, "lgbm"),
            "rf": (build_rf, "sklearn"),
            "ridge": (build_ridge, "sklearn"),
            "played_prob": (build_played_classifier, "classifier"),
        }
        if HAS_XGBOOST:
            learners["xgb"] = (build_xgboost, "sklearn")
        return learners

    def fit(self, X_train: pd.DataFrame, y_train: np.ndarray, cat_cols: list):
        """
        Fit the stacked ensemble.

        1. Generate out-of-fold predictions for base learners
        2. Fit meta-learner on base predictions
        3. Refit base learners on full training data
        """

        X_num = to_numeric(X_train)
        learners = self._get_base_learners()
        self.base_names = list(learners.keys())

        n_samples = len(y_train)
        oof_predictions = np.zeros((n_samples, len(learners)))

        # For classifier, target is binary
        y_played = (y_train > 0).astype(int)

        # Generate out-of-fold predictions
        print(f"  Generating OOF predictions ({self.n_inner_folds} inner folds)...")
        kf = KFold(n_splits=self.n_inner_folds, shuffle=True, random_state=42)

        for fold_idx, (train_idx, val_idx) in enumerate(kf.split(X_train)):
            X_tr = X_train.iloc[train_idx]
            X_val = X_train.iloc[val_idx]
            X_tr_num = X_num.iloc[train_idx]
            X_val_num = X_num.iloc[val_idx]
            y_tr = y_train[train_idx]
            y_val_played = y_played[train_idx]

            for i, (name, (builder, ltype)) in enumerate(learners.items()):
                model = builder()

                if ltype == "lgbm":
                    model.fit(X_tr, y_tr, categorical_feature=cat_cols)
                    oof_predictions[val_idx, i] = model.predict(X_val)
                elif ltype == "classifier":
                    model.fit(X_tr, y_played[train_idx], categorical_feature=cat_cols)
                    oof_predictions[val_idx, i] = model.predict_proba(X_val)[:, 1]
                else:  # sklearn
                    model.fit(X_tr_num, y_tr)
                    oof_predictions[val_idx, i] = model.predict(X_val_num)

        # Fit meta-learner on OOF predictions
        print("  Fitting meta-learner...")
        self.meta_model = Ridge(alpha=1.0)
        self.meta_model.fit(oof_predictions, y_train)

        # Report meta-learner weights
        print(f"  Meta-learner coefficients: {dict(zip(self.base_names, self.meta_model.coef_.round(4)))}")
        print(f"  Meta-learner intercept: {self.meta_model.intercept_:.4f}")

        # Refit base models on full training data
        print("  Refitting base models on full data...")
        for name, (builder, ltype) in learners.items():
            model = builder()
            if ltype == "lgbm":
                model.fit(X_train, y_train, categorical_feature=cat_cols)
            elif ltype == "classifier":
                model.fit(X_train, y_played, categorical_feature=cat_cols)
            else:
                model.fit(X_num, y_train)
            self.base_models[name] = (model, ltype)

        return self

    def predict(self, X_test: pd.DataFrame) -> tuple[np.ndarray, dict]:
        """Generate predictions using the stacked ensemble."""

        X_num = to_numeric(X_test)

        base_preds = {}
        pred_matrix = []

        for name in self.base_names:
            model, ltype = self.base_models[name]

            if ltype == "lgbm":
                pred = model.predict(X_test)
            elif ltype == "classifier":
                pred = model.predict_proba(X_test)[:, 1]
            else:
                pred = model.predict(X_num)

            base_preds[name] = pred
            pred_matrix.append(pred)

        pred_matrix = np.column_stack(pred_matrix)

        # Meta-learner prediction
        stacked_pred = self.meta_model.predict(pred_matrix)

        # Also compute simple combinations for comparison
        base_preds["mean"] = np.mean([p for n, p in base_preds.items() if n != "played_prob"], axis=0)
        base_preds["median"] = np.median([p for n, p in base_preds.items() if n != "played_prob"], axis=0)
        base_preds["stacked"] = stacked_pred

        return stacked_pred, base_preds


def evaluate_predictions(
    y_true: np.ndarray,
    predictions: dict,
    baseline_mae: float,
    positions: np.ndarray = None,
) -> dict:
    """Comprehensive evaluation of predictions."""

    results = {}

    for name, preds in predictions.items():
        mae = float(mean_absolute_error(y_true, preds))
        rmse_val = rmse(y_true, preds)

        # Stratified
        played_mask = y_true > 0
        mae_played = float(mean_absolute_error(y_true[played_mask], preds[played_mask]))
        mae_not_played = float(mean_absolute_error(y_true[~played_mask], preds[~played_mask]))

        # High-return players (>=5 points)
        high_mask = y_true >= 5
        mae_high = float(mean_absolute_error(y_true[high_mask], preds[high_mask])) if high_mask.sum() > 0 else None

        results[name] = {
            "mae": mae,
            "rmse": rmse_val,
            "mae_played": mae_played,
            "mae_not_played": mae_not_played,
            "mae_high_return": mae_high,
            "delta_vs_baseline": mae - baseline_mae,
            "pct_improvement": (baseline_mae - mae) / baseline_mae * 100,
        }

        # Per-position (if available)
        if positions is not None:
            for pos in ["GK", "DEF", "MID", "FWD"]:
                mask = positions == pos
                if mask.sum() > 0:
                    results[name][f"mae_{pos.lower()}"] = float(mean_absolute_error(y_true[mask], preds[mask]))

    return results


def run_holdout(df: pd.DataFrame, seasons: list[str]) -> dict:
    """Final holdout evaluation with stacked ensemble."""

    train_seasons = [s for s in seasons if s != TEST_SEASON]

    print(f"\n{'='*60}")
    print(f"STACKED ENSEMBLE - Holdout Evaluation")
    print(f"{'='*60}")
    print(f"Train: {train_seasons[0]}..{train_seasons[-1]}, Test: {TEST_SEASON}")

    train_df = df[df["season"].isin(train_seasons)]
    test_df = df[df["season"] == TEST_SEASON]

    X_train, y_train = prepare_xy(train_df)
    X_test, y_test = prepare_xy(test_df)
    X_test = X_test[X_train.columns]

    # Ensure categoricals
    for c in CAT_COLS:
        if c in X_train.columns:
            X_train[c] = X_train[c].astype("category")
            X_test[c] = X_test[c].astype("category")

    cat_cols = [c for c in CAT_COLS if c in X_train.columns]

    # Get positions for stratified evaluation
    positions = test_df["position"].values if "position" in test_df.columns else None

    # Train stacked ensemble
    print(f"\nTraining stacked ensemble...")
    ensemble = StackedEnsemble(n_inner_folds=N_INNER_FOLDS)
    ensemble.fit(X_train, y_train, cat_cols)

    # Predict
    print(f"Generating predictions...")
    stacked_pred, all_preds = ensemble.predict(X_test)

    # Load baseline
    baseline_mae = None
    if BASELINE_METRICS.exists():
        baseline = json.loads(BASELINE_METRICS.read_text())
        baseline_mae = baseline["mae"]

    # Evaluate
    results = evaluate_predictions(y_test, all_preds, baseline_mae or 0, positions)

    # Find best method
    best_method = min(results.keys(), key=lambda k: results[k]["mae"])
    best_mae = results[best_method]["mae"]

    holdout = {
        "test_season": TEST_SEASON,
        "n_train": len(train_df),
        "n_test": len(test_df),
        "n_base_models": len(ensemble.base_names),
        "base_models": ensemble.base_names,
        "meta_coefficients": dict(zip(ensemble.base_names, ensemble.meta_model.coef_.tolist())),
        "meta_intercept": float(ensemble.meta_model.intercept_),
        "baseline_mae": baseline_mae,
        "best_method": best_method,
        "best_mae": best_mae,
        "delta_vs_baseline": best_mae - baseline_mae if baseline_mae else None,
        "all_results": results,
    }

    # Print results
    print(f"\n{'='*60}")
    print(f"RESULTS (Baseline MAE: {baseline_mae:.4f})")
    print(f"{'='*60}")
    print(f"\n{'Method':<20} {'MAE':<10} {'Delta':<10} {'Played':<10} {'Not-Played':<10}")
    print("-" * 60)
    for method in sorted(results.keys(), key=lambda x: results[x]["mae"]):
        r = results[method]
        delta = r["delta_vs_baseline"]
        symbol = "+" if delta > 0 else ""
        print(f"{method:<20} {r['mae']:.4f}     {symbol}{delta:.4f}     {r['mae_played']:.4f}     {r['mae_not_played']:.4f}")

    return holdout, ensemble


def run():
    """Main entry point."""

    print("=" * 60)
    print("Experiment 003b: Stacked Ensemble with Meta-Learning")
    print("=" * 60)

    # Load data
    print("\nLoading baseline features...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    seasons = sorted(df["season"].dropna().unique().tolist())
    print(f"Seasons: {seasons}")
    print(f"Total rows: {len(df):,}")
    print(f"XGBoost available: {HAS_XGBOOST}")

    # Create output directory
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Run holdout evaluation
    holdout, ensemble = run_holdout(df, seasons)

    # Save ensemble
    joblib.dump(ensemble, OUT_DIR / "stacked_ensemble.joblib")

    # Save summary
    summary = {
        "experiment": "stacked_v1",
        "description": "Stacked ensemble with Ridge meta-learner",
        "holdout": holdout,
    }
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2, default=str))

    print(f"\nResults saved to: {OUT_DIR}")

    # Verdict
    print("\n" + "=" * 60)
    if holdout.get("delta_vs_baseline") is not None:
        delta = holdout["delta_vs_baseline"]
        best = holdout["best_method"]
        if delta < -0.005:
            print(f"IMPROVEMENT: {best} MAE {holdout['best_mae']:.4f} vs baseline {holdout['baseline_mae']:.4f} ({delta:+.4f})")
        elif delta > 0.005:
            print(f"REGRESSION: {best} MAE {holdout['best_mae']:.4f} vs baseline {holdout['baseline_mae']:.4f} ({delta:+.4f})")
        else:
            print(f"NO CHANGE: {best} MAE {holdout['best_mae']:.4f} ~ baseline {holdout['baseline_mae']:.4f} ({delta:+.4f})")
    print("=" * 60)


if __name__ == "__main__":
    run()
