import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TEAM_COLORS, POSITION_COLORS } from "../lib/constants";
import { PitchView } from "../components/pitch";
import TeamBadge from "../components/TeamBadge";
import ErrorState from "../components/ErrorState";
import { SkeletonStatStrip, SkeletonPitch, SkeletonTable } from "../components/skeletons";
import { useSeasonPlanner } from "../hooks";

// ============================================================
// SEASON PLANNER PAGE
// Default: ML-recommended 15 on pitch view
// Customize: manual builder with player pool
// ============================================================
export default function SeasonPlanner() {
  const navigate = useNavigate();
  const { data: plannerData, isLoading, error } = useSeasonPlanner();
  const [mode, setMode] = useState("recommended"); // recommended | customize
  const [squad, setSquad] = useState([]);
  const [posFilter, setPosFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("predicted");
  const [horizon, setHorizon] = useState(6);
  const [search, setSearch] = useState("");

  const playerPool = plannerData?.playerPool ?? [];
  const BUDGET = plannerData?.budget ?? 100;
  const POS_LIMITS = plannerData?.posLimits ?? { GK: 2, DEF: 5, MID: 5, FWD: 3 };
  const MAX_PER_TEAM = plannerData?.maxPerTeam ?? 3;
  const recommended = plannerData?.recommended;

  // Squad analysis (customize mode)
  const spent = useMemo(() => squad.reduce((s, p) => s + p.value, 0), [squad]);
  const remaining = BUDGET - spent;
  const posCounts = useMemo(() => {
    const c = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    squad.forEach((p) => {
      c[p.position]++;
    });
    return c;
  }, [squad]);
  const teamCounts = useMemo(() => {
    const c = {};
    squad.forEach((p) => {
      c[p.team] = (c[p.team] || 0) + 1;
    });
    return c;
  }, [squad]);
  const totalPredicted = useMemo(
    () =>
      squad.reduce(
        (s, p) => s + (horizon === 1 ? p.predicted_1gw : p.predicted_6gw * (horizon / 6)),
        0
      ),
    [squad, horizon]
  );

  const getPredicted = (p) => {
    if (horizon === 1) return p.predicted_1gw;
    return p.predicted_6gw * (horizon / 6);
  };

  // Filtered & sorted player pool
  const filteredPool = useMemo(() => {
    if (!playerPool.length) return [];
    let pool = playerPool;
    if (posFilter !== "ALL") pool = pool.filter((p) => p.position === posFilter);
    if (search) {
      const q = search.toLowerCase();
      pool = pool.filter(
        (p) => p.web_name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
      );
    }
    const sortKey =
      sortBy === "predicted"
        ? (p) => getPredicted(p)
        : sortBy === "value"
          ? (p) => -p.value
          : (p) => p.form;
    return [...pool].sort((a, b) => sortKey(b) - sortKey(a));
  }, [playerPool, posFilter, sortBy, search, horizon]);

  if (isLoading)
    return (
      <div className="space-y-6">
        <SkeletonStatStrip items={mode === "recommended" ? 4 : 3} />
        {mode === "recommended" ? (
          <SkeletonPitch id="season-sk" />
        ) : (
          <SkeletonTable rows={10} cols={7} />
        )}
      </div>
    );
  if (error) return <ErrorState message="Failed to load season data." />;
  if (!plannerData) return null;

  const squadIds = new Set(squad.map((p) => p.element));

  const canAdd = (p) => {
    if (squadIds.has(p.element)) return false;
    if (squad.length >= 15) return false;
    if (posCounts[p.position] >= POS_LIMITS[p.position]) return false;
    if ((teamCounts[p.team] || 0) >= MAX_PER_TEAM) return false;
    if (p.value > remaining) return false;
    return true;
  };

  const addBlockReason = (p) => {
    if (squadIds.has(p.element)) return "In squad";
    if (squad.length >= 15) return "Squad full";
    if (posCounts[p.position] >= POS_LIMITS[p.position]) return `${p.position} full`;
    if ((teamCounts[p.team] || 0) >= MAX_PER_TEAM) return `3× ${p.team}`;
    if (p.value > remaining) return "Over budget";
    return "";
  };

  const addPlayer = (p) => {
    if (canAdd(p)) setSquad((prev) => [...prev, p]);
  };

  const removePlayer = (element) => {
    setSquad((prev) => prev.filter((p) => p.element !== element));
  };

  const autoPick = () => {
    let current = [...squad];
    const currentIds = new Set(current.map((p) => p.element));
    let budget = BUDGET - current.reduce((s, p) => s + p.value, 0);
    const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    const teams = {};
    current.forEach((p) => {
      counts[p.position]++;
      teams[p.team] = (teams[p.team] || 0) + 1;
    });

    const sorted = [...playerPool]
      .filter((p) => !currentIds.has(p.element))
      .sort((a, b) => getPredicted(b) / b.value - getPredicted(a) / a.value);

    for (const p of sorted) {
      if (current.length >= 15) break;
      if (counts[p.position] >= POS_LIMITS[p.position]) continue;
      if ((teams[p.team] || 0) >= MAX_PER_TEAM) continue;
      if (p.value > budget) continue;
      current.push(p);
      currentIds.add(p.element);
      counts[p.position]++;
      teams[p.team] = (teams[p.team] || 0) + 1;
      budget -= p.value;
    }
    setSquad(current);
  };

  // ============================================================
  // RECOMMENDED MODE — ML-optimized squad on pitch
  // ============================================================
  if (mode === "recommended" && recommended) {
    return (
      <div className="space-y-6 stagger">
        {/* Stats strip */}
        <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
          <div>
            <span className="text-lg font-bold text-brand-400 font-data tabular-nums">
              {recommended.totalPoints.toFixed(1)}
            </span>
            <span className="text-xs text-surface-500 ml-1.5">total predicted pts</span>
          </div>
          <div className="w-px h-5 bg-surface-700" />
          <div>
            <span className="text-lg font-bold text-surface-100 font-data tabular-nums">
              £{recommended.totalValue.toFixed(1)}m
            </span>
            <span className="text-xs text-surface-500 ml-1.5">/ £{BUDGET}m</span>
          </div>
          <div className="w-px h-5 bg-surface-700" />
          <div>
            <span className="text-sm font-semibold text-surface-100">{recommended.formation}</span>
            <span className="text-xs text-surface-500 ml-1.5">formation</span>
          </div>
          <div className="w-px h-5 bg-surface-700" />
          <div>
            <span
              className={`text-sm font-semibold ${recommended.budgetRemaining >= 0 ? "text-success-400" : "text-danger-400"}`}
            >
              £{recommended.budgetRemaining.toFixed(1)}m
            </span>
            <span className="text-xs text-surface-500 ml-1.5">remaining</span>
          </div>

          <button
            onClick={() => setMode("customize")}
            className="ml-auto px-3 py-1.5 text-sm font-medium rounded bg-surface-800 text-surface-300 hover:text-surface-100 transition-colors"
          >
            Customize
          </button>
        </div>

        {/* Pitch view with recommended squad */}
        <PitchView
          starters={recommended.starters}
          bench={recommended.bench}
          captainId={recommended.captainId}
          viceId={recommended.viceId}
          id="season"
          benchLabel="Bench"
        />
      </div>
    );
  }

  // ============================================================
  // CUSTOMIZE MODE — manual builder (existing UI)
  // ============================================================
  return (
    <div className="space-y-6 stagger">
      {/* Budget bar */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">
            £{spent.toFixed(1)}m
          </span>
          <span className="text-xs text-surface-500 ml-1">spent</span>
        </div>
        <div className="flex-1 h-2 bg-surface-800 rounded-full overflow-hidden min-w-[120px]">
          <div
            className={`h-full rounded-full transition-all ${remaining < 0 ? "bg-danger-500" : remaining < 5 ? "bg-warning-500" : "bg-brand-500"}`}
            style={{ width: `${Math.min((spent / BUDGET) * 100, 100)}%` }}
          />
        </div>
        <div>
          <span
            className={`text-lg font-bold font-data tabular-nums ${remaining < 0 ? "text-danger-400" : "text-success-400"}`}
          >
            £{remaining.toFixed(1)}m
          </span>
          <span className="text-xs text-surface-500 ml-1">remaining</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-brand-400 font-data tabular-nums">
            {totalPredicted.toFixed(1)}
          </span>
          <span className="text-xs text-surface-500 ml-1">total predicted pts</span>
        </div>
      </div>

      {/* Position constraints + horizon */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {Object.entries(POS_LIMITS).map(([pos, limit]) => {
            const count = posCounts[pos];
            const full = count >= limit;
            return (
              <div key={pos} className="flex items-center gap-1.5">
                <span className={`text-xs font-medium ${POSITION_COLORS[pos]}`}>{pos}</span>
                <span
                  className={`text-sm font-data tabular-nums ${full ? "text-success-400" : "text-surface-300"}`}
                >
                  {count}/{limit}
                </span>
              </div>
            );
          })}
          <div className="w-px h-4 bg-surface-700" />
          <span
            className={`text-xs ${squad.length >= 15 ? "text-success-400" : "text-surface-500"}`}
          >
            {squad.length}/15 players
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-surface-500">Horizon</span>
          <div className="flex items-center gap-0 border-b border-surface-700">
            {[1, 3, 6, 8].map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  horizon === h
                    ? "border-brand-400 text-brand-400"
                    : "border-transparent text-surface-500 hover:text-surface-300"
                }`}
              >
                {h} GW{h > 1 ? "s" : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={autoPick}
          disabled={squad.length >= 15}
          className="px-3 py-1.5 text-sm font-medium rounded bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Auto-fill best value
        </button>
        <button
          onClick={() => setSquad([])}
          disabled={squad.length === 0}
          className="px-3 py-1.5 text-sm font-medium rounded bg-surface-800 text-surface-300 hover:text-surface-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear squad
        </button>
        {recommended && (
          <button
            onClick={() => setMode("recommended")}
            className="px-3 py-1.5 text-sm font-medium rounded bg-surface-800 text-surface-300 hover:text-surface-100 transition-colors"
          >
            ML Recommended
          </button>
        )}
      </div>

      {/* Two-column: squad + pool */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Squad */}
        <div>
          <span className="section-label">Your squad</span>
          {squad.length === 0 ? (
            <p className="text-sm text-surface-600 mt-3 py-8 text-center">
              Add players from the pool
            </p>
          ) : (
            <div className="mt-3 space-y-0">
              {["GK", "DEF", "MID", "FWD"].map((pos) => {
                const posPlayers = squad.filter((p) => p.position === pos);
                if (posPlayers.length === 0) return null;
                return (
                  <div key={pos}>
                    <div className="flex items-center gap-2 py-1.5">
                      <span className={`text-2xs font-medium ${POSITION_COLORS[pos]}`}>{pos}</span>
                      <span className="text-2xs text-surface-600">
                        {posPlayers.length}/{POS_LIMITS[pos]}
                      </span>
                    </div>
                    {posPlayers.map((p) => (
                      <div
                        key={p.element}
                        className="flex items-center gap-2 py-1.5 border-b border-surface-800/40 last:border-0 group"
                        style={{
                          borderLeftColor: TEAM_COLORS[p.team],
                          borderLeftWidth: 2,
                          paddingLeft: 8,
                        }}
                      >
                        <TeamBadge team={p.team} size="sm" />
                        <span
                          className="text-sm text-surface-200 flex-1 truncate group-hover:text-brand-400 transition-colors cursor-pointer"
                          onClick={() => navigate(`/player/${p.element}`)}
                        >
                          {p.web_name}
                        </span>
                        <span className="text-xs text-surface-500 font-data tabular-nums">
                          £{p.value}m
                        </span>
                        <span className="text-xs text-brand-400 font-data tabular-nums w-10 text-right">
                          {getPredicted(p).toFixed(1)}
                        </span>
                        <button
                          onClick={() => removePlayer(p.element)}
                          className="text-surface-600 hover:text-danger-400 transition-colors p-0.5 opacity-0 group-hover:opacity-100"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Player pool */}
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <span className="section-label">Player pool</span>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded px-2.5 py-1 text-sm text-surface-200 placeholder:text-surface-600 focus:outline-none focus:border-brand-500/50 w-36"
              />
              <div className="flex items-center gap-0 border-b border-surface-700">
                {["ALL", "GK", "DEF", "MID", "FWD"].map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setPosFilter(pos)}
                    className={`px-2 py-1 text-xs font-medium transition-colors border-b-2 -mb-px ${
                      posFilter === pos
                        ? "border-brand-400 text-brand-400"
                        : "border-transparent text-surface-500 hover:text-surface-300"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  <th scope="col" className="py-2 pr-2 text-xs text-surface-500 font-medium">
                    Player
                  </th>
                  <th
                    className={`py-2 px-2 text-xs font-medium text-right cursor-pointer transition-colors ${sortBy === "value" ? "text-brand-400" : "text-surface-500 hover:text-surface-300"}`}
                    onClick={() => setSortBy("value")}
                  >
                    Price
                  </th>
                  <th
                    className={`py-2 px-2 text-xs font-medium text-right cursor-pointer transition-colors ${sortBy === "predicted" ? "text-brand-400" : "text-surface-500 hover:text-surface-300"}`}
                    onClick={() => setSortBy("predicted")}
                  >
                    Pred ({horizon}GW)
                  </th>
                  <th
                    scope="col"
                    className="py-2 px-2 text-xs text-surface-500 font-medium text-right"
                  >
                    Pts/£m
                  </th>
                  <th
                    className={`py-2 px-2 text-xs font-medium text-right cursor-pointer transition-colors ${sortBy === "form" ? "text-brand-400" : "text-surface-500 hover:text-surface-300"}`}
                    onClick={() => setSortBy("form")}
                  >
                    Form
                  </th>
                  <th
                    scope="col"
                    className="py-2 px-2 text-xs text-surface-500 font-medium text-right"
                  >
                    Own%
                  </th>
                  <th scope="col" className="py-2 pl-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filteredPool.map((p) => {
                  const inSquad = squadIds.has(p.element);
                  const canAddPlayer = canAdd(p);
                  const reason = addBlockReason(p);
                  const pred = getPredicted(p);
                  const ptsPerM = (pred / p.value).toFixed(2);

                  return (
                    <tr
                      key={p.element}
                      className={`border-b border-surface-800/40 transition-colors ${
                        inSquad ? "bg-brand-500/5" : "hover:bg-surface-800/30"
                      }`}
                      style={{ borderLeftColor: TEAM_COLORS[p.team], borderLeftWidth: 2 }}
                    >
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <TeamBadge team={p.team} size="sm" />
                          <span
                            className="text-surface-200 hover:text-brand-400 transition-colors cursor-pointer"
                            onClick={() => navigate(`/player/${p.element}`)}
                          >
                            {p.web_name}
                          </span>
                          <span className={`text-2xs ${POSITION_COLORS[p.position]}`}>
                            {p.position}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right text-surface-300 font-data tabular-nums">
                        £{p.value}m
                      </td>
                      <td className="py-2 px-2 text-right text-brand-400 font-data tabular-nums font-medium">
                        {pred.toFixed(1)}
                      </td>
                      <td className="py-2 px-2 text-right text-surface-400 font-data tabular-nums">
                        {ptsPerM}
                      </td>
                      <td className="py-2 px-2 text-right text-surface-300 font-data tabular-nums">
                        {p.form}
                      </td>
                      <td className="py-2 px-2 text-right text-surface-500 font-data tabular-nums">
                        {p.ownership}%
                      </td>
                      <td className="py-2 pl-2">
                        {inSquad ? (
                          <button
                            onClick={() => removePlayer(p.element)}
                            className="text-xs text-danger-400 hover:text-danger-300 transition-colors"
                          >
                            −
                          </button>
                        ) : canAddPlayer ? (
                          <button
                            onClick={() => addPlayer(p)}
                            className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                          >
                            +
                          </button>
                        ) : (
                          <span className="text-2xs text-surface-600" title={reason}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
