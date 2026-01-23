# ml/pipelines/train/train_extended_ensemble.py
"""
Experiment 004: Stacked Ensemble with Extended Features

Tests the impact of extended time windows:
- roll10 (10-game form)
- season_avg (full season context)
- momentum features (short vs long-term form)
- availability features (consecutive starts, minutes trend)

Compares against Exp 003 (stacked with baseline features).
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


# Paths - use extended features
IN_PATH = Path("data/features/extended_features.csv")
OUT_DIR = Path("outputs/experiments/extended_v1")
BASELINE_METRICS = Path("outputs/metrics/baseline_v1.json")
STACKED_METRICS = Path("outputs/experiments/stacked_v1/summary.json")

# Configuration
TEST_SEASON = "2023-24"
DROP_COLS = ["name", "element", "points_next_gw", "will_play_next"]
CAT_COLS = ["season", "position", "team", "opponent_team"]
N_INNER_FOLDS = 3


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
    y = df["points_next_gw"].values
    drop = set(DROP_COLS)
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
        }
        if HAS_XGBOOST:
            learners["xgb"] = (build_xgboost, "sklearn")
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


def evaluate_predictions(y_true: np.ndarray, predictions: dict, baseline_mae: float, positions=None) -> dict:
    results = {}
    for name, preds in predictions.items():
        mae = float(mean_absolute_error(y_true, preds))
        rmse_val = rmse(y_true, preds)

        played_mask = y_true > 0
        mae_played = float(mean_absolute_error(y_true[played_mask], preds[played_mask]))
        mae_not_played = float(mean_absolute_error(y_true[~played_mask], preds[~played_mask]))

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

        if positions is not None:
            for pos in ["GK", "DEF", "MID", "FWD"]:
                mask = positions == pos
                if mask.sum() > 0:
                    results[name][f"mae_{pos.lower()}"] = float(mean_absolute_error(y_true[mask], preds[mask]))

    return results


def run_holdout(df: pd.DataFrame, seasons: list[str]) -> dict:
    train_seasons = [s for s in seasons if s != TEST_SEASON]

    print(f"\n{'='*60}")
    print(f"EXTENDED FEATURES ENSEMBLE - Holdout Evaluation")
    print(f"{'='*60}")
    print(f"Train: {train_seasons[0]}..{train_seasons[-1]}, Test: {TEST_SEASON}")

    train_df = df[df["season"].isin(train_seasons)]
    test_df = df[df["season"] == TEST_SEASON]

    X_train, y_train = prepare_xy(train_df)
    X_test, y_test = prepare_xy(test_df)
    X_test = X_test[X_train.columns]

    for c in CAT_COLS:
        if c in X_train.columns:
            X_train[c] = X_train[c].astype("category")
            X_test[c] = X_test[c].astype("category")

    cat_cols = [c for c in CAT_COLS if c in X_train.columns]
    positions = test_df["position"].values if "position" in test_df.columns else None

    print(f"\nFeatures: {len(X_train.columns)} (extended from ~75 baseline)")
    print(f"Training stacked ensemble...")

    ensemble = StackedEnsemble(n_inner_folds=N_INNER_FOLDS)
    ensemble.fit(X_train, y_train, cat_cols)

    print(f"Generating predictions...")
    stacked_pred, all_preds = ensemble.predict(X_test)

    # Load comparisons
    baseline_mae = None
    if BASELINE_METRICS.exists():
        baseline = json.loads(BASELINE_METRICS.read_text())
        baseline_mae = baseline["mae"]

    stacked_v1_mae = None
    if STACKED_METRICS.exists():
        stacked_v1 = json.loads(STACKED_METRICS.read_text())
        stacked_v1_mae = stacked_v1["holdout"]["all_results"]["stacked"]["mae"]

    results = evaluate_predictions(y_test, all_preds, baseline_mae or 0, positions)

    best_method = min(results.keys(), key=lambda k: results[k]["mae"])
    best_mae = results[best_method]["mae"]

    holdout = {
        "test_season": TEST_SEASON,
        "n_train": len(train_df),
        "n_test": len(test_df),
        "n_features": len(X_train.columns),
        "n_base_models": len(ensemble.base_names),
        "base_models": ensemble.base_names,
        "meta_coefficients": dict(zip(ensemble.base_names, ensemble.meta_model.coef_.tolist())),
        "baseline_mae": baseline_mae,
        "stacked_v1_mae": stacked_v1_mae,
        "best_method": best_method,
        "best_mae": best_mae,
        "delta_vs_baseline": best_mae - baseline_mae if baseline_mae else None,
        "delta_vs_stacked_v1": best_mae - stacked_v1_mae if stacked_v1_mae else None,
        "all_results": results,
    }

    # Print results
    print(f"\n{'='*60}")
    print(f"RESULTS")
    print(f"  Baseline MAE (75 features):   {baseline_mae:.4f}")
    print(f"  Stacked v1 MAE (75 features): {stacked_v1_mae:.4f}" if stacked_v1_mae else "")
    print(f"{'='*60}")
    print(f"\n{'Method':<20} {'MAE':<10} {'vs Base':<10} {'vs Stack':<10} {'Played':<10}")
    print("-" * 60)

    for method in sorted(results.keys(), key=lambda x: results[x]["mae"]):
        r = results[method]
        delta_base = r["delta_vs_baseline"]
        delta_stack = r["mae"] - stacked_v1_mae if stacked_v1_mae else 0
        print(f"{method:<20} {r['mae']:.4f}     {delta_base:+.4f}     {delta_stack:+.4f}     {r['mae_played']:.4f}")

    return holdout, ensemble


def run():
    print("=" * 60)
    print("Experiment 004: Extended Features Ensemble")
    print("=" * 60)

    print("\nLoading extended features...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    seasons = sorted(df["season"].dropna().unique().tolist())
    print(f"Seasons: {seasons}")
    print(f"Total rows: {len(df):,}")
    print(f"Total columns: {len(df.columns)}")

    # New feature categories
    roll10_cols = [c for c in df.columns if "_roll10" in c]
    season_avg_cols = [c for c in df.columns if "_season_avg" in c]
    momentum_cols = [c for c in df.columns if "_momentum" in c]
    avail_cols = [c for c in df.columns if c in ["consecutive_starts", "minutes_trend", "games_since_start"]]

    print(f"\nNew feature groups:")
    print(f"  roll10 features:      {len(roll10_cols)}")
    print(f"  season_avg features:  {len(season_avg_cols)}")
    print(f"  momentum features:    {len(momentum_cols)}")
    print(f"  availability features: {len(avail_cols)}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    holdout, ensemble = run_holdout(df, seasons)

    joblib.dump(ensemble, OUT_DIR / "extended_ensemble.joblib")

    summary = {
        "experiment": "extended_v1",
        "description": "Stacked ensemble with extended features (roll10, season_avg, momentum, availability)",
        "new_features": {
            "roll10": roll10_cols,
            "season_avg": season_avg_cols,
            "momentum": momentum_cols,
            "availability": avail_cols,
        },
        "holdout": holdout,
    }
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2, default=str))

    print(f"\nResults saved to: {OUT_DIR}")

    print("\n" + "=" * 60)
    if holdout.get("delta_vs_baseline") is not None:
        delta = holdout["delta_vs_baseline"]
        delta_stack = holdout.get("delta_vs_stacked_v1", 0)
        best = holdout["best_method"]

        print(f"vs Baseline (75 feat):  {delta:+.4f} ({delta/holdout['baseline_mae']*100:+.1f}%)")
        if holdout.get("stacked_v1_mae"):
            print(f"vs Stacked v1 (75 feat): {delta_stack:+.4f} ({delta_stack/holdout['stacked_v1_mae']*100:+.1f}%)")

        if delta < -0.005:
            print(f"\nIMPROVEMENT: Extended features help!")
        elif delta > 0.005:
            print(f"\nREGRESSION: Extended features hurt (possible overfitting)")
        else:
            print(f"\nNO CHANGE: Extended features don't help significantly")
    print("=" * 60)


if __name__ == "__main__":
    run()
