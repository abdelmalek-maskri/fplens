import { useState } from "react";
import { TEAM_COLORS } from "../lib/constants";

// ============================================================
// MOCK DATA - 20 PL teams × 6 upcoming GWs
// Will be replaced with: GET /api/fixtures/ticker
// ============================================================

const TEAMS = [
  "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "CRY", "EVE",
  "FUL", "IPS", "LEI", "LIV", "MCI", "MUN", "NEW", "NFO",
  "SOU", "TOT", "WHU", "WOL",
];

const TEAM_FULL = {
  ARS: "Arsenal", AVL: "Aston Villa", BOU: "Bournemouth", BRE: "Brentford",
  BHA: "Brighton", CHE: "Chelsea", CRY: "Crystal Palace", EVE: "Everton",
  FUL: "Fulham", IPS: "Ipswich", LEI: "Leicester", LIV: "Liverpool",
  MCI: "Man City", MUN: "Man United", NEW: "Newcastle", NFO: "Nott'm Forest",
  SOU: "Southampton", TOT: "Tottenham", WHU: "West Ham", WOL: "Wolves",
};

// Fixture data: each entry is { opponent, home, atkFdr, defFdr }
// atkFdr = how hard to ATTACK (goals opponent concedes — low = they concede less = harder)
// defFdr = how hard to DEFEND (goals opponent scores — low = they score less = easier)
const FIXTURES = {
  ARS: [
    { gw: 24, opponent: "CHE", home: true, atkFdr: 4, defFdr: 4 },
    { gw: 25, opponent: "MCI", home: false, atkFdr: 5, defFdr: 5 },
    { gw: 26, opponent: "LEI", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 27, opponent: "NFO", home: false, atkFdr: 3, defFdr: 2 },
    { gw: 28, opponent: "BOU", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 29, opponent: "FUL", home: false, atkFdr: 3, defFdr: 2 },
  ],
  LIV: [
    { gw: 24, opponent: "EVE", home: true, atkFdr: 2, defFdr: 3 },
    { gw: 25, opponent: "WOL", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 26, opponent: "MCI", home: true, atkFdr: 4, defFdr: 5 },
    { gw: 27, opponent: "IPS", home: false, atkFdr: 1, defFdr: 1 },
    { gw: 28, opponent: "SOU", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 29, opponent: "MUN", home: false, atkFdr: 3, defFdr: 3 },
  ],
  MCI: [
    { gw: 24, opponent: "BOU", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 25, opponent: "ARS", home: true, atkFdr: 5, defFdr: 4 },
    { gw: 26, opponent: "LIV", home: false, atkFdr: 5, defFdr: 5 },
    { gw: 27, opponent: "TOT", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 28, opponent: "NFO", home: false, atkFdr: 3, defFdr: 2 },
    { gw: 29, opponent: "BHA", home: true, atkFdr: 3, defFdr: 3 },
  ],
  CHE: [
    { gw: 24, opponent: "ARS", home: false, atkFdr: 5, defFdr: 4 },
    { gw: 25, opponent: "BHA", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 26, opponent: "SOU", home: false, atkFdr: 1, defFdr: 1 },
    { gw: 27, opponent: "FUL", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 28, opponent: "LEI", home: false, atkFdr: 1, defFdr: 1 },
    { gw: 29, opponent: "WOL", home: true, atkFdr: 2, defFdr: 2 },
  ],
  NEW: [
    { gw: 24, opponent: "WOL", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 25, opponent: "NFO", home: false, atkFdr: 3, defFdr: 2 },
    { gw: 26, opponent: "EVE", home: true, atkFdr: 2, defFdr: 3 },
    { gw: 27, opponent: "BHA", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 28, opponent: "CRY", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 29, opponent: "AVL", home: false, atkFdr: 3, defFdr: 3 },
  ],
  AVL: [
    { gw: 24, opponent: "NFO", home: true, atkFdr: 3, defFdr: 2 },
    { gw: 25, opponent: "EVE", home: false, atkFdr: 2, defFdr: 3 },
    { gw: 26, opponent: "WHU", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 27, opponent: "MUN", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 28, opponent: "FUL", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 29, opponent: "NEW", home: true, atkFdr: 3, defFdr: 3 },
  ],
  BOU: [
    { gw: 24, opponent: "MCI", home: false, atkFdr: 4, defFdr: 5 },
    { gw: 25, opponent: "SOU", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 26, opponent: "WOL", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 27, opponent: "LEI", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 28, opponent: "ARS", home: false, atkFdr: 5, defFdr: 4 },
    { gw: 29, opponent: "IPS", home: true, atkFdr: 1, defFdr: 1 },
  ],
  BRE: [
    { gw: 24, opponent: "NFO", home: false, atkFdr: 3, defFdr: 2 },
    { gw: 25, opponent: "CRY", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 26, opponent: "TOT", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 27, opponent: "WHU", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 28, opponent: "WOL", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 29, opponent: "LEI", home: true, atkFdr: 1, defFdr: 1 },
  ],
  BHA: [
    { gw: 24, opponent: "IPS", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 25, opponent: "CHE", home: false, atkFdr: 4, defFdr: 4 },
    { gw: 26, opponent: "FUL", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 27, opponent: "NEW", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 28, opponent: "MUN", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 29, opponent: "MCI", home: false, atkFdr: 4, defFdr: 5 },
  ],
  CRY: [
    { gw: 24, opponent: "MUN", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 25, opponent: "BRE", home: false, atkFdr: 2, defFdr: 3 },
    { gw: 26, opponent: "IPS", home: false, atkFdr: 1, defFdr: 1 },
    { gw: 27, opponent: "SOU", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 28, opponent: "NEW", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 29, opponent: "EVE", home: true, atkFdr: 2, defFdr: 3 },
  ],
  EVE: [
    { gw: 24, opponent: "LIV", home: false, atkFdr: 5, defFdr: 5 },
    { gw: 25, opponent: "AVL", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 26, opponent: "NEW", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 27, opponent: "WOL", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 28, opponent: "TOT", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 29, opponent: "CRY", home: false, atkFdr: 2, defFdr: 2 },
  ],
  FUL: [
    { gw: 24, opponent: "LEI", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 25, opponent: "TOT", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 26, opponent: "BHA", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 27, opponent: "CHE", home: false, atkFdr: 4, defFdr: 4 },
    { gw: 28, opponent: "AVL", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 29, opponent: "ARS", home: true, atkFdr: 5, defFdr: 4 },
  ],
  IPS: [
    { gw: 24, opponent: "BHA", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 25, opponent: "MUN", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 26, opponent: "CRY", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 27, opponent: "LIV", home: true, atkFdr: 5, defFdr: 5 },
    { gw: 28, opponent: "WHU", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 29, opponent: "BOU", home: false, atkFdr: 2, defFdr: 3 },
  ],
  LEI: [
    { gw: 24, opponent: "FUL", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 25, opponent: "WHU", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 26, opponent: "ARS", home: false, atkFdr: 5, defFdr: 4 },
    { gw: 27, opponent: "BOU", home: false, atkFdr: 2, defFdr: 3 },
    { gw: 28, opponent: "CHE", home: true, atkFdr: 4, defFdr: 4 },
    { gw: 29, opponent: "BRE", home: false, atkFdr: 2, defFdr: 3 },
  ],
  MUN: [
    { gw: 24, opponent: "CRY", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 25, opponent: "IPS", home: false, atkFdr: 1, defFdr: 1 },
    { gw: 26, opponent: "NFO", home: true, atkFdr: 3, defFdr: 2 },
    { gw: 27, opponent: "AVL", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 28, opponent: "BHA", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 29, opponent: "LIV", home: true, atkFdr: 5, defFdr: 5 },
  ],
  NFO: [
    { gw: 24, opponent: "AVL", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 25, opponent: "NEW", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 26, opponent: "MUN", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 27, opponent: "ARS", home: true, atkFdr: 5, defFdr: 4 },
    { gw: 28, opponent: "MCI", home: true, atkFdr: 4, defFdr: 5 },
    { gw: 29, opponent: "SOU", home: false, atkFdr: 1, defFdr: 1 },
  ],
  SOU: [
    { gw: 24, opponent: "TOT", home: true, atkFdr: 3, defFdr: 3 },
    { gw: 25, opponent: "BOU", home: false, atkFdr: 2, defFdr: 3 },
    { gw: 26, opponent: "CHE", home: true, atkFdr: 4, defFdr: 4 },
    { gw: 27, opponent: "CRY", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 28, opponent: "IPS", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 29, opponent: "NFO", home: true, atkFdr: 3, defFdr: 2 },
  ],
  TOT: [
    { gw: 24, opponent: "SOU", home: false, atkFdr: 1, defFdr: 1 },
    { gw: 25, opponent: "FUL", home: true, atkFdr: 2, defFdr: 2 },
    { gw: 26, opponent: "BRE", home: true, atkFdr: 2, defFdr: 3 },
    { gw: 27, opponent: "MCI", home: false, atkFdr: 4, defFdr: 5 },
    { gw: 28, opponent: "EVE", home: true, atkFdr: 2, defFdr: 3 },
    { gw: 29, opponent: "WHU", home: false, atkFdr: 2, defFdr: 2 },
  ],
  WHU: [
    { gw: 24, opponent: "WOL", home: false, atkFdr: 2, defFdr: 2 },
    { gw: 25, opponent: "LEI", home: false, atkFdr: 1, defFdr: 1 },
    { gw: 26, opponent: "AVL", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 27, opponent: "BRE", home: false, atkFdr: 2, defFdr: 3 },
    { gw: 28, opponent: "IPS", home: true, atkFdr: 1, defFdr: 1 },
    { gw: 29, opponent: "TOT", home: true, atkFdr: 3, defFdr: 3 },
  ],
  WOL: [
    { gw: 24, opponent: "NEW", home: false, atkFdr: 3, defFdr: 3 },
    { gw: 25, opponent: "LIV", home: true, atkFdr: 5, defFdr: 5 },
    { gw: 26, opponent: "BOU", home: true, atkFdr: 2, defFdr: 3 },
    { gw: 27, opponent: "EVE", home: false, atkFdr: 2, defFdr: 3 },
    { gw: 28, opponent: "BRE", home: true, atkFdr: 2, defFdr: 3 },
    { gw: 29, opponent: "CHE", home: false, atkFdr: 4, defFdr: 4 },
  ],
};

// ============================================================
// FDR COLORS
// ============================================================
const FDR_BG = {
  1: "bg-success-600",
  2: "bg-success-500/60",
  3: "bg-surface-600",
  4: "bg-danger-500/60",
  5: "bg-danger-700",
};

const FDR_TEXT = {
  1: "text-white",
  2: "text-white",
  3: "text-surface-200",
  4: "text-white",
  5: "text-white",
};

// ============================================================
// FIXTURE TICKER PAGE
// ============================================================
export default function FixtureTicker() {
  const [fdrMode, setFdrMode] = useState("attack"); // "attack" | "defence" | "combined"
  const [sortBy, setSortBy] = useState("name"); // "name" | "easiest"

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
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500 uppercase tracking-wide mr-1">
            FDR Mode
          </span>
          {["attack", "defence", "combined"].map((mode) => (
            <button
              key={mode}
              onClick={() => setFdrMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                fdrMode === mode
                  ? "bg-brand-600 text-white"
                  : "bg-surface-800 text-surface-400 hover:text-surface-100"
              }`}
            >
              {mode === "attack" ? "Attack" : mode === "defence" ? "Defence" : "Combined"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500 uppercase tracking-wide mr-1">
            Sort
          </span>
          <button
            onClick={() => setSortBy("name")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sortBy === "name"
                ? "bg-brand-600 text-white"
                : "bg-surface-800 text-surface-400 hover:text-surface-100"
            }`}
          >
            A-Z
          </button>
          <button
            onClick={() => setSortBy("easiest")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sortBy === "easiest"
                ? "bg-brand-600 text-white"
                : "bg-surface-800 text-surface-400 hover:text-surface-100"
            }`}
          >
            Easiest First
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-surface-500">
        <span>Difficulty:</span>
        {[1, 2, 3, 4, 5].map((fdr) => (
          <div key={fdr} className="flex items-center gap-1">
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-2xs font-bold ${FDR_BG[fdr]} ${FDR_TEXT[fdr]}`}>
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
      <div className="card overflow-y-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-800/50">
            <tr>
              <th className="table-header text-left py-2.5 px-3 w-36">Team</th>
              {gameweeks.map((gw) => (
                <th key={gw} className="table-header text-center py-2.5 px-2 w-24">
                  GW{gw}
                </th>
              ))}
              <th className="table-header text-center py-2.5 px-3 w-20">Avg</th>
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((row) => {
              const avgVal = fdrMode === "attack" ? row.avgAtk : fdrMode === "defence" ? row.avgDef : row.avgCombined;
              const avgFdr = Math.round(avgVal);

              return (
                <tr
                  key={row.team}
                  className="border-t border-surface-800 hover:bg-surface-800/40 transition-colors"
                  style={{ borderLeft: `3px solid ${TEAM_COLORS[row.team] || "rgb(var(--surface-700))"}` }}
                >
                  <td className="py-2 px-4">
                    <div>
                      <span className="font-semibold text-surface-100 text-sm">
                        {row.team}
                      </span>
                      <span className="text-xs text-surface-500 ml-2">
                        {TEAM_FULL[row.team]}
                      </span>
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
                          <p className={`text-xs font-bold ${FDR_TEXT[fdr]}`}>
                            {fix.opponent}
                          </p>
                          <p className={`text-2xs ${FDR_TEXT[fdr]} opacity-70`}>
                            {fix.home ? "(H)" : "(A)"}
                          </p>
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-2 px-4 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${FDR_BG[avgFdr]} ${FDR_TEXT[avgFdr]}`}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="space-y-2">
            {[...teamData]
              .sort((a, b) => a.avgAtk - b.avgAtk)
              .slice(0, 5)
              .map((t, i) => (
                <div key={t.team} className="flex items-center justify-between text-sm">
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
          <div className="space-y-2">
            {[...teamData]
              .sort((a, b) => a.avgDef - b.avgDef)
              .slice(0, 5)
              .map((t, i) => (
                <div key={t.team} className="flex items-center justify-between text-sm">
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
