"""Where the trained models live, and how to load them.

This belongs with the job rather than the API because the job is what loads
models. Once the API serves precomputed snapshots it will not import from here
at all, and its image can drop LightGBM, XGBoost and SHAP entirely.

Both metrics are exposed because ranking and error disagree here, and that
disagreement is the point: baseline_tweedie has the lowest MAE of anything in
the project while ranking near the bottom, because 60% of the target is zeros
and MAE rewards predicting low. rho is the metric to sort and judge by.
Numbers come from outputs/experiments/**/{summary,metrics,*_comprehensive}.json.
"""

import contextlib
import os
from pathlib import Path

import joblib

# joblib needs the custom estimator classes importable to unpickle. Training
# scripts pickle them under __main__, which uvicorn --reload remaps to
# __mp_main__, so both names are patched below. Guarded because the training
# dependencies are not installed in every environment that loads a model.
_MODEL_CLASSES = []
with contextlib.suppress(ImportError):
    from ml.pipelines.train.train_stacked_ensemble import StackedEnsemble

    _MODEL_CLASSES.append(StackedEnsemble)
with contextlib.suppress(ImportError):
    from ml.pipelines.train.train_twohead_model import TwoHeadModel

    _MODEL_CLASSES.append(TwoHeadModel)
with contextlib.suppress(ImportError):
    from ml.pipelines.train.train_position_specific import PositionSpecificLGBMModel

    _MODEL_CLASSES.append(PositionSpecificLGBMModel)
with contextlib.suppress(ImportError):
    from ml.pipelines.train.train_stacked_with_injury import StackedEnsembleInjury

    _MODEL_CLASSES.append(StackedEnsembleInjury)


MODEL_REGISTRY = {
    "config_d": (
        "Config D: Stacked + Injury + News",
        "outputs/experiments/ablation/config_D/model.joblib",
        1.029,
        0.687,
    ),
    "config_b": ("Config B: + Injury", "outputs/experiments/ablation/config_B/model.joblib", 1.032, 0.685),
    "config_c": ("Config C: + News", "outputs/experiments/ablation/config_C/model.joblib", 1.037, 0.675),
    "config_a": ("Config A: FPL + Understat", "outputs/experiments/ablation/config_A/model.joblib", 1.039, 0.674),
    "stacked_ensemble": (
        "Stacked Ensemble (no injury/news)",
        "outputs/experiments/stacked_ensemble/model.joblib",
        1.080,
        0.669,
    ),
    "catboost_twohead": ("CatBoost Two-Head", "outputs/experiments/catboost_twohead/model.joblib", 1.097, 0.667),
    "baseline_tweedie": ("LightGBM Tweedie", "outputs/experiments/baseline_tweedie/model.joblib", 1.021, 0.662),
    "baseline": ("Single LightGBM", "outputs/experiments/baseline/model.joblib", 1.091, 0.661),
    "twohead": ("Two-Head (Classifier + Regressor)", "outputs/experiments/twohead/model.joblib", 1.087, 0.655),
    "position_specific": (
        "Position-Specific (4× LightGBM)",
        "outputs/experiments/position_specific/model.joblib",
        1.095,
        0.633,
    ),
}

DEFAULT_MODEL_ID = "config_d"

# The set published to the site, in two halves.
#
# The four ablation configs are the point of the project: switching between them
# shows what injury and news features are actually worth, which is the research
# made interactive rather than a table in a document. stacked_ensemble is the
# same architecture without either, so it is the floor they are measured against.
#
# The other four each demonstrate something distinct: lowest MAE but poor ranking,
# the original baseline, a different architecture, and a failed experiment.
#
# This list used to exclude the ablation configs because the API held every model
# in memory for the life of the process, and each stacked ensemble costs ~120MB.
# The API no longer loads models at all — the job loads them once, predicts, and
# exits — so that constraint is gone. What publishing one now costs is ~45MB in
# the release tarball and ~38KB gzipped per snapshot.
#
# catboost_twohead is left out: 46MB to duplicate an architecture already shown.
SHOWCASE_MODELS = (
    "config_d",
    "config_b",
    "config_c",
    "config_a",
    "stacked_ensemble",
    "baseline_tweedie",
    "baseline",
    "twohead",
    "position_specific",
)


def patch_unpickle_names() -> None:
    """Make the custom estimator classes resolvable under __main__/__mp_main__."""
    import sys

    for mod in ("__main__", "__mp_main__"):
        target = sys.modules.get(mod)
        if target is None:
            continue
        for cls in _MODEL_CLASSES:
            setattr(target, cls.__name__, cls)


def selected_model_ids() -> list[str]:
    """Model IDs to attempt loading.

    Defaults to SHOWCASE_MODELS so a local run produces the same selector a
    visitor gets, rather than every model that happens to be on disk.
    FPLENS_MODELS takes "all", "showcase", or a comma-separated list of IDs.
    """
    raw = os.environ.get("FPLENS_MODELS", "").strip()
    if not raw or raw == "showcase":
        return list(SHOWCASE_MODELS)
    if raw == "all":
        return list(MODEL_REGISTRY)

    ids = [m.strip() for m in raw.split(",") if m.strip()]
    unknown = [m for m in ids if m not in MODEL_REGISTRY]
    if unknown:
        raise ValueError(f"FPLENS_MODELS contains unknown model IDs {unknown}; valid: {list(MODEL_REGISTRY)}")
    return ids


def load_models(model_ids: list[str] | None = None) -> tuple[dict, list[dict]]:
    """Load the given models from disk.

    Returns (models by id, info dicts for the selector). A model whose .joblib is
    missing is skipped rather than raising, so a partial checkout yields fewer
    options instead of failing to start.
    """
    patch_unpickle_names()

    models: dict = {}
    info: list[dict] = []
    for model_id in model_ids if model_ids is not None else selected_model_ids():
        name, path, mae, rho = MODEL_REGISTRY[model_id]
        p = Path(path)
        if not p.exists():
            continue
        try:
            models[model_id] = joblib.load(p)
            info.append({"id": model_id, "name": name, "mae": mae, "spearman": rho})
        except Exception as e:
            print(f"  WARNING: failed to load {name}: {e}")

    return models, info
