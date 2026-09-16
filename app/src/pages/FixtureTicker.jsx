import { useSearchParams } from "react-router-dom";
import { TEAM_COLORS } from "../lib/constants";
import TabBar from "../components/ui/TabBar";
import ErrorState from "../components/feedback/ErrorState";
import Loading from "../components/feedback/Loading";
import { useFixtures } from "../hooks";

const LABELS = { 1: "Very easy", 2: "Easy", 3: "Medium", 4: "Hard", 5: "Very hard" };

export default function FixtureTicker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sortBy = searchParams.get("sort") || "name";
  const setSort = (value) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("sort", value);
      return p;
    });
  };

  const { data: fixtureData, isLoading, error } = useFixtures();
  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Failed to load fixture data." />;
  if (!fixtureData) return null;
  const {
    teams: TEAMS,
    teamFull: TEAM_FULL,
    fixtures: FIXTURES,
    fdrBg: FDR_BG,
    fdrText: FDR_TEXT,
  } = fixtureData;

  // Derive from actual data so blank GWs don't break alignment
  const gameweeks = [...new Set(Object.values(FIXTURES).flatMap((fs) => fs.map((f) => f.gw)))].sort(
    (a, b) => a - b
  );

  // FPL publishes one difficulty per team per fixture, held in atkFdr. defFdr
  // is the opponent's rating of the same match, which is just this team's
  // own strength, so it is not a second view of the fixture and is not shown.
  const teamData = TEAMS.map((team) => {
    const fixtures = FIXTURES[team] || [];
    const fixtureByGw = Object.fromEntries(fixtures.map((f) => [f.gw, f]));
    const avg = fixtures.reduce((s, f) => s + f.atkFdr, 0) / (fixtures.length || 1);
    return { team, fixtureByGw, avg };
  });

  const sortedTeams = [...teamData].sort((a, b) =>
    sortBy === "name" ? a.team.localeCompare(b.team) : a.avg - b.avg
  );

  return (
    <div className="space-y-6 stagger">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 text-xs text-surface-500">
          {[1, 2, 3, 4, 5].map((fdr) => (
            <div key={fdr} className="flex items-center gap-1">
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded text-2xs font-bold ${FDR_BG[fdr]} ${FDR_TEXT[fdr]}`}
              >
                {fdr}
              </span>
              <span>{LABELS[fdr]}</span>
            </div>
          ))}
          <span className="ml-2 text-surface-600">FPL's rating of each fixture</span>
        </div>

        <TabBar
          tabs={[
            { id: "name", label: "A-Z" },
            { id: "easiest", label: "Easiest run" },
          ]}
          active={sortBy}
          onChange={setSort}
          id="fdr-sort"
          variant="border"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-800/30">
            <tr>
              <th scope="col" className="table-header text-left py-2.5 px-3 w-36">
                Team
              </th>
              {gameweeks.map((gw) => (
                <th key={gw} scope="col" className="table-header text-center py-2.5 px-2 w-24">
                  GW{gw}
                </th>
              ))}
              <th scope="col" className="table-header text-center py-2.5 px-3 w-20">
                Avg
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((row) => {
              const avgFdr = Math.round(row.avg);
              return (
                <tr
                  key={row.team}
                  className="border-t border-surface-800 hover:bg-surface-800/40 transition-colors"
                  style={{
                    borderLeft: `3px solid ${TEAM_COLORS[row.team] || "rgb(var(--surface-700))"}`,
                  }}
                >
                  <td className="py-2 px-4">
                    <span className="font-semibold text-surface-100 text-sm">{row.team}</span>
                    <span className="text-xs text-surface-500 ml-2">{TEAM_FULL[row.team]}</span>
                  </td>
                  {gameweeks.map((gw) => {
                    const fix = row.fixtureByGw[gw];
                    if (!fix) {
                      return (
                        <td key={gw} className="py-2 px-1 text-center">
                          <div className="mx-auto rounded-md px-1 py-2 bg-surface-800/30">
                            <p className="text-xs text-surface-600">blank</p>
                          </div>
                        </td>
                      );
                    }
                    const fdr = fix.atkFdr;
                    return (
                      <td key={gw} className="py-2 px-1 text-center">
                        <div
                          className={`mx-auto rounded-md px-1 py-2 ${FDR_BG[fdr]}`}
                          title={`${fix.opponent} ${fix.home ? "at home" : "away"}, ${LABELS[fdr].toLowerCase()}`}
                        >
                          <p className={`text-xs font-bold ${FDR_TEXT[fdr]}`}>{fix.opponent}</p>
                          <p className={`text-2xs ${FDR_TEXT[fdr]} opacity-70`}>
                            {fix.home ? "(H)" : "(A)"}
                          </p>
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-2 px-4 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-sm font-bold font-data tabular-nums ${FDR_BG[avgFdr]} ${FDR_TEXT[avgFdr]}`}
                    >
                      {row.avg.toFixed(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
