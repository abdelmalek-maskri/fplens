import { useState } from "react";

// ============================================================
// MOCK DATA - Top 10k ownership and template info
// Will be replaced with: GET /api/analytics/top10k?gw={gw}
// ============================================================
const mockTop10k = {
  gw: 24,
  avg_points: 62.3,
  avg_total: 1542,
  chips_played: { wildcard: 8.2, free_hit: 2.1, bench_boost: 1.8, triple_captain: 0.9 },
  template: [
    { web_name: "Raya", team: "ARS", position: "GK", value: 5.5, top10k_own: 42.5, overall_own: 18.2, delta: 24.3 },
    { web_name: "Alexander-Arnold", team: "LIV", position: "DEF", value: 7.1, top10k_own: 68.2, overall_own: 28.9, delta: 39.3 },
    { web_name: "Gabriel", team: "ARS", position: "DEF", value: 6.2, top10k_own: 55.1, overall_own: 31.2, delta: 23.9 },
    { web_name: "Saliba", team: "ARS", position: "DEF", value: 5.8, top10k_own: 48.8, overall_own: 22.5, delta: 26.3 },
    { web_name: "Salah", team: "LIV", position: "MID", value: 13.2, top10k_own: 92.4, overall_own: 52.1, delta: 40.3 },
    { web_name: "Palmer", team: "CHE", position: "MID", value: 9.5, top10k_own: 78.5, overall_own: 45.8, delta: 32.7 },
    { web_name: "Saka", team: "ARS", position: "MID", value: 10.1, top10k_own: 52.1, overall_own: 38.4, delta: 13.7 },
    { web_name: "Mbeumo", team: "BRE", position: "MID", value: 7.8, top10k_own: 45.2, overall_own: 19.5, delta: 25.7 },
    { web_name: "Haaland", team: "MCI", position: "FWD", value: 15.3, top10k_own: 88.1, overall_own: 85.2, delta: 2.9 },
    { web_name: "Isak", team: "NEW", position: "FWD", value: 8.8, top10k_own: 62.8, overall_own: 24.3, delta: 38.5 },
    { web_name: "Cunha", team: "WOL", position: "FWD", value: 7.2, top10k_own: 38.5, overall_own: 12.1, delta: 26.4 },
  ],
  captain_picks: [
    { web_name: "Haaland", captain_pct: 38.2 },
    { web_name: "Salah", captain_pct: 35.5 },
    { web_name: "Palmer", captain_pct: 12.8 },
    { web_name: "Isak", captain_pct: 8.2 },
    { web_name: "Other", captain_pct: 5.3 },
  ],
  trending_in: [
    { web_name: "Isak", team: "NEW", change: +12.5 },
    { web_name: "Cunha", team: "WOL", change: +9.8 },
    { web_name: "Gordon", team: "NEW", change: +7.2 },
  ],
  trending_out: [
    { web_name: "Watkins", team: "AVL", change: -18.2 },
    { web_name: "Saka", team: "ARS", change: -8.5 },
    { web_name: "Walker", team: "MCI", change: -6.1 },
  ],
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function TemplateTracker() {
  const [sortBy, setSortBy] = useState("top10k_own");

  const sorted = [...mockTop10k.template].sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-100">Top 10k Template</h1>
        <p className="text-surface-400 mt-1">
          GW{mockTop10k.gw} · What the best managers are doing — ownership, captains, and trends
        </p>
      </div>

      {/* Top 10k Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase">Avg GW Points</p>
          <p className="text-2xl font-bold text-brand-400 mt-1">{mockTop10k.avg_points}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase">Avg Total Points</p>
          <p className="text-2xl font-bold text-surface-100 mt-1">{mockTop10k.avg_total.toLocaleString()}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase">Most Popular Chip</p>
          <p className="text-2xl font-bold text-surface-100 mt-1">Wildcard</p>
          <p className="text-xs text-surface-500">{mockTop10k.chips_played.wildcard}% played this GW</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase">Top Captain</p>
          <p className="text-2xl font-bold text-surface-100 mt-1">{mockTop10k.captain_picks[0].web_name}</p>
          <p className="text-xs text-surface-500">{mockTop10k.captain_picks[0].captain_pct}% captaincy</p>
        </div>
      </div>

      {/* Captain Split + Trending */}
      <div className="grid grid-cols-3 gap-4">
        {/* Captain Split */}
        <div className="card p-5">
          <h3 className="text-lg font-bold text-surface-100 mb-3">Captain Split</h3>
          <div className="space-y-2">
            {mockTop10k.captain_picks.map((c, idx) => (
              <div key={c.web_name} className="flex items-center gap-2">
                <span className="text-sm text-surface-200 w-20 truncate">{c.web_name}</span>
                <div className="flex-1 h-3 bg-surface-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${idx === 0 ? "bg-brand-500" : idx === 1 ? "bg-brand-500/60" : "bg-surface-600"}`}
                    style={{ width: `${c.captain_pct}%` }} />
                </div>
                <span className={`text-xs font-bold w-10 text-right ${idx === 0 ? "text-brand-400" : "text-surface-400"}`}>
                  {c.captain_pct}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Trending In */}
        <div className="card p-5">
          <h3 className="text-lg font-bold text-surface-100 mb-3">
            <span className="text-success-400">Trending In</span> (Top 10k)
          </h3>
          <div className="space-y-3">
            {mockTop10k.trending_in.map(p => (
              <div key={p.web_name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-surface-100">{p.web_name}</span>
                  <span className="text-[10px] text-surface-500">{p.team}</span>
                </div>
                <span className="text-sm font-bold text-success-400">+{p.change}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trending Out */}
        <div className="card p-5">
          <h3 className="text-lg font-bold text-surface-100 mb-3">
            <span className="text-danger-400">Trending Out</span> (Top 10k)
          </h3>
          <div className="space-y-3">
            {mockTop10k.trending_out.map(p => (
              <div key={p.web_name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-surface-100">{p.web_name}</span>
                  <span className="text-[10px] text-surface-500">{p.team}</span>
                </div>
                <span className="text-sm font-bold text-danger-400">{p.change}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Template Table */}
      <div className="card overflow-hidden">
        <div className="p-3 border-b border-surface-800 flex items-center gap-3">
          <span className="text-xs text-surface-500">Sort by:</span>
          {[
            { id: "top10k_own", label: "Top 10k %" },
            { id: "delta", label: "Delta" },
            { id: "overall_own", label: "Overall %" },
            { id: "value", label: "Price" },
          ].map(opt => (
            <button key={opt.id} onClick={() => setSortBy(opt.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                sortBy === opt.id ? "bg-brand-600 text-white" : "bg-surface-800 text-surface-400"
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        <table className="w-full">
          <thead className="bg-surface-800/50">
            <tr>
              <th className="table-header text-left py-3 px-4">Player</th>
              <th className="table-header text-left py-3 px-4">Pos</th>
              <th className="table-header text-left py-3 px-4">Price</th>
              <th className="table-header text-left py-3 px-4">Top 10k Own%</th>
              <th className="table-header text-left py-3 px-4">Overall Own%</th>
              <th className="table-header text-left py-3 px-4">Delta</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => (
              <tr key={p.web_name} className="border-t border-surface-800 hover:bg-surface-800/30">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center text-[10px] font-bold text-surface-300">
                      {p.team}
                    </div>
                    <span className="text-sm font-medium text-surface-100">{p.web_name}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="badge bg-surface-700 text-surface-300">{p.position}</span>
                </td>
                <td className="py-3 px-4 text-surface-100 font-mono">£{p.value}m</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-surface-800 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${p.top10k_own}%` }} />
                    </div>
                    <span className="text-sm font-bold text-brand-400">{p.top10k_own}%</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-surface-800 rounded-full overflow-hidden">
                      <div className="h-full bg-surface-600 rounded-full" style={{ width: `${p.overall_own}%` }} />
                    </div>
                    <span className="text-sm text-surface-400">{p.overall_own}%</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-sm font-bold ${p.delta >= 25 ? "text-success-400" : p.delta >= 10 ? "text-surface-100" : "text-surface-400"}`}>
                    +{p.delta.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-surface-600 text-center">
        Data from top 10,000 ranked managers. Delta = Top 10k ownership − Overall ownership.
        High delta = the elite managers know something the crowd doesn't.
      </p>
    </div>
  );
}
