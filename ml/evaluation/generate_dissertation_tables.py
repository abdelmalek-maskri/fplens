# ml/evaluation/generate_dissertation_tables.py
"""
Generate dissertation-ready tables from deep comparison outputs.

Reads from outputs/comparison/ and produces:
    outputs/comparison/final_report_table.csv    — one flat table with ALL metrics
    outputs/comparison/final_report_table.md     — markdown version
    outputs/comparison/table_dm_matrix.md        — DM significance matrix
    outputs/comparison/table_position_mae.md     — position-wise MAE
    outputs/comparison/table_stability.md        — per-GW stability
"""

import json
from pathlib import Path

import pandas as pd

COMPARISON_DIR = Path("outputs/comparison")


def load_json(name: str) -> dict:
    path = COMPARISON_DIR / name
    return json.loads(path.read_text())


def generate_final_report_table():
    """Merge ALL metrics into one flat CSV + markdown table."""
    metrics = load_json("master_comparison.json")
    shap_path = COMPARISON_DIR / "shap_comparison.json"
    shap_data = load_json("shap_comparison.json") if shap_path.exists() else {}

    rows = []
    for model_name, m in metrics.items():
        s = m.get("stratified", {})
        c = m.get("calibration", {})
        b = m.get("business", {})
        bl = m.get("baselines", {})
        st = m.get("stability", {})
        r = m.get("residuals", {})

        # Find top SHAP feature for this model
        top_shap = ""
        top_shap_pct = ""
        # Try exact match, then partial match
        for shap_name, features in shap_data.items():
            if model_name in shap_name or shap_name in model_name:
                if features:
                    top_shap = features[0]["feature"]
                    top_shap_pct = features[0]["importance"]
                break

        row = {
            "Model": model_name,
            "Family": m.get("family", ""),
            "N Features": m.get("n_features", ""),
            "MAE": _fmt(s.get("mae_overall")),
            "RMSE": _fmt(s.get("rmse_overall")),
            "R²": _fmt(c.get("correlation") ** 2 if c.get("correlation") is not None else None),
            "Spearman ρ": _fmt(c.get("spearman_rho")),
            "MAE (played)": _fmt(s.get("mae_played")),
            "MAE (not played)": _fmt(s.get("mae_not_played")),
            "MAE (high ≥5pts)": _fmt(s.get("mae_high_return")),
            "MAE (GK)": _fmt(s.get("mae_gk")),
            "MAE (DEF)": _fmt(s.get("mae_def")),
            "MAE (MID)": _fmt(s.get("mae_mid")),
            "MAE (FWD)": _fmt(s.get("mae_fwd")),
            "Mean Predicted": _fmt(c.get("mean_predicted")),
            "Mean Actual": _fmt(c.get("mean_actual")),
            "Correlation": _fmt(c.get("correlation")),
            "Captain Top-1 %": _pct(b.get("top1_accuracy")),
            "Captain Top-3 %": _pct(b.get("top3_accuracy")),
            "Captain Top-5 %": _pct(b.get("top5_accuracy")),
            "Captain Efficiency %": _pct(b.get("captain_efficiency")),
            "MAE vs Zero": _fmt(bl.get("mae_vs_zero")),
            "MAE vs Mean": _fmt(bl.get("mae_vs_mean")),
            "GW MAE Std": _fmt(st.get("gw_mae_std")),
            "GW MAE CoV": _fmt(st.get("gw_mae_cov")),
            "Residual Mean": _fmt(r.get("mean")),
            "Residual Skew": _fmt(r.get("skewness")),
            "Top SHAP Feature": top_shap,
            "Top SHAP %": top_shap_pct,
        }
        rows.append(row)

    df = pd.DataFrame(rows).sort_values("MAE")

    # Save CSV
    df.to_csv(COMPARISON_DIR / "final_report_table.csv", index=False)

    # Save markdown
    md = df.to_markdown(index=False)
    (COMPARISON_DIR / "final_report_table.md").write_text(f"# Final Model Comparison\n\n{md}\n")

    print(f"  Saved final_report_table.csv ({len(df)} models × {len(df.columns)} columns)")
    print("  Saved final_report_table.md")
    return df


def generate_dm_matrix_table():
    """Format DM significance matrix with stars."""
    matrix_df = pd.read_csv(COMPARISON_DIR / "dm_significance_matrix.csv", index_col=0)

    # Create starred version
    def star(p):
        if p == 0.0:
            return "-"
        if p < 0.001:
            return "***"
        if p < 0.01:
            return "**"
        if p < 0.05:
            return "*"
        return "ns"

    starred = matrix_df.map(star)
    md = starred.to_markdown()
    (COMPARISON_DIR / "table_dm_matrix.md").write_text(
        f"# Diebold-Mariano Significance Matrix\n\n"
        f"\\* p<0.05, \\*\\* p<0.01, \\*\\*\\* p<0.001, ns = not significant\n\n{md}\n"
    )
    print("  Saved table_dm_matrix.md")


def generate_position_table():
    """Position-wise MAE table."""
    metrics = load_json("master_comparison.json")

    rows = []
    for name, m in metrics.items():
        s = m.get("stratified", {})
        rows.append(
            {
                "Model": name,
                "GK": _fmt(s.get("mae_gk")),
                "DEF": _fmt(s.get("mae_def")),
                "MID": _fmt(s.get("mae_mid")),
                "FWD": _fmt(s.get("mae_fwd")),
                "Overall": _fmt(s.get("mae_overall")),
            }
        )

    df = pd.DataFrame(rows).sort_values("Overall")
    md = df.to_markdown(index=False)
    (COMPARISON_DIR / "table_position_mae.md").write_text(f"# Position-wise MAE\n\n{md}\n")
    print("  Saved table_position_mae.md")


def generate_stability_table():
    """Per-GW stability table."""
    metrics = load_json("master_comparison.json")

    rows = []
    for name, m in metrics.items():
        st = m.get("stability", {})
        if st:
            rows.append(
                {
                    "Model": name,
                    "GW MAE Mean": _fmt(st.get("gw_mae_mean")),
                    "GW MAE Std": _fmt(st.get("gw_mae_std")),
                    "CoV": _fmt(st.get("gw_mae_cov")),
                    "Min GW": _fmt(st.get("gw_mae_min")),
                    "Max GW": _fmt(st.get("gw_mae_max")),
                }
            )

    df = pd.DataFrame(rows).sort_values("GW MAE Mean")
    md = df.to_markdown(index=False)
    (COMPARISON_DIR / "table_stability.md").write_text(f"# Per-GW Stability\n\n{md}\n")
    print("  Saved table_stability.md")


def _fmt(val, decimals=4):
    """Format a numeric value."""
    if val is None or val == "":
        return ""
    try:
        return round(float(val), decimals)
    except (TypeError, ValueError):
        return val


def _pct(val):
    """Format as percentage."""
    if val is None:
        return ""
    try:
        return round(float(val) * 100, 1)
    except (TypeError, ValueError):
        return val


def run():
    print("=" * 65)
    print("  GENERATING DISSERTATION TABLES")
    print("=" * 65)

    if not (COMPARISON_DIR / "master_comparison.json").exists():
        print("  ERROR: Run deep_comparison.py first")
        return

    generate_final_report_table()

    dm_deps = ["dm_significance_matrix.csv"]
    if all((COMPARISON_DIR / f).exists() for f in dm_deps):
        generate_dm_matrix_table()
    else:
        print(f"  SKIP: generate_dm_matrix_table (missing {dm_deps})")

    generate_position_table()
    generate_stability_table()

    print(f"\n  All tables saved to {COMPARISON_DIR}/")
    print("=" * 65)


if __name__ == "__main__":
    run()
