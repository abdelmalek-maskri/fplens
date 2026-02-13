import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FDR_COLORS, POSITION_COLORS } from "../lib/constants";
import TeamBadge from "../components/TeamBadge";
import TabBar from "../components/TabBar";
import RadarChart from "../components/RadarChart";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import { SkeletonCard } from "../components/skeletons";
import { usePlayerPool, STATUS_CONFIG } from "../hooks";

// ============================================================
// SUB-COMPONENTS
// ============================================================

/** Searchable player selector dropdown */
function PlayerSelector({ selected, onChange, label, excludeId, allPlayers }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allPlayers
      .filter((p) => p.id !== excludeId)
      .filter(
        (p) =>
          !q ||
          p.web_name.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q)
      );
  }, [search, excludeId, allPlayers]);

  const selectedPlayer = allPlayers.find((p) => p.id === selected);

  return (
    <div className="relative">
      <p className="section-label mb-2">
        {label}
      </p>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-surface-800 border border-surface-700 rounded-md px-4 py-3 text-left hover:border-surface-600 transition-colors"
      >
        {selectedPlayer ? (
          <div className="flex items-center gap-3">
            <TeamBadge team={selectedPlayer.team} />
            <div>
              <p className="text-sm font-medium text-surface-100">
                {selectedPlayer.web_name}
              </p>
              <p className="text-xs text-surface-500">
                <span className={POSITION_COLORS[selectedPlayer.position]}>{selectedPlayer.position}</span> · £{selectedPlayer.value}m
              </p>
            </div>
          </div>
        ) : (
          <span className="text-surface-500 text-sm">Select a player...</span>
        )}
        <svg
          className={`w-4 h-4 text-surface-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface-800 border border-surface-700 rounded-md max-h-72 overflow-hidden">
          <div className="p-2 border-b border-surface-700">
            <input
              type="text"
              placeholder="Search name, team, position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-900 border border-surface-700 rounded px-3 py-1.5 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-brand-500"
              autoFocus
            />
          </div>
          <ul className="overflow-y-auto max-h-56">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-700/50 transition-colors ${
                    p.id === selected ? "bg-brand-600/20" : ""
                  }`}
                >
                  <TeamBadge team={p.team} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-100 truncate">{p.web_name}</p>
                    <p className="text-xs text-surface-500">
                      <span className={POSITION_COLORS[p.position]}>{p.position}</span> · £{p.value}m · {p.predicted_points.toFixed(1)} pts
                    </p>
                  </div>
                  <span className={`text-xs font-medium ${STATUS_CONFIG[p.status]?.cls || "text-surface-400"}`}>
                    {STATUS_CONFIG[p.status]?.label}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-center text-surface-500 text-sm">
                No players found
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Comparison bar showing who is better */
function ComparisonBar({ label, valueA, valueB, format, higherIsBetter = true, suffix = "" }) {
  const a = typeof valueA === "number" ? valueA : 0;
  const b = typeof valueB === "number" ? valueB : 0;
  const max = Math.max(a, b, 0.01);
  const pctA = (a / max) * 100;
  const pctB = (b / max) * 100;

  const aWins = higherIsBetter ? a > b : a < b;
  const bWins = higherIsBetter ? b > a : b < a;
  const tie = a === b;

  const formatVal = (v) => {
    if (format === "price") return `£${v}m`;
    if (format === "pct") return `${v}%`;
    if (format === "int") return Math.round(v).toLocaleString();
    return typeof v === "number" ? v.toFixed(1) : v;
  };

  return (
    <div className="py-2.5 border-b border-surface-800/50 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`text-sm font-semibold tabular-nums ${
            aWins ? "text-brand-400" : tie ? "text-surface-200" : "text-surface-400"
          }`}
        >
          {formatVal(valueA)}{suffix}
        </span>
        <span className="section-label">{label}</span>
        <span
          className={`text-sm font-semibold tabular-nums ${
            bWins ? "text-brand-400" : tie ? "text-surface-200" : "text-surface-400"
          }`}
        >
          {formatVal(valueB)}{suffix}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {/* Left bar (Player A) — grows from right to left */}
        <div className="flex-1 flex justify-end">
          <div
            className={`h-2 rounded-l transition-all duration-500 ${
              aWins ? "bg-brand-500" : "bg-surface-700"
            }`}
            style={{ width: `${pctA}%` }}
          />
        </div>
        {/* Divider */}
        <div className="w-px h-4 bg-surface-600" />
        {/* Right bar (Player B) — grows from left to right */}
        <div className="flex-1">
          <div
            className={`h-2 rounded-r transition-all duration-500 ${
              bWins ? "bg-brand-500" : "bg-surface-700"
            }`}
            style={{ width: `${pctB}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function PlayerComparison() {
  const navigate = useNavigate();
  const { data: poolData, isLoading, error } = usePlayerPool();
  const [playerA, setPlayerA] = useState(2); // Haaland default
  const [playerB, setPlayerB] = useState(50); // Isak default
  const [viewMode, setViewMode] = useState("bars");

  if (isLoading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
        <SkeletonCard lines={3} />
        <div />
        <SkeletonCard lines={3} />
      </div>
    </div>
  );
  if (error) return <ErrorState message="Failed to load player data." />;
  if (!poolData) return null;
  const allPlayers = poolData.players;

  const a = allPlayers.find((p) => p.id === playerA);
  const b = allPlayers.find((p) => p.id === playerB);

  // Quick swap
  const handleSwap = () => {
    setPlayerA(playerB);
    setPlayerB(playerA);
  };

  // Value metrics (points per million)
  const valA = a ? (a.predicted_points / a.value).toFixed(2) : 0;
  const valB = b ? (b.predicted_points / b.value).toFixed(2) : 0;

  // Determine winner count
  const metrics = a && b ? [
    { better: a.predicted_points > b.predicted_points ? "a" : a.predicted_points < b.predicted_points ? "b" : "tie" },
    { better: a.form > b.form ? "a" : a.form < b.form ? "b" : "tie" },
    { better: a.total_points > b.total_points ? "a" : a.total_points < b.total_points ? "b" : "tie" },
    { better: parseFloat(valA) > parseFloat(valB) ? "a" : parseFloat(valA) < parseFloat(valB) ? "b" : "tie" },
    { better: a.opponent_fdr < b.opponent_fdr ? "a" : a.opponent_fdr > b.opponent_fdr ? "b" : "tie" },
    { better: a.xG > b.xG ? "a" : a.xG < b.xG ? "b" : "tie" },
    { better: a.xA > b.xA ? "a" : a.xA < b.xA ? "b" : "tie" },
  ] : [];

  const winsA = metrics.filter((m) => m.better === "a").length;
  const winsB = metrics.filter((m) => m.better === "b").length;

  return (
    <div className="space-y-6 stagger">
      {/* Player Selectors */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
        <PlayerSelector
          selected={playerA}
          onChange={setPlayerA}
          label="Player A"
          excludeId={playerB}
          allPlayers={allPlayers}
        />
        <button
          onClick={handleSwap}
          className="mb-1 p-2 rounded-md bg-surface-800 border border-surface-700 hover:border-brand-500 transition-colors"
          title="Swap players"
        >
          <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </button>
        <PlayerSelector
          selected={playerB}
          onChange={setPlayerB}
          label="Player B"
          excludeId={playerA}
          allPlayers={allPlayers}
        />
      </div>

      {a && b ? (
        <>
          {/* Player Cards Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[a, b].map((p, idx) => {
              const isWinner = idx === 0 ? winsA > winsB : winsB > winsA;
              return (
                <div
                  key={p.id}
                  className={`${isWinner ? "ring-1 ring-brand-500/50" : ""}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <TeamBadge team={p.team} size="lg" />
                      <div>
                        <p className="text-lg font-bold text-surface-100 hover:text-brand-400 transition-colors cursor-pointer" onClick={() => navigate(`/player/${p.id}`)}>{p.web_name}</p>
                        <p className="text-sm text-surface-500">
                          {p.name} · <span className={POSITION_COLORS[p.position]}>{p.position}</span>
                        </p>
                      </div>
                    </div>
                    {isWinner && (
                      <span className="badge bg-brand-500/20 text-brand-400">
                        Favoured
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
                    <div>
                      <span className="text-xl font-bold text-surface-100">{p.predicted_points.toFixed(1)}</span>
                      <span className="text-xs text-surface-500 ml-1.5">predicted</span>
                    </div>
                    <div className="w-px h-5 bg-surface-700" />
                    <div>
                      <span className="text-xl font-bold text-surface-100">£{p.value}m</span>
                      <span className="text-xs text-surface-500 ml-1.5">price</span>
                    </div>
                    <div className="w-px h-5 bg-surface-700" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-bold text-surface-100">{p.opponent}</span>
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded text-2xs font-bold ${
                          FDR_COLORS[p.opponent_fdr]?.bg
                        } ${FDR_COLORS[p.opponent_fdr]?.text}`}
                      >
                        {p.opponent_fdr}
                      </span>
                      <span className="text-xs text-surface-500 ml-0.5">fixture</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className={`text-xs font-medium ${STATUS_CONFIG[p.status]?.cls}`}>
                      {STATUS_CONFIG[p.status]?.label}
                    </span>
                    <span className="text-xs text-surface-600">·</span>
                    <span className="text-xs text-surface-500">
                      Owned by {p.selected_by_percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Verdict Banner */}
          <div className="flex items-center justify-between border-t border-b border-surface-800 py-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${winsA > winsB ? "bg-brand-500" : winsB > winsA ? "bg-brand-500" : "bg-surface-500"}`} />
              <div>
                <p className="text-sm font-semibold text-surface-100">
                  {winsA > winsB
                    ? `${a.web_name} wins ${winsA} of 7 key metrics`
                    : winsB > winsA
                    ? `${b.web_name} wins ${winsB} of 7 key metrics`
                    : "Dead heat across key metrics"
                  }
                </p>
                <p className="text-xs text-surface-500 mt-0.5">
                  Based on predicted points, form, season total, value, fixture difficulty, xG, and xA
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className={winsA >= winsB ? "text-brand-400" : "text-surface-500"}>
                {winsA}
              </span>
              <span className="text-surface-600">–</span>
              <span className={winsB >= winsA ? "text-brand-400" : "text-surface-500"}>
                {winsB}
              </span>
            </div>
          </div>

          {/* Head-to-Head — tabs + content */}
          <div>
            {/* Tab bar */}
            <div className="flex items-center justify-between border-b border-surface-800 mb-4">
              <TabBar
                tabs={[
                  { id: "bars", label: "Bars" },
                  { id: "radar", label: "Radar" },
                ]}
                active={viewMode}
                onChange={setViewMode}
                id="compare-view"
              />
              <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wide">
                Head to Head
              </h3>
            </div>

            {viewMode === "bars" ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-surface-300">{a.web_name}</span>
                  <span className="text-sm font-semibold text-surface-300">{b.web_name}</span>
                </div>

                <ComparisonBar label="Predicted Points" valueA={a.predicted_points} valueB={b.predicted_points} />
                <ComparisonBar label="Form" valueA={a.form} valueB={b.form} />
                <ComparisonBar label="Total Points" valueA={a.total_points} valueB={b.total_points} />
                <ComparisonBar label="Price" valueA={a.value} valueB={b.value} format="price" higherIsBetter={false} />
                <ComparisonBar label="Pts / £m" valueA={parseFloat(valA)} valueB={parseFloat(valB)} />
                <ComparisonBar label="Ownership" valueA={a.selected_by_percent} valueB={b.selected_by_percent} format="pct" />
                <ComparisonBar label="xG" valueA={a.xG} valueB={b.xG} />
                <ComparisonBar label="xA" valueA={a.xA} valueB={b.xA} />
                <ComparisonBar label="Goals" valueA={a.goals} valueB={b.goals} format="int" />
                <ComparisonBar label="Assists" valueA={a.assists} valueB={b.assists} format="int" />
                <ComparisonBar label="Bonus" valueA={a.bonus} valueB={b.bonus} format="int" />
                <ComparisonBar label="ICT Index" valueA={a.ict_index} valueB={b.ict_index} />
                <ComparisonBar label="Minutes" valueA={a.minutes} valueB={b.minutes} format="int" />
                <ComparisonBar label="Fixture Difficulty" valueA={a.opponent_fdr} valueB={b.opponent_fdr} higherIsBetter={false} />
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                <RadarChart playerA={a} playerB={b} allPlayers={allPlayers} />
                {/* Legend */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgb(var(--brand-400))" }} />
                    <span className="text-sm text-surface-300">{a.web_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgb(var(--info-400))" }} />
                    <span className="text-sm text-surface-300">{b.web_name}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Season Stats Comparison Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* xG Over/Underperformance */}
            <div>
              {[a, b].map((p) => {
                const diff = p.goals - p.xG;
                const overPerforming = diff > 0;
                return (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-surface-800/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-surface-300">{p.web_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-surface-500 mr-2">
                        {p.goals}G vs {p.xG}xG
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          overPerforming ? "text-success-400" : "text-danger-400"
                        }`}
                      >
                        {overPerforming ? "+" : ""}
                        {diff.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-surface-500 mt-2">
                Negative = regression candidate. Positive = finishing quality or variance.
              </p>
            </div>

            {/* Value Analysis */}
            <div>
              {[a, b].map((p) => {
                const ptsPerMil = (p.predicted_points / p.value).toFixed(2);
                const totalPtsPerMil = (p.total_points / p.value).toFixed(1);
                return (
                  <div key={p.id} className="py-2 border-b border-surface-800/50 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-surface-300">{p.web_name}</span>
                      <span className="text-sm font-bold text-surface-100">
                        {ptsPerMil} pts/£m
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-surface-500">Season total</span>
                      <span className="text-xs text-surface-400">
                        {totalPtsPerMil} total pts/£m
                      </span>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-surface-500 mt-2">
                Higher pts/£m = better value for budget-constrained squads.
              </p>
            </div>
          </div>

          {/* Uncertainty Comparison */}
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[a, b].map((p) => {
                const low = Math.max(0, p.predicted_points - p.uncertainty);
                const high = p.predicted_points + p.uncertainty;
                const maxVal = 12;
                const leftPct = (low / maxVal) * 100;
                const widthPct = ((high - low) / maxVal) * 100;
                const pointPct = (p.predicted_points / maxVal) * 100;

                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-surface-300">{p.web_name}</span>
                      <span className="text-xs text-surface-500">
                        ±{p.uncertainty.toFixed(1)} pts
                      </span>
                    </div>
                    <div className="relative h-3 bg-surface-800 rounded-full">
                      <div
                        className="absolute h-full bg-brand-500/30 rounded-full"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-brand-400"
                        style={{ left: `${pointPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-surface-500">
                      <span>{low.toFixed(1)}</span>
                      <span className="font-semibold text-surface-300">
                        {p.predicted_points.toFixed(1)}
                      </span>
                      <span>{high.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-surface-500 mt-3">
              Wider range = less certain. Factor in fixture and availability.
            </p>
          </div>
        </>
      ) : (
        <EmptyState title="No players selected" message="Select two players above to compare them." />
      )}
    </div>
  );
}
