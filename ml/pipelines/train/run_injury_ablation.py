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

from ml.config.eval_config import (
    HOLDOUT_SEASON,
    CV_SEASONS,
    DROP_COLS,
    CAT_COLS,
    TARGET_COL,
)
from ml.utils.eval_metrics import full_evaluation, print_final_summary
from ml.utils.statistical_tests import print_comparison
from ml.evaluation.comprehensive_metrics import ComprehensiveEvaluator
from ml.pipelines.injury.build_injury_features import FILL_DEFAULTS
from ml.pipelines.train.train_stacked_with_injury import (
    StackedEnsembleInjury,
    evaluate_all_predictions,
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


def train_config(config_key: str, config: dict, out_dir: Path) -> dict:
    """Train one ablation config — same flow as train_stacked_with_injury.py."""
    name = config["name"]
    data_path = config["data"]
    config_out_dir = out_dir / f"config_{config_key}"

    # -- Banner (matches train_stacked_with_injury.py) --

    print(f"\n{'=' * 70}")
    print(f"ABLATION CONFIG {config_key}: {name}")
    print("=" * 70)
    print(f"Holdout season: {HOLDOUT_SEASON}")
    print(f"Train seasons:  {CV_SEASONS}")
    print(f"Input:          {data_path}")
    print()

    # -- Load data --

    print("Loading data...")
    df = pd.read_csv(data_path, low_memory=False)

    for c in CAT_COLS:
        if c in df.columns:
            df[c] = df[c].astype("category")

    available = set(df["season"].dropna().unique())
    train_seasons = [s for s in CV_SEASONS if s in available]

    if HOLDOUT_SEASON not in available:
        raise ValueError(f"Holdout season {HOLDOUT_SEASON} not in data")

    print(f"Total rows:    {len(df):,}")
    print(f"Total columns: {len(df.columns)}")

    # -- Feature group breakdown --

    injury_structured = [c for c in df.columns if c in FILL_DEFAULTS]
    injury_nlp = [c for c in df.columns if c.startswith("injury_") and c not in injury_structured]
    baseline_cols = [c for c in df.columns if c not in injury_structured + injury_nlp
                     and c not in [TARGET_COL] + DROP_COLS + ["GW"]]

    print(f"\nFeature groups:")
    print(f"Baseline features:           {len(baseline_cols)}")
    print(f"Injury structured + temporal: {len(injury_structured)}")
    print(f"Injury NLP (type dummies):    {len(injury_nlp)}")
    print(f"Total:                        {len(baseline_cols) + len(injury_structured) + len(injury_nlp)}")

    if "status_encoded" in df.columns:
        injury_seasons = sorted(df[df["status_encoded"].notna()]["season"].unique())
        nan_seasons = sorted(df[df["status_encoded"].isna()]["season"].unique())
        print(f"\nSeasons with real injury data: {injury_seasons}")
        print(f"Seasons with NaN (pre-injury): {nan_seasons}")

    # -- Split --

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

    # -- Train --

    print(f"\nTraining stacked ensemble (Config {config_key})...")
    ensemble = StackedEnsembleInjury(n_inner_folds=N_INNER_FOLDS)
    ensemble.fit(X_train, y_train, cat_cols)

    print("Generating predictions...")
    stacked_pred, all_preds = ensemble.predict(X_test)

    # -- Per-method holdout results table --

    results = evaluate_all_predictions(y_test, y_train, all_preds)
    best_method = min(results.keys(), key=lambda k: results[k]["mae"])

    print(f"\n{'=' * 60}")
    print(f"HOLDOUT RESULTS (all methods) — Config {config_key}")
    print(f"{'=' * 60}")
    print(f"\n{'Method':<15} {'MAE':<10} {'RMSE':<10} {'R²':<10}")
    print("-" * 45)
    for method in sorted(results.keys(), key=lambda x: results[x]["mae"]):
        r = results[method]
        marker = " *" if method == best_method else ""
        print(f"{method:<15} {r['mae']:.4f}     {r['rmse']:.4f}     {r['r2']:.4f}{marker}")

    print(f"\nBest method: {best_method}")

    # -- print_final_summary --

    holdout_eval = full_evaluation(y_test, stacked_pred, y_train)

    print_final_summary(
        model_name=f"ablation_{config_key}_{name}",
        holdout_season=HOLDOUT_SEASON,
        train_seasons=train_seasons,
        n_train=len(train_df),
        n_test=len(test_df),
        eval_result=holdout_eval,
        output_dir=str(config_out_dir),
    )

    # -- Comprehensive evaluation --

    positions = test_df["position"].values if "position" in test_df.columns else None
    gameweek_ids = test_df["GW"].values if "GW" in test_df.columns else None

    config_out_dir.mkdir(parents=True, exist_ok=True)

    evaluator = ComprehensiveEvaluator(config_out_dir)
    comprehensive = evaluator.evaluate_holdout(
        y_true=y_test,
        y_pred=stacked_pred,
        positions=positions,
        gameweek_ids=gameweek_ids,
        experiment_name=f"ablation_{config_key}",
    )
    evaluator.print_summary(comprehensive, f"Ablation Config {config_key}: {name}")

    # -- Save outputs --

    meta_coefs = ensemble.meta_info.get("coefficients", {})

    summary = {
        "model_name": f"ablation_{config_key}",
        "config": config_key,
        "config_name": name,
        "data_path": str(data_path),
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

    joblib.dump(ensemble, config_out_dir / "model.joblib")
    np.savez(
        config_out_dir / "holdout_predictions.npz",
        y_true=y_test,
        y_pred=stacked_pred,
    )
    (config_out_dir / "summary.json").write_text(
        json.dumps(summary, indent=2, default=str)
    )

    print(f"\nOutputs saved to: {config_out_dir}")
    print(f"model.joblib              — trained ensemble")
    print(f"summary.json              — full metrics")
    print(f"holdout_predictions.npz   — predictions for cross-config tests")
    print(f"ablation_{config_key}_comprehensive.json — stratified + calibration + business")

    return {
        "config_key": config_key,
        "name": name,
        "y_true": y_test,
        "y_pred": stacked_pred,
        "all_preds": all_preds,
        "holdout_eval": holdout_eval,
        "all_results": results,
        "comprehensive": comprehensive,
        "n_features": len(X_train.columns),
        "meta_coefs": meta_coefs,
        "base_names": ensemble.base_names,
        "best_method": best_method,
    }


# -- Cross-config comparison --

def print_comparison_table(results: dict) -> None:
    """Print ablation comparison table (runs after all configs are trained)."""
    configs = sorted(results.keys())

    print(f"\n\n{'=' * 70}")
    print("ABLATION COMPARISON")
    print(f"{'=' * 70}")

    # Main metrics
    print(f"\n  {'Config':<6} {'Description':<30} {'Feats':<8} {'MAE':<10} {'RMSE':<10} {'R²':<10} {'Spearman'}")
    print(f"  {'-'*6} {'-'*30} {'-'*8} {'-'*10} {'-'*10} {'-'*10} {'-'*10}")

    for key in configs:
        r = results[key]
        mae = r["holdout_eval"]["model"]["mae"]
        rmse = r["holdout_eval"]["model"]["rmse"]
        r2 = r["holdout_eval"]["model"]["r2"]
        rho = r["comprehensive"]["calibration"]["spearman_rho"]
        print(f"  {key:<6} {r['name']:<30} {r['n_features']:<8} {mae:<10.4f} {rmse:<10.4f} {r2:<10.4f} {rho:.4f}")

    # Stratified MAE breakdown
    print(f"\n  {'Config':<6} {'Overall':<10} {'Played':<10} {'Not Play':<10} {'GK':<10} {'DEF':<10} {'MID':<10} {'FWD':<10} {'High Ret'}")
    print(f"  {'-'*6} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*10}")

    for key in configs:
        s = results[key]["comprehensive"]["stratified"]
        print(f"  {key:<6} "
              f"{s['mae_overall']:<10.4f} "
              f"{s['mae_played']:<10.4f} "
              f"{s['mae_not_played']:<10.4f} "
              f"{s.get('mae_gk', 0):<10.4f} "
              f"{s.get('mae_def', 0):<10.4f} "
              f"{s.get('mae_mid', 0):<10.4f} "
              f"{s.get('mae_fwd', 0):<10.4f} "
              f"{s.get('mae_high_return', 0):<10.4f}")

    # Per-base-learner holdout MAE (compensatory masquerade check)
    if len(configs) >= 2:
        print(f"\n  {'Base Learner':<15}", end="")
        for key in configs:
            print(f" {'Config '+key:<12}", end="")
        if len(configs) == 2:
            print(f" {'Delta':<12}", end="")
        print()
        print(f"  {'-'*15}", end="")
        for _ in configs:
            print(f" {'-'*12}", end="")
        if len(configs) == 2:
            print(f" {'-'*12}", end="")
        print()

        base_names = results[configs[0]]["base_names"]
        for bname in base_names + ["mean", "median", "stacked"]:
            if bname not in results[configs[0]]["all_results"]:
                continue
            print(f"  {bname:<15}", end="")
            maes = []
            for key in configs:
                mae = results[key]["all_results"][bname]["mae"]
                maes.append(mae)
                marker = " *" if bname == results[key]["best_method"] else ""
                print(f" {mae:<12.4f}", end="")
            if len(configs) == 2:
                delta = maes[1] - maes[0]
                print(f" {delta:+.4f}", end="")
            print()

    # Meta-learner coefficients
    if len(configs) >= 2:
        print(f"\n  {'Meta Coef':<15}", end="")
        for key in configs:
            print(f" {'Config '+key:<12}", end="")
        print()
        print(f"  {'-'*15}", end="")
        for _ in configs:
            print(f" {'-'*12}", end="")
        print()

        base_names = results[configs[0]]["base_names"]
        for bname in base_names:
            print(f"  {bname:<15}", end="")
            for key in configs:
                c = results[key]["meta_coefs"].get(bname, 0)
                print(f" {c:<12.4f}", end="")
            print()

    # Calibration comparison
    print(f"\n{'Calibration':<25}", end="")
    for key in configs:
        print(f" {'Config '+key:<12}", end="")
    print()
    print(f"  {'-'*25}", end="")
    for _ in configs:
        print(f" {'-'*12}", end="")
    print()

    for metric, label in [
        ("correlation", "Pearson r"),
        ("spearman_rho", "Spearman rho"),
        ("mean_predicted", "Mean Predicted"),
        ("mean_actual", "Mean Actual"),
    ]:
        print(f"{label:<25}", end="")
        for key in configs:
            val = results[key]["comprehensive"]["calibration"][metric]
            print(f" {val:<12.4f}", end="")
        print()

    # Business metrics comparison
    if "business" in results[configs[0]]["comprehensive"]:
        print(f"\n{'Captain Picks':<25}", end="")
        for key in configs:
            print(f" {'Config '+key:<12}", end="")
        print()
        print(f"{'-'*25}", end="")
        for _ in configs:
            print(f" {'-'*12}", end="")
        print()

        for metric, label in [
            ("top1_accuracy", "Top-1 Accuracy"),
            ("top3_accuracy", "Top-3 Accuracy"),
            ("top5_accuracy", "Top-5 Accuracy"),
            ("captain_efficiency", "Captain Efficiency"),
        ]:
            print(f"{label:<25}", end="")
            for key in configs:
                val = results[key]["comprehensive"]["business"][metric]
                print(f"{val*100:<11.1f}%", end="")
            print()


def print_statistical_tests(results: dict) -> dict:
    """Run pairwise statistical tests and print results."""
    configs = sorted(results.keys())
    if len(configs) < 2:
        print("\nNeed at least 2 configs for statistical tests.")
        return {}

    print(f"\n\n{'=' * 70}")
    print("STATISTICAL SIGNIFICANCE")
    print(f"{'=' * 70}")

    test_results = {}
    baseline_key = configs[0]

    for key in configs[1:]:
        pair_name = f"{baseline_key}_vs_{key}"
        test_results[pair_name] = print_comparison(
            name_a=f"Config {baseline_key}",
            name_b=f"Config {key}",
            y_true=results[baseline_key]["y_true"],
            pred_a=results[baseline_key]["y_pred"],
            pred_b=results[key]["y_pred"],
        )

    # Pairwise between non-baseline configs
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

        print(f"\nINCREMENTAL ANALYSIS")
        print(f"Injury alone (A-B):    {injury_alone:+.4f}")
        print(f"News alone (A-C):      {news_alone:+.4f}")
        print(f"Combined (A-D):        {combined:+.4f}")
        print(f"Expected additive:     {injury_alone + news_alone:+.4f}")
        print(f"Interaction effect:     {interaction:+.4f}")

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
        print(f"{key}: {CONFIGS[key]['name']} -> {CONFIGS[key]['data']}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = {}

    for key in config_keys:
        results[key] = train_config(key, CONFIGS[key], OUT_DIR)

    # Cross-config comparison (only if multiple configs)
    if len(results) >= 2:
        print_comparison_table(results)
        test_results = print_statistical_tests(results)
    else:
        test_results = {}

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
        print(f"config_{key}/")
        print(f"model.joblib              — trained ensemble")
        print(f"summary.json              — full metrics")
        print(f"holdout_predictions.npz   — for cross-config tests")
        print(f"ablation_{key}_comprehensive.json")
    print(f"ablation_summary.json        — cross-config comparison")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Injury & News Ablation Study")
    parser.add_argument(
        "--configs", nargs="+", default=None,
        help="Config keys to run (e.g., A B). Default: all available.",
    )
    args = parser.parse_args()

    run(config_keys=args.configs)
