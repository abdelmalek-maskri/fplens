"""
Injury data pipeline for FPL prediction.

Pipeline steps (run in order):
    1. download_historical  — fetch per-GW injury snapshots from vaastav's repo
    2. merge_with_fpl       — align with main FPL dataset (+1 GW temporal shift)
    3. build_injury_features — engineer structured, NLP, and embedding features

Anti-leakage design: vaastav commits players_raw.csv AFTER each gameweek.
The merge step shifts by +1 GW so that GW N predictions only use injury
status known after GW N-1.

Seasons covered: 2018-19 onwards (earlier seasons lack per-GW commits).
2019-20 COVID ghost commits (GW30-37) are harmlessly dropped during merge.
"""
