# ml/utils/io.py
from pathlib import Path
import pandas as pd

def safe_read_csv(path: Path) -> pd.DataFrame:
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
