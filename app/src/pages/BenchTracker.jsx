import { useState, useMemo } from "react";

// ============================================================
// MOCK DATA - Bench points per GW (your team)
// Will be replaced with: GET /api/teams/my-team/bench-history
// ============================================================
const mockBenchHistory = [
  { gw: 18, bench: [
    { web_name: "Flekken", team: "BRE", position: "GK", points: 6, reason: "CS + 3 saves" },
    { web_name: "Dunk", team: "BHA", position: "DEF", points: 8, reason: "CS + goal" },
    { web_name: "Gross", team: "BHA", position: "MID", points: 2, reason: "Played 60+" },
  ], total_bench: 16, team_total: 52 },
  { gw: 19, bench: [
    { web_name: "Flekken", team: "BRE", position: "GK", points: 2, reason: "Played 60+" },
    { web_name: "Collins", team: "BRE", position: "DEF", points: 1, reason: "Came on late" },
    { web_name: "Mbeumo", team: "BRE", position: "MID", points: 12, reason: "Goal + assist!" },
  ], total_bench: 15, team_total: 48 },
  { gw: 20, bench: [
    { web_name: "Flekken", team: "BRE", position: "GK", points: 3, reason: "3 saves" },
    { web_name: "Dunk", team: "BHA", position: "DEF", points: 2, reason: "Played 60+" },
    { web_name: "Eze", team: "CRY", position: "MID", points: 5, reason: "Assist" },
  ], total_bench: 10, team_total: 65 },
  { gw: 21, bench: [
    { web_name: "Flekken", team: "BRE", position: "GK", points: 1, reason: "Played <60" },
    { web_name: "Collins", team: "BRE", position: "DEF", points: 6, reason: "CS" },
    { web_name: "Gross", team: "BHA", position: "MID", points: 3, reason: "Assist" },
  ], total_bench: 10, team_total: 71 },
  { gw: 22, bench: [
    { web_name: "Flekken", team: "BRE", position: "GK", points: 2, reason: "Played 60+" },
    { web_name: "Dunk", team: "BHA", position: "DEF", points: 1, reason: "Came on late" },
    { web_name: "Eze", team: "CRY", position: "MID", points: 8, reason: "Goal" },
  ], total_bench: 11, team_total: 55 },
  { gw: 23, bench: [
    { web_name: "Flekken", team: "BRE", position: "GK", points: 7, reason: "CS + penalty save!" },
    { web_name: "Collins", team: "BRE", position: "DEF", points: 6, reason: "CS" },
    { web_name: "Gross", team: "BHA", position: "MID", points: 1, reason: "Came on late" },
  ], total_bench: 14, team_total: 42 },
];

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function BenchTracker() {
  const totalBenchPts = mockBenchHistory.reduce((s, gw) => s + gw.total_bench, 0);
  const totalTeamPts = mockBenchHistory.reduce((s, gw) => s + gw.team_total, 0);
  const avgBench = totalBenchPts / mockBenchHistory.length;
  const worstGW = [...mockBenchHistory].sort((a, b) => b.total_bench - a.total_bench)[0];

  // Worst bench offender — player who left most on bench
  const playerBenchTotals = {};
  mockBenchHistory.forEach(gw => {
    gw.bench.forEach(p => {
      if (!playerBenchTotals[p.web_name]) playerBenchTotals[p.web_name] = { name: p.web_name, team: p.team, pts: 0, gws: 0 };
      playerBenchTotals[p.web_name].pts += p.points;
      playerBenchTotals[p.web_name].gws++;
    });
  });
  const benchOffenders = Object.values(playerBenchTotals).sort((a, b) => b.pts - a.pts);

  const maxBenchGW = Math.max(...mockBenchHistory.map(g => g.total_bench));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-100">Bench Tracker</h1>
        <p className="text-surface-400 mt-1">
          See how many points you're leaving on the bench every week
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase">Total Bench Points</p>
          <p className="text-2xl font-bold text-danger-400 mt-1">{totalBenchPts}</p>
          <p className="text-xs text-surface-500">Over {mockBenchHistory.length} GWs</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase">Avg / Gameweek</p>
          <p className="text-2xl font-bold text-warning-400 mt-1">{avgBench.toFixed(1)}</p>
          <p className="text-xs text-surface-500">pts wasted per week</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase">Worst GW</p>
          <p className="text-2xl font-bold text-surface-100 mt-1">GW{worstGW.gw}</p>
          <p className="text-xs text-danger-400">{worstGW.total_bench} pts left on bench</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-surface-500 uppercase">% of Total Points</p>
          <p className="text-2xl font-bold text-surface-100 mt-1">
            {(totalBenchPts / (totalTeamPts + totalBenchPts) * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-surface-500">of all points on bench</p>
        </div>
      </div>

      {/* Bench Points Bar Chart */}
      <div className="card p-5">
        <h3 className="text-lg font-bold text-surface-100 mb-1">Bench Points by Gameweek</h3>
        <p className="text-xs text-surface-500 mb-4">The red you want to minimize</p>
        <div className="flex items-end gap-2 h-40">
          {mockBenchHistory.map(gw => {
            const pct = (gw.total_bench / maxBenchGW) * 100;
            return (
              <div key={gw.gw} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-danger-400">{gw.total_bench}</span>
                <div className="w-full bg-surface-800 rounded-t relative" style={{ height: "100%" }}>
                  <div className="absolute bottom-0 w-full bg-danger-500/40 rounded-t transition-all"
                    style={{ height: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-surface-500">GW{gw.gw}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bench Offenders */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-lg font-bold text-surface-100 mb-1">Bench Offenders</h3>
          <p className="text-xs text-surface-500 mb-4">Players who scored the most while on your bench</p>
          <div className="space-y-3">
            {benchOffenders.slice(0, 5).map((p, idx) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className={`text-sm font-bold w-5 text-center ${idx === 0 ? "text-danger-400" : "text-surface-500"}`}>
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-surface-100">{p.name}</span>
                    <span className="text-[10px] text-surface-500">{p.team}</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-800 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-danger-500/50 rounded-full"
                      style={{ width: `${(p.pts / benchOffenders[0].pts) * 100}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-danger-400">{p.pts} pts</p>
                  <p className="text-[10px] text-surface-500">{p.gws} GWs benched</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Breakdown */}
        <div className="card p-5">
          <h3 className="text-lg font-bold text-surface-100 mb-1">Biggest Bench Hauls</h3>
          <p className="text-xs text-surface-500 mb-4">Individual performances you missed out on</p>
          <div className="space-y-2">
            {mockBenchHistory.flatMap(gw =>
              gw.bench.filter(p => p.points >= 6).map(p => ({ ...p, gw: gw.gw }))
            ).sort((a, b) => b.points - a.points).slice(0, 6).map((p, idx) => (
              <div key={`${p.gw}-${p.web_name}`} className="flex items-center justify-between py-1.5 border-b border-surface-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="badge bg-surface-700 text-surface-300 text-[10px]">GW{p.gw}</span>
                  <span className="text-sm text-surface-100 font-medium">{p.web_name}</span>
                  <span className="text-[10px] text-surface-500">{p.team}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-surface-400">{p.reason}</span>
                  <span className="text-sm font-bold text-danger-400">{p.points} pts</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-surface-600 text-center">
        Track bench points to improve your starting XI decisions. If a player consistently scores on bench, consider starting them.
      </p>
    </div>
  );
}
