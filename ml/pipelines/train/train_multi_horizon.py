# ml/pipelines/train/train_multi_horizon.py
"""
Multi-Horizon Model Experiments (FF-9b)

Trains and compares multiple model architectures across GW+1, GW+2, GW+3
horizons. Each experiment saves structured output to:
    outputs/experiments/multi_horizon/{gw1,gw2,gw3}/{experiment_name}/

Run all experiments:
    python -m ml.pipelines.train.train_multi_horizon

Run a single experiment:
    python -m ml.pipelines.train.train_multi_horizon --experiment 1
    python -m ml.pipelines.train.train_multi_horizon --experiment 1 --horizon 2
"""

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from lightgbm import LGBMClassifier, LGBMRegressor
from sklearn.linear_model import ElasticNet
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import StandardScaler
from scipy.stats import spearmanr

from ml.config.eval_config import (
    CAT_COLS,
    CV_SEASONS,
    DROP_COLS,
    HOLDOUT_SEASON,
    HORIZON_TARGETS,
)
from ml.utils.eval_metrics import full_evaluation

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
IN_PATH = Path("data/features/extended_features.csv")
OUT_ROOT = Path("outputs/experiments/multi_horizon")


# ===========================================================================
# Shared utilities
# ===========================================================================


def load_data() -> pd.DataFrame:
    """Load extended features and cast categoricals."""
    df = pd.read_csv(IN_PATH, low_memory=False)
    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")
    return df


def prepare_xy(df: pd.DataFrame, target_col: str):
    """Extract X, y for a given horizon target. Drops rows where target is NaN."""
    df = df.dropna(subset=[target_col])
    y = df[target_col].values.astype(float)
    drop = set([target_col] + DROP_COLS)
    X = df.drop(columns=[c for c in drop if c in df.columns])
    return X, y


def split_data(df: pd.DataFrame):
    """Split into train (CV seasons) and test (holdout)."""
    available = set(df["season"].dropna().unique())
    train_seasons = [s for s in CV_SEASONS if s in available]
    if HOLDOUT_SEASON not in available:
        raise ValueError(f"Holdout season {HOLDOUT_SEASON} not in data")
    train_df = df[df["season"].isin(train_seasons)]
    test_df = df[df["season"] == HOLDOUT_SEASON]
    return train_df, test_df, train_seasons


def extended_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_train: np.ndarray) -> dict:
    """Full evaluation + Spearman rho + haul MAE."""
    base = full_evaluation(y_true, y_pred, y_train)

    # Spearman rank correlation
    rho, p_val = spearmanr(y_true, y_pred)
    base["model"]["spearman_rho"] = float(rho)
    base["model"]["spearman_p"] = float(p_val)

    # Haul MAE (players scoring > 6 pts)
    haul_mask = y_true > 6
    if haul_mask.sum() > 0:
        haul_mae = float(np.mean(np.abs(y_true[haul_mask] - y_pred[haul_mask])))
    else:
        haul_mae = float("nan")
    base["model"]["haul_mae"] = haul_mae
    base["model"]["haul_count"] = int(haul_mask.sum())

    return base


def save_experiment(out_dir: Path, metrics: dict, model=None, model_name: str = "model"):
    """Save metrics JSON and optionally a model joblib."""
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2, default=str))
    if model is not None:
        joblib.dump(model, out_dir / f"{model_name}.joblib")


def print_horizon_result(experiment: str, horizon: int, metrics: dict):
    """Print a compact summary line."""
    m = metrics["holdout"]["model"]
    print(
        f"  [GW+{horizon}] {experiment:<25s} "
        f"MAE={m['mae']:.4f}  RMSE={m['rmse']:.4f}  "
        f"R²={m['r2']:.4f}  ρ={m.get('spearman_rho', 0):.4f}  "
        f"Haul MAE={m.get('haul_mae', float('nan')):.4f}"
    )


# ===========================================================================
# Experiment 1: Single LightGBM baseline (fast, per horizon)
# ===========================================================================


def build_lgbm_baseline() -> LGBMRegressor:
    """LightGBM v2 config — fast to train, good baseline."""
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


def run_experiment_1(df: pd.DataFrame, horizons: list[int]) -> list[dict]:
    """Experiment 1: Single LightGBM baseline for each horizon."""
    print("\n" + "=" * 65)
    print("  EXPERIMENT 1: LIGHTGBM BASELINE")
    print("=" * 65)

    results = []
    train_df, test_df, train_seasons = split_data(df)

    for h in horizons:
        target_col = HORIZON_TARGETS[h]
        print(f"\n  --- GW+{h} (target: {target_col}) ---")

        X_train, y_train = prepare_xy(train_df, target_col)
        X_test, y_test = prepare_xy(test_df, target_col)
        X_test = X_test[X_train.columns]

        for c in CAT_COLS:
            if c in X_train.columns:
                X_train[c] = X_train[c].astype("category")
                X_test[c] = X_test[c].astype("category")

        cat_cols = [c for c in CAT_COLS if c in X_train.columns]

        print(f"  Train: {len(X_train):,} rows | Test: {len(X_test):,} rows | Features: {len(X_train.columns)}")

        model = build_lgbm_baseline()
        model.fit(X_train, y_train, categorical_feature=cat_cols)
        preds = model.predict(X_test)

        eval_result = extended_metrics(y_test, preds, y_train)

        # Feature importance (top 20)
        imp = pd.DataFrame({
            "feature": X_train.columns,
            "importance": model.feature_importances_,
        }).sort_values("importance", ascending=False)

        metrics = {
            "experiment": "lgbm_baseline",
            "horizon": h,
            "target_col": target_col,
            "holdout_season": HOLDOUT_SEASON,
            "train_seasons": train_seasons,
            "n_train": len(X_train),
            "n_test": len(X_test),
            "n_features": len(X_train.columns),
            "top_features": imp.head(20).to_dict(orient="records"),
            "holdout": eval_result,
        }

        out_dir = OUT_ROOT / f"gw{h}" / "lgbm_baseline"
        save_experiment(out_dir, metrics, model=model)
        imp.to_csv(out_dir / "feature_importance.csv", index=False)
        print_horizon_result("lgbm_baseline", h, metrics)

        results.append({
            "experiment": "lgbm_baseline",
            "horizon": h,
            **eval_result["model"],
        })

    return results


# ===========================================================================
# Experiment 2: Regularized LightGBM with reduced features per horizon
# ===========================================================================

# Features to drop at each horizon (cumulative: GW+2 drops apply to GW+3 too)
DROP_GW2 = [c for c in [
    # lag-1 features (too noisy 2 weeks out)
    "played_lag1", "total_points_lag1", "minutes_lag1", "starts_lag1",
    "expected_goals_lag1", "expected_assists_lag1", "expected_goal_involvements_lag1",
    "expected_goals_conceded_lag1", "influence_lag1", "creativity_lag1", "threat_lag1",
    "ict_index_lag1", "bps_lag1", "bonus_lag1",
    "us_xg_lag1", "us_xa_lag1", "us_npxg_lag1", "us_xgchain_lag1",
    "us_xgbuildup_lag1", "us_shots_lag1", "us_key_passes_lag1", "us_time_lag1",
    # momentum (derived from short-term, noisy at distance)
    "points_momentum", "bps_momentum", "xg_momentum",
]]

DROP_GW3 = DROP_GW2 + [c for c in [
    # roll3 features (3-game window too short for 3 weeks out)
    "total_points_roll3", "minutes_roll3", "starts_roll3",
    "expected_goals_roll3", "expected_assists_roll3", "expected_goal_involvements_roll3",
    "expected_goals_conceded_roll3", "influence_roll3", "creativity_roll3", "threat_roll3",
    "ict_index_roll3", "bps_roll3", "bonus_roll3",
    "us_xg_roll3", "us_xa_roll3", "us_npxg_roll3", "us_xgchain_roll3",
    "us_xgbuildup_roll3", "us_shots_roll3", "us_key_passes_roll3", "us_time_roll3",
]]

HORIZON_DROP_FEATURES = {1: [], 2: DROP_GW2, 3: DROP_GW3}


def build_lgbm_regularized(horizon: int) -> LGBMRegressor:
    """Increasingly regularized LightGBM as horizon grows."""
    if horizon == 1:
        return build_lgbm_baseline()
    elif horizon == 2:
        return LGBMRegressor(
            n_estimators=500,
            learning_rate=0.03,
            num_leaves=15,
            min_child_samples=30,
            subsample=0.7,
            colsample_bytree=0.6,
            reg_alpha=0.5,
            reg_lambda=1.0,
            random_state=123,
            n_jobs=-1,
            verbose=-1,
        )
    else:  # horizon == 3
        return LGBMRegressor(
            n_estimators=400,
            learning_rate=0.03,
            num_leaves=10,
            min_child_samples=50,
            subsample=0.6,
            colsample_bytree=0.5,
            reg_alpha=1.0,
            reg_lambda=2.0,
            random_state=123,
            n_jobs=-1,
            verbose=-1,
        )


def run_experiment_2(df: pd.DataFrame, horizons: list[int]) -> list[dict]:
    """Experiment 2: Regularized LightGBM with reduced features per horizon."""
    print("\n" + "=" * 65)
    print("  EXPERIMENT 2: REGULARIZED LGBM (REDUCED FEATURES)")
    print("=" * 65)

    results = []
    train_df, test_df, train_seasons = split_data(df)

    for h in horizons:
        if h == 1:
            print(f"\n  --- GW+1: skipped (no features to drop, model identical to baseline) ---")
            continue
        target_col = HORIZON_TARGETS[h]
        drop_feats = HORIZON_DROP_FEATURES[h]
        print(f"\n  --- GW+{h} (target: {target_col}, dropping {len(drop_feats)} features) ---")

        X_train, y_train = prepare_xy(train_df, target_col)
        X_test, y_test = prepare_xy(test_df, target_col)
        X_test = X_test[X_train.columns]

        # Drop horizon-specific noisy features
        cols_to_drop = [c for c in drop_feats if c in X_train.columns]
        X_train = X_train.drop(columns=cols_to_drop)
        X_test = X_test.drop(columns=cols_to_drop)

        for c in CAT_COLS:
            if c in X_train.columns:
                X_train[c] = X_train[c].astype("category")
                X_test[c] = X_test[c].astype("category")

        cat_cols = [c for c in CAT_COLS if c in X_train.columns]

        print(f"  Train: {len(X_train):,} rows | Test: {len(X_test):,} rows | Features: {len(X_train.columns)}")

        model = build_lgbm_regularized(h)
        model.fit(X_train, y_train, categorical_feature=cat_cols)
        preds = model.predict(X_test)

        eval_result = extended_metrics(y_test, preds, y_train)

        # Feature importance
        imp = pd.DataFrame({
            "feature": X_train.columns,
            "importance": model.feature_importances_,
        }).sort_values("importance", ascending=False)

        metrics = {
            "experiment": "lgbm_reduced",
            "horizon": h,
            "target_col": target_col,
            "holdout_season": HOLDOUT_SEASON,
            "train_seasons": train_seasons,
            "n_train": len(X_train),
            "n_test": len(X_test),
            "n_features": len(X_train.columns),
            "features_dropped": cols_to_drop,
            "features_used": list(X_train.columns),
            "top_features": imp.head(20).to_dict(orient="records"),
            "holdout": eval_result,
        }

        out_dir = OUT_ROOT / f"gw{h}" / "lgbm_reduced"
        save_experiment(out_dir, metrics, model=model)
        imp.to_csv(out_dir / "feature_importance.csv", index=False)
        # Save features list for reproducibility
        (out_dir / "features_used.json").write_text(
            json.dumps({"used": list(X_train.columns), "dropped": cols_to_drop}, indent=2)
        )
        print_horizon_result("lgbm_reduced", h, metrics)

        results.append({
            "experiment": "lgbm_reduced",
            "horizon": h,
            **eval_result["model"],
        })

    return results


# ===========================================================================
# Experiment 3: Custom Loss Functions
# ===========================================================================

# --- Loss function implementations (gradient, hessian for LightGBM) --------


def asymmetric_mse(alpha: float):
    """
    Under-predictions penalized α× more than over-predictions.
    L = (y - ŷ)²  if ŷ < y  (under-predict, weighted α)
    L = (y - ŷ)²  if ŷ >= y (over-predict, weighted 1)

    grad = -2 * w * (y - ŷ)   where w = α if ŷ < y else 1
    hess =  2 * w
    """

    def objective(y_true, y_pred):
        residual = y_true - y_pred
        weight = np.where(residual > 0, alpha, 1.0)  # under-prediction → residual > 0
        grad = -2.0 * weight * residual
        hess = 2.0 * weight * np.ones_like(residual)
        return grad, hess

    return objective


def haul_weighted_mse(beta: float, threshold: float = 6.0):
    """
    Errors on high-scoring players (>threshold pts) are weighted (1+β)× more.
    L = w * (y - ŷ)²  where w = (1+β) if y > threshold else 1

    grad = -2 * w * (y - ŷ)
    hess =  2 * w
    """

    def objective(y_true, y_pred):
        residual = y_true - y_pred
        weight = np.where(y_true > threshold, 1.0 + beta, 1.0)
        grad = -2.0 * weight * residual
        hess = 2.0 * weight * np.ones_like(residual)
        return grad, hess

    return objective


def linex_loss(a: float):
    """
    LinEx (Linear-Exponential) loss:
    L = exp(a * (ŷ - y)) - a * (ŷ - y) - 1

    With a > 0 and diff = (ŷ - y):
      - Over-prediction (ŷ > y → diff > 0) receives an exponential penalty.
      - Under-prediction (ŷ < y → diff < 0) is closer to linear.

    grad = a * (exp(a * (ŷ - y)) - 1)
    hess = a² * exp(a * (ŷ - y))
    """

    def objective(y_true, y_pred):
        diff = y_pred - y_true  # positive = over-predict
        exp_term = np.exp(np.clip(a * diff, -50, 50))  # clip for numerical stability
        grad = a * (exp_term - 1.0)
        hess = a * a * exp_term
        return grad, hess

    return objective


# All custom loss configs to test
CUSTOM_LOSS_CONFIGS = [
    ("asymmetric_a1.5", asymmetric_mse(1.5)),
    ("asymmetric_a2.0", asymmetric_mse(2.0)),
    ("asymmetric_a3.0", asymmetric_mse(3.0)),
    ("haul_weighted_b0.5", haul_weighted_mse(0.5)),
    ("haul_weighted_b1.0", haul_weighted_mse(1.0)),
    ("haul_weighted_b2.0", haul_weighted_mse(2.0)),
    ("linex_a0.5", linex_loss(0.5)),
    ("linex_a1.0", linex_loss(1.0)),
]


def run_experiment_3(df: pd.DataFrame, horizons: list[int]) -> list[dict]:
    """Experiment 3: Custom loss functions for LightGBM."""
    print("\n" + "=" * 65)
    print("  EXPERIMENT 3: CUSTOM LOSS FUNCTIONS")
    print("=" * 65)

    results = []
    train_df, test_df, train_seasons = split_data(df)

    for h in horizons:
        target_col = HORIZON_TARGETS[h]
        print(f"\n  --- GW+{h} (target: {target_col}) ---")

        X_train, y_train = prepare_xy(train_df, target_col)
        X_test, y_test = prepare_xy(test_df, target_col)
        X_test = X_test[X_train.columns]

        for c in CAT_COLS:
            if c in X_train.columns:
                X_train[c] = X_train[c].astype("category")
                X_test[c] = X_test[c].astype("category")

        cat_cols = [c for c in CAT_COLS if c in X_train.columns]

        for loss_name, loss_fn in CUSTOM_LOSS_CONFIGS:
            model = LGBMRegressor(
                n_estimators=600,
                learning_rate=0.03,
                num_leaves=31,
                subsample=0.7,
                colsample_bytree=0.7,
                random_state=123,
                n_jobs=-1,
                verbose=-1,
                objective=loss_fn,
            )
            model.fit(X_train, y_train, categorical_feature=cat_cols)
            preds = model.predict(X_test)

            eval_result = extended_metrics(y_test, preds, y_train)

            metrics = {
                "experiment": f"loss_{loss_name}",
                "horizon": h,
                "target_col": target_col,
                "holdout_season": HOLDOUT_SEASON,
                "train_seasons": train_seasons,
                "n_train": len(X_train),
                "n_test": len(X_test),
                "n_features": len(X_train.columns),
                "loss_function": loss_name,
                "holdout": eval_result,
            }

            out_dir = OUT_ROOT / f"gw{h}" / f"loss_{loss_name}"
            # Skip saving model — custom objective closures can't be pickled
            save_experiment(out_dir, metrics, model=None)
            print_horizon_result(f"loss_{loss_name}", h, metrics)

            results.append({
                "experiment": f"loss_{loss_name}",
                "horizon": h,
                **eval_result["model"],
            })

    return results


# ===========================================================================
# Experiment 4: Two-Stage Hurdle Model
# ===========================================================================


def run_experiment_4(df: pd.DataFrame, horizons: list[int]) -> list[dict]:
    """Experiment 4: Classifier P(plays) × Regressor E[points|plays] per horizon."""
    print("\n" + "=" * 65)
    print("  EXPERIMENT 4: TWO-STAGE HURDLE MODEL")
    print("=" * 65)

    results = []
    train_df, test_df, train_seasons = split_data(df)

    for h in horizons:
        target_col = HORIZON_TARGETS[h]
        print(f"\n  --- GW+{h} (target: {target_col}) ---")

        X_train, y_train = prepare_xy(train_df, target_col)
        X_test, y_test = prepare_xy(test_df, target_col)
        X_test = X_test[X_train.columns]

        for c in CAT_COLS:
            if c in X_train.columns:
                X_train[c] = X_train[c].astype("category")
                X_test[c] = X_test[c].astype("category")

        cat_cols = [c for c in CAT_COLS if c in X_train.columns]

        y_played_train = (y_train > 0).astype(int)
        played_mask = y_train > 0

        print(f"  Train: {len(X_train):,} rows ({played_mask.sum():,} played)")
        print(f"  Test:  {len(X_test):,} rows")

        # Stage 1: Classifier — P(will score > 0)
        classifier = LGBMClassifier(
            n_estimators=500,
            learning_rate=0.05,
            num_leaves=31,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1,
            verbose=-1,
        )
        classifier.fit(X_train, y_played_train, categorical_feature=cat_cols)

        # Stage 2: Regressor — E[points | played], trained only on played samples
        regressor = LGBMRegressor(
            n_estimators=600,
            learning_rate=0.03,
            num_leaves=31,
            subsample=0.7,
            colsample_bytree=0.7,
            random_state=123,
            n_jobs=-1,
            verbose=-1,
        )
        regressor.fit(
            X_train[played_mask], y_train[played_mask], categorical_feature=cat_cols
        )

        # Predict
        play_prob = classifier.predict_proba(X_test)[:, 1]
        points_if_play = regressor.predict(X_test)

        # Two combination strategies
        preds_soft = play_prob * points_if_play  # smooth
        preds_hard = np.where(play_prob > 0.5, points_if_play, 0.0)  # threshold

        # Classifier AUC
        y_played_test = (y_test > 0).astype(int)
        try:
            auc = float(roc_auc_score(y_played_test, play_prob))
        except ValueError:
            auc = float("nan")

        print(f"  Classifier AUC: {auc:.4f}")

        # Evaluate both variants
        for variant_name, preds in [("hurdle_soft", preds_soft), ("hurdle_hard", preds_hard)]:
            eval_result = extended_metrics(y_test, preds, y_train)

            metrics = {
                "experiment": variant_name,
                "horizon": h,
                "target_col": target_col,
                "holdout_season": HOLDOUT_SEASON,
                "train_seasons": train_seasons,
                "n_train": len(X_train),
                "n_test": len(X_test),
                "n_features": len(X_train.columns),
                "n_played_train": int(played_mask.sum()),
                "classifier_auc": auc,
                "holdout": eval_result,
            }

            out_dir = OUT_ROOT / f"gw{h}" / variant_name
            save_experiment(out_dir, metrics)
            print_horizon_result(variant_name, h, metrics)

            results.append({
                "experiment": variant_name,
                "horizon": h,
                **eval_result["model"],
            })

        # Save models (once per horizon, under hurdle_soft dir)
        out_dir = OUT_ROOT / f"gw{h}" / "hurdle_soft"
        joblib.dump(classifier, out_dir / "classifier.joblib")
        joblib.dump(regressor, out_dir / "regressor.joblib")

    return results


# ===========================================================================
# Experiment 5: Horizon-Specific Architectures
#   5a: CatBoost with Tweedie loss (variance_power 1.2, 1.5, 1.8)
#   5b: ElasticNet (l1_ratio 0.1, 0.5, 0.9)
#   5c: Simple GBM Average (3 LightGBMs, different seeds, averaged)
# ===========================================================================


def cats_to_codes(X: pd.DataFrame) -> pd.DataFrame:
    """Convert categorical columns to numeric codes for models that can't handle them (ElasticNet)."""
    X = X.copy()
    for c in X.columns:
        if X[c].dtype.name == "category":
            X[c] = X[c].cat.codes.astype(float)
    return X


def run_experiment_5(df: pd.DataFrame, horizons: list[int]) -> list[dict]:
    """Experiment 5: Horizon-specific architectures — CatBoost Tweedie, ElasticNet, GBM Average."""
    print("\n" + "=" * 65)
    print("  EXPERIMENT 5: HORIZON-SPECIFIC ARCHITECTURES")
    print("=" * 65)

    results = []
    train_df, test_df, train_seasons = split_data(df)

    for h in horizons:
        target_col = HORIZON_TARGETS[h]
        print(f"\n  === GW+{h} (target: {target_col}) ===")

        X_train, y_train = prepare_xy(train_df, target_col)
        X_test, y_test = prepare_xy(test_df, target_col)
        X_test = X_test[X_train.columns]

        for c in CAT_COLS:
            if c in X_train.columns:
                X_train[c] = X_train[c].astype("category")
                X_test[c] = X_test[c].astype("category")

        cat_cols = [c for c in CAT_COLS if c in X_train.columns]
        cat_indices = [list(X_train.columns).index(c) for c in cat_cols]

        print(f"  Train: {len(X_train):,} rows | Test: {len(X_test):,} rows | Features: {len(X_train.columns)}")

        # ----- 5a: CatBoost Tweedie -----
        for vp in [1.2, 1.5, 1.8]:
            exp_name = f"catboost_tweedie_vp{vp}"
            print(f"\n  --- {exp_name} ---")

            model = CatBoostRegressor(
                iterations=600,
                learning_rate=0.03,
                depth=6,
                l2_leaf_reg=3.0,
                loss_function=f"Tweedie:variance_power={vp}",
                random_seed=123,
                verbose=0,
            )
            # CatBoost needs string cat indices, not LightGBM-style
            model.fit(X_train, y_train, cat_features=cat_indices)
            preds = model.predict(X_test)

            eval_result = extended_metrics(y_test, preds, y_train)

            # Feature importance
            imp = pd.DataFrame({
                "feature": list(X_train.columns),
                "importance": model.get_feature_importance(),
            }).sort_values("importance", ascending=False)

            metrics = {
                "experiment": exp_name,
                "horizon": h,
                "target_col": target_col,
                "holdout_season": HOLDOUT_SEASON,
                "train_seasons": train_seasons,
                "n_train": len(X_train),
                "n_test": len(X_test),
                "n_features": len(X_train.columns),
                "variance_power": vp,
                "top_features": imp.head(20).to_dict(orient="records"),
                "holdout": eval_result,
            }

            out_dir = OUT_ROOT / f"gw{h}" / exp_name
            save_experiment(out_dir, metrics, model=model)
            imp.to_csv(out_dir / "feature_importance.csv", index=False)
            print_horizon_result(exp_name, h, metrics)

            results.append({
                "experiment": exp_name,
                "horizon": h,
                **eval_result["model"],
            })

        # ----- 5b: ElasticNet -----
        X_train_num = cats_to_codes(X_train)
        X_test_num = cats_to_codes(X_test)

        # Scale features for linear model
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train_num.fillna(0))
        X_test_scaled = scaler.transform(X_test_num.fillna(0))

        for l1_ratio in [0.1, 0.5, 0.9]:
            exp_name = f"elasticnet_l1r{l1_ratio}"
            print(f"\n  --- {exp_name} ---")

            model = ElasticNet(
                alpha=0.1,
                l1_ratio=l1_ratio,
                max_iter=2000,
                random_state=123,
            )
            model.fit(X_train_scaled, y_train)
            preds = model.predict(X_test_scaled)

            eval_result = extended_metrics(y_test, preds, y_train)

            # Feature importance (absolute coefficients)
            coef_imp = pd.DataFrame({
                "feature": list(X_train.columns),
                "importance": np.abs(model.coef_),
            }).sort_values("importance", ascending=False)

            n_nonzero = int((model.coef_ != 0).sum())
            print(f"  Non-zero coefficients: {n_nonzero}/{len(model.coef_)}")

            metrics = {
                "experiment": exp_name,
                "horizon": h,
                "target_col": target_col,
                "holdout_season": HOLDOUT_SEASON,
                "train_seasons": train_seasons,
                "n_train": len(X_train),
                "n_test": len(X_test),
                "n_features": len(X_train.columns),
                "l1_ratio": l1_ratio,
                "alpha": 0.1,
                "n_nonzero_coefs": n_nonzero,
                "top_features": coef_imp.head(20).to_dict(orient="records"),
                "holdout": eval_result,
            }

            out_dir = OUT_ROOT / f"gw{h}" / exp_name
            save_experiment(out_dir, metrics, model=model)
            coef_imp.to_csv(out_dir / "feature_importance.csv", index=False)
            print_horizon_result(exp_name, h, metrics)

            results.append({
                "experiment": exp_name,
                "horizon": h,
                **eval_result["model"],
            })

        # ----- 5c: Simple GBM Average (3 seeds) -----
        exp_name = "gbm_avg_3seeds"
        print(f"\n  --- {exp_name} ---")

        seeds = [42, 123, 777]
        individual_preds = []
        models_to_save = []

        for seed in seeds:
            m = LGBMRegressor(
                n_estimators=600,
                learning_rate=0.03,
                num_leaves=31,
                subsample=0.7,
                colsample_bytree=0.7,
                random_state=seed,
                n_jobs=-1,
                verbose=-1,
            )
            m.fit(X_train, y_train, categorical_feature=cat_cols)
            individual_preds.append(m.predict(X_test))
            models_to_save.append(m)

        preds_avg = np.mean(individual_preds, axis=0)
        eval_result = extended_metrics(y_test, preds_avg, y_train)

        # Average feature importance across the 3 models
        avg_imp = np.mean([m.feature_importances_ for m in models_to_save], axis=0)
        imp = pd.DataFrame({
            "feature": list(X_train.columns),
            "importance": avg_imp,
        }).sort_values("importance", ascending=False)

        # Also compute std of predictions across seeds (diversity measure)
        pred_std = float(np.mean(np.std(individual_preds, axis=0)))

        metrics = {
            "experiment": exp_name,
            "horizon": h,
            "target_col": target_col,
            "holdout_season": HOLDOUT_SEASON,
            "train_seasons": train_seasons,
            "n_train": len(X_train),
            "n_test": len(X_test),
            "n_features": len(X_train.columns),
            "seeds": seeds,
            "prediction_diversity_std": pred_std,
            "top_features": imp.head(20).to_dict(orient="records"),
            "holdout": eval_result,
        }

        out_dir = OUT_ROOT / f"gw{h}" / exp_name
        save_experiment(out_dir, metrics)
        # Save all 3 models
        for i, m in enumerate(models_to_save):
            joblib.dump(m, out_dir / f"model_seed{seeds[i]}.joblib")
        imp.to_csv(out_dir / "feature_importance.csv", index=False)
        print_horizon_result(exp_name, h, metrics)

        results.append({
            "experiment": exp_name,
            "horizon": h,
            **eval_result["model"],
        })

    return results


# ===========================================================================
# Final Summary & Multi-Criteria Ranking
# ===========================================================================


def generate_final_summary():
    """
    Aggregate all experiment results from disk and produce:
      - comparison_summary.csv  (all configs, all metrics)
      - best_per_horizon.json   (recommended model per horizon with rationale)
      - Printed senior-engineer analysis
    """
    root = Path("outputs/experiments/multi_horizon")
    rows = []

    for gw_dir in sorted(root.glob("gw*")):
        h = int(gw_dir.name.replace("gw", ""))
        for exp_dir in sorted(gw_dir.iterdir()):
            mf = exp_dir / "metrics.json"
            if not mf.exists():
                continue
            m = json.loads(mf.read_text())
            model = m["holdout"]["model"]
            baselines = m["holdout"]["baselines"]
            rows.append({
                "horizon": h,
                "experiment": m["experiment"],
                "mae": model["mae"],
                "rmse": model["rmse"],
                "r2": model["r2"],
                "spearman_rho": model.get("spearman_rho"),
                "haul_mae": model.get("haul_mae"),
                "haul_count": model.get("haul_count"),
                "n_features": m.get("n_features"),
                "mae_vs_mean": baselines["mean_baseline"]["mae"] - model["mae"],
                "mae_vs_zero": baselines["zero_baseline"]["mae"] - model["mae"],
            })

    df = pd.DataFrame(rows)

    # Exclude unstable configs (MAE > 3 = clearly broken)
    df_stable = df[df["mae"] < 3.0].copy()

    # ------------------------------------------------------------------
    # Multi-criteria composite score (lower = better)
    # Weights reflect FPL product priorities:
    #   MAE (40%) — overall accuracy
    #   Spearman (25%) — ranking for captain/squad selection
    #   Haul MAE (20%) — accuracy on high-value players (>6 pts)
    #   R² (15%) — explained variance
    # ------------------------------------------------------------------
    for h in [1, 2, 3]:
        mask = df_stable["horizon"] == h
        subset = df_stable.loc[mask]
        if len(subset) == 0:
            continue

        # Normalize each metric to [0, 1] within horizon (min-max)
        for col, ascending in [("mae", True), ("haul_mae", True), ("spearman_rho", False), ("r2", False)]:
            vals = subset[col].fillna(subset[col].median())
            mn, mx = vals.min(), vals.max()
            if mx - mn > 0:
                if ascending:  # lower is better → 0=best, 1=worst
                    df_stable.loc[mask, f"{col}_norm"] = (vals - mn) / (mx - mn)
                else:  # higher is better → flip
                    df_stable.loc[mask, f"{col}_norm"] = 1 - (vals - mn) / (mx - mn)
            else:
                df_stable.loc[mask, f"{col}_norm"] = 0.0

        # Composite (lower = better)
        df_stable.loc[mask, "composite"] = (
            0.40 * df_stable.loc[mask, "mae_norm"]
            + 0.25 * df_stable.loc[mask, "spearman_rho_norm"]
            + 0.20 * df_stable.loc[mask, "haul_mae_norm"]
            + 0.15 * df_stable.loc[mask, "r2_norm"]
        )

    # Rank within each horizon
    df_stable["rank"] = df_stable.groupby("horizon")["composite"].rank(method="min").astype(int)
    df_stable = df_stable.sort_values(["horizon", "rank"])

    # Save full comparison
    out_cols = [
        "horizon", "rank", "experiment", "mae", "rmse", "r2",
        "spearman_rho", "haul_mae", "haul_count", "n_features",
        "mae_vs_mean", "composite",
    ]
    df_stable[out_cols].to_csv(root / "comparison_summary.csv", index=False)

    # ------------------------------------------------------------------
    # Best per horizon (pick rank=1)
    # ------------------------------------------------------------------
    best = {}
    for h in [1, 2, 3]:
        horizon_df = df_stable[df_stable["horizon"] == h].sort_values("composite")
        top = horizon_df.iloc[0]
        runner_up = horizon_df.iloc[1] if len(horizon_df) > 1 else None

        entry = {
            "recommended": top["experiment"],
            "mae": round(float(top["mae"]), 4),
            "rmse": round(float(top["rmse"]), 4),
            "r2": round(float(top["r2"]), 4),
            "spearman_rho": round(float(top["spearman_rho"]), 4),
            "haul_mae": round(float(top["haul_mae"]), 4),
            "composite_score": round(float(top["composite"]), 4),
            "n_features": int(top["n_features"]),
        }
        if runner_up is not None:
            entry["runner_up"] = {
                "experiment": runner_up["experiment"],
                "mae": round(float(runner_up["mae"]), 4),
                "composite_score": round(float(runner_up["composite"]), 4),
            }
        best[f"gw_plus_{h}"] = entry

    (root / "best_per_horizon.json").write_text(json.dumps(best, indent=2))

    # ------------------------------------------------------------------
    # Print comprehensive analysis
    # ------------------------------------------------------------------
    print("\n")
    print("=" * 75)
    print("  FF-9b MULTI-HORIZON EXPERIMENT SUMMARY")
    print("  57 model configs × 5 experiments × 3 horizons")
    print("=" * 75)

    print("\n  SCORING WEIGHTS: MAE 40% | Spearman ρ 25% | Haul MAE 20% | R² 15%")
    print("  (Composite: lower = better, 0.0 = best possible, 1.0 = worst)")

    for h in [1, 2, 3]:
        horizon_df = df_stable[df_stable["horizon"] == h].head(10)
        print(f"\n  {'─' * 71}")
        print(f"  GW+{h} — TOP 10")
        print(f"  {'─' * 71}")
        print(f"  {'Rank':<5} {'Experiment':<30} {'MAE':<8} {'ρ':<8} {'Haul':<8} {'R²':<8} {'Score':<6}")
        print(f"  {'─'*5} {'─'*30} {'─'*8} {'─'*8} {'─'*8} {'─'*8} {'─'*6}")
        for _, row in horizon_df.iterrows():
            print(
                f"  {int(row['rank']):<5} {row['experiment']:<30} "
                f"{row['mae']:<8.4f} {row['spearman_rho']:<8.4f} "
                f"{row['haul_mae']:<8.4f} {row['r2']:<8.4f} {row['composite']:<6.3f}"
            )

    # Signal decay analysis
    print(f"\n  {'─' * 71}")
    print("  SIGNAL DECAY ANALYSIS")
    print(f"  {'─' * 71}")

    for h in [1, 2, 3]:
        top = df_stable[df_stable["horizon"] == h].iloc[0]
        baseline = df_stable[(df_stable["horizon"] == h) & (df_stable["experiment"] == "lgbm_baseline")]
        if len(baseline) > 0:
            bl = baseline.iloc[0]
            delta_mae = top["mae"] - bl["mae"]
            print(
                f"  GW+{h}: Best={top['experiment']:<28s} MAE={top['mae']:.4f} "
                f"(Δ vs baseline: {delta_mae:+.4f})"
            )

    # Key insights
    print(f"\n  {'─' * 71}")
    print("  KEY INSIGHTS")
    print(f"  {'─' * 71}")

    # Check if same model wins all horizons
    winners = [df_stable[df_stable["horizon"] == h].iloc[0]["experiment"] for h in [1, 2, 3]]
    if len(set(winners)) == 1:
        print(f"  • Single winner across all horizons: {winners[0]}")
    else:
        print(f"  • Different winners per horizon: GW+1={winners[0]}, GW+2={winners[1]}, GW+3={winners[2]}")

    # MAE degradation from GW+1 to GW+3
    best_1 = df_stable[df_stable["horizon"] == 1].iloc[0]["mae"]
    best_3 = df_stable[df_stable["horizon"] == 3].iloc[0]["mae"]
    pct_degrade = (best_3 - best_1) / best_1 * 100
    print(f"  • MAE degradation GW+1→GW+3: {best_1:.4f} → {best_3:.4f} ({pct_degrade:+.1f}%)")

    # Spearman degradation
    rho_1 = df_stable[df_stable["horizon"] == 1].iloc[0]["spearman_rho"]
    rho_3 = df_stable[df_stable["horizon"] == 3].iloc[0]["spearman_rho"]
    print(f"  • Ranking accuracy GW+1→GW+3: ρ={rho_1:.4f} → ρ={rho_3:.4f}")

    # Count how many configs beat mean baseline
    for h in [1, 2, 3]:
        n_beat = (df_stable[(df_stable["horizon"] == h)]["mae_vs_mean"] > 0).sum()
        n_total = len(df_stable[df_stable["horizon"] == h])
        print(f"  • GW+{h}: {n_beat}/{n_total} configs beat mean baseline")

    print(f"\n  {'─' * 71}")
    print("  RECOMMENDATION")
    print(f"  {'─' * 71}")
    for h in [1, 2, 3]:
        top = df_stable[df_stable["horizon"] == h].iloc[0]
        print(f"  GW+{h}: {top['experiment']:<30s} (MAE={top['mae']:.4f}, ρ={top['spearman_rho']:.4f})")

    print(f"\n  Output files:")
    print(f"    {root / 'comparison_summary.csv'}")
    print(f"    {root / 'best_per_horizon.json'}")
    print("=" * 75)


# ===========================================================================
# CLI entry point
# ===========================================================================


EXPERIMENT_RUNNERS = {
    1: run_experiment_1,
    2: run_experiment_2,
    3: run_experiment_3,
    4: run_experiment_4,
    5: run_experiment_5,
}


def run(experiment: int | None = None, horizon: int | None = None):
    print("Loading data...")
    df = load_data()

    horizons = [horizon] if horizon else [1, 2, 3]
    all_results = []

    if experiment:
        runner = EXPERIMENT_RUNNERS.get(experiment)
        if not runner:
            raise ValueError(f"Experiment {experiment} not implemented yet. Available: {list(EXPERIMENT_RUNNERS.keys())}")
        all_results.extend(runner(df, horizons))
    else:
        for exp_num, runner in sorted(EXPERIMENT_RUNNERS.items()):
            all_results.extend(runner(df, horizons))

    # Save comparison summary
    if all_results:
        summary_df = pd.DataFrame(all_results)
        OUT_ROOT.mkdir(parents=True, exist_ok=True)
        summary_df.to_csv(OUT_ROOT / "comparison_summary.csv", index=False)

        print("\n" + "=" * 65)
        print("  COMPARISON SUMMARY")
        print("=" * 65)
        print(summary_df.to_string(index=False))


def main():
    parser = argparse.ArgumentParser(description="Multi-horizon model experiments (FF-9b)")
    parser.add_argument("--experiment", type=int, default=None, help="Run a single experiment (1-5)")
    parser.add_argument("--horizon", type=int, default=None, choices=[1, 2, 3], help="Run a single horizon")
    parser.add_argument("--summary", action="store_true", help="Generate final summary from saved results")
    args = parser.parse_args()

    if args.summary:
        generate_final_summary()
    else:
        run(experiment=args.experiment, horizon=args.horizon)


if __name__ == "__main__":
    main()
