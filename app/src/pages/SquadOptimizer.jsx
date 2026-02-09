import { useState } from "react";
import Jersey from "../components/Jersey";
import { TEAM_COLORS } from "../lib/constants";
import MiniSparkline from "../components/MiniSparkline";

// ============================================================
// MOCK DATA - optimal squad from optimization algorithm
// Will be replaced with: POST /api/squad/optimize
// ============================================================

const mockOptimalSquad = [
  // GK (2)
  { element: 20, web_name: "Raya", position: "GK", team_name: "ARS", value: 5.5, predicted_points: 4.2, form: 4.8, status: "a", opponent_name: "CHE", selected_by_percent: 18.2, starter: true, pts_last5: [6, 2, 6, 1, 6] },
  { element: 60, web_name: "Flekken", position: "GK", team_name: "BRE", value: 4.5, predicted_points: 3.6, form: 3.2, status: "a", opponent_name: "NFO", selected_by_percent: 5.1, starter: false, pts_last5: [3, 6, 1, 3, 2] },
  // DEF (5)
  { element: 15, web_name: "Alexander-Arnold", position: "DEF", team_name: "LIV", value: 7.1, predicted_points: 5.4, form: 6.1, status: "a", opponent_name: "EVE", selected_by_percent: 28.9, starter: true, pts_last5: [2, 9, 6, 1, 8] },
  { element: 12, web_name: "Gabriel", position: "DEF", team_name: "ARS", value: 6.2, predicted_points: 5.1, form: 5.8, status: "a", opponent_name: "CHE", selected_by_percent: 31.2, starter: true, pts_last5: [6, 2, 8, 6, 6] },
  { element: 30, web_name: "Saliba", position: "DEF", team_name: "ARS", value: 6.0, predicted_points: 4.8, form: 5.2, status: "a", opponent_name: "CHE", selected_by_percent: 22.1, starter: true, pts_last5: [6, 1, 6, 2, 6] },
  { element: 70, web_name: "Van Dijk", position: "DEF", team_name: "LIV", value: 6.3, predicted_points: 4.5, form: 5.0, status: "a", opponent_name: "EVE", selected_by_percent: 20.4, starter: false, pts_last5: [6, 2, 1, 6, 6] },
  { element: 61, web_name: "Mykolenko", position: "DEF", team_name: "EVE", value: 4.3, predicted_points: 3.1, form: 3.5, status: "a", opponent_name: "LIV", selected_by_percent: 4.2, starter: false, pts_last5: [1, 2, 1, 2, 1] },
  // MID (5)
  { element: 3, web_name: "Salah", position: "MID", team_name: "LIV", value: 13.2, predicted_points: 6.8, form: 7.2, status: "a", opponent_name: "EVE", selected_by_percent: 52.1, starter: true, pts_last5: [12, 3, 8, 5, 15] },
  { element: 7, web_name: "Palmer", position: "MID", team_name: "CHE", value: 9.5, predicted_points: 6.1, form: 9.2, status: "a", opponent_name: "ARS", selected_by_percent: 45.8, starter: true, pts_last5: [5, 13, 2, 10, 8] },
  { element: 40, web_name: "Mbeumo", position: "MID", team_name: "BRE", value: 7.8, predicted_points: 4.5, form: 5.6, status: "a", opponent_name: "NFO", selected_by_percent: 19.5, starter: true, pts_last5: [3, 7, 2, 5, 6] },
  { element: 71, web_name: "Rogers", position: "MID", team_name: "AVL", value: 5.8, predicted_points: 3.8, form: 4.2, status: "a", opponent_name: "NFO", selected_by_percent: 8.3, starter: true, pts_last5: [4, 2, 5, 3, 4] },
  { element: 62, web_name: "Wharton", position: "MID", team_name: "CRY", value: 4.8, predicted_points: 2.8, form: 2.9, status: "a", opponent_name: "MUN", selected_by_percent: 3.8, starter: false, pts_last5: [2, 3, 1, 2, 3] },
  // FWD (3)
  { element: 2, web_name: "Haaland", position: "FWD", team_name: "MCI", value: 15.3, predicted_points: 7.2, form: 8.8, status: "a", opponent_name: "BOU", selected_by_percent: 85.2, starter: true, pts_last5: [13, 2, 9, 5, 12] },
  { element: 50, web_name: "Isak", position: "FWD", team_name: "NEW", value: 8.8, predicted_points: 5.5, form: 7.0, status: "a", opponent_name: "WOL", selected_by_percent: 24.3, starter: true, pts_last5: [8, 5, 2, 10, 6] },
  { element: 63, web_name: "Archer", position: "FWD", team_name: "SOU", value: 4.5, predicted_points: 2.1, form: 1.8, status: "a", opponent_name: "TOT", selected_by_percent: 1.2, starter: false, pts_last5: [1, 2, 1, 2, 2] },
];

const BUDGET = 100.0;
const POSITION_LIMITS = { GK: 2, DEF: 5, MID: 5, FWD: 3 };
const MAX_PER_TEAM = 3;


// ============================================================
// PLAYER CARD ON PITCH
// ============================================================
const PitchPlayerCard = ({ player }) => (
  <div className="flex flex-col items-center gap-0.5">
    <Jersey teamName={player.team_name} position={player.position} status={player.status} />
    <div className="bg-white/95 px-2 py-0.5 rounded-sm text-[11px] font-semibold text-gray-900 text-center min-w-[72px] max-w-[100px] truncate shadow-sm">
      {player.web_name}
    </div>
    <div className="bg-gray-900/80 px-1.5 py-0.5 rounded-sm text-2xs text-center whitespace-nowrap">
      <span className="text-emerald-400 font-semibold">
        {player.predicted_points.toFixed(1)}
      </span>
      <span className="text-gray-400"> · {player.opponent_name}</span>
    </div>
    <MiniSparkline pts={player.pts_last5} />
  </div>
);

// ============================================================
// PITCH VIEW COMPONENT
// ============================================================
const PitchView = ({ starters, bench }) => {
  const gk = starters.filter((p) => p.position === "GK");
  const def = starters.filter((p) => p.position === "DEF");
  const mid = starters.filter((p) => p.position === "MID");
  const fwd = starters.filter((p) => p.position === "FWD");
  const formation = `${def.length}-${mid.length}-${fwd.length}`;

  return (
    <div className="card overflow-hidden">
      {/* Pitch header */}
      <div className="px-4 py-2.5 border-b border-surface-700 flex items-center justify-between bg-surface-800/50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-surface-100">
            Optimal XI
          </span>
          <span className="badge bg-surface-700 text-surface-300">
            {formation}
          </span>
        </div>
        <span className="text-xs text-surface-500">
          Predicted pts shown per player
        </span>
      </div>

      {/* The pitch */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            "repeating-linear-gradient(180deg, #1a5a2e 0px, #1a5a2e 65px, #1d6232 65px, #1d6232 130px)",
        }}
      >
        {/* Pitch markings */}
        <div className="absolute inset-4 border border-white/[0.12] rounded-sm" />
        <div className="absolute left-4 right-4 top-1/2 h-[1px] bg-white/[0.12]" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-white/[0.12]" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/[0.15]" />
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[240px] h-[60px] border-b border-l border-r border-white/[0.10]" />
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[120px] h-[25px] border-b border-l border-r border-white/[0.08]" />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[240px] h-[60px] border-t border-l border-r border-white/[0.10]" />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[120px] h-[25px] border-t border-l border-r border-white/[0.08]" />

        {/* Player formation rows */}
        <div
          className="relative z-10 flex flex-col justify-around py-8 px-4"
          style={{ minHeight: "540px" }}
        >
          <div className="flex justify-center gap-8">
            {gk.map((p) => (
              <PitchPlayerCard key={p.element} player={p} />
            ))}
          </div>
          <div className="flex justify-center gap-4 sm:gap-6 lg:gap-10">
            {def.map((p) => (
              <PitchPlayerCard key={p.element} player={p} />
            ))}
          </div>
          <div className="flex justify-center gap-3 sm:gap-5 lg:gap-8">
            {mid.map((p) => (
              <PitchPlayerCard key={p.element} player={p} />
            ))}
          </div>
          <div className="flex justify-center gap-4 sm:gap-6 lg:gap-10">
            {fwd.map((p) => (
              <PitchPlayerCard key={p.element} player={p} />
            ))}
          </div>
        </div>
      </div>

      {/* Bench */}
      <div className="bg-surface-800/60 px-4 py-4 border-t border-surface-700">
        <p className="text-xs font-medium text-surface-500 uppercase tracking-wider mb-4">
          Substitutes
        </p>
        <div className="flex justify-around">
          {bench.map((p, idx) => (
            <div key={p.element} className="flex flex-col items-center gap-0.5">
              <span className="text-2xs text-surface-500 font-medium mb-1">
                {idx + 1}
              </span>
              <Jersey teamName={p.team_name} position={p.position} status={p.status} />
              <div className="bg-white/95 px-2 py-0.5 rounded-sm text-[11px] font-semibold text-gray-900 text-center min-w-[72px] max-w-[100px] truncate shadow-sm">
                {p.web_name}
              </div>
              <div className="text-2xs whitespace-nowrap">
                <span className="text-emerald-400 font-semibold">{p.predicted_points.toFixed(1)}</span>
                <span className="text-gray-400"> · {p.opponent_name}</span>
              </div>
              <MiniSparkline pts={p.pts_last5} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// SQUAD OPTIMIZER PAGE
// ============================================================
export default function SquadOptimizer() {
  const [squad] = useState(mockOptimalSquad);

  const totalValue = squad.reduce((sum, p) => sum + p.value, 0);
  const remaining = BUDGET - totalValue;
  const starters = squad.filter((p) => p.starter);
  const bench = squad.filter((p) => !p.starter);
  const totalPredicted = starters.reduce(
    (sum, p) => sum + p.predicted_points,
    0
  );

  // Position counts
  const positionCounts = squad.reduce((acc, p) => {
    acc[p.position] = (acc[p.position] || 0) + 1;
    return acc;
  }, {});

  // Team counts
  const teamCounts = squad.reduce((acc, p) => {
    acc[p.team_name] = (acc[p.team_name] || 0) + 1;
    return acc;
  }, {});

  // Validation checks
  const constraints = [
    {
      label: "Budget",
      met: totalValue <= BUDGET,
      detail: `£${totalValue.toFixed(1)}m / £${BUDGET}m`,
    },
    {
      label: "Squad Size",
      met: squad.length === 15,
      detail: `${squad.length} / 15 players`,
    },
    {
      label: "Max 3 per team",
      met: Object.values(teamCounts).every((c) => c <= MAX_PER_TEAM),
      detail: Object.entries(teamCounts)
        .filter(([, c]) => c >= 3)
        .map(([t]) => `${t}: ${teamCounts[t]}`)
        .join(", ") || "All valid",
    },
    ...Object.entries(POSITION_LIMITS).map(([pos, limit]) => ({
      label: `${pos}`,
      met: (positionCounts[pos] || 0) === limit,
      detail: `${positionCounts[pos] || 0} / ${limit}`,
    })),
  ];

  return (
    <div className="space-y-8 stagger">
      {/* Summary — compact inline strip */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-xl font-bold text-surface-100">£{totalValue.toFixed(1)}m</span>
          <span className="text-xs text-surface-500 ml-1.5">/ £{BUDGET}m</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold text-brand-400">{totalPredicted.toFixed(1)}</span>
          <span className="text-xs text-surface-500 ml-1.5">predicted pts</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold text-surface-100">{(totalPredicted / 11).toFixed(1)}</span>
          <span className="text-xs text-surface-500 ml-1.5">avg / player</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold text-surface-100">{(totalPredicted / totalValue).toFixed(2)}</span>
          <span className="text-xs text-surface-500 ml-1.5">pts / £m</span>
        </div>
      </div>

      {/* Constraints + Team Distribution row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Constraints Validation */}
        <div>
          <div className="flex flex-wrap gap-2">
            {constraints.map((c) => (
              <div
                key={c.label}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                  c.met
                    ? "bg-success-500/10 border border-success-500/20"
                    : "bg-danger-500/10 border border-danger-500/20"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    c.met ? "bg-success-500" : "bg-danger-500"
                  }`}
                />
                <span className={c.met ? "text-success-400" : "text-danger-400"}>
                  {c.label}
                </span>
                <span className="text-surface-500 text-xs">{c.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Team Distribution */}
        <div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(teamCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([team, count]) => (
                <div
                  key={team}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: TEAM_COLORS[team] || "#555" }}
                  />
                  <span className="text-sm text-surface-200 font-medium">
                    {team}
                  </span>
                  <span className="text-xs text-surface-500">×{count}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Pitch Formation View */}
      <PitchView starters={starters} bench={bench} />

      {/* Method */}
      <div className="mt-8">
        <p className="text-xs text-surface-500 mb-3">
          Selects 15 players maximising total predicted points subject to:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700">
            <p className="text-sm font-medium text-surface-200">Budget</p>
            <p className="text-xs text-surface-500 mt-1">
              Squad value &le; £100m
            </p>
          </div>
          <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700">
            <p className="text-sm font-medium text-surface-200">Positions</p>
            <p className="text-xs text-surface-500 mt-1">
              2 GK, 5 DEF, 5 MID, 3 FWD
            </p>
          </div>
          <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700">
            <p className="text-sm font-medium text-surface-200">Team Limit</p>
            <p className="text-xs text-surface-500 mt-1">
              Max 3 per club
            </p>
          </div>
          <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700">
            <p className="text-sm font-medium text-surface-200">Starting XI</p>
            <p className="text-xs text-surface-500 mt-1">
              Best 11 from 15 by predicted points
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
