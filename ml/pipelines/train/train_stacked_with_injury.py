"""
Stacked Ensemble WITH Injury Features — head-to-head comparison.

Same base learners and hyperparameters as train_stacked_ensemble.py,
but trained on extended_with_injury.csv and with a tuned meta-learner.

Usage:
    python -m ml.pipelines.train.train_stacked_with_injury
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier, LGBMRegressor
from scipy.optimize import nnls as scipy_nnls
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge, RidgeCV
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import GroupKFold
from xgboost import XGBRegressor

from ml.config.eval_config import (
    CAT_COLS,
    CV_SEASONS,
    DROP_COLS,
    HOLDOUT_SEASON,
    TARGET_COL,
)
from ml.evaluation.comprehensive_metrics import (
    ComprehensiveEvaluator,
)
from ml.pipelines.injury.build_injury_features import FILL_DEFAULTS
from ml.utils.eval_metrics import full_evaluation, print_final_summary

# -- Paths ---

IN_PATH = Path("data/features/extended_with_injury.csv")
OUT_DIR = Path("outputs/experiments/stacked_ensemble_injury")

PREV_SUMMARY = Path("outputs/experiments/stacked_ensemble/summary.json")
PREV_COMPREHENSIVE = Path("outputs/metrics/comprehensive/stacked_ensemble_comprehensive.json")

N_INNER_FOLDS = 3

# -- Base learners (identical to train_stacked_ensemble.py) ---


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


def build_xgboost() -> XGBRegressor:
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


# -- Data helpers ---


def prepare_xy(df: pd.DataFrame):
    y = df[TARGET_COL].values
    drop = set([TARGET_COL] + DROP_COLS)
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y


def to_numeric(X: pd.DataFrame) -> pd.DataFrame:
    """Convert to fully numeric for sklearn models (Ridge, RF, XGBoost).

    Uses FILL_DEFAULTS for injury columns so pre-injury seasons get
    semantically correct values (available=1, chance=100) instead of 0.
    """
    X_num = X.copy()
    for c in CAT_COLS:
        if c in X_num.columns and hasattr(X_num[c], "cat"):
            X_num[c] = X_num[c].cat.codes
        elif c in X_num.columns:
            X_num[c] = X_num[c].astype("category").cat.codes

    for col, default in FILL_DEFAULTS.items():
        if col in X_num.columns:
            X_num[col] = X_num[col].fillna(default)

    for col in X_num.columns:
        if col.startswith("injury_"):
            X_num[col] = X_num[col].fillna(0)

    X_num = X_num.fillna(0)
    return X_num


# -- Stacked ensemble ---


class StackedEnsembleInjury:
    def __init__(self, n_inner_folds: int = 3):
        self.n_inner_folds = n_inner_folds
        self.base_models = {}
        self.meta_model = None
        self.meta_type = None
        self.meta_info = {}
        self.base_names = []
        self._nnls_weights = None

    def _get_base_learners(self):
        return {
            "lgbm": (build_lgbm, "lgbm"),
            "lgbm_v2": (build_lgbm_v2, "lgbm"),
            "rf": (build_rf, "sklearn"),
            "ridge": (build_ridge, "sklearn"),
            "played_prob": (build_played_classifier, "classifier"),
            "xgb": (build_xgboost, "sklearn"),
        }

    def _tune_meta_learner(self, oof_predictions: np.ndarray, y_train: np.ndarray):
        """Try RidgeCV, Ridge(1.0), NNLS, and inverse-MAE; pick lowest OOF MAE."""
        print("\n  Tuning meta-learner...")
        candidates = {}

        alphas = [0.001, 0.01, 0.1, 0.5, 1.0, 5.0, 10.0, 50.0, 100.0]
        ridge_cv = RidgeCV(alphas=alphas)
        ridge_cv.fit(oof_predictions, y_train)
        candidates["ridge_cv"] = {
            "model": ridge_cv,
            "pred": ridge_cv.predict(oof_predictions),
            "type": "ridge",
            "coefs": ridge_cv.coef_,
            "detail": f"alpha={ridge_cv.alpha_}",
        }

        ridge_1 = Ridge(alpha=1.0)
        ridge_1.fit(oof_predictions, y_train)
        candidates["ridge_1.0"] = {
            "model": ridge_1,
            "pred": ridge_1.predict(oof_predictions),
            "type": "ridge",
            "coefs": ridge_1.coef_,
            "detail": "alpha=1.0 (old default)",
        }

        nnls_w, _ = scipy_nnls(oof_predictions, y_train)
        candidates["nnls"] = {
            "model": nnls_w,
            "pred": oof_predictions @ nnls_w,
            "type": "nnls",
            "coefs": nnls_w,
            "detail": "non-negative",
        }

        base_maes = [mean_absolute_error(y_train, oof_predictions[:, i]) for i in range(oof_predictions.shape[1])]
        inv_w = np.array([1.0 / m for m in base_maes])
        inv_w = inv_w / inv_w.sum()
        candidates["inv_mae"] = {
            "model": inv_w,
            "pred": oof_predictions @ inv_w,
            "type": "nnls",  # same predict logic (weights @ preds)
            "coefs": inv_w,
            "detail": "1/MAE weights",
        }

        print(f"\n  {'Method':<16} {'OOF MAE':<12} {'Details'}")
        print(f"  {'-' * 16} {'-' * 12} {'-' * 30}")

        for name in sorted(candidates, key=lambda n: mean_absolute_error(y_train, candidates[n]["pred"])):
            c = candidates[name]
            mae = mean_absolute_error(y_train, c["pred"])
            coef_str = ", ".join(f"{n}={w:.3f}" for n, w in zip(self.base_names, c["coefs"]))
            print(f"  {name:<16} {mae:.6f}   {c['detail']}")
            print(f"  {'':16} {'':12}   {coef_str}")

        best_name = min(candidates, key=lambda n: mean_absolute_error(y_train, candidates[n]["pred"]))
        best = candidates[best_name]
        best_mae = mean_absolute_error(y_train, best["pred"])
        print(f"\n  Selected: {best_name} (OOF MAE: {best_mae:.6f})")

        self.meta_type = best["type"]
        self.meta_info = {
            "method": best_name,
            "oof_mae": best_mae,
            "detail": best["detail"],
            "coefficients": dict(zip(self.base_names, best["coefs"].tolist())),
            "all_candidates": {
                name: {
                    "oof_mae": float(mean_absolute_error(y_train, c["pred"])),
                    "detail": c["detail"],
                    "coefficients": dict(zip(self.base_names, c["coefs"].tolist())),
                }
                for name, c in candidates.items()
            },
        }

        if best["type"] == "ridge":
            self.meta_model = best["model"]
            self._nnls_weights = None
        else:
            self.meta_model = None
            self._nnls_weights = best["coefs"]

    def fit(self, X_train: pd.DataFrame, y_train: np.ndarray, cat_cols: list):
        X_num = to_numeric(X_train)
        learners = self._get_base_learners()
        self.base_names = list(learners.keys())

        n_samples = len(y_train)
        oof_predictions = np.zeros((n_samples, len(learners)))
        y_played = (y_train > 0).astype(int)

        groups = X_train["season"].cat.codes.values if hasattr(X_train["season"], "cat") else X_train["season"].values
        n_groups = len(np.unique(groups))
        n_folds = min(self.n_inner_folds, n_groups)
        print(f"  Generating OOF predictions ({n_folds} inner folds, grouped by season)...")
        gkf = GroupKFold(n_splits=n_folds)

        for _fold_idx, (train_idx, val_idx) in enumerate(gkf.split(X_train, groups=groups)):
            X_tr = X_train.iloc[train_idx]
            X_val = X_train.iloc[val_idx]
            X_tr_num = X_num.iloc[train_idx]
            X_val_num = X_num.iloc[val_idx]
            y_tr = y_train[train_idx]

            for i, (_name, (builder, ltype)) in enumerate(learners.items()):
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

        print("\n  Base learner OOF performance:")
        for i, name in enumerate(self.base_names):
            oof_mae = mean_absolute_error(y_train, oof_predictions[:, i])
            print(f"    {name:<15} OOF MAE: {oof_mae:.4f}")

        self._tune_meta_learner(oof_predictions, y_train)

        print("\n  Refitting base models on full data...")
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

        if self.meta_type == "ridge":
            stacked_pred = self.meta_model.predict(pred_matrix)
        else:
            stacked_pred = pred_matrix @ self._nnls_weights

        base_preds["mean"] = np.mean([p for n, p in base_preds.items() if n != "played_prob"], axis=0)
        base_preds["median"] = np.median([p for n, p in base_preds.items() if n != "played_prob"], axis=0)
        base_preds["stacked"] = stacked_pred

        return stacked_pred, base_preds


# -- Evaluation ---


def evaluate_all_predictions(y_true: np.ndarray, y_train: np.ndarray, predictions: dict) -> dict:
    results = {}
    for name, preds in predictions.items():
        eval_result = full_evaluation(y_true, preds, y_train)
        results[name] = {
            **eval_result["model"],
            "improve_vs_zero_mae": eval_result["improvements"]["vs_zero"]["mae_improve"],
            "improve_vs_mean_mae": eval_result["improvements"]["vs_mean"]["mae_improve"],
        }
    return results


def load_previous_results() -> tuple[dict | None, dict | None]:
    prev_summary = None
    prev_comprehensive = None
    if PREV_SUMMARY.exists():
        prev_summary = json.loads(PREV_SUMMARY.read_text())
    if PREV_COMPREHENSIVE.exists():
        prev_comprehensive = json.loads(PREV_COMPREHENSIVE.read_text())
    return prev_summary, prev_comprehensive


def print_head_to_head(new_results: dict, new_comprehensive: dict, prev_summary: dict, prev_comprehensive: dict):
    print("\n")
    print("=" * 70)
    print("  HEAD-TO-HEAD: Stacked Ensemble WITHOUT vs WITH Injury Features")
    print("=" * 70)

    old = prev_summary["holdout"]["model"]
    new = new_results["stacked"]

    print(f"\n  {'Metric':<25} {'WITHOUT injury':<18} {'WITH injury':<18} {'Delta':<12} {'Change'}")
    print(f"  {'-' * 25} {'-' * 18} {'-' * 18} {'-' * 12} {'-' * 10}")

    for metric, fmt in [("mae", ".4f"), ("rmse", ".4f"), ("r2", ".4f")]:
        old_val = old[metric]
        new_val = new[metric]
        delta = new_val - old_val
        pct = delta / old_val * 100

        # For MAE/RMSE lower is better; for R² higher is better
        if metric in ("mae", "rmse"):
            arrow = "better" if delta < 0 else "worse"
        else:
            arrow = "better" if delta > 0 else "worse"

        print(f"  {metric.upper():<25} {old_val:<18{fmt}} {new_val:<18{fmt}} {delta:<+12{fmt}} {pct:+.2f}% ({arrow})")

    print(f"\n  {'Base Learner':<25} {'WITHOUT':<18} {'WITH':<18} {'MAE Delta'}")
    print(f"  {'-' * 25} {'-' * 18} {'-' * 18} {'-' * 12}")

    for method in ["lgbm", "lgbm_v2", "rf", "ridge", "xgb", "played_prob", "mean", "median", "stacked"]:
        if method in prev_summary["all_methods"] and method in new_results:
            old_mae = prev_summary["all_methods"][method]["mae"]
            new_mae = new_results[method]["mae"]
            delta = new_mae - old_mae
            marker = " <-- best" if method == "stacked" else ""
            print(f"  {method:<25} {old_mae:<18.4f} {new_mae:<18.4f} {delta:+.4f}{marker}")

    print(f"\n  {'Meta Coefficient':<25} {'WITHOUT':<18} {'WITH'}")
    print(f"  {'-' * 25} {'-' * 18} {'-' * 18}")

    old_coefs = prev_summary.get("meta_coefficients", {})
    new_coefs = new_results.get("meta_coefficients", {})

    for name in ["lgbm", "lgbm_v2", "rf", "ridge", "played_prob", "xgb"]:
        old_c = old_coefs.get(name, 0)
        new_c = new_coefs.get(name, 0)
        print(f"  {name:<25} {old_c:<18.4f} {new_c:.4f}")

    if prev_comprehensive and new_comprehensive:
        old_s = prev_comprehensive["stratified"]
        new_s = new_comprehensive["stratified"]

        print(f"\n  {'Stratified MAE':<25} {'WITHOUT':<18} {'WITH':<18} {'Delta'}")
        print(f"  {'-' * 25} {'-' * 18} {'-' * 18} {'-' * 12}")

        for key, label in [
            ("mae_played", "Played"),
            ("mae_not_played", "Not Played"),
            ("mae_gk", "GK"),
            ("mae_def", "DEF"),
            ("mae_mid", "MID"),
            ("mae_fwd", "FWD"),
            ("mae_high_return", "High Return (>=5pts)"),
        ]:
            old_val = old_s.get(key)
            new_val = new_s.get(key)
            if old_val is not None and new_val is not None:
                delta = new_val - old_val
                print(f"  {label:<25} {old_val:<18.4f} {new_val:<18.4f} {delta:+.4f}")

        old_c = prev_comprehensive["calibration"]
        new_c = new_comprehensive["calibration"]

        print(f"\n  {'Calibration':<25} {'WITHOUT':<18} {'WITH':<18} {'Delta'}")
        print(f"  {'-' * 25} {'-' * 18} {'-' * 18} {'-' * 12}")

        for key, label in [
            ("correlation", "Pearson r"),
            ("spearman_rho", "Spearman rho"),
            ("mean_predicted", "Mean Predicted"),
            ("mean_actual", "Mean Actual"),
        ]:
            old_val = old_c[key]
            new_val = new_c[key]
            delta = new_val - old_val
            print(f"  {label:<25} {old_val:<18.4f} {new_val:<18.4f} {delta:+.4f}")

        if "business" in prev_comprehensive and "business" in new_comprehensive:
            old_b = prev_comprehensive["business"]
            new_b = new_comprehensive["business"]

            print(f"\n  {'Captain Picks':<25} {'WITHOUT':<18} {'WITH':<18} {'Delta'}")
            print(f"  {'-' * 25} {'-' * 18} {'-' * 18} {'-' * 12}")

            for key, label in [
                ("top1_accuracy", "Top-1 Accuracy"),
                ("top3_accuracy", "Top-3 Accuracy"),
                ("top5_accuracy", "Top-5 Accuracy"),
                ("captain_efficiency", "Captain Efficiency"),
            ]:
                old_val = old_b[key]
                new_val = new_b[key]
                delta = new_val - old_val
                print(f"  {label:<25} {old_val * 100:<17.1f}% {new_val * 100:<17.1f}% {delta * 100:+.1f}pp")

    mae_delta = new["mae"] - old["mae"]
    pct = mae_delta / old["mae"] * 100

    print(f"\n  {'=' * 70}")
    if mae_delta < 0:
        print("  VERDICT: Injury features IMPROVE the stacked ensemble")
        print(f"           MAE: {old['mae']:.4f} -> {new['mae']:.4f} ({pct:+.2f}%)")
        print(f"           Absolute improvement: {abs(mae_delta):.4f}")
    elif mae_delta == 0:
        print(f"  VERDICT: No difference (MAE identical at {new['mae']:.4f})")
    else:
        print("  VERDICT: Injury features did NOT improve the stacked ensemble")
        print(f"           MAE: {old['mae']:.4f} -> {new['mae']:.4f} ({pct:+.2f}%)")
    print(f"  {'=' * 70}\n")


# -- Main ---


def run():
    print("=" * 70)
    print("STACKED ENSEMBLE WITH INJURY FEATURES")
    print("=" * 70)
    print(f"Holdout season: {HOLDOUT_SEASON}")
    print(f"Train seasons:  {CV_SEASONS}")
    print(f"Input:          {IN_PATH}")
    print()

    print("Loading data...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    available = set(df["season"].dropna().unique())
    train_seasons = [s for s in CV_SEASONS if s in available]

    if HOLDOUT_SEASON not in available:
        raise ValueError(f"Holdout season {HOLDOUT_SEASON} not in data")

    print(f"Total rows:    {len(df):,}")
    print(f"Total columns: {len(df.columns)}")

    injury_structured = [c for c in df.columns if c in FILL_DEFAULTS]
    injury_nlp = [c for c in df.columns if c.startswith("injury_") and c not in injury_structured]
    baseline_cols = [
        c for c in df.columns if c not in injury_structured + injury_nlp and c not in [TARGET_COL] + DROP_COLS + ["GW"]
    ]

    print("\nFeature groups:")
    print(f"  Baseline features:           {len(baseline_cols)}")
    print(f"  Injury structured + temporal: {len(injury_structured)}")
    print(f"  Injury NLP (type dummies):    {len(injury_nlp)}")
    print(f"  Total:                        {len(baseline_cols) + len(injury_structured) + len(injury_nlp)}")

    injury_seasons_in_data = (
        df[df["status_encoded"].notna()]["season"].unique() if "status_encoded" in df.columns else []
    )
    nan_seasons = df[df["status_encoded"].isna()]["season"].unique() if "status_encoded" in df.columns else []
    print(f"\n  Seasons with real injury data: {sorted(injury_seasons_in_data)}")
    print(f"  Seasons with NaN (pre-injury): {sorted(nan_seasons)}")

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
    print(f"Train:    {len(train_df):,}, Test: {len(test_df):,}")

    print("\nTraining stacked ensemble with injury features...")
    ensemble = StackedEnsembleInjury(n_inner_folds=N_INNER_FOLDS)
    ensemble.fit(X_train, y_train, cat_cols)

    print("Generating predictions...")
    stacked_pred, all_preds = ensemble.predict(X_test)

    results = evaluate_all_predictions(y_test, y_train, all_preds)
    best_method = min(results.keys(), key=lambda k: results[k]["mae"])

    print(f"\n{'=' * 60}")
    print("HOLDOUT RESULTS (all methods)")
    print(f"{'=' * 60}")
    print(f"\n{'Method':<15} {'MAE':<10} {'RMSE':<10} {'R²':<10}")
    print("-" * 45)
    for method in sorted(results.keys(), key=lambda x: results[x]["mae"]):
        r = results[method]
        marker = " *" if method == best_method else ""
        print(f"{method:<15} {r['mae']:.4f}     {r['rmse']:.4f}     {r['r2']:.4f}{marker}")

    print(f"\nBest method: {best_method}")

    holdout_eval = full_evaluation(y_test, stacked_pred, y_train)

    print_final_summary(
        model_name="stacked_ensemble_with_injury",
        holdout_season=HOLDOUT_SEASON,
        train_seasons=train_seasons,
        n_train=len(train_df),
        n_test=len(test_df),
        eval_result=holdout_eval,
        output_dir=str(OUT_DIR),
    )

    positions = test_df["position"].values if "position" in test_df.columns else None
    gameweek_ids = test_df["GW"].values if "GW" in test_df.columns else None

    evaluator = ComprehensiveEvaluator(OUT_DIR)
    comprehensive = evaluator.evaluate_holdout(
        y_true=y_test,
        y_pred=stacked_pred,
        positions=positions,
        gameweek_ids=gameweek_ids,
        experiment_name="stacked_ensemble_injury",
    )
    evaluator.print_summary(comprehensive, "Stacked Ensemble + Injury")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    meta_coefs = ensemble.meta_info.get("coefficients", {})

    metrics = {
        "model_name": "stacked_ensemble_with_injury",
        "holdout_season": HOLDOUT_SEASON,
        "train_seasons": train_seasons,
        "rows_train": int(len(train_df)),
        "rows_test": int(len(test_df)),
        "n_features": len(X_train.columns),
        "n_base_models": len(ensemble.base_names),
        "base_models": ensemble.base_names,
        "meta_learner": ensemble.meta_info,
        "meta_coefficients": meta_coefs,
        "feature_groups": {
            "baseline": len(baseline_cols),
            "injury_structured": len(injury_structured),
            "injury_nlp": len(injury_nlp),
        },
        "holdout": holdout_eval,
        "all_methods": results,
        "best_method": best_method,
    }

    model_path = OUT_DIR / "model.joblib"
    joblib.dump(ensemble, model_path)
    (OUT_DIR / "summary.json").write_text(json.dumps(metrics, indent=2, default=str))

    prev_summary, prev_comprehensive = load_previous_results()

    if prev_summary:
        results["meta_coefficients"] = meta_coefs
        print_head_to_head(results, comprehensive, prev_summary, prev_comprehensive)
    else:
        print("\n  No previous stacked ensemble results found for comparison.")
        print(f"  Expected at: {PREV_SUMMARY}")

    print(f"\nOutputs saved to: {OUT_DIR}")
    print("  model.joblib    — trained ensemble")
    print("  summary.json    — full metrics")


if __name__ == "__main__":
    run()
