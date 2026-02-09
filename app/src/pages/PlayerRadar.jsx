import { useState, useMemo } from "react";

// ============================================================
// MOCK DATA - Player percentile stats (vs position peers)
// Will be replaced with: GET /api/players/{id}/percentiles
// ============================================================
const mockPlayers = [
  {
    element: 2, web_name: "Haaland", team: "MCI", position: "FWD", value: 15.3,
    percentiles: { goals: 99, xG: 98, assists: 45, xA: 38, shots: 97, key_passes: 32, bonus: 92, ict: 95, minutes: 90, clean_sheets: 0, creativity: 28, threat: 99 },
    raw: { goals: 16, xG: 14.8, assists: 5, xA: 3.2, shots: 96, key_passes: 18, bonus: 28, ict: 285, minutes: 2050, clean_sheets: 0, creativity: 52, threat: 680 },
  },
  {
    element: 3, web_name: "Salah", team: "LIV", position: "MID", value: 13.2,
    percentiles: { goals: 98, xG: 95, assists: 92, xA: 88, shots: 94, key_passes: 85, bonus: 95, ict: 98, minutes: 92, clean_sheets: 30, creativity: 90, threat: 97 },
    raw: { goals: 15, xG: 12.5, assists: 10, xA: 8.1, shots: 88, key_passes: 52, bonus: 30, ict: 310, minutes: 2100, clean_sheets: 5, creativity: 185, threat: 620 },
  },
  {
    element: 7, web_name: "Palmer", team: "CHE", position: "MID", value: 9.5,
    percentiles: { goals: 96, xG: 92, assists: 85, xA: 82, shots: 88, key_passes: 78, bonus: 90, ict: 94, minutes: 88, clean_sheets: 25, creativity: 82, threat: 93 },
    raw: { goals: 14, xG: 11.2, assists: 8, xA: 6.8, shots: 78, key_passes: 45, bonus: 26, ict: 290, minutes: 2000, clean_sheets: 4, creativity: 168, threat: 585 },
  },
  {
    element: 15, web_name: "Alexander-Arnold", team: "LIV", position: "DEF", value: 7.1,
    percentiles: { goals: 42, xG: 35, assists: 95, xA: 92, shots: 55, key_passes: 98, bonus: 82, ict: 90, minutes: 85, clean_sheets: 88, creativity: 97, threat: 58 },
    raw: { goals: 2, xG: 1.4, assists: 8, xA: 6.5, shots: 28, key_passes: 62, bonus: 22, ict: 245, minutes: 1950, clean_sheets: 10, creativity: 210, threat: 95 },
  },
  {
    element: 12, web_name: "Gabriel", team: "ARS", position: "DEF", value: 6.2,
    percentiles: { goals: 85, xG: 78, assists: 18, xA: 12, shots: 62, key_passes: 15, bonus: 88, ict: 72, minutes: 92, clean_sheets: 92, creativity: 10, threat: 82 },
    raw: { goals: 4, xG: 2.8, assists: 1, xA: 0.5, shots: 32, key_passes: 8, bonus: 24, ict: 195, minutes: 2080, clean_sheets: 10, creativity: 22, threat: 145 },
  },
  {
    element: 50, web_name: "Isak", team: "NEW", position: "FWD", value: 8.8,
    percentiles: { goals: 92, xG: 90, assists: 52, xA: 42, shots: 85, key_passes: 38, bonus: 78, ict: 85, minutes: 88, clean_sheets: 0, creativity: 35, threat: 92 },
    raw: { goals: 12, xG: 11.9, assists: 4, xA: 2.8, shots: 82, key_passes: 22, bonus: 20, ict: 252, minutes: 2020, clean_sheets: 0, creativity: 62, threat: 520 },
  },
  {
    element: 40, web_name: "Mbeumo", team: "BRE", position: "MID", value: 7.8,
    percentiles: { goals: 88, xG: 82, assists: 65, xA: 60, shots: 72, key_passes: 58, bonus: 72, ict: 78, minutes: 90, clean_sheets: 18, creativity: 62, threat: 82 },
    raw: { goals: 10, xG: 8.2, assists: 5, xA: 4.1, shots: 62, key_passes: 35, bonus: 18, ict: 225, minutes: 2040, clean_sheets: 3, creativity: 128, threat: 420 },
  },
  {
    element: 20, web_name: "Raya", team: "ARS", position: "GK", value: 5.5,
    percentiles: { goals: 0, xG: 0, assists: 10, xA: 5, shots: 0, key_passes: 5, bonus: 85, ict: 15, minutes: 95, clean_sheets: 95, creativity: 2, threat: 0 },
    raw: { goals: 0, xG: 0, assists: 0, xA: 0, shots: 0, key_passes: 2, bonus: 22, ict: 32, minutes: 2160, clean_sheets: 11, creativity: 5, threat: 0 },
  },
];

const RADAR_METRICS = {
  FWD: ["goals", "xG", "assists", "shots", "bonus", "ict", "key_passes", "threat"],
  MID: ["goals", "xG", "assists", "xA", "key_passes", "creativity", "bonus", "ict"],
  DEF: ["clean_sheets", "assists", "xA", "goals", "key_passes", "creativity", "bonus", "minutes"],
  GK: ["clean_sheets", "bonus", "minutes", "ict"],
};

const METRIC_LABELS = {
  goals: "Goals", xG: "xG", assists: "Assists", xA: "xA",
  shots: "Shots", key_passes: "Key Passes", bonus: "Bonus",
  ict: "ICT Index", minutes: "Minutes", clean_sheets: "Clean Sheets",
  creativity: "Creativity", threat: "Threat",
};

// ============================================================
// SVG RADAR CHART
// ============================================================
function RadarChart({ metrics, percentiles, size = 280 }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;
  const levels = 5;
  const angleStep = (2 * Math.PI) / metrics.length;

  const getPoint = (index, value) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  };

  const dataPoints = metrics.map((m, i) => getPoint(i, percentiles[m] || 0));
  const polygonPoints = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Grid levels */}
      {[...Array(levels)].map((_, lvl) => {
        const r = ((lvl + 1) / levels) * radius;
        const points = metrics.map((_, i) => {
          const angle = angleStep * i - Math.PI / 2;
          return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
        }).join(" ");
        return (
          <polygon key={lvl} points={points}
            fill="none" stroke="#334155" strokeWidth={lvl === levels - 1 ? 1 : 0.5}
            opacity={0.5} />
        );
      })}

      {/* Axis lines */}
      {metrics.map((_, i) => {
        const end = getPoint(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#334155" strokeWidth={0.5} opacity={0.5} />;
      })}

      {/* Data polygon */}
      <polygon points={polygonPoints} fill="rgba(168, 85, 247, 0.15)" stroke="#A855F7" strokeWidth={2} />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#A855F7" stroke="#C084FC" strokeWidth={1} />
      ))}

      {/* Labels */}
      {metrics.map((m, i) => {
        const labelDist = radius + 25;
        const angle = angleStep * i - Math.PI / 2;
        const x = cx + labelDist * Math.cos(angle);
        const y = cy + labelDist * Math.sin(angle);
        const value = percentiles[m] || 0;
        return (
          <g key={m}>
            <text x={x} y={y - 6} textAnchor="middle" className="fill-surface-300 text-[10px] font-medium">
              {METRIC_LABELS[m]}
            </text>
            <text x={x} y={y + 6} textAnchor="middle"
              className={`text-[10px] font-bold ${value >= 90 ? "fill-[#4ADE80]" : value >= 70 ? "fill-[#A855F7]" : value >= 50 ? "fill-[#F8FAFC]" : "fill-[#94A3B8]"}`}>
              {value}th
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function PlayerRadar() {
  const [selectedPlayer, setSelectedPlayer] = useState(2);
  const [comparePlayer, setComparePlayer] = useState(null);

  const player = mockPlayers.find(p => p.element === selectedPlayer);
  const compare = comparePlayer ? mockPlayers.find(p => p.element === comparePlayer) : null;
  const metrics = player ? (RADAR_METRICS[player.position] || RADAR_METRICS.MID) : [];

  const allMetrics = ["goals", "xG", "assists", "xA", "shots", "key_passes", "bonus", "ict", "minutes", "clean_sheets", "creativity", "threat"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Player Radar</h1>
          <p className="text-surface-400 mt-1">Percentile rankings vs position peers — see strengths at a glance</p>
        </div>
      </div>

      {/* Player Selectors */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-xs text-surface-500 uppercase tracking-wide block mb-1">Player</label>
          <select value={selectedPlayer} onChange={e => setSelectedPlayer(Number(e.target.value))}
            className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:border-brand-500 focus:outline-none cursor-pointer">
            {mockPlayers.map(p => (
              <option key={p.element} value={p.element}>
                {p.web_name} ({p.position} · {p.team} · £{p.value}m)
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-surface-500 uppercase tracking-wide block mb-1">Compare With</label>
          <select value={comparePlayer || ""} onChange={e => setComparePlayer(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 focus:border-brand-500 focus:outline-none cursor-pointer">
            <option value="">None</option>
            {mockPlayers.filter(p => p.element !== selectedPlayer).map(p => (
              <option key={p.element} value={p.element}>
                {p.web_name} ({p.position} · {p.team} · £{p.value}m)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Radar Chart(s) */}
      <div className={`grid ${compare ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
        {player && (
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
                <span className="text-sm font-bold text-brand-400">{player.position}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-surface-100">{player.web_name}</h3>
                <p className="text-xs text-surface-500">{player.team} · £{player.value}m</p>
              </div>
            </div>
            <RadarChart metrics={metrics} percentiles={player.percentiles} size={compare ? 240 : 300} />
          </div>
        )}
        {compare && (
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-info-500/20 border border-info-500/30 flex items-center justify-center">
                <span className="text-sm font-bold text-info-400">{compare.position}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-surface-100">{compare.web_name}</h3>
                <p className="text-xs text-surface-500">{compare.team} · £{compare.value}m</p>
              </div>
            </div>
            <RadarChart
              metrics={RADAR_METRICS[compare.position] || RADAR_METRICS.MID}
              percentiles={compare.percentiles}
              size={240}
            />
          </div>
        )}
      </div>

      {/* Percentile Breakdown Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-800/50">
            <tr>
              <th className="table-header text-left py-3 px-4">Metric</th>
              <th className="table-header text-left py-3 px-4">{player?.web_name} (Pctile)</th>
              <th className="table-header text-left py-3 px-4">{player?.web_name} (Raw)</th>
              {compare && (
                <>
                  <th className="table-header text-left py-3 px-4">{compare.web_name} (Pctile)</th>
                  <th className="table-header text-left py-3 px-4">{compare.web_name} (Raw)</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {allMetrics.map(m => {
              const pVal = player?.percentiles[m] || 0;
              const cVal = compare?.percentiles[m] || 0;
              const better = compare ? (pVal > cVal ? "player" : cVal > pVal ? "compare" : "tie") : null;
              return (
                <tr key={m} className="border-t border-surface-800">
                  <td className="py-2.5 px-4 text-sm text-surface-300">{METRIC_LABELS[m]}</td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${
                          pVal >= 90 ? "bg-success-500" : pVal >= 70 ? "bg-brand-500" : pVal >= 50 ? "bg-surface-500" : "bg-surface-700"
                        }`} style={{ width: `${pVal}%` }} />
                      </div>
                      <span className={`text-xs font-bold ${
                        pVal >= 90 ? "text-success-400" : pVal >= 70 ? "text-brand-400" : "text-surface-400"
                      } ${better === "player" ? "underline" : ""}`}>
                        {pVal}th
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-surface-500 font-mono">{player?.raw[m]}</td>
                  {compare && (
                    <>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${
                              cVal >= 90 ? "bg-success-500" : cVal >= 70 ? "bg-info-500" : cVal >= 50 ? "bg-surface-500" : "bg-surface-700"
                            }`} style={{ width: `${cVal}%` }} />
                          </div>
                          <span className={`text-xs font-bold ${
                            cVal >= 90 ? "text-success-400" : cVal >= 70 ? "text-info-400" : "text-surface-400"
                          } ${better === "compare" ? "underline" : ""}`}>
                            {cVal}th
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-surface-500 font-mono">{compare.raw[m]}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Percentile Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-surface-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full bg-success-500" /> Elite (90th+)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full bg-brand-500" /> Good (70th–89th)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full bg-surface-500" /> Average (50th–69th)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full bg-surface-700" /> Below Avg (&lt;50th)
        </div>
      </div>

      <p className="text-xs text-surface-600 text-center">
        Percentiles calculated vs all players in the same position across the 2024/25 season.
        Raw stats are season totals through GW23.
      </p>
    </div>
  );
}
