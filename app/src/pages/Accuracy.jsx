import { useState, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { POSITION_COLORS } from "../lib/constants";
import { useAccuracy, useGameweek, usePagination } from "../hooks";
import { seasonContext } from "./accuracy/seasonContext";
import Loading from "../components/feedback/Loading";
import ErrorState from "../components/feedback/ErrorState";
import EmptyState from "../components/feedback/EmptyState";
import Pagination from "../components/ui/Pagination";

const POSITIONS = ["ALL", "GK", "DEF", "MID", "FWD"];
const PAGE_SIZE = 50;

function diffClass(d) {
  if (d >= 3) return "text-success-400";
  if (d <= -3) return "text-danger-400";
  return "text-surface-500";
}

export default function Accuracy() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useAccuracy();
  const { data: gwData } = useGameweek();
  const [modelId, setModelId] = useState(null);
  const [positionFilter, setPositionFilter] = useState("ALL");
  const tableHeadingRef = useRef(null);

  const modelIds = useMemo(() => Object.keys(data?.models ?? {}), [data]);
  // Default to config_d, the production model, when it was scored
  const selected = modelId ?? (modelIds.includes("config_d") ? "config_d" : modelIds[0]);
  const model = data?.models?.[selected];

  const players = useMemo(() => {
    const all = model?.players ?? [];
    return positionFilter === "ALL" ? all : all.filter((p) => p.position === positionFilter);
  }, [model, positionFilter]);

  // Before the early returns below, so the hook order stays stable across the
  // loading, error and empty states.
  const { page, setPage, totalPages, pageStart, pageItems } = usePagination(players, PAGE_SIZE);

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

  // Each model has its own XI from this gameweek on. Gameweeks scored before
  // per-model logging began have only the default model's, held at the top
  // level, so fall back to that for the model that produced it.
  const xi = model?.xi ?? (selected === data.defaultModel ? data.xi : null);
  const margin = xi && xi.average_manager != null ? xi.points - xi.average_manager : null;
  const context = seasonContext(data.gameweek, data.final, gwData?.current_gw);

  return (
    <div className="space-y-6 stagger">
      <div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-surface-900">Gameweek {data.gameweek} results</h2>
          {!data.final && <span className="badge badge-warning">provisional</span>}
        </div>
        {/* Said out loud rather than put in a title attribute: a reader on a
            phone has no way to hover, and this one changes how much they should
            trust the numbers below. */}
        {!data.final && (
          <p className="text-sm text-surface-600 mt-2">
            Bonus points can still change until FPL signs off the gameweek.
          </p>
        )}
        {(context.note || context.next != null) && (
          <p className="text-sm text-surface-600 mt-2">
            {context.note}
            {context.note && context.next != null && " "}
            {context.next != null && (
              <>
                Gameweek {context.next} is next.{" "}
                <Link to="/" className="link">
                  See its predictions
                </Link>
                .
              </>
            )}
          </p>
        )}
      </div>

      {!xi && (
        <p className="text-sm text-surface-500 py-5 border-y border-surface-200">
          No team was recorded for{" "}
          <span className="text-surface-700">{data.names[selected] ?? selected}</span> in gameweek{" "}
          {data.gameweek}. Only the published model's team was logged before this gameweek.
        </p>
      )}

      {xi && (
        /* The outcome before the statistics. The ranking score says the model
           orders players well; this says whether fielding the team it picked
           would actually have beaten the field. */
        <div className="py-5 border-y border-surface-200">
          <p className="text-base text-surface-800">
            The eleven{" "}
            <span className="font-semibold text-surface-900">
              {data.names[selected] ?? selected}
            </span>{" "}
            picked scored{" "}
            <span className="text-2xl font-bold font-data tabular-nums text-surface-900">
              {xi.points}
            </span>{" "}
            points.
            {margin != null && (
              <>
                {" "}
                That is{" "}
                <span
                  className={`font-semibold ${margin > 0 ? "text-success-400" : margin < 0 ? "text-danger-400" : "text-surface-800"}`}
                >
                  {margin > 0
                    ? `${margin} ahead of`
                    : margin < 0
                      ? `${-margin} behind`
                      : "level with"}
                </span>{" "}
                the average FPL manager.
              </>
            )}
          </p>

          <div className="flex items-center gap-8 flex-wrap mt-4">
            {xi.average_manager != null && (
              <div>
                <span className="text-lg font-bold font-data tabular-nums text-surface-800">
                  {xi.average_manager}
                </span>
                <span className="text-sm text-surface-500 ml-2">average manager</span>
              </div>
            )}
            {xi.highest != null && (
              <div>
                <span className="text-lg font-bold font-data tabular-nums text-surface-800">
                  {xi.highest}
                </span>
                <span className="text-sm text-surface-500 ml-2">best manager in the world</span>
              </div>
            )}
          </div>

          <div className="mt-4">
            <p className="text-xs text-surface-500 mb-2">
              The eleven it picked, and what each one actually scored
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {xi.players.map((p) => (
                <span key={p.element} className="text-sm text-surface-700">
                  {p.name}
                  {p.captain && (
                    <span className="text-brand-700 ml-1">
                      (C)<span className="sr-only"> captain, points doubled</span>
                    </span>
                  )}
                  <span className="ml-1.5 font-data tabular-nums font-semibold text-surface-900">
                    {p.actual ?? "-"}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 ref={tableHeadingRef} tabIndex={-1} className="section-label">
            Every player, by model
          </h2>
          <p className="text-xs text-surface-500 mt-1">
            How close each prediction was to what the player really scored.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <span className="text-sm text-surface-500">Model</span>
            <select
              value={selected}
              onChange={(e) => setModelId(e.target.value)}
              className="bg-surface-200 border border-surface-300 rounded px-3 py-1.5 text-sm text-surface-800 focus:outline-none cursor-pointer"
            >
              {modelIds.map((id) => (
                <option key={id} value={id}>
                  {data.names[id] ?? id}
                </option>
              ))}
            </select>
          </label>
          {/* Ranking first, error second: same order as the dashboard, same reason.
              A model can win on error by predicting low for everyone. */}
          {/* No tooltips: the labels beside each number already say what it
              means, and in plainer words than "Spearman rank correlation" would. */}
          <div className="flex items-center gap-5 text-sm">
            {model.spearman != null && (
              <div>
                <span className="font-data tabular-nums font-semibold text-brand-700">
                  {model.spearman.toFixed(2)}
                </span>
                <span className="text-surface-500 ml-1.5">ranking, 1 = perfect</span>
              </div>
            )}
            <div>
              <span className="font-data tabular-nums font-semibold text-surface-800">
                {model.mae?.toFixed(1) ?? "-"}
              </span>
              <span className="text-surface-500 ml-1.5">pts off, on average</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-0 border-b border-surface-200">
        {POSITIONS.map((pos) => (
          <button
            key={pos}
            onClick={() => setPositionFilter(pos)}
            className={`relative px-3 py-2 text-xs font-medium transition-colors ${
              positionFilter === pos
                ? "text-surface-900"
                : "text-surface-500 hover:text-surface-700"
            }`}
          >
            {pos}
            {positionFilter === pos && (
              <span className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-brand-600" />
            )}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-300">
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
              {/* The colours are the whole point of this column, so the key
                  sits under the table where everyone can read it. */}
              <th scope="col" className="table-header text-right py-2.5 px-3">
                Diff
              </th>
              <th scope="col" className="table-header text-right py-2.5 px-3">
                Mins
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((p, i) => {
              const diff = p.actual == null ? null : p.actual - p.predicted;
              return (
                <tr
                  key={p.element}
                  onClick={() => navigate(`/player/${p.element}`)}
                  className="border-b border-surface-200 hover:bg-surface-200/40 cursor-pointer transition-colors"
                >
                  <td className="py-2 px-3 text-xs text-surface-400 font-data tabular-nums">
                    {pageStart + i + 1}
                  </td>
                  <td className="py-2 px-3">
                    {/* A Link, not a span, so keyboard users can reach it. The row
                        click stays for mouse users; stopPropagation prevents the
                        two from navigating twice. */}
                    <Link
                      to={`/player/${p.element}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm text-surface-900 hover:text-brand-700 transition-colors"
                    >
                      {p.name}
                    </Link>
                    {p.position && (
                      <span className={`ml-2 text-2xs font-medium ${POSITION_COLORS[p.position]}`}>
                        {p.position}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-data tabular-nums text-sm text-surface-700">
                    {p.predicted.toFixed(1)}
                  </td>
                  <td className="py-2 px-3 text-right font-data tabular-nums text-sm text-surface-900">
                    {p.actual ?? "—"}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-data tabular-nums text-sm ${diff == null ? "text-surface-400" : diffClass(diff)}`}
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

        <p className="text-xs text-surface-500 mt-3">
          Diff is actual minus predicted. <span className="text-success-400">Green</span> means the
          player scored 3 or more above the prediction, <span className="text-danger-400">red</span>{" "}
          3 or more below.
        </p>

        <Pagination
          page={page}
          totalPages={totalPages}
          pageStart={pageStart}
          pageSize={PAGE_SIZE}
          total={players.length}
          onChange={(nextPage) => {
            setPage(nextPage);
            tableHeadingRef.current?.scrollIntoView();
            tableHeadingRef.current?.focus({ preventScroll: true });
          }}
        />
      </div>
    </div>
  );
}
