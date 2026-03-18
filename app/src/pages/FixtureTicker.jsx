import { useSearchParams } from "react-router-dom";
import { TEAM_COLORS } from "../lib/constants";
import TabBar from "../components/ui/TabBar";
import ErrorState from "../components/feedback/ErrorState";
import Loading from "../components/feedback/Loading";
import { useFixtures } from "../hooks";

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

  const teamData = TEAMS.map((team) => {
    const fixtures = FIXTURES[team] || [];
    const fixtureByGw = Object.fromEntries(fixtures.map((f) => [f.gw, f]));
    const avgAtk = fixtures.reduce((s, f) => s + f.atkFdr, 0) / (fixtures.length || 1);
    const avgDef = fixtures.reduce((s, f) => s + f.defFdr, 0) / (fixtures.length || 1);
    const avgCombined = (avgAtk + avgDef) / 2;
    return { team, fixtures, fixtureByGw, avgAtk, avgDef, avgCombined };
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
                  {gameweeks.map((gw) => {
                    const fix = row.fixtureByGw[gw];
                    if (!fix) {
                      return (
                        <td key={gw} className="py-2 px-1 text-center">
                          <div className="mx-auto rounded-md px-1 py-2 bg-surface-800/30">
                            <p className="text-xs text-surface-600">—</p>
                          </div>
                        </td>
                      );
                    }
                    const fdr = getFdr(fix);
                    return (
                      <td key={gw} className="py-2 px-1 text-center">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <span className="section-label">Best for attackers & midfielders</span>
          <p className="text-[10px] text-surface-500 mt-0.5 mb-3">
            Teams facing the weakest defences — target their FWD/MID
          </p>
          <div className="space-y-2">
            {[...teamData]
              .sort((a, b) => a.avgAtk - b.avgAtk)
              .slice(0, 5)
              .map((t, i) => (
                <div
                  key={t.team}
                  className="flex items-center gap-2 text-sm"
                  style={{
                    borderLeftColor: TEAM_COLORS[t.team],
                    borderLeftWidth: 2,
                    paddingLeft: 8,
                  }}
                >
                  <span className="text-surface-300 flex-1">
                    {i + 1}. {TEAM_FULL[t.team]}
                  </span>
                  <span
                    className={`text-xs font-data tabular-nums px-1.5 py-0.5 rounded ${
                      t.avgAtk <= 2.5 ? "text-success-400 bg-success-500/10" : "text-surface-400"
                    }`}
                  >
                    {t.avgAtk.toFixed(1)} avg FDR
                  </span>
                </div>
              ))}
          </div>
        </div>
        <div>
          <span className="section-label">Best for defenders & goalkeepers</span>
          <p className="text-[10px] text-surface-500 mt-0.5 mb-3">
            Teams facing the weakest attacks — target their DEF/GK for clean sheets
          </p>
          <div className="space-y-2">
            {[...teamData]
              .sort((a, b) => a.avgDef - b.avgDef)
              .slice(0, 5)
              .map((t, i) => (
                <div
                  key={t.team}
                  className="flex items-center gap-2 text-sm"
                  style={{
                    borderLeftColor: TEAM_COLORS[t.team],
                    borderLeftWidth: 2,
                    paddingLeft: 8,
                  }}
                >
                  <span className="text-surface-300 flex-1">
                    {i + 1}. {TEAM_FULL[t.team]}
                  </span>
                  <span
                    className={`text-xs font-data tabular-nums px-1.5 py-0.5 rounded ${
                      t.avgDef <= 2.5 ? "text-success-400 bg-success-500/10" : "text-surface-400"
                    }`}
                  >
                    {t.avgDef.toFixed(1)} avg FDR
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
