# ml/config/eval_config.py
"""
shared evaluation configuration for all models.
"""

from ml.config.seasons import SEASONS_ALL

# -----------------------------------------------------------------------------
# HOLDOUT CONFIGURATION
# -----------------------------------------------------------------------------

HOLDOUT_SEASON = "2024-25"

# Incomplete season (current)
INCOMPLETE_SEASON = "2025-26"

# -----------------------------------------------------------------------------
# CROSS-VALIDATION CONFIGURATION
# -----------------------------------------------------------------------------

# Seasons used for rolling CV (excludes holdout and incomplete)
CV_SEASONS = [s for s in SEASONS_ALL if s not in [HOLDOUT_SEASON, INCOMPLETE_SEASON]]

# Minimum training seasons before first CV fold
MIN_TRAIN_SEASONS = 3

# -----------------------------------------------------------------------------
# FEATURE CONFIGURATION
# -----------------------------------------------------------------------------

# Columns to always drop before training (identifiers + all target columns).
DROP_COLS = ["name", "element", "points_next_gw", "points_gw_plus_2", "points_gw_plus_3"]

# Categorical columns for tree-based models
CAT_COLS = ["season", "position", "team", "opponent_team"]

# Target columns per horizon
TARGET_COL = "points_next_gw"
TARGET_COL_GW2 = "points_gw_plus_2"
TARGET_COL_GW3 = "points_gw_plus_3"
HORIZON_TARGETS = {1: TARGET_COL, 2: TARGET_COL_GW2, 3: TARGET_COL_GW3}

# -----------------------------------------------------------------------------
# OUTPUT PATHS
# -----------------------------------------------------------------------------

MODELS_DIR = "outputs/models"
METRICS_DIR = "outputs/evaluation/metrics"
