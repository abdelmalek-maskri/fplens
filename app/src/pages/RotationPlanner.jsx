import { useState, useMemo } from "react";
import { FDR_COLORS } from "../lib/constants";

// ============================================================
// MOCK DATA - Rotation pairs with alternating fixture runs
// Will be replaced with: GET /api/rotation/pairs?positions={pos}&budget={max}
// ============================================================

const GW_RANGE = ["GW24", "GW25", "GW26", "GW27", "GW28", "GW29", "GW30", "GW31"];

const mockRotationPlayers = [
  // GK options
  { element: 101, web_name: "Raya", team: "ARS", position: "GK", value: 5.5, fdr: [4, 2, 3, 2, 4, 2, 3, 2], predicted_sum: 33.2 },
  { element: 102, web_name: "Flekken", team: "BRE", position: "GK", value: 4.5, fdr: [2, 3, 2, 4, 2, 3, 2, 4], predicted_sum: 28.8 },
  { element: 103, web_name: "Pope", team: "NEW", position: "GK", value: 5.0, fdr: [2, 3, 4, 2, 2, 3, 4, 2], predicted_sum: 30.1 },
  { element: 104, web_name: "Sánchez", team: "CHE", position: "GK", value: 4.5, fdr: [5, 2, 2, 3, 5, 2, 2, 3], predicted_sum: 27.5 },
  { element: 105, web_name: "Verbruggen", team: "BHA", position: "GK", value: 4.5, fdr: [2, 2, 3, 4, 2, 2, 3, 4], predicted_sum: 29.0 },
  { element: 106, web_name: "Pickford", team: "EVE", position: "GK", value: 4.5, fdr: [5, 2, 2, 3, 2, 4, 2, 3], predicted_sum: 25.5 },
  // DEF options
  { element: 201, web_name: "Gabriel", team: "ARS", position: "DEF", value: 6.2, fdr: [4, 2, 3, 2, 4, 2, 3, 2], predicted_sum: 38.5 },
  { element: 202, web_name: "Collins", team: "BRE", position: "DEF", value: 4.8, fdr: [2, 3, 2, 4, 2, 3, 2, 4], predicted_sum: 30.2 },
  { element: 203, web_name: "Schär", team: "NEW", position: "DEF", value: 5.2, fdr: [2, 3, 4, 2, 2, 3, 4, 2], predicted_sum: 32.8 },
  { element: 204, web_name: "Colwill", team: "CHE", position: "DEF", value: 4.8, fdr: [5, 2, 2, 3, 5, 2, 2, 3], predicted_sum: 28.1 },
  { element: 205, web_name: "Dunk", team: "BHA", position: "DEF", value: 4.5, fdr: [2, 2, 3, 4, 2, 2, 3, 4], predicted_sum: 29.5 },
  { element: 206, web_name: "Hall", team: "NEW", position: "DEF", value: 4.5, fdr: [2, 3, 4, 2, 2, 3, 4, 2], predicted_sum: 28.0 },
  { element: 207, web_name: "Estupiñán", team: "BHA", position: "DEF", value: 5.0, fdr: [2, 2, 3, 4, 2, 2, 3, 4], predicted_sum: 30.5 },
  { element: 208, web_name: "Ajer", team: "BRE", position: "DEF", value: 4.5, fdr: [2, 3, 2, 4, 2, 3, 2, 4], predicted_sum: 27.8 },
];

// Find best rotation pairs — complementary fixtures
function findRotationPairs(players, position, maxBudget) {
  const posPlayers = players.filter(p => p.position === position);
  const pairs = [];

  for (let i = 0; i < posPlayers.length; i++) {
    for (let j = i + 1; j < posPlayers.length; j++) {
      const a = posPlayers[i];
      const b = posPlayers[j];
      if (a.value + b.value > maxBudget) continue;

      // Calculate complementary score: how many GWs at least one has FDR <= 2
      let easyGWs = 0;
      let combinedFdr = [];
      for (let gw = 0; gw < a.fdr.length; gw++) {
        const bestFdr = Math.min(a.fdr[gw], b.fdr[gw]);
        combinedFdr.push(bestFdr);
        if (bestFdr <= 2) easyGWs++;
      }

      pairs.push({
        playerA: a,
        playerB: b,
        combinedCost: a.value + b.value,
        easyGWs,
        combinedFdr,
        coverage: (easyGWs / a.fdr.length * 100).toFixed(0),
        combinedPredicted: a.predicted_sum + b.predicted_sum,
      });
    }
  }

  return pairs.sort((a, b) => b.easyGWs - a.easyGWs || a.combinedCost - b.combinedCost);
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function RotationPlanner() {
  const [position, setPosition] = useState("GK");
  const [maxBudget, setMaxBudget] = useState(10.0);

  const pairs = useMemo(() =>
    findRotationPairs(mockRotationPlayers, position, maxBudget),
    [position, maxBudget]
  );

  return (
    <div className="space-y-6 stagger">
      {/* Controls */}
      <div className="flex items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          {["GK", "DEF"].map(pos => (
            <button key={pos} onClick={() => setPosition(pos)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                position === pos ? "bg-brand-600 text-white" : "bg-surface-800 text-surface-400 hover:text-surface-100"
              }`}>
              {pos}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500">Max Budget:</span>
          <select value={maxBudget} onChange={e => setMaxBudget(Number(e.target.value))}
            className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-surface-100 focus:border-brand-500 focus:outline-none cursor-pointer">
            <option value={9}>£9.0m</option>
            <option value={9.5}>£9.5m</option>
            <option value={10}>£10.0m</option>
            <option value={10.5}>£10.5m</option>
            <option value={11}>£11.0m</option>
          </select>
        </div>
      </div>

      {/* How It Works */}
      <div className="flex items-center gap-4 py-2 border-b border-surface-800">
        <div className="flex items-center gap-6 text-xs text-surface-400">
          <span>Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-success-500/70 inline-flex items-center justify-center text-2xs font-bold text-white">2</span>
            <span>Play this player</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded bg-danger-500/70 inline-flex items-center justify-center text-2xs font-bold text-white">4</span>
            <span>Bench this player</span>
          </div>
          <span className="text-surface-500">Rotate to always start the favourable fixture</span>
        </div>
      </div>

      {/* Rotation Pair Cards */}
      <div className="space-y-4">
        {pairs.slice(0, 6).map((pair, idx) => (
          <div key={`${pair.playerA.element}-${pair.playerB.element}`}
            className={`py-4 border-b border-surface-800 last:border-0 ${idx === 0 ? "bg-success-500/[0.03]" : ""}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {idx === 0 && <span className="badge bg-success-500/20 text-success-400">Best Pair</span>}
                <h3 className="text-sm font-semibold text-surface-100">
                  {pair.playerA.web_name} + {pair.playerB.web_name}
                </h3>
                <span className="text-xs text-surface-500">
                  {pair.playerA.team} / {pair.playerB.team}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <span className="text-surface-500">Cost</span>
                  <p className="text-sm font-bold text-surface-100">£{pair.combinedCost.toFixed(1)}m</p>
                </div>
                <div className="text-right">
                  <span className="text-surface-500">Easy GW Coverage</span>
                  <p className={`text-sm font-bold ${Number(pair.coverage) >= 75 ? "text-success-400" : Number(pair.coverage) >= 50 ? "text-surface-100" : "text-warning-400"}`}>
                    {pair.coverage}%
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-surface-500">Combined Predicted</span>
                  <p className="text-sm font-bold text-brand-400">{pair.combinedPredicted.toFixed(1)} pts</p>
                </div>
              </div>
            </div>

            {/* Fixture Grid */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-xs text-surface-500 text-left py-1 px-2 w-32">Player</th>
                    {GW_RANGE.map(gw => (
                      <th key={gw} className="text-2xs text-surface-500 text-center py-1 px-1">{gw}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Player A */}
                  <tr>
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-surface-100">{pair.playerA.web_name}</span>
                        <span className="text-2xs text-surface-500">£{pair.playerA.value}m</span>
                      </div>
                    </td>
                    {pair.playerA.fdr.map((fdr, i) => {
                      const isStarter = pair.playerA.fdr[i] <= pair.playerB.fdr[i];
                      return (
                        <td key={i} className="py-1.5 px-1 text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-2xs font-bold ${FDR_COLORS[fdr].bg} ${FDR_COLORS[fdr].text} ${isStarter ? "" : "opacity-25"}`}>
                            {fdr}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  {/* Player B */}
                  <tr>
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-surface-100">{pair.playerB.web_name}</span>
                        <span className="text-2xs text-surface-500">£{pair.playerB.value}m</span>
                      </div>
                    </td>
                    {pair.playerB.fdr.map((fdr, i) => {
                      const isStarter = pair.playerB.fdr[i] < pair.playerA.fdr[i];
                      return (
                        <td key={i} className="py-1.5 px-1 text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-2xs font-bold ${FDR_COLORS[fdr].bg} ${FDR_COLORS[fdr].text} ${isStarter ? "" : "opacity-25"}`}>
                            {fdr}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  {/* Best pick row */}
                  <tr className="border-t border-surface-700/50">
                    <td className="py-1.5 px-2 text-2xs text-surface-500 uppercase">Start</td>
                    {pair.combinedFdr.map((fdr, i) => {
                      const starter = pair.playerA.fdr[i] <= pair.playerB.fdr[i] ? pair.playerA : pair.playerB;
                      return (
                        <td key={i} className="py-1.5 px-1 text-center">
                          <span className="text-2xs text-surface-300 font-medium">{starter.web_name.slice(0, 4)}</span>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {pairs.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-surface-500">No pairs within £{maxBudget.toFixed(1)}m</p>
          <p className="text-xs text-surface-600 mt-1">Try a higher budget</p>
        </div>
      )}
    </div>
  );
}
