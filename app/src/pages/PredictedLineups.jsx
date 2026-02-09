import { useState, useMemo } from "react";

// ============================================================
// MOCK DATA - Predicted lineups with nailedness scores
// Will be replaced with: GET /api/lineups/predicted?gw={gw}
// ============================================================
const TEAMS = [
  { short: "ARS", name: "Arsenal", formation: "4-3-3", color: "#EF0107" },
  { short: "LIV", name: "Liverpool", formation: "4-3-3", color: "#C8102E" },
  { short: "MCI", name: "Man City", formation: "4-2-3-1", color: "#6CABDD" },
  { short: "CHE", name: "Chelsea", formation: "4-2-3-1", color: "#034694" },
  { short: "NEW", name: "Newcastle", formation: "4-3-3", color: "#241F20" },
  { short: "AVL", name: "Aston Villa", formation: "4-2-3-1", color: "#670E36" },
  { short: "BRE", name: "Brentford", formation: "3-5-2", color: "#E30613" },
  { short: "BHA", name: "Brighton", formation: "4-2-3-1", color: "#0057B8" },
];

const mockLineups = {
  ARS: {
    gk: [{ name: "Raya", nailedness: 98, minutes_pct: 100, started_last5: 5, news: "" }],
    def: [
      { name: "White", nailedness: 88, minutes_pct: 92, started_last5: 4, news: "" },
      { name: "Saliba", nailedness: 95, minutes_pct: 98, started_last5: 5, news: "" },
      { name: "Gabriel", nailedness: 94, minutes_pct: 96, started_last5: 5, news: "" },
      { name: "Timber", nailedness: 82, minutes_pct: 85, started_last5: 4, news: "" },
    ],
    mid: [
      { name: "Odegaard", nailedness: 90, minutes_pct: 88, started_last5: 4, news: "" },
      { name: "Rice", nailedness: 93, minutes_pct: 95, started_last5: 5, news: "" },
      { name: "Havertz", nailedness: 78, minutes_pct: 80, started_last5: 3, news: "Rotated with Trossard" },
    ],
    fwd: [
      { name: "Saka", nailedness: 62, minutes_pct: 60, started_last5: 2, news: "Muscle injury — 75% chance" },
      { name: "Martinelli", nailedness: 72, minutes_pct: 75, started_last5: 3, news: "Rotated recently" },
      { name: "Trossard", nailedness: 65, minutes_pct: 68, started_last5: 3, news: "Starts when Havertz dropped" },
    ],
  },
  LIV: {
    gk: [{ name: "Alisson", nailedness: 96, minutes_pct: 98, started_last5: 5, news: "" }],
    def: [
      { name: "Alexander-Arnold", nailedness: 88, minutes_pct: 90, started_last5: 4, news: "" },
      { name: "Konaté", nailedness: 82, minutes_pct: 84, started_last5: 4, news: "Rotation risk with Quansah" },
      { name: "Van Dijk", nailedness: 97, minutes_pct: 100, started_last5: 5, news: "" },
      { name: "Robertson", nailedness: 80, minutes_pct: 78, started_last5: 3, news: "Shares with Tsimikas" },
    ],
    mid: [
      { name: "Mac Allister", nailedness: 85, minutes_pct: 88, started_last5: 4, news: "" },
      { name: "Szoboszlai", nailedness: 70, minutes_pct: 72, started_last5: 3, news: "Heavy rotation" },
      { name: "Gravenberch", nailedness: 82, minutes_pct: 85, started_last5: 4, news: "" },
    ],
    fwd: [
      { name: "Salah", nailedness: 96, minutes_pct: 98, started_last5: 5, news: "" },
      { name: "Gakpo", nailedness: 68, minutes_pct: 70, started_last5: 3, news: "Shares with Díaz & Jota" },
      { name: "Díaz", nailedness: 72, minutes_pct: 74, started_last5: 3, news: "Shares with Gakpo" },
    ],
  },
  MCI: {
    gk: [{ name: "Ederson", nailedness: 95, minutes_pct: 96, started_last5: 5, news: "" }],
    def: [
      { name: "Walker", nailedness: 60, minutes_pct: 62, started_last5: 2, news: "Transfer rumours — limited mins" },
      { name: "Dias", nailedness: 88, minutes_pct: 90, started_last5: 4, news: "" },
      { name: "Akanji", nailedness: 85, minutes_pct: 86, started_last5: 4, news: "" },
      { name: "Gvardiol", nailedness: 82, minutes_pct: 84, started_last5: 4, news: "" },
    ],
    mid: [
      { name: "Rodri", nailedness: 25, minutes_pct: 0, started_last5: 0, news: "ACL injury — out for season" },
      { name: "Bernardo", nailedness: 80, minutes_pct: 82, started_last5: 4, news: "" },
    ],
    fwd: [
      { name: "Foden", nailedness: 75, minutes_pct: 78, started_last5: 3, news: "Rotation with Grealish" },
      { name: "Haaland", nailedness: 98, minutes_pct: 100, started_last5: 5, news: "" },
      { name: "Doku", nailedness: 55, minutes_pct: 58, started_last5: 2, news: "Heavy rotation" },
    ],
  },
  CHE: {
    gk: [{ name: "Sánchez", nailedness: 90, minutes_pct: 92, started_last5: 5, news: "" }],
    def: [
      { name: "James", nailedness: 45, minutes_pct: 40, started_last5: 1, news: "Fitness issues — managed minutes" },
      { name: "Fofana", nailedness: 85, minutes_pct: 88, started_last5: 4, news: "" },
      { name: "Colwill", nailedness: 82, minutes_pct: 84, started_last5: 4, news: "" },
      { name: "Cucurella", nailedness: 78, minutes_pct: 80, started_last5: 3, news: "" },
    ],
    mid: [
      { name: "Caicedo", nailedness: 88, minutes_pct: 90, started_last5: 4, news: "" },
      { name: "Enzo", nailedness: 80, minutes_pct: 82, started_last5: 4, news: "" },
    ],
    fwd: [
      { name: "Palmer", nailedness: 96, minutes_pct: 98, started_last5: 5, news: "" },
      { name: "Jackson", nailedness: 72, minutes_pct: 75, started_last5: 3, news: "Shares with Nkunku" },
      { name: "Neto", nailedness: 60, minutes_pct: 62, started_last5: 2, news: "Rotation risk" },
    ],
  },
  NEW: {
    gk: [{ name: "Pope", nailedness: 92, minutes_pct: 94, started_last5: 5, news: "" }],
    def: [
      { name: "Trippier", nailedness: 72, minutes_pct: 74, started_last5: 3, news: "Shares with Livramento" },
      { name: "Schär", nailedness: 80, minutes_pct: 82, started_last5: 4, news: "" },
      { name: "Burn", nailedness: 78, minutes_pct: 80, started_last5: 3, news: "" },
      { name: "Hall", nailedness: 75, minutes_pct: 76, started_last5: 3, news: "" },
    ],
    mid: [
      { name: "Guimarães", nailedness: 92, minutes_pct: 94, started_last5: 5, news: "" },
      { name: "Joelinton", nailedness: 85, minutes_pct: 88, started_last5: 4, news: "" },
      { name: "Tonali", nailedness: 78, minutes_pct: 80, started_last5: 3, news: "" },
    ],
    fwd: [
      { name: "Isak", nailedness: 95, minutes_pct: 96, started_last5: 5, news: "" },
      { name: "Gordon", nailedness: 88, minutes_pct: 90, started_last5: 4, news: "" },
      { name: "Barnes", nailedness: 70, minutes_pct: 72, started_last5: 3, news: "" },
    ],
  },
  AVL: {
    gk: [{ name: "Martínez", nailedness: 97, minutes_pct: 100, started_last5: 5, news: "" }],
    def: [
      { name: "Cash", nailedness: 82, minutes_pct: 84, started_last5: 4, news: "" },
      { name: "Konsa", nailedness: 88, minutes_pct: 90, started_last5: 4, news: "" },
      { name: "Torres", nailedness: 85, minutes_pct: 86, started_last5: 4, news: "" },
      { name: "Digne", nailedness: 78, minutes_pct: 80, started_last5: 3, news: "" },
    ],
    mid: [
      { name: "Tielemans", nailedness: 80, minutes_pct: 82, started_last5: 4, news: "" },
      { name: "Kamara", nailedness: 75, minutes_pct: 78, started_last5: 3, news: "" },
    ],
    fwd: [
      { name: "Rogers", nailedness: 82, minutes_pct: 84, started_last5: 4, news: "" },
      { name: "Watkins", nailedness: 15, minutes_pct: 0, started_last5: 0, news: "Hamstring — out 2-3 weeks" },
      { name: "Bailey", nailedness: 68, minutes_pct: 70, started_last5: 3, news: "" },
    ],
  },
  BRE: {
    gk: [{ name: "Flekken", nailedness: 95, minutes_pct: 96, started_last5: 5, news: "" }],
    def: [
      { name: "Ajer", nailedness: 80, minutes_pct: 82, started_last5: 4, news: "" },
      { name: "Collins", nailedness: 85, minutes_pct: 88, started_last5: 4, news: "" },
      { name: "Pinnock", nailedness: 82, minutes_pct: 84, started_last5: 4, news: "" },
    ],
    mid: [
      { name: "Mbeumo", nailedness: 92, minutes_pct: 94, started_last5: 5, news: "" },
      { name: "Norgaard", nailedness: 88, minutes_pct: 90, started_last5: 4, news: "" },
      { name: "Damsgaard", nailedness: 72, minutes_pct: 74, started_last5: 3, news: "" },
      { name: "Lewis-Potter", nailedness: 68, minutes_pct: 70, started_last5: 3, news: "" },
      { name: "Janelt", nailedness: 75, minutes_pct: 78, started_last5: 3, news: "" },
    ],
    fwd: [
      { name: "Wissa", nailedness: 78, minutes_pct: 80, started_last5: 3, news: "" },
      { name: "Schade", nailedness: 65, minutes_pct: 68, started_last5: 2, news: "Rotation risk" },
    ],
  },
  BHA: {
    gk: [{ name: "Verbruggen", nailedness: 92, minutes_pct: 94, started_last5: 5, news: "" }],
    def: [
      { name: "Veltman", nailedness: 72, minutes_pct: 74, started_last5: 3, news: "" },
      { name: "Dunk", nailedness: 85, minutes_pct: 88, started_last5: 4, news: "" },
      { name: "Van Hecke", nailedness: 80, minutes_pct: 82, started_last5: 4, news: "" },
      { name: "Estupiñán", nailedness: 78, minutes_pct: 80, started_last5: 3, news: "" },
    ],
    mid: [
      { name: "Gross", nailedness: 85, minutes_pct: 88, started_last5: 4, news: "" },
      { name: "Mitoma", nailedness: 75, minutes_pct: 78, started_last5: 3, news: "" },
    ],
    fwd: [
      { name: "João Pedro", nailedness: 88, minutes_pct: 90, started_last5: 4, news: "" },
      { name: "Welbeck", nailedness: 60, minutes_pct: 62, started_last5: 2, news: "Managed minutes" },
      { name: "Adingra", nailedness: 70, minutes_pct: 72, started_last5: 3, news: "" },
    ],
  },
};

// ============================================================
// HELPERS
// ============================================================
const getNailednessColor = (n) => {
  if (n >= 90) return "text-success-400";
  if (n >= 75) return "text-surface-100";
  if (n >= 60) return "text-warning-400";
  return "text-danger-400";
};

const getNailednessBarColor = (n) => {
  if (n >= 90) return "bg-success-500";
  if (n >= 75) return "bg-brand-500";
  if (n >= 60) return "bg-warning-500";
  return "bg-danger-500";
};

const getNailednessLabel = (n) => {
  if (n >= 90) return "Nailed";
  if (n >= 75) return "Likely";
  if (n >= 60) return "Rotation";
  if (n >= 40) return "Risky";
  return "Unlikely";
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function PredictedLineups() {
  const [selectedTeam, setSelectedTeam] = useState("ARS");
  const [viewMode, setViewMode] = useState("lineup"); // lineup | table
  const [filterThreshold, setFilterThreshold] = useState(0);

  const teamInfo = TEAMS.find(t => t.short === selectedTeam);
  const lineup = mockLineups[selectedTeam];

  const allPlayers = useMemo(() => {
    if (!lineup) return [];
    const all = [
      ...lineup.gk.map(p => ({ ...p, pos: "GK" })),
      ...lineup.def.map(p => ({ ...p, pos: "DEF" })),
      ...lineup.mid.map(p => ({ ...p, pos: "MID" })),
      ...lineup.fwd.map(p => ({ ...p, pos: "FWD" })),
    ];
    return filterThreshold > 0
      ? all.filter(p => p.nailedness >= filterThreshold)
      : all;
  }, [lineup, filterThreshold]);

  // Rotation risks across all teams
  const rotationRisks = useMemo(() => {
    const risks = [];
    Object.entries(mockLineups).forEach(([team, positions]) => {
      Object.values(positions).flat().forEach(p => {
        if (p.nailedness < 70 && p.nailedness > 20) {
          risks.push({ ...p, team });
        }
      });
    });
    return risks.sort((a, b) => a.nailedness - b.nailedness).slice(0, 8);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Predicted Lineups</h1>
          <p className="text-surface-400 mt-1">
            GW24 · Nailedness scores based on rotation patterns, minutes, and news
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {["lineup", "table"].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === mode ? "bg-brand-600 text-white" : "bg-surface-800 text-surface-400 hover:text-surface-100"
                }`}>
                {mode === "lineup" ? "Lineup View" : "Table View"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Team Selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {TEAMS.map(team => (
          <button key={team.short} onClick={() => setSelectedTeam(team.short)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedTeam === team.short
                ? "bg-surface-700 text-surface-100 border border-surface-600"
                : "bg-surface-800 text-surface-400 border border-transparent hover:text-surface-200"
            }`}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color }} />
              {team.short}
            </div>
          </button>
        ))}
      </div>

      {/* Nailedness Legend */}
      <div className="flex items-center gap-5 text-xs text-surface-500">
        <span>Nailedness:</span>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-success-500" />
          <span>90+ Nailed</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
          <span>75–89 Likely</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-warning-500" />
          <span>60–74 Rotation</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-danger-500" />
          <span>&lt;60 Risky</span>
        </div>
      </div>

      {/* Team Header */}
      <div className="card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: teamInfo?.color + "22" }}>
            <span className="font-bold text-surface-100">{selectedTeam}</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-surface-100">{teamInfo?.name}</h2>
            <p className="text-xs text-surface-500">Formation: {teamInfo?.formation}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <p className="text-[10px] text-surface-500 uppercase">Nailed (90+)</p>
            <p className="text-lg font-bold text-success-400">
              {allPlayers.filter(p => p.nailedness >= 90).length}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-surface-500 uppercase">Rotation Risk</p>
            <p className="text-lg font-bold text-warning-400">
              {allPlayers.filter(p => p.nailedness >= 60 && p.nailedness < 75).length}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-surface-500 uppercase">Avoid</p>
            <p className="text-lg font-bold text-danger-400">
              {allPlayers.filter(p => p.nailedness < 60).length}
            </p>
          </div>
        </div>
      </div>

      {viewMode === "lineup" ? (
        /* ===== LINEUP VIEW ===== */
        <div className="card p-6">
          {/* Pitch background */}
          <div className="relative bg-surface-900 rounded-xl border border-surface-700 p-6 space-y-6">
            {/* GK */}
            <div className="text-center">
              <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-3">Goalkeeper</p>
              <div className="flex justify-center gap-4">
                {lineup?.gk.map(p => (
                  <PlayerCard key={p.name} player={p} pos="GK" teamColor={teamInfo?.color} />
                ))}
              </div>
            </div>

            {/* DEF */}
            <div className="text-center">
              <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-3">Defenders</p>
              <div className="flex justify-center gap-3 flex-wrap">
                {lineup?.def.map(p => (
                  <PlayerCard key={p.name} player={p} pos="DEF" teamColor={teamInfo?.color} />
                ))}
              </div>
            </div>

            {/* MID */}
            <div className="text-center">
              <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-3">Midfielders</p>
              <div className="flex justify-center gap-3 flex-wrap">
                {lineup?.mid.map(p => (
                  <PlayerCard key={p.name} player={p} pos="MID" teamColor={teamInfo?.color} />
                ))}
              </div>
            </div>

            {/* FWD */}
            <div className="text-center">
              <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-3">Forwards</p>
              <div className="flex justify-center gap-3 flex-wrap">
                {lineup?.fwd.map(p => (
                  <PlayerCard key={p.name} player={p} pos="FWD" teamColor={teamInfo?.color} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ===== TABLE VIEW ===== */
        <div className="card overflow-hidden">
          <div className="p-3 border-b border-surface-800 flex items-center gap-3">
            <span className="text-xs text-surface-500">Filter:</span>
            {[0, 60, 75, 90].map(threshold => (
              <button key={threshold} onClick={() => setFilterThreshold(threshold)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  filterThreshold === threshold ? "bg-brand-600 text-white" : "bg-surface-800 text-surface-400"
                }`}>
                {threshold === 0 ? "All" : `${threshold}+`}
              </button>
            ))}
          </div>
          <table className="w-full">
            <thead className="bg-surface-800/50">
              <tr>
                <th className="table-header text-left py-3 px-4">Player</th>
                <th className="table-header text-left py-3 px-4">Pos</th>
                <th className="table-header text-left py-3 px-4">Nailedness</th>
                <th className="table-header text-left py-3 px-4">Minutes %</th>
                <th className="table-header text-left py-3 px-4">Started (Last 5)</th>
                <th className="table-header text-left py-3 px-4">Status</th>
                <th className="table-header text-left py-3 px-4">News</th>
              </tr>
            </thead>
            <tbody>
              {allPlayers.map(p => (
                <tr key={p.name} className="border-t border-surface-800 hover:bg-surface-800/30">
                  <td className="py-3 px-4">
                    <span className="text-sm font-medium text-surface-100">{p.name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="badge bg-surface-700 text-surface-300">{p.pos}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-surface-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getNailednessBarColor(p.nailedness)}`}
                          style={{ width: `${p.nailedness}%` }} />
                      </div>
                      <span className={`text-sm font-bold ${getNailednessColor(p.nailedness)}`}>
                        {p.nailedness}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-surface-300">{p.minutes_pct}%</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={`w-3 h-3 rounded-sm ${
                          i < p.started_last5 ? "bg-success-500/60" : "bg-surface-700"
                        }`} />
                      ))}
                      <span className="text-xs text-surface-500 ml-1">{p.started_last5}/5</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge ${
                      p.nailedness >= 90 ? "bg-success-500/20 text-success-400" :
                      p.nailedness >= 75 ? "bg-brand-500/20 text-brand-400" :
                      p.nailedness >= 60 ? "bg-warning-500/20 text-warning-400" :
                      "bg-danger-500/20 text-danger-400"
                    }`}>
                      {getNailednessLabel(p.nailedness)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {p.news ? (
                      <span className="text-xs text-warning-400">{p.news}</span>
                    ) : (
                      <span className="text-xs text-surface-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rotation Risks Across All Teams */}
      <div className="card p-5">
        <h3 className="text-lg font-bold text-surface-100 mb-1">Rotation Risks Across PL</h3>
        <p className="text-xs text-surface-500 mb-4">
          Popular FPL assets with the highest rotation risk this GW
        </p>
        <div className="grid grid-cols-4 gap-3">
          {rotationRisks.map(p => (
            <div key={`${p.team}-${p.name}`} className="rounded-lg border border-surface-700 bg-surface-800/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-surface-100">{p.name}</p>
                  <p className="text-[10px] text-surface-500">{p.team}</p>
                </div>
                <span className={`text-sm font-bold ${getNailednessColor(p.nailedness)}`}>
                  {p.nailedness}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-surface-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${getNailednessBarColor(p.nailedness)}`}
                  style={{ width: `${p.nailedness}%` }} />
              </div>
              {p.news && (
                <p className="text-[10px] text-warning-400 mt-1.5 truncate" title={p.news}>{p.news}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-surface-600 text-center">
        Nailedness scores based on starting frequency, minutes played, manager rotation patterns, and press conference news.
        Scores update pre-deadline as new information emerges.
      </p>
    </div>
  );
}

// ============================================================
// PLAYER CARD (Lineup View)
// ============================================================
function PlayerCard({ player, teamColor }) {
  const p = player;
  return (
    <div className={`relative rounded-xl border p-3 w-28 text-center transition-all ${
      p.nailedness >= 90 ? "border-success-500/30 bg-success-500/5" :
      p.nailedness >= 75 ? "border-surface-600 bg-surface-800/50" :
      p.nailedness >= 60 ? "border-warning-500/30 bg-warning-500/5" :
      "border-danger-500/30 bg-danger-500/5"
    }`}>
      {/* Team accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b" style={{ backgroundColor: teamColor }} />

      <p className="text-sm font-semibold text-surface-100 mt-1">{p.name}</p>

      {/* Nailedness score */}
      <div className="mt-1.5">
        <span className={`text-lg font-bold ${getNailednessColor(p.nailedness)}`}>
          {p.nailedness}%
        </span>
      </div>

      {/* Mini bar */}
      <div className="w-full h-1 bg-surface-800 rounded-full mt-1 overflow-hidden">
        <div className={`h-full rounded-full ${getNailednessBarColor(p.nailedness)}`}
          style={{ width: `${p.nailedness}%` }} />
      </div>

      {/* Started last 5 */}
      <div className="flex items-center justify-center gap-0.5 mt-1.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`w-1.5 h-1.5 rounded-full ${
            i < p.started_last5 ? "bg-success-400" : "bg-surface-700"
          }`} />
        ))}
      </div>

      {p.news && (
        <p className="text-[9px] text-warning-400 mt-1 truncate" title={p.news}>
          {p.news}
        </p>
      )}
    </div>
  );
}
