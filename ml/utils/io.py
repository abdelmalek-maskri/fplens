# ml/utils/io.py
"""
I/O utilities for data loading and file operations.
"""

from pathlib import Path
from typing import Union

import pandas as pd


def find_latest_snapshot(root: Union[str, Path] = "data/raw/fpl") -> Path:
    """
    Find the most recent vaastav snapshot directory.

    Args:
        root: Base directory containing vaastav_snapshot_* folders

    Returns:
        Path to the latest snapshot directory

    Raises:
        FileNotFoundError: If no snapshot directories found
    """
    root = Path(root)
    snaps = sorted([p for p in root.glob("vaastav_snapshot_*") if p.is_dir()])
    if not snaps:
        raise FileNotFoundError(f"No snapshot directory found under {root}/vaastav_snapshot_*")
    return snaps[-1]


def safe_read_csv(path: Union[str, Path]) -> pd.DataFrame:
    # 1) Fast path: C engine + utf-8
    try:
        return pd.read_csv(path, encoding="utf-8", low_memory=False)
    except UnicodeDecodeError:
        pass

    # 2) Still-fast fallbacks
    for enc in ("utf-8-sig", "cp1252", "latin1"):
        try:
            return pd.read_csv(path, encoding=enc, low_memory=False)
        except UnicodeDecodeError:
            continue

    # 3) Last resort: python engine (note: no low_memory with python engine)
    return pd.read_csv(path, encoding="cp1252", engine="python", on_bad_lines="skip")
