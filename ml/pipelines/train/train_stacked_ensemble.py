# ml/pipelines/train/train_extended_ensemble.py
"""
Stacked Ensemble with Extended Features

Tests the impact of extended time windows:
- roll10 (10-game form)
- season_avg (full season context)
- momentum features (short vs long-term form)
- availability features (consecutive starts, minutes trend)
"""

import json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier, LGBMRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import KFold
from xgboost import XGBRegressor



from ml.config.eval_config import (
    HOLDOUT_SEASON,
    CV_SEASONS,
    DROP_COLS,
    CAT_COLS,
    TARGET_COL,
    METRICS_DIR,
)

from ml.utils.eval_metrics import (
    full_evaluation,
    print_final_summary,
)

IN_PATH = Path("data/features/extended_features.csv")
OUT_DIR = Path("outputs/experiments/stacked_ensemble")
STACKED_METRICS = Path("outputs/experiments/stacked_ensemble/summary.json")

N_INNER_FOLDS = 3

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
    y = df[TARGET_COL].values
    drop = set([TARGET_COL] + DROP_COLS + ["will_play_next"])
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y


def to_numeric(X: pd.DataFrame) -> pd.DataFrame:
    X_num = X.copy()
    for c in CAT_COLS:
        if c in X_num.columns and hasattr(X_num[c], 'cat'):
            X_num[c] = X_num[c].cat.codes
        elif c in X_num.columns:
            X_num[c] = X_num[c].astype("category").cat.codes
    X_num = X_num.fillna(0)
    return X_num

class StackedEnsemble:
    def __init__(self, n_inner_folds: int = 3):
        self.n_inner_folds = n_inner_folds
        self.base_models = {}
        self.meta_model = None
        self.base_names = []

    def _get_base_learners(self):
        learners = {
            "lgbm": (build_lgbm, "lgbm"),
            "lgbm_v2": (build_lgbm_v2, "lgbm"),
            "rf": (build_rf, "sklearn"),
            "ridge": (build_ridge, "sklearn"),
            "played_prob": (build_played_classifier, "classifier"),
            "xgb" : (build_xgboost, "sklearn"),
        }
        return learners

    def fit(self, X_train: pd.DataFrame, y_train: np.ndarray, cat_cols: list):
        X_num = to_numeric(X_train)
        learners = self._get_base_learners()
        self.base_names = list(learners.keys())

        n_samples = len(y_train)
        oof_predictions = np.zeros((n_samples, len(learners)))
        y_played = (y_train > 0).astype(int)

        print(f"  Generating OOF predictions ({self.n_inner_folds} inner folds)...")
        kf = KFold(n_splits=self.n_inner_folds, shuffle=True, random_state=42)

        for fold_idx, (train_idx, val_idx) in enumerate(kf.split(X_train)):
            X_tr = X_train.iloc[train_idx]
            X_val = X_train.iloc[val_idx]
            X_tr_num = X_num.iloc[train_idx]
            X_val_num = X_num.iloc[val_idx]
            y_tr = y_train[train_idx]

            for i, (name, (builder, ltype)) in enumerate(learners.items()):
                model = builder()
                if ltype == "lgbm":
                    model.fit(X_tr, y_tr, categorical_feature=cat_cols)
                    oof_predictions[val_idx, i] = model.predict(X_val)
                elif ltype == "classifier":
                    model.fit(X_tr, y_played[train_idx], categorical_feature=cat_cols)
                    oof_predictions[val_idx, i] = model.predict_proba(X_val)[:, 1]
                else:
                    model.fit(X_tr_num, y_tr)
                    oof_predictions[val_idx, i] = model.predict(X_val_num)

        print("  Fitting meta-learner...")
        self.meta_model = Ridge(alpha=1.0)
        self.meta_model.fit(oof_predictions, y_train)

        print(f"  Meta-learner coefficients: {dict(zip(self.base_names, self.meta_model.coef_.round(4)))}")

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
        stacked_pred = self.meta_model.predict(pred_matrix)

        base_preds["mean"] = np.mean([p for n, p in base_preds.items() if n != "played_prob"], axis=0)
        base_preds["median"] = np.median([p for n, p in base_preds.items() if n != "played_prob"], axis=0)
        base_preds["stacked"] = stacked_pred

        return stacked_pred, base_preds


def evaluate_all_predictions(y_true: np.ndarray, y_train: np.ndarray, predictions: dict) -> dict:
    """Evaluate all prediction methods using shared metrics."""
    results = {}
    for name, preds in predictions.items():
        eval_result = full_evaluation(y_true, preds, y_train)
        results[name] = {
            **eval_result["model"],
            "improve_vs_zero_mae": eval_result["improvements"]["vs_zero"]["mae_improve"],
            "improve_vs_mean_mae": eval_result["improvements"]["vs_mean"]["mae_improve"],
        }
    return results


def run():
    print("=" * 60)
    print("EXTENDED FEATURES ENSEMBLE TRAINING")
    print("=" * 60)
    print(f"Holdout season: {HOLDOUT_SEASON}")
    print(f"Train seasons: {CV_SEASONS}")
    print()

    print("Loading extended features...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    available = set(df["season"].dropna().unique())
    train_seasons = [s for s in CV_SEASONS if s in available]

    if HOLDOUT_SEASON not in available:
        raise ValueError(f"Holdout season {HOLDOUT_SEASON} not in data")

    print(f"Total rows: {len(df):,}")
    print(f"Total columns: {len(df.columns)}")

    # Feature breakdown
    roll10_cols = [c for c in df.columns if "_roll10" in c]
    season_avg_cols = [c for c in df.columns if "_season_avg" in c]
    momentum_cols = [c for c in df.columns if "_momentum" in c]
    avail_cols = [c for c in df.columns if c in ["consecutive_starts", "minutes_trend", "games_since_start"]]

    print(f"\nExtended feature groups:")
    print(f"  roll10 features:       {len(roll10_cols)}")
    print(f"  season_avg features:   {len(season_avg_cols)}")
    print(f"  momentum features:     {len(momentum_cols)}")
    print(f"  availability features: {len(avail_cols)}")

    # Split data
    train_df = df[df["season"].isin(train_seasons)]
    test_df = df[df["season"] == HOLDOUT_SEASON]

    X_train, y_train = prepare_xy(train_df)
    X_test, y_test = prepare_xy(test_df)
    X_test = X_test[X_train.columns]

    for c in CAT_COLS:
        if c in X_train.columns:
            X_train[c] = X_train[c].astype("category")
            X_test[c] = X_test[c].astype("category")

    cat_cols = [c for c in CAT_COLS if c in X_train.columns]

    print(f"\nFeatures: {len(X_train.columns)}")
    print(f"Train: {len(train_df):,}, Test: {len(test_df):,}")

    # Train
    print("\nTraining stacked ensemble...")
    ensemble = StackedEnsemble(n_inner_folds=N_INNER_FOLDS)
    ensemble.fit(X_train, y_train, cat_cols)

    # Predict
    print("Generating predictions...")
    stacked_pred, all_preds = ensemble.predict(X_test)

    # Evaluate
    results = evaluate_all_predictions(y_test, y_train, all_preds)

    # Find best
    best_method = min(results.keys(), key=lambda k: results[k]["mae"])

    # Print results
    print(f"\n{'='*60}")
    print("HOLDOUT RESULTS")
    print(f"{'='*60}")
    print(f"\n{'Method':<15} {'MAE':<10} {'RMSE':<10} {'R²':<10}")
    print("-" * 45)
    for method in sorted(results.keys(), key=lambda x: results[x]["mae"]):
        r = results[method]
        print(f"{method:<15} {r['mae']:.4f}     {r['rmse']:.4f}     {r['r2']:.4f}")

    print(f"\nBest method: {best_method}")

    # Save outputs
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    holdout_eval = full_evaluation(y_test, stacked_pred, y_train)

    metrics = {
        "model_name": "extended_ensemble_v1",
        "holdout_season": HOLDOUT_SEASON,
        "train_seasons": train_seasons,
        "rows_train": int(len(train_df)),
        "rows_test": int(len(test_df)),
        "n_features": len(X_train.columns),
        "n_base_models": len(ensemble.base_names),
        "base_models": ensemble.base_names,
        "meta_coefficients": dict(zip(ensemble.base_names, ensemble.meta_model.coef_.tolist())),
        "extended_features": {
            "roll10": roll10_cols,
            "season_avg": season_avg_cols,
            "momentum": momentum_cols,
            "availability": avail_cols,
        },
        "holdout": holdout_eval,
        "all_methods": results,
        "best_method": best_method,
    }

    joblib.dump(ensemble, OUT_DIR / "extended_ensemble.joblib")
    (OUT_DIR / "summary.json").write_text(json.dumps(metrics, indent=2, default=str))

    # Print standardized summary
    print_final_summary(
        model_name="extended_ensemble_v1",
        holdout_season=HOLDOUT_SEASON,
        train_seasons=train_seasons,
        n_train=len(train_df),
        n_test=len(test_df),
        eval_result=holdout_eval,
        output_dir=str(OUT_DIR),
    )


if __name__ == "__main__":
    run()
