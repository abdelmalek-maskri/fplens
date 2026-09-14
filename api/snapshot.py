"""Read the predictions the scheduled job wrote.

The API no longer loads or runs models. Predictions come from the same snapshot
files the frontend reads, so the two can never disagree about what a player is
predicted to score.

Parsing the file costs about 3ms, so it is read per request rather than cached.
That also means a fresh snapshot is live the moment it lands, with no TTL to
wait out and no cache to invalidate.
"""

import json
import os
from pathlib import Path

import pandas as pd
from fastapi import HTTPException

# The frontend serves these from its own public directory. Override when the API
# is deployed separately from the site.
SNAPSHOT_DIR = Path(os.environ.get("FPLENS_SNAPSHOT_DIR", "app/public/data"))


def _read(name: str):
    path = SNAPSHOT_DIR / name
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=f"No snapshot at {path}. Run `make snapshot` to build one.",
        )
    return json.loads(path.read_text())


def load_manifest() -> dict:
    return _read("manifest.json")


def load_predictions() -> pd.DataFrame:
    """Predicted points for every player, from the default model.

    Only the default is exposed because only the default is asked for: the squad
    solver and team enrichment never took a model parameter. Adding one means
    passing an id through to the filename, not restructuring anything.
    """
    return pd.DataFrame(_read(f"predictions_{load_manifest()['default_model']}.json"))
