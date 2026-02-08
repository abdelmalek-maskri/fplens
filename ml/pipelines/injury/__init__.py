"""
Injury data pipeline for FPL prediction.

This module handles:
1. Downloading historical injury data from vaastav's FPL repository
2. Extracting and processing injury features
3. Merging injury data with main FPL dataset

Key insight: The vaastav repository updates players_raw.csv after each
gameweek. By fetching historical commits, we can reconstruct per-GW
injury states without temporal leakage.
"""
