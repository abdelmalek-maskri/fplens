# ml/pipelines/train/train_position_specific.py

"""
Position-Specific Stacked Ensemble

Uses the best-performing model architecture (stacked ensemble) but trains
4 separate ensembles - one for each position:
  - GK ensemble:  trained only on goalkeepers
  - DEF ensemble: trained only on defenders
  - MID ensemble: trained only on midfielders
  - FWD ensemble: trained only on forwards

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
    compute_metrics,
    full_evaluation,
    print_final_summary,
)

# Paths
IN_PATH = Path("data/features/baseline_features.csv")
OUT_DIR = Path("outputs/experiments/position_specific_v1")

# Positions in FPL
POSITIONS = ["GK", "DEF", "MID", "FWD"]

# Stacking config
N_INNER_FOLDS = 3

def build_lgbm() -> LGBMRegressor:
    return LGBMRegressor(
        n_estimators=800, learning_rate=0.05, num_leaves=63,
        subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1, verbose=-1,
    )

def build_lgbm_v2() -> LGBMRegressor:
    return LGBMRegressor(
        n_estimators=600, learning_rate=0.03, num_leaves=31,
        subsample=0.7, colsample_bytree=0.7, random_state=123, n_jobs=-1, verbose=-1,
    )

def build_xgboost():
    return XGBRegressor(
        n_estimators=800, learning_rate=0.05, max_depth=7,
        subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1, verbosity=0,
    )

def build_rf() -> RandomForestRegressor:
    return RandomForestRegressor(
        n_estimators=200, max_depth=12, min_samples_split=10,
        min_samples_leaf=5, random_state=42, n_jobs=-1,
    )

def build_ridge() -> Ridge:
    return Ridge(alpha=1.0, random_state=42)

def build_played_classifier() -> LGBMClassifier:
    return LGBMClassifier(
        n_estimators=500, learning_rate=0.05, num_leaves=31,
        subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1, verbose=-1,
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
    """Stacked ensemble with Ridge meta-learner."""

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
            "xgb": (build_xgboost, "sklearn"),
        }
        return learners

    def fit(self, X_train: pd.DataFrame, y_train: np.ndarray, cat_cols: list):
        X_num = to_numeric(X_train)
        learners = self._get_base_learners()
        self.base_names = list(learners.keys())

        n_samples = len(y_train)
        oof_predictions = np.zeros((n_samples, len(learners)))
        y_played = (y_train > 0).astype(int)

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

        self.meta_model = Ridge(alpha=1.0)
        self.meta_model.fit(oof_predictions, y_train)

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

    def predict(self, X_test: pd.DataFrame) -> np.ndarray:
        X_num = to_numeric(X_test)
        pred_matrix = []

        for name in self.base_names:
            model, ltype = self.base_models[name]
            if ltype == "lgbm":
                pred = model.predict(X_test)
            elif ltype == "classifier":
                pred = model.predict_proba(X_test)[:, 1]
            else:
                pred = model.predict(X_num)
            pred_matrix.append(pred)

        pred_matrix = np.column_stack(pred_matrix)
        return self.meta_model.predict(pred_matrix)


class PositionSpecificStackedModel:
    """
    Trains a separate stacked ensemble for each position.

    self.models["GK"]  -> StackedEnsemble trained on goalkeepers only
    self.models["DEF"] -> StackedEnsemble trained on defenders only
    etc.
    """

    def __init__(self):
        self.models = {}
        self.feature_cols = None

    def fit(self, X: pd.DataFrame, y: np.ndarray, positions: np.ndarray, cat_cols: list):
        self.feature_cols = X.columns.tolist()

        for pos in POSITIONS:
            mask = positions == pos
            n_samples = mask.sum()

            if n_samples < 100:
                print(f"    {pos}: Only {n_samples} samples, skipping stacking")
                continue

            X_pos = X[mask].reset_index(drop=True)
            y_pos = y[mask]

            print(f"    {pos}: Training stacked ensemble on {n_samples:,} samples...")

            model = StackedEnsemble(n_inner_folds=N_INNER_FOLDS)
            model.fit(X_pos, y_pos, cat_cols)
            self.models[pos] = model

        return self

    def predict(self, X: pd.DataFrame, positions: np.ndarray) -> np.ndarray:
        X = X[self.feature_cols]
        predictions = np.zeros(len(X))

        for pos in POSITIONS:
            if pos not in self.models:
                continue

            mask = positions == pos
            if mask.sum() > 0:
                X_pos = X[mask].reset_index(drop=True)
                predictions[mask] = self.models[pos].predict(X_pos)

        return predictions

def train_single_stacked(X_train, y_train, X_test, cat_cols):
    """Train single stacked ensemble (baseline comparison)."""
    print("  Training single stacked ensemble (all positions)...")
    model = StackedEnsemble(n_inner_folds=N_INNER_FOLDS)
    model.fit(X_train, y_train, cat_cols)
    preds = model.predict(X_test)
    return preds, model


def train_position_stacked(X_train, y_train, positions_train, X_test, positions_test, cat_cols):
    """Train position-specific stacked ensembles."""
    print("  Training position-specific stacked ensembles...")
    model = PositionSpecificStackedModel()
    model.fit(X_train, y_train, positions_train, cat_cols)
    preds = model.predict(X_test, positions_test)
    return preds, model

def run():
    print("=" * 60)
    print("POSITION-SPECIFIC STACKED ENSEMBLE")
    print("=" * 60)
    print(f"Holdout season: {HOLDOUT_SEASON}")
    print(f"Train seasons: {CV_SEASONS}")
    print(f"Architecture: Stacked ensemble (best performing model)")
    print()

    print("Loading baseline features...")
    df = pd.read_csv(IN_PATH, low_memory=False)

    if "position" not in df.columns:
        raise ValueError("'position' column not found")

    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    available = set(df["season"].dropna().unique())
    train_seasons = [s for s in CV_SEASONS if s in available]

    if HOLDOUT_SEASON not in available:
        raise ValueError(f"Holdout season {HOLDOUT_SEASON} not in data")

    # Split
    train_df = df[df["season"].isin(train_seasons)]
    test_df = df[df["season"] == HOLDOUT_SEASON]

    X_train, y_train = prepare_xy(train_df)
    X_test, y_test = prepare_xy(test_df)

    positions_train = train_df["position"].values
    positions_test = test_df["position"].values

    X_test = X_test[X_train.columns]

    for c in CAT_COLS:
        if c in X_train.columns:
            X_train[c] = X_train[c].astype("category")
            X_test[c] = X_test[c].astype("category")

    cat_cols = [c for c in CAT_COLS if c in X_train.columns]

    print(f"Train: {len(train_df):,}, Test: {len(test_df):,}")
    print(f"\nPosition distribution (test):")
    for pos in POSITIONS:
        n = (positions_test == pos).sum()
        print(f"  {pos}: {n:,} ({n/len(positions_test)*100:.1f}%)")

    print("\n" + "-" * 60)
    single_preds, single_model = train_single_stacked(X_train, y_train, X_test, cat_cols)

    print()
    position_preds, position_model = train_position_stacked(
        X_train, y_train, positions_train, X_test, positions_test, cat_cols
    )

    single_eval = full_evaluation(y_test, single_preds, y_train)
    position_eval = full_evaluation(y_test, position_preds, y_train)

    print(f"\n{'='*60}")
    print("HOLDOUT RESULTS")
    print(f"{'='*60}")

    # Results will be shown in final summary

    # Per-position breakdown
    print(f"\n{'='*60}")
    print("PER-POSITION BREAKDOWN")
    print(f"{'='*60}")
    print(f"\n{'Position':<8} {'N':<8} {'Single MAE':<12} {'Position MAE':<12} {'Diff':<10}")
    print("-" * 52)

    per_position_results = {}
    for pos in POSITIONS:
        mask = positions_test == pos
        if mask.sum() == 0:
            continue

        y_pos = y_test[mask]
        single_pos = single_preds[mask]
        position_pos = position_preds[mask]

        single_m = compute_metrics(y_pos, single_pos)
        position_m = compute_metrics(y_pos, position_pos)

        diff = position_m["mae"] - single_m["mae"]

        per_position_results[pos] = {
            "n_samples": int(mask.sum()),
            "single": single_m,
            "position_specific": position_m,
            "mae_diff": diff,
        }

        print(f"{pos:<8} {mask.sum():<8} {single_m['mae']:.4f}       {position_m['mae']:.4f}        {diff:+.4f}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    mae_diff = single_eval["model"]["mae"] - position_eval["model"]["mae"]

    metrics = {
        "model_name": "position_specific_stacked_v1",
        "holdout_season": HOLDOUT_SEASON,
        "train_seasons": train_seasons,
        "rows_train": int(len(train_df)),
        "rows_test": int(len(test_df)),
        # Main holdout results (same structure as other models)
        "holdout": position_eval,
        # Comparison with single model
        "comparison": {
            "single_stacked": single_eval,
            "position_specific": position_eval,
            "mae_improvement": mae_diff,
            "pct_improvement": mae_diff / single_eval["model"]["mae"] * 100 if single_eval["model"]["mae"] else 0,
            "per_position": per_position_results,
        },
    }

    (OUT_DIR / "summary.json").write_text(json.dumps(metrics, indent=2, default=str))
    joblib.dump(position_model, OUT_DIR / "position_specific_model.joblib")

    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Single stacked MAE:      {single_eval['model']['mae']:.4f}")
    print(f"Position-specific MAE:   {position_eval['model']['mae']:.4f}")
    print(f"Difference:              {mae_diff:+.4f} ({'better' if mae_diff > 0 else 'worse'})")

    if mae_diff > 0.002:
        print(f"\nPosition-specific models IMPROVE by {mae_diff:.4f} MAE")
    elif mae_diff < -0.002:
        print(f"\nSingle model is BETTER by {-mae_diff:.4f} MAE")
    else:
        print(f"\nNo significant difference")

    # Print standardized summary
    print_final_summary(
        model_name="position_specific_stacked_v1",
        holdout_season=HOLDOUT_SEASON,
        train_seasons=train_seasons,
        n_train=len(train_df),
        n_test=len(test_df),
        eval_result=position_eval,
        output_dir=str(OUT_DIR),
    )


if __name__ == "__main__":
    run()
