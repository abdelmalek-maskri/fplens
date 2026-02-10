import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { POSITION_COLORS } from "../lib/constants";
import Jersey from "../components/Jersey";
import TeamBadge from "../components/TeamBadge";
import FdrBadge from "../components/FdrBadge";

// ============================================================
// MOCK SQUAD — 15 players (same as MyTeam)
// Will be replaced with: GET /api/team/{fpl_id}
// ============================================================
const mockSquad = [
  { element: 20, web_name: "Raya", position: "GK", team_name: "ARS", value: 5.5, predicted_points: 4.2, form: 4.8, status: "a", chance_of_playing: 100, opponent_name: "CHE" },
  { element: 60, web_name: "Flekken", position: "GK", team_name: "BRE", value: 4.5, predicted_points: 3.6, form: 3.2, status: "a", chance_of_playing: 100, opponent_name: "NFO" },
  { element: 15, web_name: "Alexander-Arnold", position: "DEF", team_name: "LIV", value: 7.1, predicted_points: 5.4, form: 6.1, status: "a", chance_of_playing: 100, opponent_name: "EVE" },
  { element: 12, web_name: "Gabriel", position: "DEF", team_name: "ARS", value: 6.2, predicted_points: 5.1, form: 5.8, status: "a", chance_of_playing: 100, opponent_name: "CHE" },
  { element: 30, web_name: "Saliba", position: "DEF", team_name: "ARS", value: 6.0, predicted_points: 4.8, form: 5.2, status: "a", chance_of_playing: 100, opponent_name: "CHE" },
  { element: 61, web_name: "Mykolenko", position: "DEF", team_name: "EVE", value: 4.3, predicted_points: 3.1, form: 3.5, status: "a", chance_of_playing: 100, opponent_name: "LIV" },
  { element: 3, web_name: "Salah", position: "MID", team_name: "LIV", value: 13.2, predicted_points: 6.8, form: 7.2, status: "a", chance_of_playing: 100, opponent_name: "EVE" },
  { element: 7, web_name: "Palmer", position: "MID", team_name: "CHE", value: 9.5, predicted_points: 6.1, form: 9.2, status: "a", chance_of_playing: 100, opponent_name: "ARS" },
  { element: 5, web_name: "Saka", position: "MID", team_name: "ARS", value: 10.1, predicted_points: 4.2, form: 6.5, status: "d", chance_of_playing: 75, opponent_name: "CHE" },
  { element: 40, web_name: "Mbeumo", position: "MID", team_name: "BRE", value: 7.8, predicted_points: 4.5, form: 5.6, status: "a", chance_of_playing: 100, opponent_name: "NFO" },
  { element: 62, web_name: "Wharton", position: "MID", team_name: "CRY", value: 4.8, predicted_points: 2.8, form: 2.9, status: "a", chance_of_playing: 100, opponent_name: "MUN" },
  { element: 2, web_name: "Haaland", position: "FWD", team_name: "MCI", value: 15.3, predicted_points: 7.2, form: 8.8, status: "a", chance_of_playing: 100, opponent_name: "BOU" },
  { element: 50, web_name: "Isak", position: "FWD", team_name: "NEW", value: 8.8, predicted_points: 5.5, form: 7.0, status: "a", chance_of_playing: 100, opponent_name: "WOL" },
  { element: 10, web_name: "Watkins", position: "FWD", team_name: "AVL", value: 9.0, predicted_points: 1.8, form: 5.4, status: "i", chance_of_playing: 0, opponent_name: "NFO" },
  { element: 63, web_name: "Archer", position: "FWD", team_name: "SOU", value: 4.5, predicted_points: 2.1, form: 1.8, status: "a", chance_of_playing: 100, opponent_name: "TOT" },
];

const FDR_MAP = {
  ARS: 5, AVL: 3, BOU: 2, BRE: 2, BHA: 3, CHE: 4, CRY: 2, EVE: 2,
  FUL: 2, IPS: 1, LEI: 2, LIV: 5, MCI: 4, MUN: 3, NEW: 3, NFO: 2,
  SOU: 1, TOT: 3, WHU: 2, WOL: 2,
};

// ============================================================
// VALID FORMATIONS — all legal FPL starting formations
// ============================================================
const FORMATIONS = [
  [3, 4, 3], [3, 5, 2], [4, 3, 3], [4, 4, 2], [4, 5, 1], [5, 3, 2], [5, 4, 1],
];

// ============================================================
// OPTIMAL XI SOLVER
// Tries all valid formations, picks the highest-scoring
// combination of available players for each one.
// ============================================================
function solveOptimalXI(squad) {
  const available = squad.filter((p) => p.status !== "i" && p.chance_of_playing > 0);
  const gks = available.filter((p) => p.position === "GK").sort((a, b) => b.predicted_points - a.predicted_points);
  const defs = available.filter((p) => p.position === "DEF").sort((a, b) => b.predicted_points - a.predicted_points);
  const mids = available.filter((p) => p.position === "MID").sort((a, b) => b.predicted_points - a.predicted_points);
  const fwds = available.filter((p) => p.position === "FWD").sort((a, b) => b.predicted_points - a.predicted_points);

  let bestXI = null;
  let bestTotal = -1;
  let bestFormation = null;

  for (const [nDef, nMid, nFwd] of FORMATIONS) {
    if (defs.length < nDef || mids.length < nMid || fwds.length < nFwd || gks.length < 1) continue;

    const xi = [
      gks[0],
      ...defs.slice(0, nDef),
      ...mids.slice(0, nMid),
      ...fwds.slice(0, nFwd),
    ];
    const total = xi.reduce((sum, p) => sum + p.predicted_points, 0);

    if (total > bestTotal) {
      bestTotal = total;
      bestXI = xi;
      bestFormation = `${nDef}-${nMid}-${nFwd}`;
    }
  }

  // Bench: everyone not in XI, ordered by predicted points (GK first for FPL rules)
  const xiIds = new Set(bestXI.map((p) => p.element));
  const benchGK = squad.filter((p) => p.position === "GK" && !xiIds.has(p.element));
  const benchOutfield = squad.filter((p) => p.position !== "GK" && !xiIds.has(p.element))
    .sort((a, b) => b.predicted_points - a.predicted_points);
  const bench = [...benchGK, ...benchOutfield];

  // Captain & vice: top 2 by predicted points
  const sorted = [...bestXI].sort((a, b) => b.predicted_points - a.predicted_points);
  const captain = sorted[0];
  const vice = sorted[1];

  return { xi: bestXI, bench, captain, vice, formation: bestFormation, totalPoints: bestTotal };
}

// ============================================================
// PITCH PLAYER CARD
// ============================================================
const PitchPlayerCard = ({ player, isCaptain, isVice }) => (
  <div className={`flex flex-col items-center gap-0.5 transition-opacity ${player.status === "d" ? "opacity-70" : ""}`}>
    <Jersey
      teamName={player.team_name}
      position={player.position}
      isCaptain={isCaptain}
      isVice={isVice}
      status={player.status}
    />
    <div className="bg-white/95 px-2.5 py-0.5 rounded text-[11px] font-bold text-gray-900 text-center min-w-[72px] max-w-[100px] truncate shadow-sm">
      {player.web_name}
    </div>
    <div className="bg-gray-900/80 backdrop-blur-sm px-2 py-0.5 rounded text-2xs text-center whitespace-nowrap">
      <span className="text-emerald-400 font-semibold">{player.predicted_points.toFixed(1)}</span>
      <span className="text-gray-400 mx-0.5">·</span>
      <span className="text-gray-300">{player.opponent_name}</span>
    </div>
  </div>
);

// ============================================================
// OPTIMAL XI PAGE
// ============================================================
export default function OptimalXI() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState("pitch"); // "pitch" | "table"

  const result = useMemo(() => solveOptimalXI(mockSquad), []);

  const gk = result.xi.filter((p) => p.position === "GK");
  const def = result.xi.filter((p) => p.position === "DEF");
  const mid = result.xi.filter((p) => p.position === "MID");
  const fwd = result.xi.filter((p) => p.position === "FWD");

  const captainPoints = result.captain.predicted_points * 2;
  const totalWithCaptain = result.totalPoints + result.captain.predicted_points; // captain counted twice

  return (
    <div className="space-y-6 stagger">
      {/* Stats strip */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-xl font-bold text-brand-400 font-data tabular-nums">{totalWithCaptain.toFixed(1)}</span>
          <span className="text-xs text-surface-500 ml-1.5">predicted pts</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-sm font-semibold text-surface-100">{result.formation}</span>
          <span className="text-xs text-surface-500 ml-1.5">formation</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-sm font-semibold text-surface-100">{result.captain.web_name}</span>
          <span className="text-xs text-warning-400 ml-1"> (C)</span>
          <span className="text-xs text-surface-500 ml-1">· {captainPoints.toFixed(1)} pts</span>
        </div>

        {/* View toggle */}
        <div className="ml-auto flex items-center border border-surface-700 rounded overflow-hidden">
          <button
            onClick={() => setViewMode("pitch")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "pitch" ? "bg-surface-700 text-surface-100" : "text-surface-500 hover:text-surface-300"}`}
          >
            Pitch
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "table" ? "bg-surface-700 text-surface-100" : "text-surface-500 hover:text-surface-300"}`}
          >
            Table
          </button>
        </div>
      </div>

      {viewMode === "pitch" ? (
        /* ---- Pitch View ---- */
        <div className="card overflow-hidden">
          <div className="relative overflow-hidden">
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              <defs>
                <pattern id="grass" width="100%" height="90" patternUnits="userSpaceOnUse">
                  <rect width="100%" height="45" fill="#1b7a35" />
                  <rect y="45" width="100%" height="45" fill="#1a7030" />
                </pattern>
                <filter id="grassNoise">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
                  <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
                  <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" />
                </filter>
              </defs>
              <rect width="100%" height="100%" fill="url(#grass)" />
              <rect width="100%" height="100%" fill="url(#grass)" opacity="0.3" filter="url(#grassNoise)" />
            </svg>

            {/* Pitch markings */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-[16px] border-2 border-white/20 rounded-[3px]" />
              <div className="absolute left-[16px] right-[16px] top-1/2 h-[2px] bg-white/20" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[100px] h-[100px] rounded-full border-2 border-white/20" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/25" />
              <div className="absolute top-[16px] left-1/2 -translate-x-1/2 w-[220px] h-[65px] border-b-2 border-l-2 border-r-2 border-white/15 rounded-b-[2px]" />
              <div className="absolute top-[16px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] border-b-2 border-l-2 border-r-2 border-white/12 rounded-b-[2px]" />
              <div className="absolute top-[68px] left-1/2 -translate-x-1/2 w-[70px] h-[35px] border-b-2 border-white/10 rounded-b-full" />
              <div className="absolute bottom-[16px] left-1/2 -translate-x-1/2 w-[220px] h-[65px] border-t-2 border-l-2 border-r-2 border-white/15 rounded-t-[2px]" />
              <div className="absolute bottom-[16px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] border-t-2 border-l-2 border-r-2 border-white/12 rounded-t-[2px]" />
              <div className="absolute bottom-[68px] left-1/2 -translate-x-1/2 w-[70px] h-[35px] border-t-2 border-white/10 rounded-t-full" />
              <div className="absolute top-[16px] left-[16px] w-5 h-5 border-r-2 border-b-2 border-white/10 rounded-br-full" />
              <div className="absolute top-[16px] right-[16px] w-5 h-5 border-l-2 border-b-2 border-white/10 rounded-bl-full" />
              <div className="absolute bottom-[16px] left-[16px] w-5 h-5 border-r-2 border-t-2 border-white/10 rounded-tr-full" />
              <div className="absolute bottom-[16px] right-[16px] w-5 h-5 border-l-2 border-t-2 border-white/10 rounded-tl-full" />
            </div>

            {/* Players on pitch */}
            <div className="relative z-10 flex flex-col justify-around py-8 px-4" style={{ minHeight: "560px" }}>
              <div className="flex justify-center gap-8">
                {gk.map((p) => <PitchPlayerCard key={p.element} player={p} isCaptain={p.element === result.captain.element} isVice={p.element === result.vice.element} />)}
              </div>
              <div className="flex justify-center gap-4 sm:gap-6 lg:gap-10">
                {def.map((p) => <PitchPlayerCard key={p.element} player={p} isCaptain={p.element === result.captain.element} isVice={p.element === result.vice.element} />)}
              </div>
              <div className="flex justify-center gap-3 sm:gap-5 lg:gap-8">
                {mid.map((p) => <PitchPlayerCard key={p.element} player={p} isCaptain={p.element === result.captain.element} isVice={p.element === result.vice.element} />)}
              </div>
              <div className="flex justify-center gap-4 sm:gap-6 lg:gap-10">
                {fwd.map((p) => <PitchPlayerCard key={p.element} player={p} isCaptain={p.element === result.captain.element} isVice={p.element === result.vice.element} />)}
              </div>
            </div>
          </div>

          {/* Bench */}
          <div className="bg-surface-800/60 px-4 py-4 border-t border-surface-700">
            <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-4">Bench order</p>
            <div className="flex justify-around">
              {result.bench.map((p, idx) => (
                <div key={p.element} className="flex flex-col items-center gap-0.5">
                  <span className="text-2xs text-surface-500 font-medium mb-1">{idx + 1}</span>
                  <Jersey teamName={p.team_name} position={p.position} isCaptain={false} isVice={false} status={p.status} />
                  <div className="bg-surface-700/80 px-2 py-0.5 rounded-sm text-[11px] font-semibold text-surface-300 text-center min-w-[72px] max-w-[100px] truncate">
                    {p.web_name}
                  </div>
                  <div className="text-2xs text-surface-500 whitespace-nowrap">
                    {p.predicted_points.toFixed(1)} · {p.opponent_name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ---- Table View ---- */
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="table-header text-left py-2.5 px-3 w-8"></th>
                <th className="table-header text-left py-2.5 px-3">Player</th>
                <th className="table-header text-left py-2.5 px-3">Predicted</th>
                <th className="table-header text-left py-2.5 px-3">Form</th>
                <th className="table-header text-left py-2.5 px-3">Fixture</th>
                <th className="table-header text-left py-2.5 px-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {/* Starters */}
              {result.xi
                .sort((a, b) => {
                  const posOrder = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
                  return posOrder[a.position] - posOrder[b.position] || b.predicted_points - a.predicted_points;
                })
                .map((p) => (
                  <tr key={p.element} className="border-t border-surface-800/60 hover:bg-surface-800/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className={`w-1 h-8 rounded-full ${p.element === result.captain.element ? "bg-warning-400" : p.element === result.vice.element ? "bg-surface-400" : "bg-brand-500/40"}`} />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <TeamBadge team={p.team_name} />
                        <div>
                          <p
                            className="font-medium text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
                            onClick={() => navigate(`/player/${p.element}`)}
                          >
                            {p.web_name}
                          </p>
                          <p className="text-xs text-surface-500">
                            <span className={POSITION_COLORS[p.position]}>{p.position}</span>
                            {" · "}{p.team_name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-base font-semibold font-data tabular-nums ${p.predicted_points >= 6 ? "text-brand-400" : "text-surface-100"}`}>
                        {p.predicted_points.toFixed(1)}
                      </span>
                      {p.element === result.captain.element && (
                        <span className="text-xs text-warning-400 ml-1">×2</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">{p.form}</td>
                    <td className="py-2.5 px-3">
                      <FdrBadge opponent={p.opponent_name} fdrMap={FDR_MAP} />
                    </td>
                    <td className="py-2.5 px-3">
                      {p.element === result.captain.element ? (
                        <span className="text-xs font-semibold text-warning-400">Captain</span>
                      ) : p.element === result.vice.element ? (
                        <span className="text-xs text-surface-400">Vice</span>
                      ) : (
                        <span className="text-xs text-surface-500">Starter</span>
                      )}
                    </td>
                  </tr>
                ))}
              {/* Bench divider */}
              <tr>
                <td colSpan={6} className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-surface-700" />
                    <span className="text-2xs text-surface-500 uppercase tracking-wider">Bench</span>
                    <div className="h-px flex-1 bg-surface-700" />
                  </div>
                </td>
              </tr>
              {/* Bench players */}
              {result.bench.map((p, idx) => (
                <tr key={p.element} className="border-t border-surface-800/60 opacity-60">
                  <td className="py-2.5 px-3 text-xs text-surface-600 font-data">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <TeamBadge team={p.team_name} />
                      <div>
                        <p
                          className="font-medium text-surface-300 hover:text-brand-400 transition-colors cursor-pointer"
                          onClick={() => navigate(`/player/${p.element}`)}
                        >
                          {p.web_name}
                        </p>
                        <p className="text-xs text-surface-600">
                          <span className={POSITION_COLORS[p.position]}>{p.position}</span>
                          {" · "}{p.team_name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-surface-500 font-data tabular-nums">{p.predicted_points.toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-surface-500 font-data tabular-nums">{p.form}</td>
                  <td className="py-2.5 px-3">
                    <FdrBadge opponent={p.opponent_name} fdrMap={FDR_MAP} />
                  </td>
                  <td className="py-2.5 px-3 text-xs text-surface-600">Bench {idx + 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
