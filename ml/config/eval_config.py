# ml/config/eval_config.py
"""
Shared evaluation configuration for all models.
"""

from ml.config.seasons import SEASONS_ALL

# -----------------------------------------------------------------------------
# HOLDOUT CONFIGURATION
# -----------------------------------------------------------------------------

# Latest complete season used as final holdout test set.
HOLDOUT_SEASON = "2024-25"

# Incomplete season (current) - excluded from both CV and holdout
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

# Columns to always drop before training (identifiers, not features)
DROP_COLS = ["name", "element"]

# Categorical columns for tree-based models
CAT_COLS = ["season", "position", "team", "opponent_team"]

# Target column
TARGET_COL = "points_next_gw"

# -----------------------------------------------------------------------------
# OUTPUT PATHS
# -----------------------------------------------------------------------------

MODELS_DIR = "outputs/models"
METRICS_DIR = "outputs/metrics"
