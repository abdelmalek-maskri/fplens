import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { POSITION_COLORS } from "../lib/constants";
import { useAccuracy } from "../hooks";
import Loading from "../components/feedback/Loading";
import ErrorState from "../components/feedback/ErrorState";
import EmptyState from "../components/feedback/EmptyState";

const POSITIONS = ["ALL", "GK", "DEF", "MID", "FWD"];

function diffClass(d) {
  if (d >= 3) return "text-success-400";
  if (d <= -3) return "text-danger-400";
  return "text-surface-500";
}

export default function Accuracy() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useAccuracy();
  const [modelId, setModelId] = useState(null);
  const [positionFilter, setPositionFilter] = useState("ALL");

  const modelIds = useMemo(() => Object.keys(data?.models ?? {}), [data]);
  // Default to config_d, the production model, when it was scored
  const selected = modelId ?? (modelIds.includes("config_d") ? "config_d" : modelIds[0]);
  const model = data?.models?.[selected];

  const players = useMemo(() => {
    const all = model?.players ?? [];
    return positionFilter === "ALL" ? all : all.filter((p) => p.position === positionFilter);
  }, [model, positionFilter]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Failed to load accuracy." />;
  if (!data || !model) {
    return (
      <EmptyState
        title="No gameweek scored yet"
        message="Results appear the morning after a gameweek finishes."
      />
    );
  }

  return (
    <div className="space-y-6 stagger">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-surface-500">Gameweek {data.gameweek}</span>
          {!data.final && (
            <span
              className="badge badge-warning"
              title="Bonus points can still change until FPL signs off the gameweek"
            >
              provisional
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selected}
            onChange={(e) => setModelId(e.target.value)}
            className="bg-surface-800 border border-surface-700 rounded px-2 py-1 text-xs text-surface-300 focus:outline-none cursor-pointer"
          >
            {modelIds.map((id) => (
              <option key={id} value={id}>
                {data.names[id] ?? id}
              </option>
            ))}
          </select>
          {/* rho first, MAE second: same order as the dashboard, same reason.
              A model can win on MAE by predicting low for everyone. */}
          <span className="text-2xs font-data tabular-nums text-surface-500">
            {model.spearman != null && (
              <>
                <span className="text-brand-400" title="Spearman rank correlation">
                  ρ {model.spearman.toFixed(3)}
                </span>
                <span className="mx-1.5 text-surface-700">·</span>
              </>
            )}
            <span title="Mean absolute error">MAE {model.mae?.toFixed(2) ?? "—"}</span>
            <span className="mx-1.5 text-surface-700">·</span>
            <span>{model.count} scored</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-0 border-b border-surface-800">
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            onClick={() => setPositionFilter(pos)}
            className={`relative px-3 py-2 text-xs font-medium transition-colors ${
              positionFilter === pos
                ? "text-surface-100"
                : "text-surface-500 hover:text-surface-300"
            }`}
          >
            {pos}
            {positionFilter === pos && (
              <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-brand-500" />
            )}
          </button>
        ))}
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
              <th scope="col" className="table-header text-right py-2.5 px-3">
                Predicted
              </th>
              <th scope="col" className="table-header text-right py-2.5 px-3">
                Actual
              </th>
              <th scope="col" className="table-header text-right py-2.5 px-3">
                Diff
              </th>
              <th scope="col" className="table-header text-right py-2.5 px-3">
                Mins
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => {
              const diff = p.actual == null ? null : p.actual - p.predicted;
              return (
                <tr
                  key={p.element}
                  onClick={() => navigate(`/player/${p.element}`)}
                  className="border-b border-surface-800 hover:bg-surface-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-2 px-3 text-xs text-surface-600 font-data tabular-nums">
                    {i + 1}
                  </td>
                  <td className="py-2 px-3">
                    <span className="text-sm text-surface-100">{p.name}</span>
                    {p.position && (
                      <span className={`ml-2 text-2xs font-medium ${POSITION_COLORS[p.position]}`}>
                        {p.position}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-data tabular-nums text-sm text-surface-300">
                    {p.predicted.toFixed(1)}
                  </td>
                  <td className="py-2 px-3 text-right font-data tabular-nums text-sm text-surface-100">
                    {p.actual ?? "—"}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-data tabular-nums text-sm ${diff == null ? "text-surface-600" : diffClass(diff)}`}
                  >
                    {diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`}
                  </td>
                  <td className="py-2 px-3 text-right font-data tabular-nums text-xs text-surface-500">
                    {p.minutes ?? "—"}
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
