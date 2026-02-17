# ml/pipelines/run_understat_all.py
"""
Runs the full Understat pipeline for all seasons.
Each module now handles all seasons internally.
"""

import subprocess
import sys


def sh(cmd):
    print("\n", " ".join(cmd))
    subprocess.check_call(cmd)


def run_module(module: str):
    sh([sys.executable, "-m", module])


def main():
    print("==================== UNDERSTAT PIPELINE ====================")

    # 1) Build FPL fixtures + fixture->GW mapping
    run_module("ml.pipelines.fpl.build_fpl_fixtures_from_gws")
    run_module("ml.pipelines.mappings.build_fixture_to_gw")

    # 2) Fetch Understat + build required mapping tables
    run_module("ml.pipelines.understat.fetch_understat")
    run_module("ml.pipelines.mappings.build_team_name_map")
    run_module("ml.pipelines.mappings.build_fpl_understat_mapping")

    # 3) Map Understat matches to FPL fixtures, add GW, build Understat GW table
    run_module("ml.pipelines.understat.understat_map_fixture")
    run_module("ml.pipelines.understat.understat_add_gw_by_fixture")
    run_module("ml.pipelines.understat.build_understat_gw")

    # 4) Final merge (enrich FPL with Understat features)
    run_module("ml.pipelines.merge.enrich_fpl_with_understat_all")

    print("\n==================== DONE ====================")


if __name__ == "__main__":
    main()
