"""Every season the project has data for, oldest first.

Order matters: the cross-validation folds are chronological, so this list is
read as a timeline rather than a set. eval_config.py decides which of these
are trained on, held out, or skipped as incomplete.
"""

SEASONS_ALL = [
    "2016-17",
    "2017-18",
    "2018-19",
    "2019-20",
    "2020-21",
    "2021-22",
    "2022-23",
    "2023-24",
    "2024-25",
    "2025-26",
]
