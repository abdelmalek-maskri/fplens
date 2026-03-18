import { useState, useMemo, useEffect, Fragment } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { POSITION_COLORS, FDR_MAP } from "../lib/constants";
import MiniSparkline from "../components/charts/MiniSparkline";
import StatusBadge from "../components/badges/StatusBadge";
import FdrBadge from "../components/badges/FdrBadge";
import SortHeader from "../components/ui/SortHeader";
import TeamBadge from "../components/badges/TeamBadge";

import TabBar from "../components/ui/TabBar";
import ErrorState from "../components/feedback/ErrorState";
import EmptyState from "../components/feedback/EmptyState";
import Loading from "../components/feedback/Loading";
import { usePredictions } from "../hooks";
import DifferentialsTab from "./dashboard/DifferentialsTab";
import XGTab from "./dashboard/XGTab";
import PriceTab from "./dashboard/PriceTab";

const calcEO = (p) => p.selected_by_percent + p.captain_pct;

const POSITIONS = ["ALL", "GK", "DEF", "MID", "FWD"];

const POS_TAB_UNDERLINE = {
  ALL: "bg-brand-500",
  GK: "bg-warning-400",
  DEF: "bg-success-400",
  MID: "bg-brand-400",
  FWD: "bg-danger-400",
};

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
  useEffect(() => {
    if (!selectedModel && models.length > 0) setSelectedModel(models[0].id);
  }, [models, selectedModel]);
  const predictions = data?.predictions ?? [];
  const activeModel = models.find((m) => m.id === selectedModel) || models[0];

  const filteredPredictions = useMemo(() => {
    let result = [...predictions];
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
  }, [predictions, positionFilter, sortBy, sortDesc, searchQuery]);

  if (isLoading) return <Loading />;
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
      <div className="flex items-center justify-between">
        <span className="text-sm text-surface-500">
          {predictions.length} players ·{" "}
          {predictions.filter((p) => p.status === "d" || p.status === "i").length} flagged
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
            {filteredPredictions.map((p, idx) => (
              <Fragment key={p.element}>
                <tr
                  onClick={() => setExpandedPlayer(expandedPlayer === p.element ? null : p.element)}
                  className={`border-t border-surface-800/60 hover:bg-surface-800/40 transition-colors cursor-pointer ${
                    expandedPlayer === p.element ? "bg-surface-800/30" : ""
                  }`}
                >
                  <td className="py-2.5 px-3 text-surface-600 text-xs font-data tabular-nums w-8">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <TeamBadge team={p.team_name} />
                      <div>
                        <p
                          className="font-medium text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/player/${p.element}`);
                          }}
                        >
                          {p.web_name}
                        </p>
                        <p className="text-xs text-surface-500">
                          <span className={POSITION_COLORS[p.position]}>{p.position}</span>
                          {" · "}
                          {p.team_name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-base font-semibold font-data tabular-nums ${
                        p.predicted_points >= 6
                          ? "text-brand-400"
                          : p.predicted_points >= 3.5
                            ? "text-surface-100"
                            : "text-surface-500"
                      }`}
                    >
                      {p.predicted_points.toFixed(1)}
                    </span>
                    <span className="block text-2xs text-surface-500 font-data tabular-nums">
                      {Math.max(0, p.predicted_points - p.uncertainty).toFixed(1)}–
                      {(p.predicted_points + p.uncertainty).toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={p.status} chance={p.chance_of_playing} compact />
                    {p.news && (
                      <p
                        className="text-xs text-surface-500 max-w-[160px] truncate mt-0.5"
                        title={p.news}
                      >
                        {p.news}
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-data tabular-nums ${
                          p.form >= 8
                            ? "text-brand-400 font-semibold"
                            : p.form >= 5
                              ? "text-surface-100"
                              : "text-surface-500"
                        }`}
                      >
                        {p.form}
                      </span>
                      <MiniSparkline pts={p.pts_last5} />
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">
                    £{p.value}m
                  </td>
                  <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">
                    {p.selected_by_percent}%
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-sm font-data tabular-nums ${
                        calcEO(p) > 100
                          ? "text-danger-400"
                          : calcEO(p) > 60
                            ? "text-warning-400"
                            : "text-surface-400"
                      }`}
                    >
                      {calcEO(p).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <FdrBadge opponent={p.opponent_name} fdrMap={FDR_MAP} />
                  </td>
                </tr>
                {expandedPlayer === p.element && (
                  <tr key={`${p.element}-detail`}>
                    <td colSpan={9}>
                      <div className="px-4 py-3 bg-surface-800/20 flex items-center gap-6 flex-wrap text-xs">
                        <div>
                          <span className="text-surface-500">xG</span>
                          <span className="ml-1.5 text-surface-200 font-data">{p.xG || 0}</span>
                        </div>
                        <div>
                          <span className="text-surface-500">xA</span>
                          <span className="ml-1.5 text-surface-200 font-data">{p.xA || 0}</span>
                        </div>
                        <div>
                          <span className="text-surface-500">Goals</span>
                          <span className="ml-1.5 text-surface-200 font-data">{p.goals || 0}</span>
                        </div>
                        <div>
                          <span className="text-surface-500">Assists</span>
                          <span className="ml-1.5 text-surface-200 font-data">
                            {p.assists || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-surface-500">Bonus</span>
                          <span className="ml-1.5 text-surface-200 font-data">{p.bonus || 0}</span>
                        </div>
                        <div>
                          <span className="text-surface-500">Minutes</span>
                          <span className="ml-1.5 text-surface-200 font-data">
                            {p.minutes || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-surface-500">ICT</span>
                          <span className="ml-1.5 text-surface-200 font-data">
                            {p.ict_index || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-surface-500">Uncertainty</span>
                          <span className="ml-1.5 text-surface-200 font-data">
                            ±{p.uncertainty?.toFixed(1) || 0}
                          </span>
                        </div>
                        <button
                          onClick={() => navigate(`/player/${p.element}`)}
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
          {bottomTab === "differentials" && <DifferentialsTab predictions={predictions} />}
          {bottomTab === "xg" && <XGTab predictions={predictions} />}
          {bottomTab === "prices" && <PriceTab predictions={predictions} />}
        </div>
      </div>
    </div>
  );
}
