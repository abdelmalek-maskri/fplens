"""How every model in this project is trained and scored.

One place, because a model evaluated on a different split than its neighbours
cannot be compared with them, and that mistake is invisible in the results.
"""

from ml.config.seasons import SEASONS_ALL

# ---------------------------------------------------------------------------
# the split
HOLDOUT_SEASON = "2024-25"  # never trained on; every number quoted anywhere comes from here
INCOMPLETE_SEASON = "2025-26"  # in progress, so its targets are partly absent
CV_SEASONS = [s for s in SEASONS_ALL if s not in [HOLDOUT_SEASON, INCOMPLETE_SEASON]]
MIN_TRAIN_SEASONS = 3  # folds are chronological; earlier ones train on too little to score

# features
# All three targets are dropped whichever one is being predicted: leaving GW+2
# in while predicting GW+1 hands the model the answer to a question two weeks
# ahead of the one it was asked.
DROP_COLS = ["name", "element", "points_next_gw", "points_gw_plus_2", "points_gw_plus_3"]
CAT_COLS = ["season", "position", "team", "opponent_team"]  # trees split on value, not on code

# targets
TARGET_COL = "points_next_gw"
TARGET_COL_GW2 = "points_gw_plus_2"
TARGET_COL_GW3 = "points_gw_plus_3"
HORIZON_TARGETS = {1: TARGET_COL, 2: TARGET_COL_GW2, 3: TARGET_COL_GW3}

# outputs
MODELS_DIR = "outputs/models"
METRICS_DIR = "outputs/evaluation/metrics"
# ---------------------------------------------------------------------------
