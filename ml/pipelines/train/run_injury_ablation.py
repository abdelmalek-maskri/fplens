"""
Injury & News Ablation Study — systematic feature group comparison.

Trains the same stacked ensemble architecture on different feature sets
to isolate the contribution of injury data (and later, Guardian news).

Configs:
    A  Baseline (FPL stats only)         — extended_features.csv
    B  + Injury (FPL API)                — extended_with_injury.csv
    C  + News (Guardian)                 — extended_with_news.csv         [Step 2]
    D  + Injury + News (both)            — extended_with_injury_and_news.csv [Step 2]

Usage:
    python -m ml.pipelines.train.run_injury_ablation
    python -m ml.pipelines.train.run_injury_ablation --configs A B
"""

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error

from ml.config.eval_config import (
    HOLDOUT_SEASON,
    CV_SEASONS,
    DROP_COLS,
    CAT_COLS,
    TARGET_COL,
)
from ml.utils.eval_metrics import full_evaluation, print_final_summary
from ml.utils.statistical_tests import print_comparison
from ml.evaluation.comprehensive_metrics import (
    ComprehensiveEvaluator,
    compute_stratified_metrics,
)
from ml.pipelines.injury.build_injury_features import FILL_DEFAULTS
from ml.pipelines.train.train_stacked_with_injury import (
    StackedEnsembleInjury,
    prepare_xy,
    to_numeric,
    N_INNER_FOLDS,
)

OUT_DIR = Path("outputs/experiments/ablation_injury")

CONFIGS = {
    "A": {
        "name": "Baseline (FPL stats only)",
        "data": Path("data/features/extended_features.csv"),
    },
    "B": {
        "name": "+ Injury (FPL API)",
        "data": Path("data/features/extended_with_injury.csv"),
    },
    # Configs C and D added after Guardian news pipeline (Step 2)
}


def load_data(data_path: Path) -> pd.DataFrame:
    """Load feature CSV and cast categoricals."""
    df = pd.read_csv(data_path, low_memory=False)
    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")
    return df


def split_train_test(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, list]:
    """Split into train/test by holdout season."""
    available = set(df["season"].dropna().unique())
    train_seasons = [s for s in CV_SEASONS if s in available]

    if HOLDOUT_SEASON not in available:
        raise ValueError(f"Holdout season {HOLDOUT_SEASON} not in data")

    train_df = df[df["season"].isin(train_seasons)]
    test_df = df[df["season"] == HOLDOUT_SEASON]

    return train_df, test_df, train_seasons


def train_config(
    config_key: str,
    config: dict,
    out_dir: Path,
) -> dict:
    """Train one ablation config and return results dict."""
    name = config["name"]
    data_path = config["data"]

    print(f"\n{'=' * 60}")
    print(f"CONFIG {config_key}: {name}")
    print(f"{'=' * 60}")
    print(f"Data: {data_path}")

    df = load_data(data_path)
    train_df, test_df, train_seasons = split_train_test(df)

    X_train, y_train = prepare_xy(train_df)
    X_test, y_test = prepare_xy(test_df)
    X_test = X_test[X_train.columns]

    for c in CAT_COLS:
        if c in X_train.columns:
            X_train[c] = X_train[c].astype("category")
            X_test[c] = X_test[c].astype("category")

    cat_cols = [c for c in CAT_COLS if c in X_train.columns]

    # Count feature groups
    injury_cols = [c for c in X_train.columns if c in FILL_DEFAULTS or c.startswith("injury_")]
    baseline_cols = [c for c in X_train.columns if c not in injury_cols
                     and c not in CAT_COLS + ["GW"]]

    print(f"Train: {len(train_df):,}  Test: {len(test_df):,}")
    print(f"Features: {len(X_train.columns)} (baseline={len(baseline_cols)}, injury={len(injury_cols)})")

    print("\nTraining stacked ensemble...")
    ensemble = StackedEnsembleInjury(n_inner_folds=N_INNER_FOLDS)
    ensemble.fit(X_train, y_train, cat_cols)

    print("Generating predictions...")
    stacked_pred, all_preds = ensemble.predict(X_test)

    # Evaluate
    holdout_eval = full_evaluation(y_test, stacked_pred, y_train)
    mae = holdout_eval["model"]["mae"]
    rmse = holdout_eval["model"]["rmse"]
    r2 = holdout_eval["model"]["r2"]

    print(f"\nConfig {config_key} holdout: MAE={mae:.4f}  RMSE={rmse:.4f}  R²={r2:.4f}")

    # Per-method results
    all_results = {}
    for method_name, preds in all_preds.items():
        eval_r = full_evaluation(y_test, preds, y_train)
        all_results[method_name] = {
            **eval_r["model"],
            "improve_vs_zero_mae": eval_r["improvements"]["vs_zero"]["mae_improve"],
            "improve_vs_mean_mae": eval_r["improvements"]["vs_mean"]["mae_improve"],
        }

    # Comprehensive evaluation
    positions = test_df["position"].values if "position" in test_df.columns else None
    gameweek_ids = test_df["GW"].values if "GW" in test_df.columns else None

    config_out_dir = out_dir / f"config_{config_key}"
    config_out_dir.mkdir(parents=True, exist_ok=True)

    evaluator = ComprehensiveEvaluator(config_out_dir)
    comprehensive = evaluator.evaluate_holdout(
        y_true=y_test,
        y_pred=stacked_pred,
        positions=positions,
        gameweek_ids=gameweek_ids,
        experiment_name=f"ablation_{config_key}",
    )

    # Per-base-learner OOF MAE (from meta_info)
    base_oof = {}
    for method_name in ensemble.base_names:
        if method_name in all_results:
            base_oof[method_name] = all_results[method_name]["mae"]

    # Save model and predictions
    joblib.dump(ensemble, config_out_dir / "model.joblib")
    np.savez(
        config_out_dir / "holdout_predictions.npz",
        y_true=y_test,
        y_pred=stacked_pred,
    )

    summary = {
        "config": config_key,
        "name": name,
        "data_path": str(data_path),
        "holdout_season": HOLDOUT_SEASON,
        "train_seasons": train_seasons,
        "n_train": int(len(train_df)),
        "n_test": int(len(test_df)),
        "n_features": len(X_train.columns),
        "n_baseline_features": len(baseline_cols),
        "n_injury_features": len(injury_cols),
        "holdout": holdout_eval,
        "all_methods": all_results,
        "meta_learner": ensemble.meta_info,
        "comprehensive": comprehensive,
        "base_learner_holdout_mae": base_oof,
    }

    (config_out_dir / "summary.json").write_text(
        json.dumps(summary, indent=2, default=str)
    )

    return {
        "config_key": config_key,
        "name": name,
        "y_true": y_test,
        "y_pred": stacked_pred,
        "all_preds": all_preds,
        "holdout_eval": holdout_eval,
        "all_results": all_results,
        "comprehensive": comprehensive,
        "n_features": len(X_train.columns),
        "base_oof": base_oof,
        "meta_info": ensemble.meta_info,
    }


def print_comparison_table(results: dict) -> None:
    """Print formatted ablation comparison table."""
    configs = sorted(results.keys())

    print(f"\n\n{'=' * 70}")
    print("INJURY & NEWS ABLATION STUDY")
    print(f"{'=' * 70}")

    print(f"\n{'Config':<6} {'Description':<30} {'Feats':<8} {'MAE':<10} {'RMSE':<10} {'R²':<10} {'Spearman'}")
    print("-" * 84)

    for key in configs:
        r = results[key]
        mae = r["holdout_eval"]["model"]["mae"]
        rmse = r["holdout_eval"]["model"]["rmse"]
        r2 = r["holdout_eval"]["model"]["r2"]
        rho = r["comprehensive"]["calibration"]["spearman_rho"]
        print(f"{key:<6} {r['name']:<30} {r['n_features']:<8} {mae:<10.4f} {rmse:<10.4f} {r2:<10.4f} {rho:.4f}")

    # Per-position MAE breakdown
    print(f"\n{'Config':<6} {'Overall':<10} {'GK':<10} {'DEF':<10} {'MID':<10} {'FWD':<10} {'High Ret':<10}")
    print("-" * 66)

    for key in configs:
        s = results[key]["comprehensive"]["stratified"]
        print(f"{key:<6} {s['mae_overall']:<10.4f} "
              f"{s.get('mae_gk', 0):<10.4f} "
              f"{s.get('mae_def', 0):<10.4f} "
              f"{s.get('mae_mid', 0):<10.4f} "
              f"{s.get('mae_fwd', 0):<10.4f} "
              f"{s.get('mae_high_return', 0):<10.4f}")

    # Per-base-learner holdout MAE
    if len(configs) >= 2:
        print(f"\n{'Base Learner':<15}", end="")
        for key in configs:
            print(f" {key:<12}", end="")
        print()
        print("-" * (15 + 12 * len(configs)))

        base_names = list(results[configs[0]]["base_oof"].keys())
        for name in base_names:
            print(f"{name:<15}", end="")
            for key in configs:
                mae = results[key]["base_oof"].get(name, 0)
                print(f" {mae:<12.4f}", end="")
            print()


def print_statistical_tests(results: dict) -> dict:
    """Run pairwise statistical tests and print results."""
    configs = sorted(results.keys())
    if len(configs) < 2:
        print("\n  Need at least 2 configs for statistical tests.")
        return {}

    print(f"\n\n{'=' * 70}")
    print("STATISTICAL SIGNIFICANCE")
    print(f"{'=' * 70}")

    test_results = {}
    baseline_key = configs[0]  # Config A is always baseline

    for key in configs[1:]:
        pair_name = f"{baseline_key}_vs_{key}"
        test_results[pair_name] = print_comparison(
            name_a=f"Config {baseline_key}",
            name_b=f"Config {key}",
            y_true=results[baseline_key]["y_true"],
            pred_a=results[baseline_key]["y_pred"],
            pred_b=results[key]["y_pred"],
        )

    # Pairwise between non-baseline configs (B vs C, B vs D, C vs D)
    for i, key_i in enumerate(configs[1:], 1):
        for key_j in configs[i + 1:]:
            pair_name = f"{key_i}_vs_{key_j}"
            test_results[pair_name] = print_comparison(
                name_a=f"Config {key_i}",
                name_b=f"Config {key_j}",
                y_true=results[key_i]["y_true"],
                pred_a=results[key_i]["y_pred"],
                pred_b=results[key_j]["y_pred"],
            )

    # Interaction effect (when all 4 configs available)
    if all(k in results for k in ["A", "B", "C", "D"]):
        mae_a = results["A"]["holdout_eval"]["model"]["mae"]
        mae_b = results["B"]["holdout_eval"]["model"]["mae"]
        mae_c = results["C"]["holdout_eval"]["model"]["mae"]
        mae_d = results["D"]["holdout_eval"]["model"]["mae"]

        injury_alone = mae_a - mae_b
        news_alone = mae_a - mae_c
        combined = mae_a - mae_d
        interaction = combined - (injury_alone + news_alone)

        print(f"\n  INCREMENTAL ANALYSIS")
        print(f"    Injury alone (A-B):          {injury_alone:+.4f}")
        print(f"    News alone (A-C):            {news_alone:+.4f}")
        print(f"    Combined (A-D):              {combined:+.4f}")
        print(f"    Expected additive:           {injury_alone + news_alone:+.4f}")
        print(f"    Interaction effect:           {interaction:+.4f}")

        if interaction > 0:
            print(f"    -> Complementary (combined > sum of parts)")
        elif interaction < 0:
            print(f"    -> Redundant (combined < sum of parts)")
        else:
            print(f"    -> Purely additive")

        test_results["interaction"] = {
            "injury_alone": injury_alone,
            "news_alone": news_alone,
            "combined": combined,
            "interaction": interaction,
        }

    return test_results


def run(config_keys: list[str] | None = None) -> None:
    """Run ablation study for specified configs (default: all available)."""
    if config_keys is None:
        config_keys = [k for k in CONFIGS if CONFIGS[k]["data"].exists()]

    missing = [k for k in config_keys if not CONFIGS[k]["data"].exists()]
    if missing:
        print(f"WARNING: Skipping configs {missing} — data files not found")
        config_keys = [k for k in config_keys if k not in missing]

    if not config_keys:
        print("No configs to run. Build feature files first.")
        return

    print("=" * 70)
    print("INJURY & NEWS ABLATION STUDY")
    print("=" * 70)
    print(f"Holdout season: {HOLDOUT_SEASON}")
    print(f"Configs to run: {config_keys}")
    for key in config_keys:
        print(f"  {key}: {CONFIGS[key]['name']} -> {CONFIGS[key]['data']}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = {}

    for key in config_keys:
        results[key] = train_config(key, CONFIGS[key], OUT_DIR)

    print_comparison_table(results)
    test_results = print_statistical_tests(results)

    # Save ablation summary
    ablation_summary = {
        "configs_run": config_keys,
        "holdout_season": HOLDOUT_SEASON,
    }
    for key in config_keys:
        ablation_summary[f"config_{key}"] = {
            "name": results[key]["name"],
            "mae": results[key]["holdout_eval"]["model"]["mae"],
            "rmse": results[key]["holdout_eval"]["model"]["rmse"],
            "r2": results[key]["holdout_eval"]["model"]["r2"],
            "n_features": results[key]["n_features"],
            "spearman_rho": results[key]["comprehensive"]["calibration"]["spearman_rho"],
        }
    ablation_summary["statistical_tests"] = test_results

    (OUT_DIR / "ablation_summary.json").write_text(
        json.dumps(ablation_summary, indent=2, default=str)
    )

    print(f"\n{'=' * 70}")
    print("ABLATION COMPLETE")
    print(f"{'=' * 70}")
    print(f"Outputs: {OUT_DIR}")
    for key in config_keys:
        print(f"  config_{key}/  — model, predictions, comprehensive metrics")
    print(f"  ablation_summary.json")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Injury & News Ablation Study")
    parser.add_argument(
        "--configs", nargs="+", default=None,
        help="Config keys to run (e.g., A B). Default: all available.",
    )
    args = parser.parse_args()

    run(config_keys=args.configs)
