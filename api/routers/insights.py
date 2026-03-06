"""Model insights and news endpoints, static training metrics + Guardian articles."""

import json
from pathlib import Path
from fastapi import APIRouter

router = APIRouter(tags=["Insights"])

OUTPUTS = Path("outputs")


@router.get("/model-insights")
def get_model_insights():
    
    # Training metrics, ablation results, SHAP global importance
    ablation_path = OUTPUTS / "experiments/ablation_injury/ablation_summary.json"
    ablation = json.loads(ablation_path.read_text()) if ablation_path.exists() else {}

    shap_path = OUTPUTS / "analysis/shap/stacked_ensemble_global_importance.csv"
    shap_features = []
    if shap_path.exists():
        import csv
        with open(shap_path) as f:
            shap_features = list(csv.DictReader(f))

    variants = []
    for config in ["A", "B", "C", "D"]:
        summary_path = OUTPUTS / f"experiments/ablation_injury/config_{config}/summary.json"
        if summary_path.exists():
            variants.append(json.loads(summary_path.read_text()))

    return {
        "ablation": ablation,
        "shap_features": shap_features,
        "model_variants": variants,
    }


@router.get("/news")
def get_news():
    # Recent Guardian articles with sentiment and player links
    # FF-20: Will wire Guardian pipeline once implemented
    return []
