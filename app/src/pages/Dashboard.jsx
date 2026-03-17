import { useState, useMemo, Fragment } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { POSITION_COLORS, FDR_MAP } from "../lib/constants";
import MiniSparkline from "../components/MiniSparkline";
import StatusBadge from "../components/StatusBadge";
import FdrBadge from "../components/FdrBadge";
import SortHeader from "../components/SortHeader";
import TeamBadge from "../components/TeamBadge";

import TabBar from "../components/TabBar";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";
import { SkeletonStatStrip, SkeletonTable } from "../components/skeletons";
import { usePredictions } from "../hooks";

// ============================================================
// EFFECTIVE OWNERSHIP & DIFFERENTIAL HELPERS
// EO = ownership% + captain_pct% (captaincy doubles points)
// Differential score = predicted_pts × (1 - ownership/100)
// ============================================================
const calcEO = (p) => p.selected_by_percent + p.captain_pct;
const calcDifferential = (p) => p.predicted_points * (1 - p.selected_by_percent / 100);

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
  const [searchParams, setSearchParams] = useSearchParams();
  const positionFilter = searchParams.get("pos") || "ALL";
  const bottomTab = searchParams.get("tab") || "differentials";
  const setParam = (key, value) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set(key, value);
      return p;
    });
  };
  const [sortBy, setSortBy] = useState("predicted_points");
  const [sortDesc, setSortDesc] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState(null);
  const [expandedPlayer, setExpandedPlayer] = useState(null);

  const { data, models, isLoading, error } = usePredictions(selectedModel);
  const mockPredictions = data?.predictions ?? [];
  const activeModel = models.find((m) => m.id === selectedModel) || models[0];

  const filteredPredictions = useMemo(() => {
    let result = [...mockPredictions];
    if (positionFilter !== "ALL") {
      result = result.filter((p) => p.position === positionFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.web_name.toLowerCase().includes(query) || p.team_name.toLowerCase().includes(query)
      );
    }
    result.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortDesc ? bVal - aVal : aVal - bVal;
    });
    return result;
  }, [mockPredictions, positionFilter, sortBy, sortDesc, searchQuery]);

  if (isLoading)
    return (
      <div className="space-y-6">
        <SkeletonStatStrip items={3} />
        <SkeletonTable rows={10} cols={9} />
      </div>
    );
  if (error) return <ErrorState message="Failed to load predictions." />;
  if (!data) return null;

  const handleSort = (field) => {
    if (sortBy === field) setSortDesc(!sortDesc);
    else {
      setSortBy(field);
      setSortDesc(true);
    }
  };

  return (
    <div className="space-y-6 stagger">
      {/* Compact header — model selector + stats */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-surface-500">
          {mockPredictions.length} players ·{" "}
          {mockPredictions.filter((p) => p.status === "d" || p.status === "i").length} flagged
        </span>
        <div className="flex items-center gap-3">
          {models.length > 0 && (
            <select
              value={selectedModel || models[0]?.id || ""}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-surface-800 border border-surface-700 rounded px-2 py-1 text-xs text-surface-300 focus:outline-none cursor-pointer"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          {activeModel && (
            <span className="text-2xs font-data tabular-nums text-brand-400">
              MAE {activeModel.mae}
            </span>
          )}
        </div>
      </div>

      {/* Filters — text-only, underline active */}
      <div className="flex items-center justify-between border-b border-surface-800">
        <div className="flex items-center gap-0">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setParam("pos", pos)}
              className={`px-3 py-2 text-sm font-medium transition-colors relative ${
                positionFilter === pos
                  ? "text-surface-100"
                  : "text-surface-500 hover:text-surface-300"
              }`}
            >
              {pos}
              {positionFilter === pos && (
                <span
                  className={`absolute bottom-0 left-3 right-3 h-[2px] rounded-full ${POS_TAB_UNDERLINE[pos]}`}
                />
              )}
            </button>
          ))}
        </div>

        <div className="relative">
          <svg
            className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
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
              <th scope="col" className="table-header text-left py-2.5 px-3">
                #
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Player
              </th>
              <SortHeader
                field="predicted_points"
                sortBy={sortBy}
                sortDesc={sortDesc}
                onSort={handleSort}
              >
                Predicted
              </SortHeader>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Status
              </th>
              <SortHeader field="form" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort}>
                Form
              </SortHeader>
              <SortHeader field="value" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort}>
                Price
              </SortHeader>
              <SortHeader
                field="selected_by_percent"
                sortBy={sortBy}
                sortDesc={sortDesc}
                onSort={handleSort}
              >
                Own%
              </SortHeader>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                EO%
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Fixture
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredPredictions.map((player, idx) => (
              <Fragment key={player.element}>
                <tr
                  onClick={() =>
                    setExpandedPlayer(expandedPlayer === player.element ? null : player.element)
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
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/player/${player.element}`);
                          }}
                        >
                          {player.web_name}
                        </p>
                        <p className="text-xs text-surface-500">
                          <span className={POSITION_COLORS[player.position]}>
                            {player.position}
                          </span>
                          {" · "}
                          {player.team_name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-base font-semibold font-data tabular-nums ${
                        player.predicted_points >= 6
                          ? "text-brand-400"
                          : player.predicted_points >= 3.5
                            ? "text-surface-100"
                            : "text-surface-500"
                      }`}
                    >
                      {player.predicted_points.toFixed(1)}
                    </span>
                    <span className="block text-2xs text-surface-500 font-data tabular-nums">
                      {Math.max(0, player.predicted_points - player.uncertainty).toFixed(1)}–
                      {(player.predicted_points + player.uncertainty).toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={player.status} chance={player.chance_of_playing} compact />
                    {player.news && (
                      <p
                        className="text-xs text-surface-500 max-w-[160px] truncate mt-0.5"
                        title={player.news}
                      >
                        {player.news}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-data tabular-nums ${
                          player.form >= 8
                            ? "text-brand-400 font-semibold"
                            : player.form >= 5
                              ? "text-surface-100"
                              : "text-surface-500"
                        }`}
                      >
                        {player.form}
                      </span>
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
                    <span
                      className={`text-sm font-data tabular-nums ${
                        calcEO(player) > 100
                          ? "text-danger-400"
                          : calcEO(player) > 60
                            ? "text-warning-400"
                            : "text-surface-400"
                      }`}
                    >
                      {calcEO(player).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <FdrBadge opponent={player.opponent_name} fdrMap={FDR_MAP} />
                  </td>
                </tr>
                {expandedPlayer === player.element && (
                  <tr key={`${player.element}-detail`}>
                    <td colSpan={9}>
                      <div className="px-4 py-3 bg-surface-800/20 flex items-center gap-6 flex-wrap text-xs">
                        <div>
                          <span className="text-surface-500">xG</span>
                          <span className="ml-1.5 text-surface-200 font-data">
                            {player.xG || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-surface-500">xA</span>
                          <span className="ml-1.5 text-surface-200 font-data">
                            {player.xA || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-surface-500">Goals</span>
                          <span className="ml-1.5 text-surface-200 font-data">
                            {player.goals || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-surface-500">Assists</span>
                          <span className="ml-1.5 text-surface-200 font-data">
                            {player.assists || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-surface-500">Bonus</span>
                          <span className="ml-1.5 text-surface-200 font-data">
                            {player.bonus || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-surface-500">Minutes</span>
                          <span className="ml-1.5 text-surface-200 font-data">
                            {player.minutes || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-surface-500">ICT</span>
                          <span className="ml-1.5 text-surface-200 font-data">
                            {player.ict_index || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-surface-500">Uncertainty</span>
                          <span className="ml-1.5 text-surface-200 font-data">
                            ±{player.uncertainty?.toFixed(1) || 0}
                          </span>
                        </div>
                        <button
                          onClick={() => navigate(`/player/${player.element}`)}
                          className="ml-auto text-brand-400 hover:text-brand-300 transition-colors text-xs"
                        >
                          Full profile →
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>

        {filteredPredictions.length === 0 && (
          <EmptyState
            title="No players match your filters"
            message="Try adjusting the position filter or search query."
          />
        )}
      </div>

      {/* Secondary content — tabbed */}
      <div className="mt-10">
        <TabBar
          tabs={[
            { id: "differentials", label: "Differentials" },
            { id: "xg", label: "Goals vs xG" },
            { id: "prices", label: "Price Watch" },
          ]}
          active={bottomTab}
          onChange={(value) => setParam("tab", value)}
          id="dashboard-bottom"
        />

        <div className="pt-4">
          {bottomTab === "differentials" &&
            (() => {
              const diffs = [...mockPredictions]
                .filter((p) => p.status === "a" && p.selected_by_percent < 30)
                .sort((a, b) => calcDifferential(b) - calcDifferential(a))
                .slice(0, 5);
              const maxImpact = Math.max(...diffs.map((p) => calcDifferential(p)));
              return (
                <>
                  <p className="text-xs text-surface-500 mb-3">
                    Low-ownership players your opponents likely don't have. High impact = high
                    predicted points at low ownership.
                  </p>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-surface-800/60">
                        <th
                          scope="col"
                          className="text-xs text-surface-500 text-left py-1.5 font-normal w-8"
                        >
                          #
                        </th>
                        <th
                          scope="col"
                          className="text-xs text-surface-500 text-left py-1.5 font-normal"
                        >
                          Player
                        </th>
                        <th
                          scope="col"
                          className="text-xs text-surface-500 text-right py-1.5 font-normal w-16"
                        >
                          Own%
                        </th>
                        <th
                          scope="col"
                          className="text-xs text-surface-500 text-right py-1.5 font-normal w-16"
                        >
                          Pred.
                        </th>
                        <th
                          scope="col"
                          className="text-xs text-surface-500 text-right py-1.5 font-normal w-24"
                        >
                          Impact
                        </th>
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
                                >
                                  {p.web_name}
                                </span>
                                <span
                                  className={`text-xs ${POSITION_COLORS[p.position] || "text-surface-500"}`}
                                >
                                  {p.position}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 text-xs text-surface-500 text-right font-data tabular-nums">
                              {p.selected_by_percent}%
                            </td>
                            <td className="py-2 text-sm text-surface-300 text-right font-data tabular-nums">
                              {p.predicted_points.toFixed(1)}
                            </td>
                            <td className="py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-12 h-1.5 bg-surface-800 rounded overflow-hidden">
                                  <div
                                    className="h-full bg-brand-500/60 rounded"
                                    style={{ width: `${barPct}%` }}
                                  />
                                </div>
                                <span className="text-sm font-semibold text-surface-100 font-data tabular-nums w-8">
                                  {impact.toFixed(1)}
                                </span>
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
                      <span
                        className="text-sm text-surface-300 w-28 truncate hover:text-brand-400 transition-colors cursor-pointer"
                        onClick={() => navigate(`/player/${p.element}`)}
                      >
                        {p.web_name}
                      </span>
                      <span className="text-xs text-surface-500 w-20 text-right shrink-0">
                        {p.goals}G / {p.xG}xG
                      </span>
                      <div className="flex-1 flex items-center">
                        {over ? (
                          <div className="flex items-center w-full">
                            <div className="w-1/2" />
                            <div
                              className="h-2.5 bg-success-500/50 rounded-r"
                              style={{ width: `${barPct / 2}%` }}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-end w-full">
                            <div
                              className="h-2.5 bg-warning-500/50 rounded-l"
                              style={{ width: `${barPct / 2}%` }}
                            />
                            <div className="w-1/2" />
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-xs font-bold w-10 text-right ${over ? "text-success-400" : "text-warning-400"}`}
                      >
                        {over ? "+" : ""}
                        {diff.toFixed(1)}
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
                .sort(
                  (a, b) =>
                    Math.abs(b.transfers_in - b.transfers_out) -
                    Math.abs(a.transfers_in - a.transfers_out)
                )
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
                        <span
                          className={`inline-flex items-center justify-center w-5 h-5 rounded text-2xs font-bold ${t.cls}`}
                        >
                          {t.icon}
                        </span>
                        <span
                          className="text-sm text-surface-200 hover:text-brand-400 transition-colors cursor-pointer"
                          onClick={() => navigate(`/player/${p.element}`)}
                        >
                          {p.web_name}
                        </span>
                        <span className="text-xs text-surface-500">£{p.value}m</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span
                            className={`text-xs font-mono ${net > 0 ? "text-success-400" : "text-danger-400"}`}
                          >
                            {net > 0 ? "+" : ""}
                            {(net / 1000).toFixed(1)}k net
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
