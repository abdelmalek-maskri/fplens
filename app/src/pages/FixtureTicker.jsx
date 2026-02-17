import { useSearchParams } from "react-router-dom";
import { TEAM_COLORS } from "../lib/constants";
import TabBar from "../components/TabBar";
import ErrorState from "../components/ErrorState";
import { SkeletonTable } from "../components/skeletons";
import { useFixtures } from "../hooks";

// ============================================================
// FIXTURE TICKER PAGE
// ============================================================
export default function FixtureTicker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const fdrMode = searchParams.get("mode") || "attack";
  const sortBy = searchParams.get("sort") || "name";
  const setParam = (key, value) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set(key, value);
      return p;
    });
  };

  const { data: fixtureData, isLoading, error } = useFixtures();
  if (isLoading)
    return (
      <div className="space-y-6">
        <SkeletonTable rows={20} cols={8} />
      </div>
    );
  if (error) return <ErrorState message="Failed to load fixture data." />;
  if (!fixtureData) return null;
  const {
    teams: TEAMS,
    teamFull: TEAM_FULL,
    fixtures: FIXTURES,
    fdrBg: FDR_BG,
    fdrText: FDR_TEXT,
  } = fixtureData;

  const gameweeks = [24, 25, 26, 27, 28, 29];

  // Compute avg FDR for sorting
  const teamData = TEAMS.map((team) => {
    const fixtures = FIXTURES[team] || [];
    const avgAtk = fixtures.reduce((s, f) => s + f.atkFdr, 0) / fixtures.length;
    const avgDef = fixtures.reduce((s, f) => s + f.defFdr, 0) / fixtures.length;
    const avgCombined = (avgAtk + avgDef) / 2;
    return { team, fixtures, avgAtk, avgDef, avgCombined };
  });

  const sortedTeams = [...teamData].sort((a, b) => {
    if (sortBy === "name") return a.team.localeCompare(b.team);
    const key = fdrMode === "attack" ? "avgAtk" : fdrMode === "defence" ? "avgDef" : "avgCombined";
    return a[key] - b[key];
  });

  const getFdr = (fixture) => {
    if (fdrMode === "attack") return fixture.atkFdr;
    if (fdrMode === "defence") return fixture.defFdr;
    return Math.round((fixture.atkFdr + fixture.defFdr) / 2);
  };

  return (
    <div className="space-y-6 stagger">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <TabBar
          tabs={[
            { id: "attack", label: "Attack" },
            { id: "defence", label: "Defence" },
            { id: "combined", label: "Combined" },
          ]}
          active={fdrMode}
          onChange={(value) => setParam("mode", value)}
          id="fdr-mode"
          variant="border"
        />

        <TabBar
          tabs={[
            { id: "name", label: "A-Z" },
            { id: "easiest", label: "Easiest" },
          ]}
          active={sortBy}
          onChange={(value) => setParam("sort", value)}
          id="fdr-sort"
          variant="border"
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-surface-500">
        <span>Difficulty:</span>
        {[1, 2, 3, 4, 5].map((fdr) => (
          <div key={fdr} className="flex items-center gap-1">
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded text-2xs font-bold ${FDR_BG[fdr]} ${FDR_TEXT[fdr]}`}
            >
              {fdr}
            </span>
            <span>
              {fdr === 1 && "Very Easy"}
              {fdr === 2 && "Easy"}
              {fdr === 3 && "Medium"}
              {fdr === 4 && "Hard"}
              {fdr === 5 && "Very Hard"}
            </span>
          </div>
        ))}
        <span className="ml-4 text-surface-600">
          {fdrMode === "attack" && "How hard to score against"}
          {fdrMode === "defence" && "How likely the opponent is to score"}
          {fdrMode === "combined" && "Avg of attack + defence FDR"}
        </span>
      </div>

      {/* Fixture Grid */}
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
              const avgVal =
                fdrMode === "attack"
                  ? row.avgAtk
                  : fdrMode === "defence"
                    ? row.avgDef
                    : row.avgCombined;
              const avgFdr = Math.round(avgVal);

              return (
                <tr
                  key={row.team}
                  className="border-t border-surface-800 hover:bg-surface-800/40 transition-colors"
                  style={{
                    borderLeft: `3px solid ${TEAM_COLORS[row.team] || "rgb(var(--surface-700))"}`,
                  }}
                >
                  <td className="py-2 px-4">
                    <div>
                      <span className="font-semibold text-surface-100 text-sm">{row.team}</span>
                      <span className="text-xs text-surface-500 ml-2">{TEAM_FULL[row.team]}</span>
                    </div>
                  </td>
                  {row.fixtures.map((fix) => {
                    const fdr = getFdr(fix);
                    return (
                      <td key={fix.gw} className="py-2 px-1 text-center">
                        <div
                          className={`mx-auto rounded-md px-1 py-2 ${FDR_BG[fdr]}`}
                          title={`ATK: ${fix.atkFdr} | DEF: ${fix.defFdr}`}
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
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-sm font-bold ${FDR_BG[avgFdr]} ${FDR_TEXT[avgFdr]}`}
                    >
                      {avgVal.toFixed(1)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quick Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <span className="section-label">Easiest to attack (next 6 GWs)</span>
          <div className="mt-3 space-y-2">
            {[...teamData]
              .sort((a, b) => a.avgAtk - b.avgAtk)
              .slice(0, 5)
              .map((t, i) => (
                <div
                  key={t.team}
                  className="flex items-center justify-between text-sm"
                  style={{
                    borderLeftColor: TEAM_COLORS[t.team],
                    borderLeftWidth: 2,
                    paddingLeft: 8,
                  }}
                >
                  <span className="text-surface-300">
                    {i + 1}. {TEAM_FULL[t.team]}
                  </span>
                  <span className="font-data tabular-nums text-success-400">
                    {t.avgAtk.toFixed(1)}
                  </span>
                </div>
              ))}
          </div>
        </div>
        <div>
          <span className="section-label">Easiest to keep clean sheets (next 6 GWs)</span>
          <div className="mt-3 space-y-2">
            {[...teamData]
              .sort((a, b) => a.avgDef - b.avgDef)
              .slice(0, 5)
              .map((t, i) => (
                <div
                  key={t.team}
                  className="flex items-center justify-between text-sm"
                  style={{
                    borderLeftColor: TEAM_COLORS[t.team],
                    borderLeftWidth: 2,
                    paddingLeft: 8,
                  }}
                >
                  <span className="text-surface-300">
                    {i + 1}. {TEAM_FULL[t.team]}
                  </span>
                  <span className="font-data tabular-nums text-success-400">
                    {t.avgDef.toFixed(1)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
