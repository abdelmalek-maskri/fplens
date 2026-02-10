import { useState, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { POSITION_COLORS } from "../lib/constants";
import MiniSparkline from "../components/MiniSparkline";
import StatusBadge from "../components/StatusBadge";
import FdrBadge from "../components/FdrBadge";
import SortHeader from "../components/SortHeader";
import TeamBadge from "../components/TeamBadge";

import ShapBreakdown from "../components/ShapBreakdown";

// ============================================================
// MOCK DATA - matches real prediction output structure
// Will be replaced with: GET /api/predictions?model={model}
// ============================================================

const mockPredictions = [
  { element: 2, web_name: "Haaland", name: "Erling Haaland", team_name: "MCI", position: "FWD", value: 15.3, status: "a", predicted_points: 7.2, form: 8.8, total_points: 156, chance_of_playing: 100, selected_by_percent: 85.2, captain_pct: 42.5, news: "", opponent_name: "BOU", rank: 1, uncertainty: 1.8, goals: 16, xG: 14.8, assists: 5, xA: 3.2, transfers_in: 42100, transfers_out: 18200, price_trend: "rise", pts_last5: [12, 2, 8, 6, 15] },
  { element: 3, web_name: "Salah", name: "Mohamed Salah", team_name: "LIV", position: "MID", value: 13.2, status: "a", predicted_points: 6.8, form: 7.2, total_points: 168, chance_of_playing: 100, selected_by_percent: 52.1, captain_pct: 28.3, news: "", opponent_name: "EVE", rank: 2, uncertainty: 1.5, goals: 15, xG: 12.5, assists: 10, xA: 8.1, transfers_in: 35800, transfers_out: 22400, price_trend: "rise", pts_last5: [8, 10, 3, 14, 6] },
  { element: 7, web_name: "Palmer", name: "Cole Palmer", team_name: "CHE", position: "MID", value: 9.5, status: "a", predicted_points: 6.1, form: 9.2, total_points: 158, chance_of_playing: 100, selected_by_percent: 45.8, captain_pct: 12.1, news: "", opponent_name: "ARS", rank: 3, uncertainty: 1.6, goals: 14, xG: 11.2, assists: 8, xA: 6.8, transfers_in: 28900, transfers_out: 31200, price_trend: "fall", pts_last5: [14, 8, 12, 2, 10] },
  { element: 15, web_name: "Alexander-Arnold", name: "Trent Alexander-Arnold", team_name: "LIV", position: "DEF", value: 7.1, status: "a", predicted_points: 5.4, form: 6.1, total_points: 118, chance_of_playing: 100, selected_by_percent: 28.9, captain_pct: 0.8, news: "", opponent_name: "EVE", rank: 4, uncertainty: 1.4, goals: 2, xG: 1.4, assists: 8, xA: 6.5, transfers_in: 18200, transfers_out: 15600, price_trend: "stable", pts_last5: [6, 8, 1, 6, 9] },
  { element: 12, web_name: "Gabriel", name: "Gabriel Magalhães", team_name: "ARS", position: "DEF", value: 6.2, status: "a", predicted_points: 5.1, form: 5.8, total_points: 129, chance_of_playing: 100, selected_by_percent: 31.2, captain_pct: 0.3, news: "", opponent_name: "CHE", rank: 5, uncertainty: 1.3, goals: 4, xG: 2.8, assists: 1, xA: 0.5, transfers_in: 12400, transfers_out: 14100, price_trend: "stable", pts_last5: [6, 2, 8, 6, 8] },
  { element: 20, web_name: "Raya", name: "David Raya", team_name: "ARS", position: "GK", value: 5.5, status: "a", predicted_points: 4.2, form: 4.8, total_points: 98, chance_of_playing: 100, selected_by_percent: 18.2, captain_pct: 0.1, news: "", opponent_name: "CHE", rank: 6, uncertainty: 1.1, goals: 0, xG: 0, assists: 0, xA: 0, transfers_in: 8900, transfers_out: 6200, price_trend: "rise", pts_last5: [6, 2, 6, 3, 7] },
  { element: 50, web_name: "Isak", name: "Alexander Isak", team_name: "NEW", position: "FWD", value: 8.8, status: "a", predicted_points: 5.5, form: 7.0, total_points: 130, chance_of_playing: 100, selected_by_percent: 24.3, captain_pct: 5.2, news: "", opponent_name: "WOL", rank: 7, uncertainty: 1.7, goals: 12, xG: 11.9, assists: 4, xA: 2.8, transfers_in: 48200, transfers_out: 9100, price_trend: "rise", pts_last5: [6, 8, 2, 12, 5] },
  { element: 5, web_name: "Saka", name: "Bukayo Saka", team_name: "ARS", position: "MID", value: 10.1, status: "d", predicted_points: 4.2, form: 6.5, total_points: 142, chance_of_playing: 75, selected_by_percent: 38.4, captain_pct: 3.5, news: "Muscle injury - 75% chance of playing", opponent_name: "CHE", rank: 8, uncertainty: 2.4, goals: 8, xG: 7.5, assists: 10, xA: 8.8, transfers_in: 5200, transfers_out: 62400, price_trend: "fall", pts_last5: [8, 3, 2, 6, 5] },
  { element: 40, web_name: "Mbeumo", name: "Bryan Mbeumo", team_name: "BRE", position: "MID", value: 7.8, status: "a", predicted_points: 4.5, form: 5.6, total_points: 110, chance_of_playing: 100, selected_by_percent: 19.5, captain_pct: 1.8, news: "", opponent_name: "NFO", rank: 9, uncertainty: 1.3, goals: 10, xG: 8.2, assists: 5, xA: 4.1, transfers_in: 22100, transfers_out: 11800, price_trend: "rise", pts_last5: [2, 6, 8, 3, 5] },
  { element: 10, web_name: "Watkins", name: "Ollie Watkins", team_name: "AVL", position: "FWD", value: 9.0, status: "i", predicted_points: 1.8, form: 5.4, total_points: 112, chance_of_playing: 0, selected_by_percent: 22.3, captain_pct: 0.4, news: "Hamstring injury - Expected back in 2-3 weeks", opponent_name: "NFO", rank: 45, uncertainty: 3.1, goals: 10, xG: 11.0, assists: 6, xA: 4.5, transfers_in: 1200, transfers_out: 85400, price_trend: "fall", pts_last5: [5, 8, 2, 1, 0] },
];

// ============================================================
// FIXTURE DIFFICULTY RATING (FDR) — matches FPL's 1-5 scale
// Will be replaced with: GET /api/fixtures/fdr
// ============================================================
const FDR_MAP = {
  ARS: 5, AVL: 3, BOU: 2, BRE: 2, BHA: 3, CHE: 4, CRY: 2, EVE: 2,
  FUL: 2, IPS: 1, LEI: 2, LIV: 5, MCI: 4, MUN: 3, NEW: 3, NFO: 2,
  SOU: 1, TOT: 3, WHU: 2, WOL: 2,
};

// ============================================================
// MOCK SHAP - per-player local explanations
// Will be replaced with: GET /api/shap/{player_id}
// ============================================================
const mockLocalShap = {
  2: [ // Haaland
    { feature: "minutes_lag1", value: 90, impact: +1.8 },
    { feature: "form", value: 8.8, impact: +1.2 },
    { feature: "opponent_strength", value: "BOU (FDR 2)", impact: +0.8 },
    { feature: "total_points_season_avg", value: 6.5, impact: +0.6 },
    { feature: "was_home", value: "Yes", impact: +0.3 },
  ],
  3: [ // Salah
    { feature: "minutes_lag1", value: 90, impact: +1.5 },
    { feature: "form", value: 7.2, impact: +0.9 },
    { feature: "ict_index_roll3", value: 42.1, impact: +0.7 },
    { feature: "opponent_strength", value: "EVE (FDR 2)", impact: +0.6 },
    { feature: "total_points_season_avg", value: 7.0, impact: +0.5 },
  ],
  10: [ // Watkins (injured)
    { feature: "chance_of_playing", value: "0%", impact: -2.8 },
    { feature: "status", value: "Injured", impact: -1.5 },
    { feature: "minutes_lag1", value: 0, impact: -1.2 },
    { feature: "injury_type", value: "Hamstring", impact: -0.4 },
    { feature: "form", value: 5.4, impact: +0.2 },
  ],
};

// Default SHAP for players without specific mock data
const defaultShap = [
  { feature: "minutes_lag1", value: 90, impact: +0.8 },
  { feature: "total_points_season_avg", value: 4.5, impact: +0.5 },
  { feature: "form", value: 5.0, impact: +0.3 },
  { feature: "opponent_strength", value: "FDR 3", impact: -0.1 },
  { feature: "was_home", value: "No", impact: -0.2 },
];

// ============================================================
// MODEL OPTIONS
// ============================================================
const MODEL_OPTIONS = [
  { id: "lgbm_c", name: "LightGBM Config C", mae: 1.043, description: "Best overall — 141 features, tuned" },
  { id: "lgbm_a", name: "LightGBM Config A", mae: 1.059, description: "Single LightGBM, 106 features" },
  { id: "position", name: "Position-Specific", mae: 1.070, description: "Separate models per position" },
  { id: "twohead", name: "Two-Head", mae: 1.063, description: "Position-weighted dual heads" },
];

// ============================================================
// EFFECTIVE OWNERSHIP & DIFFERENTIAL HELPERS
// EO = ownership% + captain_pct% (captaincy doubles points)
// Differential score = predicted_pts × (1 - ownership/100)
// ============================================================
const calcEO = (p) => p.selected_by_percent + p.captain_pct;
const calcDifferential = (p) =>
  p.predicted_points * (1 - p.selected_by_percent / 100);

// ============================================================
// POSITIONS FILTER
// ============================================================
const POSITIONS = ["ALL", "GK", "DEF", "MID", "FWD"];

const POS_TAB_UNDERLINE = {
  ALL: "bg-brand-500",
  GK: "bg-warning-400",
  DEF: "bg-success-400",
  MID: "bg-brand-400",
  FWD: "bg-danger-400",
};

// ============================================================
// DASHBOARD PAGE
// ============================================================
export default function Dashboard() {
  const navigate = useNavigate();
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("predicted_points");
  const [sortDesc, setSortDesc] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState("lgbm_c");
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const [bottomTab, setBottomTab] = useState("differentials");

  const activeModel = MODEL_OPTIONS.find((m) => m.id === selectedModel);

  const filteredPredictions = useMemo(() => {
    let result = [...mockPredictions];
    if (positionFilter !== "ALL") {
      result = result.filter((p) => p.position === positionFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.web_name.toLowerCase().includes(query) ||
          p.team_name.toLowerCase().includes(query)
      );
    }
    result.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortDesc ? bVal - aVal : aVal - bVal;
    });
    return result;
  }, [positionFilter, sortBy, sortDesc, searchQuery]);

  const handleSort = (field) => {
    if (sortBy === field) setSortDesc(!sortDesc);
    else { setSortBy(field); setSortDesc(true); }
  };

  return (
    <div className="space-y-6 stagger">
      {/* Compact header — model selector + stats */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-surface-500">
          {mockPredictions.length} players · {mockPredictions.filter((p) => p.status === "d" || p.status === "i").length} flagged
        </span>
        <div className="flex items-center gap-3">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-surface-800 border border-surface-700 rounded px-2 py-1 text-xs text-surface-300 focus:outline-none cursor-pointer"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <span className="text-2xs font-data tabular-nums text-brand-400">MAE {activeModel.mae}</span>
        </div>
      </div>

      {/* Filters — text-only, underline active */}
      <div className="flex items-center justify-between border-b border-surface-800">
        <div className="flex items-center gap-0">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setPositionFilter(pos)}
              className={`px-3 py-2 text-sm font-medium transition-colors relative ${
                positionFilter === pos
                  ? "text-surface-100"
                  : "text-surface-500 hover:text-surface-300"
              }`}
            >
              {pos}
              {positionFilter === pos && (
                <span className={`absolute bottom-0 left-3 right-3 h-[2px] rounded-full ${POS_TAB_UNDERLINE[pos]}`} />
              )}
            </button>
          ))}
        </div>

        <div className="relative">
          <svg className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-b border-surface-700 pl-5 pr-2 py-2 text-sm text-surface-100 placeholder:text-surface-600 w-44 focus:border-surface-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Predictions Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700">
              <th className="table-header text-left py-2.5 px-3">#</th>
              <th className="table-header text-left py-2.5 px-3">Player</th>
              <SortHeader field="predicted_points" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort}>Predicted</SortHeader>
              <th className="table-header text-left py-2.5 px-3">Status</th>
              <SortHeader field="form" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort}>Form</SortHeader>
              <SortHeader field="value" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort}>Price</SortHeader>
              <SortHeader field="selected_by_percent" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort}>Own%</SortHeader>
              <th className="table-header text-left py-2.5 px-3">EO%</th>
              <th className="table-header text-left py-2.5 px-3">Fixture</th>
            </tr>
          </thead>
          <tbody>
            {filteredPredictions.map((player, idx) => (
              <Fragment key={player.element}>
                <tr
                  onClick={() =>
                    setExpandedPlayer(
                      expandedPlayer === player.element ? null : player.element
                    )
                  }
                  className={`border-t border-surface-800/60 hover:bg-surface-800/40 transition-colors cursor-pointer ${
                    expandedPlayer === player.element ? "bg-surface-800/30" : ""
                  }`}
                >
                  <td className="py-2.5 px-3 text-surface-600 text-xs font-data tabular-nums w-8">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <TeamBadge team={player.team_name} />
                      <div>
                        <p
                          className="font-medium text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); navigate(`/player/${player.element}`); }}
                        >
                          {player.web_name}
                        </p>
                        <p className="text-xs text-surface-500">
                          <span className={POSITION_COLORS[player.position]}>{player.position}</span>
                          {" · "}{player.team_name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-base font-semibold font-data tabular-nums ${
                      player.predicted_points >= 6 ? "text-brand-400" : player.predicted_points >= 3.5 ? "text-surface-100" : "text-surface-500"
                    }`}>
                      {player.predicted_points.toFixed(1)}
                    </span>
                    <span className="block text-2xs text-surface-500 font-data tabular-nums">
                      {Math.max(0, player.predicted_points - player.uncertainty).toFixed(1)}–{(player.predicted_points + player.uncertainty).toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusBadge
                      status={player.status}
                      chance={player.chance_of_playing}
                      compact
                    />
                    {player.news && (
                      <p className="text-xs text-surface-500 max-w-[160px] truncate mt-0.5" title={player.news}>
                        {player.news}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-data tabular-nums ${
                        player.form >= 8 ? "text-brand-400 font-semibold" : player.form >= 5 ? "text-surface-100" : "text-surface-500"
                      }`}>{player.form}</span>
                      <MiniSparkline pts={player.pts_last5} />
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">
                    £{player.value}m
                  </td>
                  <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">
                    {player.selected_by_percent}%
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-sm font-data tabular-nums ${
                      calcEO(player) > 100 ? "text-danger-400" : calcEO(player) > 60 ? "text-warning-400" : "text-surface-400"
                    }`}>
                      {calcEO(player).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <FdrBadge opponent={player.opponent_name} fdrMap={FDR_MAP} />
                  </td>
                </tr>
                {expandedPlayer === player.element && (
                  <tr key={`${player.element}-shap`}>
                    <td colSpan={9}>
                      <ShapBreakdown shapData={mockLocalShap[player.element] || defaultShap} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>

        {filteredPredictions.length === 0 && (
          <div className="py-12 text-center text-surface-500">
            No players match your filters
          </div>
        )}
      </div>

      {/* Secondary content — tabbed */}
      <div className="mt-10">
        <div className="flex items-center gap-0 border-b border-surface-800">
          {[
            { id: "differentials", label: "Differentials" },
            { id: "xg", label: "Goals vs xG" },
            { id: "prices", label: "Price Watch" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setBottomTab(tab.id)}
              className={`px-3 py-2 text-sm font-medium transition-colors relative ${
                bottomTab === tab.id ? "text-surface-100" : "text-surface-500 hover:text-surface-300"
              }`}
            >
              {tab.label}
              {bottomTab === tab.id && (
                <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-brand-500" />
              )}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {bottomTab === "differentials" && (() => {
            const diffs = [...mockPredictions]
              .filter((p) => p.status === "a" && p.selected_by_percent < 30)
              .sort((a, b) => calcDifferential(b) - calcDifferential(a))
              .slice(0, 5);
            const maxImpact = Math.max(...diffs.map((p) => calcDifferential(p)));
            return (
              <>
                <p className="text-xs text-surface-500 mb-3">
                  Low-ownership players your opponents likely don't have. High impact = high predicted points at low ownership.
                </p>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-800/60">
                      <th className="text-xs text-surface-500 text-left py-1.5 font-normal w-8">#</th>
                      <th className="text-xs text-surface-500 text-left py-1.5 font-normal">Player</th>
                      <th className="text-xs text-surface-500 text-right py-1.5 font-normal w-16">Own%</th>
                      <th className="text-xs text-surface-500 text-right py-1.5 font-normal w-16">Pred.</th>
                      <th className="text-xs text-surface-500 text-right py-1.5 font-normal w-24">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffs.map((p, idx) => {
                      const impact = calcDifferential(p);
                      const barPct = (impact / maxImpact) * 100;
                      return (
                        <tr key={p.element} className="border-b border-surface-800/40">
                          <td className="py-2 text-xs text-surface-600 font-data">{idx + 1}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <TeamBadge team={p.team_name} size="sm" />
                              <span
                                className="text-sm text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
                                onClick={() => navigate(`/player/${p.element}`)}
                              >{p.web_name}</span>
                              <span className={`text-xs ${POSITION_COLORS[p.position] || "text-surface-500"}`}>{p.position}</span>
                            </div>
                          </td>
                          <td className="py-2 text-xs text-surface-500 text-right font-data tabular-nums">{p.selected_by_percent}%</td>
                          <td className="py-2 text-sm text-surface-300 text-right font-data tabular-nums">{p.predicted_points.toFixed(1)}</td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-12 h-1.5 bg-surface-800 rounded overflow-hidden">
                                <div className="h-full bg-brand-500/60 rounded" style={{ width: `${barPct}%` }} />
                              </div>
                              <span className="text-sm font-semibold text-surface-100 font-data tabular-nums w-8">{impact.toFixed(1)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            );
          })()}

          {bottomTab === "xg" && (
            <div className="space-y-2">
              {[...mockPredictions]
                .filter((p) => p.position !== "GK" && p.goals > 0)
                .sort((a, b) => Math.abs(b.goals - b.xG) - Math.abs(a.goals - a.xG))
                .slice(0, 5)
                .map((p) => {
                  const diff = p.goals - p.xG;
                  const over = diff > 0;
                  const maxBar = 4;
                  const barPct = Math.min((Math.abs(diff) / maxBar) * 100, 100);
                  return (
                    <div key={p.element} className="flex items-center gap-3">
                      <span className="text-sm text-surface-300 w-28 truncate hover:text-brand-400 transition-colors cursor-pointer" onClick={() => navigate(`/player/${p.element}`)}>{p.web_name}</span>
                      <span className="text-xs text-surface-500 w-20 text-right shrink-0">
                        {p.goals}G / {p.xG}xG
                      </span>
                      <div className="flex-1 flex items-center">
                        {over ? (
                          <div className="flex items-center w-full">
                            <div className="w-1/2" />
                            <div className="h-2.5 bg-success-500/50 rounded-r" style={{ width: `${barPct / 2}%` }} />
                          </div>
                        ) : (
                          <div className="flex items-center justify-end w-full">
                            <div className="h-2.5 bg-warning-500/50 rounded-l" style={{ width: `${barPct / 2}%` }} />
                            <div className="w-1/2" />
                          </div>
                        )}
                      </div>
                      <span className={`text-xs font-bold w-10 text-right ${over ? "text-success-400" : "text-warning-400"}`}>
                        {over ? "+" : ""}{diff.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              <div className="flex items-center gap-4 mt-3 text-2xs text-surface-600">
                <span>+ outscoring xG</span>
                <span>− underperforming</span>
              </div>
            </div>
          )}

          {bottomTab === "prices" && (
            <div className="space-y-2">
              {[...mockPredictions]
                .sort((a, b) => Math.abs(b.transfers_in - b.transfers_out) - Math.abs(a.transfers_in - a.transfers_out))
                .slice(0, 6)
                .map((p) => {
                  const net = p.transfers_in - p.transfers_out;
                  const trendConfig = {
                    rise: { icon: "▲", cls: "text-success-400 bg-success-500/15", label: "Rising" },
                    fall: { icon: "▼", cls: "text-danger-400 bg-danger-500/15", label: "Falling" },
                    stable: { icon: "–", cls: "text-surface-400 bg-surface-700", label: "Stable" },
                  };
                  const t = trendConfig[p.price_trend] || trendConfig.stable;
                  return (
                    <div key={p.element} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-2xs font-bold ${t.cls}`}>
                          {t.icon}
                        </span>
                        <span className="text-sm text-surface-200 hover:text-brand-400 transition-colors cursor-pointer" onClick={() => navigate(`/player/${p.element}`)}>{p.web_name}</span>
                        <span className="text-xs text-surface-500">£{p.value}m</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className={`text-xs font-mono ${net > 0 ? "text-success-400" : "text-danger-400"}`}>
                            {net > 0 ? "+" : ""}{(net / 1000).toFixed(1)}k net
                          </span>
                        </div>
                        <span className={`badge text-2xs ${t.cls}`}>{t.label}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
