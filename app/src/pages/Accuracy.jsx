import { useState, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { POSITION_COLORS } from "../lib/constants";
import { useAccuracy, useGameweek, usePagination } from "../hooks";
import { seasonContext } from "./accuracy/seasonContext";
import { gameweekPhase } from "../lib/freshness";
import XiPitch from "./accuracy/XiPitch";
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

function XiTotal({ value, label, hero = false }) {
  return (
    <div>
      <div
        className={`font-data tabular-nums font-bold leading-none ${
          hero ? "text-5xl text-surface-900" : "text-3xl text-surface-700"
        }`}
      >
        {value}
      </div>
      <div className="section-label mt-2">{label}</div>
    </div>
  );
}

/**
 * Where this eleven landed between the average manager and the best in the world.
 *
 * The three totals above answer "what were the numbers". This answers "was that
 * good", which is the question a reader actually has and the one three digits
 * in a row make them work out for themselves.
 */
function XiTrack({ points, average, highest }) {
  // Without a top of the scale there is nothing to be a fraction of. The track
  // is the only part of this block that needs it, so it goes rather than the
  // numbers above.
  if (!highest || highest <= 0) return null;
  const pct = (n) => `${Math.min(Math.max((n / highest) * 100, 0), 100)}%`;

  return (
    <div className="mt-6 mx-auto max-w-lg">
      <div className="relative h-2 rounded-full bg-surface-200">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand-600"
          style={{ width: pct(points) }}
        />
        {average != null && (
          <span
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-4 rounded bg-surface-600"
            style={{ left: pct(average) }}
          />
        )}
      </div>
      {/* The average label is pinned to its tick rather than laid out in the
          row. Centred by the flex it would sit mid-track whatever the value
          was, which is worse than no label: it would claim a position. */}
      <div className="relative flex justify-between text-2xs text-surface-500 mt-1.5">
        <span>0</span>
        {average != null && (
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${Math.min(Math.max((average / highest) * 100, 0), 100)}%` }}
          >
            average {average}
          </span>
        )}
        <span>{highest} best</span>
      </div>
    </div>
  );
}

export default function Accuracy() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useAccuracy();
  const { data: gwData } = useGameweek();
  const [modelId, setModelId] = useState(null);
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  // Collapsed by default. The pitch is 520px tall and pushes the per-player
  // table off the screen, and the table is what most visitors came for.
  const [showPitch, setShowPitch] = useState(false);
  const tableHeadingRef = useRef(null);

  const modelIds = useMemo(() => Object.keys(data?.models ?? {}), [data]);
  // Default to config_d, the production model, when it was scored
  const selected = modelId ?? (modelIds.includes("config_d") ? "config_d" : modelIds[0]);
  const model = data?.models?.[selected];

  const players = useMemo(() => {
    const all = model?.players ?? [];
    const query = searchQuery.trim().toLowerCase();
    return all.filter(
      (p) =>
        (positionFilter === "ALL" || p.position === positionFilter) &&
        (!query || p.name.toLowerCase().includes(query))
    );
  }, [model, positionFilter, searchQuery]);

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
  const phase = gameweekPhase(gwData?.predicted_gw, gwData?.deadline);
  const context = seasonContext(data.gameweek, data.final, phase.gw, phase.locked);

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
        {(context.note || context.next != null || context.inPlay != null) && (
          <p className="text-sm text-surface-600 mt-2">
            {context.note}
            {context.note && (context.next != null || context.inPlay != null) && " "}
            {context.next != null && (
              <>
                Gameweek {context.next} is next.{" "}
                <Link to="/" className="link">
                  See its predictions
                </Link>
                .
              </>
            )}
            {context.inPlay != null && (
              <>
                Gameweek {context.inPlay} is being played now.{" "}
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
           would actually have beaten the field.

           The three totals sit side by side at the same size, because the
           question is how they compare, and three separate sentences made the
           reader hold two numbers in their head to answer it. The track does
           the rest: 61 against 55 and 139 is "just above average and nowhere
           near the top", which the digits alone do not show. */
        <div className="py-6 border-y border-surface-200 text-center">
          <p className="section-label">{data.names[selected] ?? selected} picked</p>

          <div className="mt-4 flex items-start justify-center gap-10 sm:gap-16 flex-wrap">
            <XiTotal value={xi.points} label="this eleven" hero />
            {xi.average_manager != null && (
              <XiTotal value={xi.average_manager} label="average manager" />
            )}
            {xi.highest != null && <XiTotal value={xi.highest} label="best in the world" />}
          </div>

          {margin != null && (
            <p
              className={`mt-3 text-sm font-semibold ${
                margin > 0
                  ? "text-success-400"
                  : margin < 0
                    ? "text-danger-400"
                    : "text-surface-500"
              }`}
            >
              {margin > 0
                ? `${margin} ahead of the average manager`
                : margin < 0
                  ? `${-margin} behind the average manager`
                  : "level with the average manager"}
            </p>
          )}

          <XiTrack points={xi.points} average={xi.average_manager} highest={xi.highest} />

          <div className="mt-6 pt-5 border-t border-surface-200">
            <button
              type="button"
              onClick={() => setShowPitch((v) => !v)}
              aria-expanded={showPitch}
              aria-controls="accuracy-xi-pitch"
              className="inline-flex items-center gap-2 rounded border border-surface-300 px-3 py-1.5 text-sm text-surface-700 hover:border-surface-400 hover:text-surface-900 transition-colors"
            >
              The 11 that this model chose
              <span aria-hidden="true">{showPitch ? "\u25b4" : "\u25be"}</span>
            </button>

            {showPitch && (
              <div id="accuracy-xi-pitch" className="mt-4 text-left">
                <XiPitch players={xi.players} />
              </div>
            )}
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
        <div className="flex items-center gap-4 flex-wrap">
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
        </div>
      </div>

      {/* The position tabs and the search share a row and a bottom border, so
          they read as one set of controls over the table below. 670 rows at 50
          a page is 14 pages, which is more than anyone pages through to find
          one player. */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-surface-200">
        <div className="flex items-center gap-0">
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

        <div className="relative pb-1">
          <svg
            className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
            />
          </svg>
          <input
            type="text"
            aria-label="Search players"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="bg-transparent border-b border-surface-300 pl-5 pr-2 py-1.5 text-sm text-surface-900 placeholder:text-surface-400 w-44 focus:border-surface-500 focus:outline-none transition-colors"
          />
        </div>
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
