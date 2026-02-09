# ml/utils/io.py
"""
I/O utilities for data loading and file operations.
"""

import csv
import warnings
from pathlib import Path
from typing import Union
import pandas as pd


def find_latest_snapshot(root: Union[str, Path] = "data/raw/fpl") -> Path:
    """
    Find the most recent vaastav snapshot directory.
    Returns:
        Path to the latest snapshot directory
    """
    root = Path(root)
    snaps = sorted([p for p in root.glob("vaastav_snapshot_*") if p.is_dir()])
    if not snaps:
        raise FileNotFoundError(f"No snapshot directory found under {root}/vaastav_snapshot_*")
    return snaps[-1]


def _repair_mixed_length_csv(path: Union[str, Path], encoding: str) -> pd.DataFrame | None:
    """
    Attempt to repair a CSV with mixed row lengths by dropping a contiguous
    block of extra columns in the longer rows.
    """
    path = Path(path)
    with path.open("r", encoding=encoding, errors="replace") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if header is None:
            return None

        rows = []
        lens = []
        for row in reader:
            rows.append(row)
            lens.append(len(row))

    if not lens:
        return pd.DataFrame(columns=header)

    header_len = len(header)
    uniq_lens = sorted(set(lens))
    if len(uniq_lens) != 2 or header_len not in uniq_lens:
        return None

    long_len = max(uniq_lens)
    diff = long_len - header_len
    if diff <= 0:
        return None

    # Heuristic: find the best contiguous drop window in longer rows.
    gw_idx = header.index("GW") if "GW" in header else None
    was_home_idx = header.index("was_home") if "was_home" in header else None
    kickoff_idx = header.index("kickoff_time") if "kickoff_time" in header else None

    sample = [r for r in rows if len(r) == long_len][:1000]
    if not sample:
        return None

    def score_drop(start: int) -> int:
        score = 0
        for r in sample:
            fixed = r[:start] + r[start + diff :]
            if len(fixed) != header_len:
                continue
            ok = True
            if gw_idx is not None:
                gw = fixed[gw_idx]
                ok = ok and (gw.isdigit() or gw == "")
            if was_home_idx is not None:
                wh = fixed[was_home_idx]
                ok = ok and (wh in ("True", "False", "0", "1", ""))
            if kickoff_idx is not None:
                kt = fixed[kickoff_idx]
                ok = ok and (("T" in kt and kt.endswith("Z")) or kt == "")
            if ok:
                score += 1
        return score

    best_start = None
    best_score = -1
    for start in range(0, long_len - diff + 1):
        s = score_drop(start)
        if s > best_score:
            best_score = s
            best_start = start

    if best_start is None or best_score < max(1, int(0.8 * len(sample))):
        return None

    repaired = 0
    fixed_rows = []
    for r in rows:
        if len(r) == long_len:
            r = r[:best_start] + r[best_start + diff :]
            repaired += 1
        elif len(r) < header_len:
            r = r + [""] * (header_len - len(r))
        fixed_rows.append(r)

    if repaired > 0:
        warnings.warn(
            f"Repaired {repaired} row(s) in {path} by dropping {diff} extra column(s) "
            f"at index {best_start}",
            RuntimeWarning,
        )

    return pd.DataFrame(fixed_rows, columns=header)


def safe_read_csv(path: Union[str, Path]) -> pd.DataFrame:
    skipped = {"count": 0}

    def _count_bad_line(_line: list[str]) -> None:
        skipped["count"] += 1
        return None

    # 1) Fast path: C engine + utf-8
    try:
        return pd.read_csv(path, encoding="utf-8", low_memory=False)
    except UnicodeDecodeError:
        pass
    except pd.errors.ParserError:
        # Fallback to python engine for malformed rows
        try:
            repaired = _repair_mixed_length_csv(path, encoding="utf-8")
            if repaired is not None:
                return repaired
            df = pd.read_csv(path, encoding="utf-8", engine="python", on_bad_lines=_count_bad_line)
            if skipped["count"] > 0:
                warnings.warn(
                    f"Skipped {skipped['count']} bad line(s) while reading {path}",
                    RuntimeWarning,
                )
            return df
        except Exception:
            pass

    # 2) Still-fast fallbacks
    for enc in ("utf-8-sig", "cp1252", "latin1"):
        try:
            return pd.read_csv(path, encoding=enc, low_memory=False)
        except UnicodeDecodeError:
            continue
        except pd.errors.ParserError:
            # Try python engine for this encoding
            try:
                repaired = _repair_mixed_length_csv(path, encoding=enc)
                if repaired is not None:
                    return repaired
                df = pd.read_csv(path, encoding=enc, engine="python", on_bad_lines=_count_bad_line)
                if skipped["count"] > 0:
                    warnings.warn(
                        f"Skipped {skipped['count']} bad line(s) while reading {path}",
                        RuntimeWarning,
                    )
                return df
            except Exception:
                continue

    # 3) Last resort: python engine (note: no low_memory with python engine)
    repaired = _repair_mixed_length_csv(path, encoding="cp1252")
    if repaired is not None:
        return repaired
    df = pd.read_csv(path, encoding="cp1252", engine="python", on_bad_lines=_count_bad_line)
    if skipped["count"] > 0:
        warnings.warn(
            f"Skipped {skipped['count']} bad line(s) while reading {path}",
            RuntimeWarning,
        )
    return df
