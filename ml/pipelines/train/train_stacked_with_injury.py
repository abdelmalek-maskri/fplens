"""
Production stacked ensemble class used by all ablation configs (A/B/C/D).

The class name is StackedEnsembleInjury for historical reasons — it was
originally written for Config B (injury features). It is now the standard
ensemble class used across all configs. Renaming would break pickle
deserialization of saved models.

Training is done via run_injury_ablation.py, not this file directly.
"""

import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier, LGBMRegressor
from scipy.optimize import nnls as scipy_nnls
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge, RidgeCV
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import GroupKFold
from xgboost import XGBRegressor

from ml.config.eval_config import CAT_COLS, DROP_COLS, TARGET_COL
from ml.pipelines.injury.build_injury_features import FILL_DEFAULTS
from ml.utils.eval_metrics import full_evaluation

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
            "type": "nnls",
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
