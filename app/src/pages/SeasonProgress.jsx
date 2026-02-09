// ============================================================
// MOCK DATA - Season rank and points progression
// Will be replaced with: GET /api/teams/my-team/season-history
// ============================================================
const mockSeasonData = {
  manager_name: "FPL Insights Demo",
  total_points: 1385,
  overall_rank: 125420,
  gw_history: [
    { gw: 1, pts: 62, total: 62, rank: 1850000, hit: 0 },
    { gw: 2, pts: 48, total: 110, rank: 2100000, hit: 0 },
    { gw: 3, pts: 71, total: 181, rank: 980000, hit: 0 },
    { gw: 4, pts: 55, total: 236, rank: 750000, hit: 0 },
    { gw: 5, pts: 82, total: 318, rank: 320000, hit: 0 },
    { gw: 6, pts: 38, total: 356, rank: 520000, hit: 4 },
    { gw: 7, pts: 65, total: 421, rank: 380000, hit: 0 },
    { gw: 8, pts: 72, total: 493, rank: 250000, hit: 0 },
    { gw: 9, pts: 45, total: 538, rank: 350000, hit: 0 },
    { gw: 10, pts: 58, total: 596, rank: 310000, hit: 0 },
    { gw: 11, pts: 78, total: 674, rank: 195000, hit: 0 },
    { gw: 12, pts: 42, total: 716, rank: 260000, hit: 4 },
    { gw: 13, pts: 66, total: 782, rank: 220000, hit: 0 },
    { gw: 14, pts: 52, total: 834, rank: 235000, hit: 0 },
    { gw: 15, pts: 88, total: 922, rank: 150000, hit: 0 },
    { gw: 16, pts: 55, total: 977, rank: 165000, hit: 0 },
    { gw: 17, pts: 71, total: 1048, rank: 135000, hit: 0 },
    { gw: 18, pts: 62, total: 1110, rank: 128000, hit: 0 },
    { gw: 19, pts: 48, total: 1158, rank: 145000, hit: 4 },
    { gw: 20, pts: 75, total: 1233, rank: 118000, hit: 0 },
    { gw: 21, pts: 58, total: 1291, rank: 125000, hit: 0 },
    { gw: 22, pts: 42, total: 1333, rank: 138000, hit: 0 },
    { gw: 23, pts: 52, total: 1385, rank: 125420, hit: 0 },
  ],
};

const maxPts = Math.max(...mockSeasonData.gw_history.map(g => g.pts));
const avgPts = mockSeasonData.gw_history.reduce((s, g) => s + g.pts, 0) / mockSeasonData.gw_history.length;
const bestGW = [...mockSeasonData.gw_history].sort((a, b) => b.pts - a.pts)[0];
const worstGW = [...mockSeasonData.gw_history].sort((a, b) => a.pts - b.pts)[0];
const greenArrows = mockSeasonData.gw_history.filter((g, i) => i > 0 && g.rank < mockSeasonData.gw_history[i - 1].rank).length;

// ============================================================
// SVG LINE CHART
// ============================================================
function RankChart({ data, width = 700, height = 200 }) {
  const padding = { top: 10, right: 10, bottom: 25, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Invert rank (lower rank = higher on chart)
  const ranks = data.map(g => g.rank);
  const rMax = Math.max(...ranks);
  const rMin = Math.min(...ranks);
  const rRange = rMax - rMin || 1;

  const points = data.map((g, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + ((g.rank - rMin) / rRange) * chartH;
    return { x, y, gw: g.gw, rank: g.rank };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <svg width={width} height={height} className="w-full">
      {/* Gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = padding.top + pct * chartH;
        const rankVal = rMin + pct * rRange;
        return (
          <g key={pct}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y}
              stroke="rgb(var(--surface-700))" strokeWidth={0.5} strokeDasharray="4" />
            <text x={width - padding.right + 5} y={y + 3} className="fill-surface-500 text-2xs">
              {(rankVal / 1000).toFixed(0)}k
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={`${pathD} L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`}
        fill="url(#rankGradient)" />
      <defs>
        <linearGradient id="rankGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--brand-400))" stopOpacity="0.2" />
          <stop offset="100%" stopColor="rgb(var(--brand-400))" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Line */}
      <path d={pathD} fill="none" stroke="rgb(var(--brand-400))" strokeWidth={2} strokeLinejoin="round" />

      {/* Data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="rgb(var(--surface-900))" stroke="rgb(var(--brand-400))" strokeWidth={1.5} />
          {/* GW labels */}
          {(i % 3 === 0 || i === data.length - 1) && (
            <text x={p.x} y={height - 5} textAnchor="middle" className="fill-surface-500 text-2xs">
              {p.gw}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function PointsBarChart({ data, width = 700, height = 140 }) {
  const padding = { top: 5, bottom: 20 };
  const barW = (width / data.length) * 0.7;
  const gap = (width / data.length) * 0.3;

  return (
    <svg width={width} height={height} className="w-full">
      {/* Average line */}
      <line x1={0} y1={height - padding.bottom - (avgPts / maxPts) * (height - padding.top - padding.bottom)}
        x2={width} y2={height - padding.bottom - (avgPts / maxPts) * (height - padding.top - padding.bottom)}
        stroke="rgb(var(--brand-400))" strokeWidth={1} strokeDasharray="4" opacity={0.5} />

      {data.map((g, i) => {
        const barH = (g.pts / maxPts) * (height - padding.top - padding.bottom);
        const x = i * (barW + gap) + gap / 2;
        const y = height - padding.bottom - barH;
        const isHit = g.hit > 0;
        const isBest = g.pts === bestGW.pts;
        const isWorst = g.pts === worstGW.pts;
        return (
          <g key={g.gw}>
            <rect x={x} y={y} width={barW} height={barH} rx={2}
              className={isBest ? "fill-success-500/60" : isWorst ? "fill-danger-500/60" : isHit ? "fill-warning-500/40" : "fill-brand-500/40"} />
            <text x={x + barW / 2} y={y - 3} textAnchor="middle" className="fill-surface-400 text-2xs font-bold">
              {g.pts}
            </text>
            {i % 3 === 0 && (
              <text x={x + barW / 2} y={height - 4} textAnchor="middle" className="fill-surface-500 text-[8px]">
                {g.gw}
              </text>
            )}
            {isHit && (
              <text x={x + barW / 2} y={y - 12} textAnchor="middle" className="fill-warning-400 text-[8px]">
                -{g.hit}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function SeasonProgress() {
  return (
    <div className="space-y-6 stagger">
      {/* Season Summary — inline stat strip */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-xl font-bold font-data tabular-nums text-surface-100">{mockSeasonData.total_points}</span>
          <span className="text-xs text-surface-500 ml-1.5">pts</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold font-data tabular-nums text-brand-400">{(mockSeasonData.overall_rank / 1000).toFixed(1)}k</span>
          <span className="text-xs text-surface-500 ml-1.5">rank</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold font-data tabular-nums text-success-400">{bestGW.pts}</span>
          <span className="text-xs text-surface-500 ml-1.5">best (GW{bestGW.gw})</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold font-data tabular-nums text-danger-400">{worstGW.pts}</span>
          <span className="text-xs text-surface-500 ml-1.5">worst (GW{worstGW.gw})</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-xl font-bold font-data tabular-nums text-success-400">{greenArrows}/{mockSeasonData.gw_history.length - 1}</span>
          <span className="text-xs text-surface-500 ml-1.5">green arrows</span>
        </div>
      </div>

      {/* Rank Progression Chart */}
      <div className="mt-8 pt-2 pb-4 border-b border-surface-800">
        <RankChart data={mockSeasonData.gw_history} />
      </div>

      {/* GW Points Bar Chart */}
      <div className="mt-8 pt-2 pb-4 border-b border-surface-800">
        <PointsBarChart data={mockSeasonData.gw_history} />
      </div>

      {/* GW History Table */}
      <div className="card overflow-y-hidden overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-800/50">
            <tr>
              <th className="table-header text-left py-2.5 px-3">GW</th>
              <th className="table-header text-left py-2.5 px-3">Points</th>
              <th className="table-header text-left py-2.5 px-3">Hit</th>
              <th className="table-header text-left py-2.5 px-3">Net</th>
              <th className="table-header text-left py-2.5 px-3">Total</th>
              <th className="table-header text-left py-2.5 px-3">Rank</th>
              <th className="table-header text-left py-2.5 px-3">Movement</th>
            </tr>
          </thead>
          <tbody>
            {[...mockSeasonData.gw_history].reverse().map((g, idx, arr) => {
              const prevRank = idx < arr.length - 1 ? arr[idx + 1].rank : g.rank;
              const rankDelta = prevRank - g.rank;
              const isGreen = rankDelta > 0;
              return (
                <tr key={g.gw} className="border-t border-surface-800 hover:bg-surface-800/40">
                  <td className="py-2.5 px-4 text-surface-300 font-medium">GW{g.gw}</td>
                  <td className="py-2.5 px-4">
                    <span className={`font-bold font-data tabular-nums ${g.pts >= 70 ? "text-success-400" : g.pts < 45 ? "text-danger-400" : "text-surface-100"}`}>
                      {g.pts}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    {g.hit > 0 ? <span className="text-warning-400 text-sm">-{g.hit}</span> : <span className="text-surface-600">—</span>}
                  </td>
                  <td className="py-2.5 px-4 text-surface-300 font-data tabular-nums">{g.pts - g.hit}</td>
                  <td className="py-2.5 px-4 text-surface-100 font-medium font-data tabular-nums">{g.total}</td>
                  <td className="py-2.5 px-4 text-surface-300 font-data tabular-nums">{(g.rank / 1000).toFixed(0)}k</td>
                  <td className="py-2.5 px-4">
                    {idx < arr.length - 1 ? (
                      <span className={`text-sm font-bold font-data tabular-nums ${isGreen ? "text-success-400" : "text-danger-400"}`}>
                        {isGreen ? "↑" : "↓"} {Math.abs(rankDelta / 1000).toFixed(0)}k
                      </span>
                    ) : (
                      <span className="text-surface-600">—</span>
                    )}
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
