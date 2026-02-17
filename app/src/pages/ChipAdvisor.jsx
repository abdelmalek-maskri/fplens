import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FDR_COLORS } from "../lib/constants";
import TeamBadge from "../components/TeamBadge";
import { useChips } from "../hooks";
import { SkeletonTable } from "../components/skeletons";
import ErrorState from "../components/ErrorState";

// ============================================================
// CHIP RECOMMENDATION LOGIC
// ============================================================
function computeRecommendations(gameweeks, chipsAvailable) {
  const recs = {};

  if (chipsAvailable.triple_captain) {
    // TC: GW with highest single-player predicted + easy fixture
    const best = [...gameweeks].sort((a, b) => {
      const scoreA = a.best_captain.predicted * (6 - a.best_captain.fdr);
      const scoreB = b.best_captain.predicted * (6 - b.best_captain.fdr);
      return scoreB - scoreA;
    })[0];
    recs.triple_captain = {
      gw: best.gw,
      score: best.best_captain.predicted,
      extra_points: best.best_captain.predicted, // ×3 instead of ×2 = +1× captain pts
      reason: `${best.best_captain.web_name} predicted ${best.best_captain.predicted.toFixed(1)} pts vs ${best.best_captain.opponent} (FDR ${best.best_captain.fdr})`,
      player: best.best_captain,
    };
  }

  if (chipsAvailable.bench_boost) {
    // BB: GW with highest total bench predicted
    const best = [...gameweeks].sort((a, b) => b.bench_total - a.bench_total)[0];
    recs.bench_boost = {
      gw: best.gw,
      score: best.bench_total,
      extra_points: best.bench_total,
      reason: `Bench total ${best.bench_total.toFixed(1)} pts — ${best.bench_players.map((p) => `${p.web_name} (${p.predicted.toFixed(1)})`).join(", ")}`,
      bench: best.bench_players,
    };
  }

  if (chipsAvailable.free_hit) {
    // FH: GW with worst fixture congestion / lowest team total
    const worst = [...gameweeks].sort((a, b) => {
      const scoreA = a.team_avg_fdr + a.injured_count * 0.5;
      const scoreB = b.team_avg_fdr + b.injured_count * 0.5;
      return scoreB - scoreA;
    })[0];
    recs.free_hit = {
      gw: worst.gw,
      score: worst.team_total,
      extra_points: null,
      reason: `Avg FDR ${worst.team_avg_fdr.toFixed(1)}, ${worst.hard_fixtures} hard fixtures${worst.injured_count > 0 ? `, ${worst.injured_count} injured` : ""}`,
    };
  }

  if (chipsAvailable.wildcard) {
    // WC: When team value dropping or squad needs restructure
    // Heuristic: GW before a long run of easy fixtures
    const easiestRun = gameweeks
      .map((gw, i) => {
        const run = gameweeks.slice(i, i + 3);
        const avgFdr = run.reduce((s, g) => s + g.team_avg_fdr, 0) / run.length;
        const avgTotal = run.reduce((s, g) => s + g.team_total, 0) / run.length;
        return { gw: gw.gw, avgFdr, avgTotal, runLength: run.length };
      })
      .sort((a, b) => a.avgFdr - b.avgFdr)[0];

    recs.wildcard = {
      gw: easiestRun.gw,
      score: easiestRun.avgTotal,
      extra_points: null,
      reason: `Easy fixture run starts — avg FDR ${easiestRun.avgFdr.toFixed(1)} over next ${easiestRun.runLength} GWs`,
    };
  }

  return recs;
}

// ============================================================
// CHIP ADVISOR PAGE
// ============================================================
export default function ChipAdvisor() {
  const navigate = useNavigate();
  const { data: chipData, isLoading, error } = useChips();
  const [chipsAvailable, setChipsAvailable] = useState(null);
  const [expandedChip, setExpandedChip] = useState(null);

  const CURRENT_GW = chipData ? chipData.currentGw : 0;
  const mockGameweeks = chipData ? chipData.gameweeks : [];
  const mockChipsAvailable = chipData ? chipData.chipsAvailable : {};
  const CHIP_META = chipData ? chipData.chipMeta : {};

  // Initialize chipsAvailable from hook data when it first arrives
  const effectiveChipsAvailable = chipsAvailable ?? mockChipsAvailable;

  const recommendations = useMemo(
    () =>
      mockGameweeks.length > 0
        ? computeRecommendations(mockGameweeks, effectiveChipsAvailable)
        : {},
    [mockGameweeks, effectiveChipsAvailable]
  );

  const toggleChip = (chipKey) => {
    setChipsAvailable((prev) => {
      const current = prev ?? mockChipsAvailable;
      return { ...current, [chipKey]: !current[chipKey] };
    });
  };

  // Map GW → which chips are recommended for it
  const gwChipMap = useMemo(() => {
    const map = {};
    for (const [chip, rec] of Object.entries(recommendations)) {
      if (!map[rec.gw]) map[rec.gw] = [];
      map[rec.gw].push(chip);
    }
    return map;
  }, [recommendations]);

  if (isLoading)
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-8 w-24 rounded" />
          ))}
        </div>
        <SkeletonTable rows={7} cols={7} />
      </div>
    );

  if (error) return <ErrorState message="Failed to load chip data." />;

  if (!chipData) return null;

  return (
    <div className="space-y-6 stagger">
      {/* Chip toggles — mark which chips you still have */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-surface-500">Available:</span>
        {Object.entries(CHIP_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => toggleChip(key)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
              effectiveChipsAvailable[key]
                ? `${meta.bg} ${meta.color} ${meta.border}`
                : "bg-surface-800/50 text-surface-600 border-surface-700 line-through"
            }`}
          >
            {meta.name}
          </button>
        ))}
      </div>

      {/* GW Timeline */}
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-max py-2">
          {mockGameweeks.map((gw) => {
            const chips = gwChipMap[gw.gw] || [];
            const isCurrentGw = gw.gw === CURRENT_GW;
            return (
              <div
                key={gw.gw}
                className={`flex flex-col items-center gap-2 px-4 py-3 rounded-md border transition-colors min-w-[90px] ${
                  chips.length > 0
                    ? "border-brand-500/30 bg-brand-500/5"
                    : "border-surface-700 bg-surface-800/30"
                }`}
              >
                <span
                  className={`text-xs font-medium ${isCurrentGw ? "text-brand-400" : "text-surface-400"}`}
                >
                  GW{gw.gw}
                  {isCurrentGw && <span className="text-2xs text-surface-500 ml-1">now</span>}
                </span>
                <span className="text-lg font-bold text-surface-100 font-data tabular-nums">
                  {gw.team_total.toFixed(0)}
                </span>
                <span className="text-2xs text-surface-500">predicted</span>

                {/* FDR indicator */}
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`w-1.5 h-1.5 rounded-full ${
                        gw.team_avg_fdr >= level
                          ? level <= 2
                            ? "bg-success-500"
                            : level <= 3
                              ? "bg-surface-400"
                              : "bg-danger-500"
                          : "bg-surface-700"
                      }`}
                    />
                  ))}
                </div>

                {/* Chip badges */}
                {chips.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {chips.map((chip) => (
                      <span
                        key={chip}
                        className={`text-2xs font-bold px-1.5 py-0.5 rounded ${CHIP_META[chip].bg} ${CHIP_META[chip].color}`}
                      >
                        {CHIP_META[chip].short}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chip Recommendations */}
      <div className="space-y-3">
        {Object.entries(recommendations).map(([chipKey, rec]) => {
          const meta = CHIP_META[chipKey];
          const isExpanded = expandedChip === chipKey;
          const gw = mockGameweeks.find((g) => g.gw === rec.gw);
          return (
            <div
              key={chipKey}
              className={`border rounded-md transition-colors ${meta.border} ${isExpanded ? meta.bg : "bg-surface-800/30"}`}
            >
              {/* Header — always visible */}
              <button
                onClick={() => setExpandedChip(isExpanded ? null : chipKey)}
                className="w-full flex items-center gap-4 px-4 py-3 text-left"
              >
                <span className={`text-sm font-bold px-2 py-0.5 rounded ${meta.bg} ${meta.color}`}>
                  {meta.short}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-surface-100">{meta.name}</span>
                    <span className="text-xs text-surface-500">→ GW{rec.gw}</span>
                  </div>
                  <p className="text-xs text-surface-400 truncate">{rec.reason}</p>
                </div>
                {rec.extra_points && (
                  <div className="text-right shrink-0">
                    <span className={`text-sm font-bold font-data tabular-nums ${meta.color}`}>
                      +{rec.extra_points.toFixed(1)}
                    </span>
                    <span className="text-2xs text-surface-500 ml-1">pts</span>
                  </div>
                )}
                <svg
                  className={`w-4 h-4 text-surface-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Expanded detail */}
              {isExpanded && gw && (
                <div className="px-4 pb-4 space-y-3 border-t border-surface-700/50">
                  <p className="text-xs text-surface-500 pt-3">{meta.description}</p>

                  {/* Triple Captain detail */}
                  {chipKey === "triple_captain" && rec.player && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 py-2">
                        <TeamBadge team={rec.player.team} />
                        <div>
                          <p
                            className="text-sm font-medium text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
                            onClick={() => navigate(`/player/${rec.player.element}`)}
                          >
                            {rec.player.web_name}
                          </p>
                          <p className="text-xs text-surface-500">vs {rec.player.opponent}</p>
                        </div>
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded text-2xs font-bold ${FDR_COLORS[rec.player.fdr].bg} ${FDR_COLORS[rec.player.fdr].text}`}
                        >
                          {rec.player.fdr}
                        </span>
                        <div className="ml-auto text-right">
                          <p className="text-sm font-bold text-surface-100 font-data tabular-nums">
                            {rec.player.predicted.toFixed(1)} pts
                          </p>
                          <p className="text-xs text-surface-500">
                            ×3 ={" "}
                            <span className={`font-semibold ${meta.color}`}>
                              {(rec.player.predicted * 3).toFixed(1)}
                            </span>
                          </p>
                        </div>
                      </div>
                      {/* Compare with runner-up */}
                      {gw.second_captain && (
                        <div className="flex items-center gap-3 py-1.5 opacity-60">
                          <TeamBadge team={gw.second_captain.team} size="sm" />
                          <span className="text-xs text-surface-400">
                            {gw.second_captain.web_name}
                          </span>
                          <span className="text-xs text-surface-500">
                            vs {gw.second_captain.opponent}
                          </span>
                          <span className="text-xs text-surface-500 ml-auto font-data tabular-nums">
                            {gw.second_captain.predicted.toFixed(1)} pts (×3 ={" "}
                            {(gw.second_captain.predicted * 3).toFixed(1)})
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bench Boost detail */}
                  {chipKey === "bench_boost" && rec.bench && (
                    <div className="space-y-1">
                      {rec.bench.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <TeamBadge team={p.team} size="sm" />
                            <span className="text-sm text-surface-300">{p.web_name}</span>
                          </div>
                          <span className="text-sm text-surface-100 font-data tabular-nums">
                            {p.predicted.toFixed(1)} pts
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-2 border-t border-surface-700/50">
                        <span className="text-xs text-surface-500">Bench total</span>
                        <span className={`text-sm font-bold font-data tabular-nums ${meta.color}`}>
                          +{rec.score.toFixed(1)} pts
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Free Hit detail */}
                  {chipKey === "free_hit" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-xs text-surface-500">Avg FDR</span>
                          <p className="text-lg font-bold text-danger-400 font-data tabular-nums">
                            {gw.team_avg_fdr.toFixed(1)}
                          </p>
                        </div>
                        <div className="w-px h-8 bg-surface-700" />
                        <div>
                          <span className="text-xs text-surface-500">Hard fixtures</span>
                          <p className="text-lg font-bold text-surface-100 font-data tabular-nums">
                            {gw.hard_fixtures}
                          </p>
                        </div>
                        <div className="w-px h-8 bg-surface-700" />
                        <div>
                          <span className="text-xs text-surface-500">Team total</span>
                          <p className="text-lg font-bold text-surface-100 font-data tabular-nums">
                            {gw.team_total.toFixed(0)}
                          </p>
                        </div>
                        {gw.injured_count > 0 && (
                          <>
                            <div className="w-px h-8 bg-surface-700" />
                            <div>
                              <span className="text-xs text-surface-500">Injured</span>
                              <p className="text-lg font-bold text-danger-400 font-data tabular-nums">
                                {gw.injured_count}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-surface-400">
                        Use Free Hit to pick an optimal squad just for this GW, avoiding your tough
                        fixtures.
                      </p>
                    </div>
                  )}

                  {/* Wildcard detail */}
                  {chipKey === "wildcard" && (
                    <div className="space-y-2">
                      <p className="text-xs text-surface-400">
                        Restructure your squad before this easy fixture run to maximize points over
                        multiple gameweeks.
                      </p>
                      <div className="flex gap-2">
                        {mockGameweeks
                          .filter((g) => g.gw >= rec.gw && g.gw < rec.gw + 4)
                          .map((g) => (
                            <div
                              key={g.gw}
                              className="flex flex-col items-center gap-1 px-3 py-2 rounded bg-surface-800/50 border border-surface-700/50"
                            >
                              <span className="text-xs text-surface-400">GW{g.gw}</span>
                              <span className="text-sm font-bold text-surface-100 font-data tabular-nums">
                                {g.team_total.toFixed(0)}
                              </span>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((level) => (
                                  <div
                                    key={level}
                                    className={`w-1 h-1 rounded-full ${
                                      g.team_avg_fdr >= level
                                        ? level <= 2
                                          ? "bg-success-500"
                                          : level <= 3
                                            ? "bg-surface-400"
                                            : "bg-danger-500"
                                        : "bg-surface-700"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* GW Detail Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700">
              <th scope="col" className="table-header text-left py-2.5 px-3">
                GW
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Best Captain
              </th>
              <th scope="col" className="table-header text-center py-2.5 px-3">
                TC Value
              </th>
              <th scope="col" className="table-header text-center py-2.5 px-3">
                BB Value
              </th>
              <th scope="col" className="table-header text-center py-2.5 px-3">
                Avg FDR
              </th>
              <th scope="col" className="table-header text-center py-2.5 px-3">
                Team Pts
              </th>
              <th scope="col" className="table-header text-center py-2.5 px-3">
                Chips
              </th>
            </tr>
          </thead>
          <tbody>
            {mockGameweeks.map((gw) => {
              const chips = gwChipMap[gw.gw] || [];
              const isCurrentGw = gw.gw === CURRENT_GW;
              return (
                <tr
                  key={gw.gw}
                  className={`border-t border-surface-800/60 hover:bg-surface-800/40 transition-colors ${
                    isCurrentGw ? "bg-brand-500/5" : ""
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-sm font-medium ${isCurrentGw ? "text-brand-400" : "text-surface-100"}`}
                    >
                      GW{gw.gw}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <TeamBadge team={gw.best_captain.team} size="sm" />
                      <span
                        className="text-sm text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
                        onClick={() => navigate(`/player/${gw.best_captain.element}`)}
                      >
                        {gw.best_captain.web_name}
                      </span>
                      <span className="text-xs text-surface-500">
                        vs {gw.best_captain.opponent}
                      </span>
                      <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded text-2xs font-bold ${FDR_COLORS[gw.best_captain.fdr].bg} ${FDR_COLORS[gw.best_captain.fdr].text}`}
                      >
                        {gw.best_captain.fdr}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`text-sm font-data tabular-nums ${gw.best_captain.predicted >= 7 ? "text-warning-400 font-bold" : "text-surface-300"}`}
                    >
                      {gw.best_captain.predicted.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`text-sm font-data tabular-nums ${gw.bench_total >= 13 ? "text-brand-400 font-bold" : "text-surface-300"}`}
                    >
                      {gw.bench_total.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`text-sm font-data tabular-nums ${gw.team_avg_fdr >= 3.5 ? "text-danger-400" : gw.team_avg_fdr <= 2.5 ? "text-success-400" : "text-surface-300"}`}
                    >
                      {gw.team_avg_fdr.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-sm font-bold text-surface-100 font-data tabular-nums">
                      {gw.team_total.toFixed(0)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {chips.length > 0 ? (
                      <div className="flex justify-center gap-1">
                        {chips.map((chip) => (
                          <span
                            key={chip}
                            className={`text-2xs font-bold px-1.5 py-0.5 rounded ${CHIP_META[chip].bg} ${CHIP_META[chip].color}`}
                          >
                            {CHIP_META[chip].short}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-surface-700">—</span>
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
