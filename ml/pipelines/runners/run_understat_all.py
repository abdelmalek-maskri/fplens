# ml/pipelines/run_understat_all.py
import argparse
import subprocess
import sys

from ml.config.seasons import SEASONS_ALL


def sh(cmd):
    print("\n🔧", " ".join(cmd))
    subprocess.check_call(cmd)


def run_module(module: str, args: list):
    """
    Always run pipelines as modules so `from ml...` imports work.
    """
    sh([sys.executable, "-m", module] + args)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--seasons",
        nargs="*",
        default=None,
        help="e.g. 2016-17 2017-18 ... (default: SEASONS_ALL)",
    )
    args = ap.parse_args()

    seasons = args.seasons if args.seasons else SEASONS_ALL

    for s in seasons:
        print(f"\n==================== SEASON {s} ====================")

        # 1) Build FPL fixtures + fixture->GW mapping
        run_module("ml.pipelines.fpl.build_fpl_fixtures_from_gws", ["--season", s])
        run_module("ml.pipelines.mappings.build_fixture_to_gw", ["--season", s])

        # 2) Fetch Understat + build required mapping tables
        run_module("ml.pipelines.understat.fetch_understat", ["--season", s])

        # ✅ Required missing piece for understat_map_fixture:
        # writes data/processed/mappings/team_name_map_{season}.csv
        run_module("ml.pipelines.mappings.build_team_name_map", ["--season", s])

        # FPL ↔ Understat player mapping
        run_module("ml.pipelines.mappings.build_fpl_understat_mapping", ["--season", s])

        # 3) Map Understat matches to FPL fixtures, add GW, build Understat GW table
        run_module("ml.pipelines.understat.understat_map_fixture", ["--season", s])
        run_module("ml.pipelines.understat.understat_add_gw_by_fixture", ["--season", s])
        run_module("ml.pipelines.understat.build_understat_gw", ["--season", s])

    # 4) Final merge across seasons (enrich FPL with Understat features)
    run_module("ml.pipelines.merge.enrich_fpl_with_understat_all", ["--seasons"] + seasons)


if __name__ == "__main__":
    main()
