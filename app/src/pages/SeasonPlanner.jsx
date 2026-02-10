import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TEAM_COLORS, POSITION_COLORS, POSITION_BG, FDR_COLORS } from "../lib/constants";
import TeamBadge from "../components/TeamBadge";

// ============================================================
// MOCK PLAYER POOL — all available PL players with multi-GW predictions
// Will be replaced with: GET /api/players/pool?horizon={n}
// ============================================================
const playerPool = [
  // GK
  { element: 20, web_name: "Raya", team: "ARS", position: "GK", value: 5.5, predicted_6gw: 25.2, predicted_1gw: 4.2, form: 4.8, ownership: 18.2, fdr_avg: 2.8 },
  { element: 22, web_name: "Martinez", team: "AVL", position: "GK", value: 5.0, predicted_6gw: 22.8, predicted_1gw: 3.8, form: 4.2, ownership: 12.4, fdr_avg: 2.5 },
  { element: 70, web_name: "Pickford", team: "EVE", position: "GK", value: 4.5, predicted_6gw: 20.4, predicted_1gw: 3.4, form: 3.9, ownership: 8.1, fdr_avg: 2.7 },
  { element: 71, web_name: "Flekken", team: "BRE", position: "GK", value: 4.5, predicted_6gw: 19.8, predicted_1gw: 3.3, form: 3.5, ownership: 5.2, fdr_avg: 2.3 },
  { element: 72, web_name: "Henderson", team: "CRY", position: "GK", value: 4.5, predicted_6gw: 18.6, predicted_1gw: 3.1, form: 3.2, ownership: 3.8, fdr_avg: 2.0 },
  { element: 73, web_name: "Areola", team: "WHU", position: "GK", value: 4.0, predicted_6gw: 17.4, predicted_1gw: 2.9, form: 2.8, ownership: 2.1, fdr_avg: 2.2 },
  // DEF
  { element: 15, web_name: "Alexander-Arnold", team: "LIV", position: "DEF", value: 7.1, predicted_6gw: 32.4, predicted_1gw: 5.4, form: 6.1, ownership: 28.9, fdr_avg: 2.2 },
  { element: 12, web_name: "Gabriel", team: "ARS", position: "DEF", value: 6.2, predicted_6gw: 30.6, predicted_1gw: 5.1, form: 5.8, ownership: 31.2, fdr_avg: 2.8 },
  { element: 25, web_name: "Saliba", team: "ARS", position: "DEF", value: 5.8, predicted_6gw: 28.8, predicted_1gw: 4.8, form: 5.5, ownership: 26.1, fdr_avg: 2.8 },
  { element: 74, web_name: "Robertson", team: "LIV", position: "DEF", value: 6.5, predicted_6gw: 28.2, predicted_1gw: 4.7, form: 5.0, ownership: 15.8, fdr_avg: 2.2 },
  { element: 75, web_name: "Gvardiol", team: "MCI", position: "DEF", value: 5.5, predicted_6gw: 26.4, predicted_1gw: 4.4, form: 4.8, ownership: 12.3, fdr_avg: 3.2 },
  { element: 76, web_name: "Pedro Porro", team: "TOT", position: "DEF", value: 5.5, predicted_6gw: 25.8, predicted_1gw: 4.3, form: 5.2, ownership: 14.5, fdr_avg: 2.5 },
  { element: 77, web_name: "Hall", team: "NEW", position: "DEF", value: 4.8, predicted_6gw: 24.6, predicted_1gw: 4.1, form: 4.5, ownership: 8.2, fdr_avg: 2.7 },
  { element: 78, web_name: "Cucurella", team: "CHE", position: "DEF", value: 5.0, predicted_6gw: 24.0, predicted_1gw: 4.0, form: 4.2, ownership: 9.1, fdr_avg: 2.5 },
  { element: 79, web_name: "Estupinan", team: "BHA", position: "DEF", value: 5.0, predicted_6gw: 23.4, predicted_1gw: 3.9, form: 3.8, ownership: 6.5, fdr_avg: 3.0 },
  { element: 80, web_name: "Mitchell", team: "CRY", position: "DEF", value: 4.5, predicted_6gw: 22.2, predicted_1gw: 3.7, form: 4.0, ownership: 5.1, fdr_avg: 2.0 },
  // MID
  { element: 3, web_name: "Salah", team: "LIV", position: "MID", value: 13.2, predicted_6gw: 40.8, predicted_1gw: 6.8, form: 7.2, ownership: 52.1, fdr_avg: 2.2 },
  { element: 7, web_name: "Palmer", team: "CHE", position: "MID", value: 9.5, predicted_6gw: 36.6, predicted_1gw: 6.1, form: 9.2, ownership: 45.8, fdr_avg: 2.5 },
  { element: 5, web_name: "Saka", team: "ARS", position: "MID", value: 10.1, predicted_6gw: 33.6, predicted_1gw: 4.2, form: 6.5, ownership: 38.4, fdr_avg: 2.8 },
  { element: 40, web_name: "Mbeumo", team: "BRE", position: "MID", value: 7.8, predicted_6gw: 27.0, predicted_1gw: 4.5, form: 5.6, ownership: 19.5, fdr_avg: 2.3 },
  { element: 45, web_name: "Gordon", team: "NEW", position: "MID", value: 7.3, predicted_6gw: 25.8, predicted_1gw: 4.3, form: 6.2, ownership: 15.8, fdr_avg: 2.7 },
  { element: 30, web_name: "Son", team: "TOT", position: "MID", value: 9.8, predicted_6gw: 24.0, predicted_1gw: 4.0, form: 4.5, ownership: 10.3, fdr_avg: 2.5 },
  { element: 81, web_name: "Diaby", team: "AVL", position: "MID", value: 6.5, predicted_6gw: 23.4, predicted_1gw: 3.9, form: 4.8, ownership: 4.2, fdr_avg: 2.5 },
  { element: 82, web_name: "Rogers", team: "AVL", position: "MID", value: 5.5, predicted_6gw: 22.8, predicted_1gw: 3.8, form: 4.5, ownership: 3.8, fdr_avg: 2.5 },
  { element: 65, web_name: "Eze", team: "CRY", position: "MID", value: 6.8, predicted_6gw: 25.2, predicted_1gw: 4.2, form: 5.8, ownership: 8.2, fdr_avg: 2.0 },
  { element: 83, web_name: "Neto", team: "MCI", position: "MID", value: 5.8, predicted_6gw: 21.6, predicted_1gw: 3.6, form: 3.5, ownership: 2.8, fdr_avg: 3.2 },
  // FWD
  { element: 2, web_name: "Haaland", team: "MCI", position: "FWD", value: 15.3, predicted_6gw: 43.2, predicted_1gw: 7.2, form: 8.8, ownership: 85.2, fdr_avg: 3.2 },
  { element: 50, web_name: "Isak", team: "NEW", position: "FWD", value: 8.8, predicted_6gw: 33.0, predicted_1gw: 5.5, form: 7.0, ownership: 24.3, fdr_avg: 2.7 },
  { element: 10, web_name: "Watkins", team: "AVL", position: "FWD", value: 9.0, predicted_6gw: 28.8, predicted_1gw: 4.8, form: 5.4, ownership: 22.3, fdr_avg: 2.5 },
  { element: 60, web_name: "Cunha", team: "WOL", position: "FWD", value: 7.2, predicted_6gw: 27.0, predicted_1gw: 4.5, form: 7.5, ownership: 12.1, fdr_avg: 2.5 },
  { element: 35, web_name: "Solanke", team: "TOT", position: "FWD", value: 7.5, predicted_6gw: 21.0, predicted_1gw: 3.5, form: 3.8, ownership: 8.1, fdr_avg: 2.5 },
  { element: 64, web_name: "Wood", team: "NFO", position: "FWD", value: 6.5, predicted_6gw: 28.8, predicted_1gw: 4.8, form: 6.0, ownership: 15.2, fdr_avg: 2.5 },
  { element: 84, web_name: "Jackson", team: "CHE", position: "FWD", value: 7.8, predicted_6gw: 25.2, predicted_1gw: 4.2, form: 5.2, ownership: 11.4, fdr_avg: 2.5 },
  { element: 85, web_name: "Raul", team: "FUL", position: "FWD", value: 6.0, predicted_6gw: 22.8, predicted_1gw: 3.8, form: 4.5, ownership: 6.8, fdr_avg: 2.5 },
];

const BUDGET = 100.0;
const POS_LIMITS = { GK: 2, DEF: 5, MID: 5, FWD: 3 };
const MAX_PER_TEAM = 3;

// ============================================================
// SEASON PLANNER PAGE
// ============================================================
export default function SeasonPlanner() {
  const navigate = useNavigate();
  const [squad, setSquad] = useState([]);
  const [posFilter, setPosFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("predicted"); // predicted, value, form
  const [horizon, setHorizon] = useState(6); // 1-8 GWs
  const [search, setSearch] = useState("");

  // Squad analysis
  const spent = useMemo(() => squad.reduce((s, p) => s + p.value, 0), [squad]);
  const remaining = BUDGET - spent;
  const posCounts = useMemo(() => {
    const c = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    squad.forEach((p) => { c[p.position]++; });
    return c;
  }, [squad]);
  const teamCounts = useMemo(() => {
    const c = {};
    squad.forEach((p) => { c[p.team] = (c[p.team] || 0) + 1; });
    return c;
  }, [squad]);
  const totalPredicted = useMemo(() =>
    squad.reduce((s, p) => s + (horizon === 1 ? p.predicted_1gw : p.predicted_6gw * (horizon / 6)), 0),
    [squad, horizon]
  );

  const squadIds = new Set(squad.map((p) => p.element));

  // Can add player?
  const canAdd = (p) => {
    if (squadIds.has(p.element)) return false;
    if (squad.length >= 15) return false;
    if (posCounts[p.position] >= POS_LIMITS[p.position]) return false;
    if ((teamCounts[p.team] || 0) >= MAX_PER_TEAM) return false;
    if (p.value > remaining) return false;
    return true;
  };

  // Why can't add?
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

  // Get predicted pts based on horizon
  const getPredicted = (p) => {
    if (horizon === 1) return p.predicted_1gw;
    return (p.predicted_6gw * (horizon / 6));
  };

  // Filtered & sorted player pool
  const filteredPool = useMemo(() => {
    let pool = playerPool;
    if (posFilter !== "ALL") pool = pool.filter((p) => p.position === posFilter);
    if (search) {
      const q = search.toLowerCase();
      pool = pool.filter((p) => p.web_name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
    }
    const sortKey = sortBy === "predicted" ? (p) => getPredicted(p) : sortBy === "value" ? (p) => -p.value : (p) => p.form;
    return [...pool].sort((a, b) => sortKey(b) - sortKey(a));
  }, [posFilter, sortBy, search, horizon]);

  // Auto-pick: greedy algorithm — fill remaining squad slots with best value picks
  const autoPick = () => {
    let current = [...squad];
    const currentIds = new Set(current.map((p) => p.element));
    let budget = BUDGET - current.reduce((s, p) => s + p.value, 0);
    const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    const teams = {};
    current.forEach((p) => { counts[p.position]++; teams[p.team] = (teams[p.team] || 0) + 1; });

    // Sort pool by predicted pts per million (value metric)
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

  return (
    <div className="space-y-6 stagger">
      {/* Budget bar */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">£{spent.toFixed(1)}m</span>
          <span className="text-xs text-surface-500 ml-1">spent</span>
        </div>
        <div className="flex-1 h-2 bg-surface-800 rounded-full overflow-hidden min-w-[120px]">
          <div
            className={`h-full rounded-full transition-all ${remaining < 0 ? "bg-danger-500" : remaining < 5 ? "bg-warning-500" : "bg-brand-500"}`}
            style={{ width: `${Math.min((spent / BUDGET) * 100, 100)}%` }}
          />
        </div>
        <div>
          <span className={`text-lg font-bold font-data tabular-nums ${remaining < 0 ? "text-danger-400" : "text-success-400"}`}>
            £{remaining.toFixed(1)}m
          </span>
          <span className="text-xs text-surface-500 ml-1">remaining</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-brand-400 font-data tabular-nums">{totalPredicted.toFixed(1)}</span>
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
                <span className={`text-sm font-data tabular-nums ${full ? "text-success-400" : "text-surface-300"}`}>
                  {count}/{limit}
                </span>
              </div>
            );
          })}
          <div className="w-px h-4 bg-surface-700" />
          <span className={`text-xs ${squad.length >= 15 ? "text-success-400" : "text-surface-500"}`}>
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
      </div>

      {/* Two-column: squad + pool */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Squad */}
        <div>
          <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
            Your squad
          </span>
          {squad.length === 0 ? (
            <p className="text-sm text-surface-600 mt-3 py-8 text-center">Add players from the pool</p>
          ) : (
            <div className="mt-3 space-y-0">
              {["GK", "DEF", "MID", "FWD"].map((pos) => {
                const posPlayers = squad.filter((p) => p.position === pos);
                if (posPlayers.length === 0) return null;
                return (
                  <div key={pos}>
                    <div className="flex items-center gap-2 py-1.5">
                      <span className={`text-2xs font-medium ${POSITION_COLORS[pos]}`}>{pos}</span>
                      <span className="text-2xs text-surface-600">{posPlayers.length}/{POS_LIMITS[pos]}</span>
                    </div>
                    {posPlayers.map((p) => (
                      <div
                        key={p.element}
                        className="flex items-center gap-2 py-1.5 border-b border-surface-800/40 last:border-0 group"
                        style={{ borderLeftColor: TEAM_COLORS[p.team], borderLeftWidth: 2, paddingLeft: 8 }}
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
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
            <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
              Player pool
            </span>
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
                  <th className="py-2 pr-2 text-xs text-surface-500 font-medium">Player</th>
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
                  <th className="py-2 px-2 text-xs text-surface-500 font-medium text-right">Pts/£m</th>
                  <th
                    className={`py-2 px-2 text-xs font-medium text-right cursor-pointer transition-colors ${sortBy === "form" ? "text-brand-400" : "text-surface-500 hover:text-surface-300"}`}
                    onClick={() => setSortBy("form")}
                  >
                    Form
                  </th>
                  <th className="py-2 px-2 text-xs text-surface-500 font-medium text-right">Own%</th>
                  <th className="py-2 pl-2 w-8"></th>
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
                          <span className={`text-2xs ${POSITION_COLORS[p.position]}`}>{p.position}</span>
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
