# ml/pipelines/runners/run_data_pipeline.py
"""
Runs the full data pipeline: FPL processing, Understat scraping,
cross-source mapping, and merge. Steps 1-10 in the pipeline.
"""

import subprocess
import sys

def sh(cmd):
    print("\n", " ".join(cmd))
    subprocess.check_call(cmd)


def run_module(module: str):
    sh([sys.executable, "-m", module])


def main():
    # 1) FPL base data
    run_module("ml.pipelines.fpl.build_gw_windows")
    run_module("ml.pipelines.fpl.build_fpl_table")

    # 2) FPL fixtures + fixture->GW mapping
    run_module("ml.pipelines.fpl.build_fpl_fixtures_from_gws")
    run_module("ml.pipelines.mappings.build_fixture_to_gw")

    # 2) fetch Understat + build required mapping tables
    run_module("ml.pipelines.understat.fetch_understat")
    run_module("ml.pipelines.mappings.build_team_name_map")
    run_module("ml.pipelines.mappings.build_fpl_understat_mapping")

    # 3) map Understat matches to FPL fixtures, add GW, build Understat GW table
    run_module("ml.pipelines.understat.understat_map_fixture")
    run_module("ml.pipelines.understat.understat_add_gw_by_fixture")
    run_module("ml.pipelines.understat.build_understat_gw")

    # 4) final merge (enrich FPL with Understat features)
    run_module("ml.pipelines.merge.enrich_fpl_with_understat_all")

if __name__ == "__main__":
    main()
