import { useState } from "react";

// ============================================================
// MOCK DATA - Season wrapped / end-of-season summary
// Will be replaced with: GET /api/teams/my-team/wrapped
// ============================================================
const wrapped = {
  manager: "FPL Insights Demo",
  season: "2024/25",
  total_points: 1385,
  overall_rank: 125420,
  total_managers: 11200000,
  percentile: 98.9,
  gws_played: 23,

  // Highlights
  best_gw: { gw: 15, pts: 88, rank_gain: 85000 },
  worst_gw: { gw: 6, pts: 38, rank_loss: 200000 },
  longest_green_run: 5,
  green_arrows: 14,
  red_arrows: 8,

  // Captain
  captain_stats: {
    total_captain_pts: 312,
    avg_captain_pts: 13.6,
    best_pick: { name: "Haaland", gw: 5, pts: 30 },
    worst_pick: { name: "Palmer", gw: 12, pts: 2 },
    haaland_pct: 52,
    salah_pct: 26,
    other_pct: 22,
  },

  // Transfers
  transfer_stats: {
    total_transfers: 28,
    hits_taken: 3,
    total_hit_cost: 12,
    best_transfer: { in: "Palmer", out: "Sterling", net_gain: 42 },
    worst_transfer: { in: "Isak", out: "Haaland", net_loss: -28 },
    wildcard_gws: [8, 19],
  },

  // Squad
  squad_stats: {
    most_owned_duration: { name: "Haaland", gws: 23 },
    biggest_haul_player: { name: "Salah", pts: 214 },
    most_bench_pts: { name: "Wood", pts: 38 },
    total_bench_pts: 112,
    avg_team_value: 102.8,
    peak_team_value: 105.2,
  },

  // Position breakdown
  position_pts: {
    GK: { pts: 128, pct: 9 },
    DEF: { pts: 385, pct: 28 },
    MID: { pts: 542, pct: 39 },
    FWD: { pts: 330, pct: 24 },
  },

  // Top performers
  top_scorers: [
    { name: "Salah", pts: 214, position: "MID" },
    { name: "Haaland", pts: 198, position: "FWD" },
    { name: "Palmer", pts: 172, position: "MID" },
    { name: "Alexander-Arnold", pts: 118, position: "DEF" },
    { name: "Raya", pts: 98, position: "GK" },
  ],

  // Month-by-month
  monthly: [
    { month: "Aug", pts: 181, rank_end: 980000 },
    { month: "Sep", pts: 175, rank_end: 320000 },
    { month: "Oct", pts: 240, rank_end: 195000 },
    { month: "Nov", pts: 206, rank_end: 150000 },
    { month: "Dec", pts: 246, rank_end: 118000 },
    { month: "Jan", pts: 337, rank_end: 125420 },
  ],

  // Badges earned
  badges: [
    { icon: "🏆", title: "Top 2%", desc: "Better than 98% of managers" },
    { icon: "🎯", title: "Captain Genius", desc: "Avg captain pts > 12" },
    { icon: "📈", title: "Streak Master", desc: "5 green arrows in a row" },
    { icon: "💎", title: "Diamond Hands", desc: "Held Haaland all season" },
    { icon: "🧠", title: "Transfer Wizard", desc: "Best transfer net +42 pts" },
    { icon: "🔥", title: "GW Dominator", desc: "88 pts in a single GW" },
  ],
};

const POSITION_COLORS = {
  GK: "text-warning-400",
  DEF: "text-success-400",
  MID: "text-brand-400",
  FWD: "text-danger-400",
};

const POSITION_BG = {
  GK: "bg-warning-500/20",
  DEF: "bg-success-500/20",
  MID: "bg-brand-500/20",
  FWD: "bg-danger-500/20",
};

// ============================================================
// STAT CARD COMPONENT
// ============================================================
function StatCard({ label, value, sub, accent = "text-surface-100" }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-[10px] uppercase text-surface-500 tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-surface-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ============================================================
// DONUT CHART
// ============================================================
function DonutChart({ segments, size = 120 }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="mx-auto">
      {segments.map((seg, i) => {
        const dashLen = (seg.pct / 100) * circumference;
        const dashOffset = -offset;
        offset += dashLen;
        return (
          <circle key={i} cx="60" cy="60" r={radius} fill="none" stroke={seg.color}
            strokeWidth="12" strokeDasharray={`${dashLen} ${circumference - dashLen}`}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 60 60)" />
        );
      })}
      <text x="60" y="55" textAnchor="middle" className="fill-surface-100 text-lg font-bold">{wrapped.captain_stats.total_captain_pts}</text>
      <text x="60" y="70" textAnchor="middle" className="fill-surface-500 text-[9px]">Captain Pts</text>
    </svg>
  );
}

// ============================================================
// MONTHLY BAR CHART
// ============================================================
function MonthlyChart({ data }) {
  const maxPts = Math.max(...data.map(m => m.pts));

  return (
    <div className="flex items-end gap-2 h-32">
      {data.map(m => {
        const pct = (m.pts / maxPts) * 100;
        return (
          <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] text-surface-400 font-bold">{m.pts}</span>
            <div className="w-full rounded-t-md bg-brand-500/40 transition-all"
              style={{ height: `${pct}%` }} />
            <span className="text-[10px] text-surface-500">{m.month}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function FPLWrapped() {
  const [activeSection, setActiveSection] = useState("overview");

  const sections = [
    { id: "overview", label: "Overview" },
    { id: "captain", label: "Captain" },
    { id: "transfers", label: "Transfers" },
    { id: "squad", label: "Squad" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="card p-6 bg-gradient-to-br from-brand-600/20 via-surface-800 to-surface-900 border-brand-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-brand-400 uppercase tracking-widest mb-1">Season {wrapped.season}</p>
            <h1 className="text-3xl font-bold text-surface-100">Your FPL Wrapped</h1>
            <p className="text-surface-400 mt-2">
              A season in numbers — your highs, lows, and everything in between
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black text-brand-400">{wrapped.total_points}</p>
            <p className="text-sm text-surface-400">total points</p>
            <p className="text-xs text-surface-500 mt-1">
              Top <span className="text-success-400 font-bold">{wrapped.percentile}%</span> of {(wrapped.total_managers / 1000000).toFixed(1)}M managers
            </p>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-2">
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === s.id
                ? "bg-brand-600 text-white"
                : "bg-surface-800 text-surface-400 hover:text-surface-100"
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ==================== OVERVIEW ==================== */}
      {activeSection === "overview" && (
        <div className="space-y-6">
          {/* Key Numbers */}
          <div className="grid grid-cols-5 gap-4">
            <StatCard label="Final Rank" value={`${(wrapped.overall_rank / 1000).toFixed(1)}k`} accent="text-brand-400" />
            <StatCard label="Best GW" value={`${wrapped.best_gw.pts} pts`} sub={`GW${wrapped.best_gw.gw}`} accent="text-success-400" />
            <StatCard label="Worst GW" value={`${wrapped.worst_gw.pts} pts`} sub={`GW${wrapped.worst_gw.gw}`} accent="text-danger-400" />
            <StatCard label="Green Arrows" value={`${wrapped.green_arrows}/${wrapped.gws_played - 1}`} sub={`${wrapped.red_arrows} red`} accent="text-success-400" />
            <StatCard label="Best Streak" value={`${wrapped.longest_green_run} GWs`} sub="consecutive rises" accent="text-brand-400" />
          </div>

          {/* Monthly Breakdown */}
          <div className="card p-5">
            <h3 className="text-lg font-bold text-surface-100 mb-1">Monthly Points</h3>
            <p className="text-xs text-surface-500 mb-4">How you performed each month of the season</p>
            <MonthlyChart data={wrapped.monthly} />
          </div>

          {/* Top Scorers */}
          <div className="card p-5">
            <h3 className="text-lg font-bold text-surface-100 mb-4">Your Top Scorers</h3>
            <div className="space-y-3">
              {wrapped.top_scorers.map((p, i) => {
                const maxPts = wrapped.top_scorers[0].pts;
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-surface-500 w-5">{i + 1}</span>
                    <div className="flex items-center gap-2 w-40">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${POSITION_BG[p.position]} ${POSITION_COLORS[p.position]}`}>
                        {p.position}
                      </span>
                      <span className="text-sm font-medium text-surface-100">{p.name}</span>
                    </div>
                    <div className="flex-1 h-6 bg-surface-800 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500/40 rounded-full flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${(p.pts / maxPts) * 100}%` }}>
                        <span className="text-[10px] font-bold text-surface-100">{p.pts} pts</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Badges */}
          <div className="card p-5">
            <h3 className="text-lg font-bold text-surface-100 mb-4">Badges Earned</h3>
            <div className="grid grid-cols-3 gap-3">
              {wrapped.badges.map(b => (
                <div key={b.title} className="card p-4 text-center bg-surface-800/50 border-surface-700/50">
                  <span className="text-3xl">{b.icon}</span>
                  <p className="text-sm font-bold text-surface-100 mt-2">{b.title}</p>
                  <p className="text-[10px] text-surface-500 mt-0.5">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== CAPTAIN ==================== */}
      {activeSection === "captain" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total Captain Pts" value={wrapped.captain_stats.total_captain_pts} accent="text-brand-400" />
            <StatCard label="Avg Captain Pts" value={wrapped.captain_stats.avg_captain_pts} sub="per gameweek" accent="text-surface-100" />
            <StatCard label="Best Captain Pick" value={`${wrapped.captain_stats.best_pick.pts} pts`}
              sub={`${wrapped.captain_stats.best_pick.name} GW${wrapped.captain_stats.best_pick.gw}`} accent="text-success-400" />
          </div>

          {/* Captain Split Donut */}
          <div className="card p-5">
            <h3 className="text-lg font-bold text-surface-100 mb-4">Captain Distribution</h3>
            <div className="flex items-center justify-center gap-12">
              <DonutChart segments={[
                { pct: wrapped.captain_stats.haaland_pct, color: "#60A5FA" },
                { pct: wrapped.captain_stats.salah_pct, color: "#F87171" },
                { pct: wrapped.captain_stats.other_pct, color: "#6B7280" },
              ]} />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-400" />
                  <span className="text-sm text-surface-300">Haaland — {wrapped.captain_stats.haaland_pct}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="text-sm text-surface-300">Salah — {wrapped.captain_stats.salah_pct}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-gray-500" />
                  <span className="text-sm text-surface-300">Others — {wrapped.captain_stats.other_pct}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Worst Captain */}
          <div className="card p-4 border-danger-500/20 bg-danger-500/[0.03]">
            <div className="flex items-center gap-3">
              <span className="text-2xl">😬</span>
              <div>
                <p className="text-sm font-bold text-surface-100">Worst Captain Call</p>
                <p className="text-xs text-surface-400">
                  {wrapped.captain_stats.worst_pick.name} in GW{wrapped.captain_stats.worst_pick.gw} — only {wrapped.captain_stats.worst_pick.pts} pts (doubled)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TRANSFERS ==================== */}
      {activeSection === "transfers" && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total Transfers" value={wrapped.transfer_stats.total_transfers} accent="text-surface-100" />
            <StatCard label="Hits Taken" value={wrapped.transfer_stats.hits_taken} sub={`-${wrapped.transfer_stats.total_hit_cost} pts`} accent="text-warning-400" />
            <StatCard label="Wildcards Used" value={wrapped.transfer_stats.wildcard_gws.length}
              sub={`GW${wrapped.transfer_stats.wildcard_gws.join(", GW")}`} accent="text-brand-400" />
            <StatCard label="Hit Cost" value={`-${wrapped.transfer_stats.total_hit_cost}`} sub="total points lost" accent="text-danger-400" />
          </div>

          {/* Best Transfer */}
          <div className="card p-5 border-success-500/20 bg-success-500/[0.03]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏆</span>
                <div>
                  <p className="text-sm font-bold text-surface-100">Best Transfer of the Season</p>
                  <p className="text-xs text-surface-400">
                    {wrapped.transfer_stats.best_transfer.out} → {wrapped.transfer_stats.best_transfer.in}
                  </p>
                </div>
              </div>
              <span className="text-xl font-black text-success-400">+{wrapped.transfer_stats.best_transfer.net_gain} pts</span>
            </div>
          </div>

          {/* Worst Transfer */}
          <div className="card p-5 border-danger-500/20 bg-danger-500/[0.03]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💀</span>
                <div>
                  <p className="text-sm font-bold text-surface-100">Worst Transfer of the Season</p>
                  <p className="text-xs text-surface-400">
                    {wrapped.transfer_stats.worst_transfer.out} → {wrapped.transfer_stats.worst_transfer.in}
                  </p>
                </div>
              </div>
              <span className="text-xl font-black text-danger-400">{wrapped.transfer_stats.worst_transfer.net_loss} pts</span>
            </div>
          </div>

          {/* Transfer Efficiency */}
          <div className="card p-5">
            <h3 className="text-lg font-bold text-surface-100 mb-3">Transfer Efficiency</h3>
            <p className="text-sm text-surface-400">
              You made <span className="text-surface-100 font-bold">{wrapped.transfer_stats.total_transfers}</span> transfers
              across {wrapped.gws_played} gameweeks, averaging{" "}
              <span className="text-surface-100 font-bold">
                {(wrapped.transfer_stats.total_transfers / wrapped.gws_played).toFixed(1)}
              </span>{" "}
              per GW. You took {wrapped.transfer_stats.hits_taken} hits costing you {wrapped.transfer_stats.total_hit_cost} points.
            </p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex-1 h-3 bg-surface-800 rounded-full overflow-hidden">
                <div className="h-full bg-success-500/60 rounded-full"
                  style={{ width: `${((wrapped.transfer_stats.total_transfers - wrapped.transfer_stats.hits_taken) / wrapped.transfer_stats.total_transfers) * 100}%` }} />
              </div>
              <span className="text-xs text-surface-400">
                {(((wrapped.transfer_stats.total_transfers - wrapped.transfer_stats.hits_taken) / wrapped.transfer_stats.total_transfers) * 100).toFixed(0)}% free transfers
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SQUAD ==================== */}
      {activeSection === "squad" && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Peak Squad Value" value={`£${wrapped.squad_stats.peak_team_value}m`} accent="text-brand-400" />
            <StatCard label="Avg Squad Value" value={`£${wrapped.squad_stats.avg_team_value}m`} accent="text-surface-100" />
            <StatCard label="Bench Points Lost" value={wrapped.squad_stats.total_bench_pts} sub="left on bench" accent="text-warning-400" />
            <StatCard label="Most Benched" value={wrapped.squad_stats.most_bench_pts.name}
              sub={`${wrapped.squad_stats.most_bench_pts.pts} pts wasted`} accent="text-danger-400" />
          </div>

          {/* Position Breakdown */}
          <div className="card p-5">
            <h3 className="text-lg font-bold text-surface-100 mb-4">Points by Position</h3>
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(wrapped.position_pts).map(([pos, data]) => (
                <div key={pos} className="text-center">
                  <div className="relative w-20 h-20 mx-auto">
                    <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="#1E293B" strokeWidth="6" />
                      <circle cx="40" cy="40" r="34" fill="none"
                        stroke={pos === "GK" ? "#FBBF24" : pos === "DEF" ? "#4ADE80" : pos === "MID" ? "#A78BFA" : "#F87171"}
                        strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={`${(data.pct / 100) * 213.6} 213.6`} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-surface-100">
                      {data.pct}%
                    </span>
                  </div>
                  <p className={`text-sm font-bold mt-2 ${POSITION_COLORS[pos]}`}>{pos}</p>
                  <p className="text-xs text-surface-500">{data.pts} pts</p>
                </div>
              ))}
            </div>
          </div>

          {/* Loyalty Award */}
          <div className="card p-5 border-brand-500/20 bg-brand-500/[0.03]">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💎</span>
              <div>
                <p className="text-sm font-bold text-surface-100">Loyalty Award</p>
                <p className="text-xs text-surface-400">
                  You held <span className="text-brand-400 font-bold">{wrapped.squad_stats.most_owned_duration.name}</span> for
                  all {wrapped.squad_stats.most_owned_duration.gws} gameweeks — true diamond hands.
                </p>
              </div>
            </div>
          </div>

          {/* MVP */}
          <div className="card p-5 border-success-500/20 bg-success-500/[0.03]">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <p className="text-sm font-bold text-surface-100">Season MVP</p>
                <p className="text-xs text-surface-400">
                  <span className="text-success-400 font-bold">{wrapped.squad_stats.biggest_haul_player.name}</span> was your
                  highest scorer with {wrapped.squad_stats.biggest_haul_player.pts} points.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-surface-600 text-center">
        Your FPL Wrapped — generated from your linked FPL account data for the {wrapped.season} season.
      </p>
    </div>
  );
}
