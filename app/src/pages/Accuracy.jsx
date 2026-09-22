import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
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

  const xi = data.xi;
  const margin = xi && xi.average_manager != null ? xi.points - xi.average_manager : null;

  return (
    <div className="space-y-6 stagger">
      <div className="flex items-center gap-3">
        <span className="text-sm text-surface-300">Gameweek {data.gameweek}</span>
        <span className="text-xs text-surface-500">how last week's predictions held up</span>
        {!data.final && (
          <span
            className="badge badge-warning"
            title="Bonus points can still change until FPL signs off the gameweek"
          >
            provisional
          </span>
        )}
      </div>

      {xi && (
        /* The outcome before the statistics. rho says the model ranks well;
           this says whether fielding the team it picked would have beaten the field. */
        <div className="py-3 border-y border-surface-800 space-y-2.5">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <span className="text-lg font-bold font-data tabular-nums text-surface-100">
                {xi.points}
              </span>
              <span className="text-xs text-surface-500 ml-1.5">the model's team</span>
            </div>
            {xi.average_manager != null && (
              <div>
                <span className="text-lg font-bold font-data tabular-nums text-surface-100">
                  {xi.average_manager}
                </span>
                <span className="text-xs text-surface-500 ml-1.5">average FPL manager</span>
              </div>
            )}
            {xi.highest != null && (
              <div>
                <span className="text-lg font-bold font-data tabular-nums text-surface-400">
                  {xi.highest}
                </span>
                <span className="text-xs text-surface-500 ml-1.5">best manager</span>
              </div>
            )}
            {margin != null && (
              <span
                className={`badge ${margin > 0 ? "badge-success" : margin < 0 ? "badge-danger" : "badge-info"}`}
              >
                {margin > 0
                  ? `beat the average by ${margin}`
                  : margin < 0
                    ? `${-margin} behind the average`
                    : "level with the average"}
              </span>
            )}
          </div>
          <div className="text-xs font-data tabular-nums text-surface-500">
            <span className="text-surface-600 mr-1.5">Team it picked</span>
            {xi.players.map((p, i) => (
              <span key={p.element}>
                {i > 0 && <span className="text-surface-700"> · </span>}
                <span className="text-surface-400">{p.name}</span>
                {p.captain && (
                  <span className="text-brand-400" title="Captain, points doubled">
                    {" "}
                    C
                  </span>
                )}{" "}
                {p.actual ?? "—"}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="text-xs text-surface-500">Every player, by model</span>
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
          {/* Ranking first, error second: same order as the dashboard, same reason.
              A model can win on error by predicting low for everyone. */}
          <span className="text-2xs font-data tabular-nums text-surface-500">
            {model.spearman != null && (
              <>
                <span title="Spearman rank correlation. 1.0 means the predicted order matched the actual order exactly.">
                  ranking <span className="text-brand-400">{model.spearman.toFixed(2)}</span>
                  <span className="text-surface-600"> / 1</span>
                </span>
                <span className="mx-1.5 text-surface-700">·</span>
              </>
            )}
            <span title="Mean absolute error: on average, how many points each prediction was off by">
              avg miss <span className="text-surface-300">{model.mae?.toFixed(1) ?? "—"} pts</span>
            </span>
            <span className="mx-1.5 text-surface-700">·</span>
            <span>{model.count} players</span>
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
              <th
                scope="col"
                className="table-header text-right py-2.5 px-3"
                title="Actual minus predicted. Green: scored 3+ more than predicted. Red: 3+ fewer."
              >
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
                    {/* A Link, not a span, so keyboard users can reach it. The row
                        click stays for mouse users; stopPropagation prevents the
                        two from navigating twice. */}
                    <Link
                      to={`/player/${p.element}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm text-surface-100 hover:text-brand-400 transition-colors"
                    >
                      {p.name}
                    </Link>
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
