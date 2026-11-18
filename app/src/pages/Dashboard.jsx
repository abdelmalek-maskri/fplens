import { useState, useMemo, useRef, Fragment } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { POSITION_COLORS } from "../lib/constants";
import StatusBadge from "../components/badges/StatusBadge";
import FdrBadge from "../components/badges/FdrBadge";
import SortHeader from "../components/ui/SortHeader";
import TeamBadge from "../components/badges/TeamBadge";
import PlayerLink from "../components/ui/PlayerLink";

import ErrorState from "../components/feedback/ErrorState";
import EmptyState from "../components/feedback/EmptyState";
import Loading from "../components/feedback/Loading";
import Pagination from "../components/ui/Pagination";
import { usePredictions, useFixtures, usePagination } from "../hooks";
import { getPlayer } from "../lib/api";
import { describe } from "../lib/shap";
import DifferentialsTab from "./dashboard/DifferentialsTab";
import XGTab from "./dashboard/XGTab";
import PriceTab from "./dashboard/PriceTab";
import GameweekFixtures from "./dashboard/GameweekFixtures";

const calcEO = (p) => p.selected_by_percent + p.captain_pct;

// FPL marks doubtful and injured separately, and both mean "may not play".
// Shared so the count in the header and the filter can never disagree.
const isFlagged = (p) => p.status === "d" || p.status === "i";

// Toggle rather than link: these change what the table shows, so they need to
// read as controls with an on and an off state, not as navigation.
function FilterChip({ active, onClick, children, ...props }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded border text-xs transition-colors ${
        active
          ? "border-brand-600/50 bg-brand-600/10 text-brand-500"
          : "border-surface-300 text-surface-600 hover:text-surface-800 hover:border-surface-400"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

const POSITIONS = ["ALL", "GK", "DEF", "MID", "FWD"];

// The expandable panels above the table, in the order their chips appear.
const PANELS = [
  { id: "fixtures", label: "Fixtures" },
  { id: "differentials", label: "Differentials" },
  { id: "xg", label: "Goals vs xG" },
  { id: "prices", label: "Price Watch" },
];

// All ~670 players match an empty filter, and a table that long pushes
// everything below it thousands of pixels out of reach.
const PAGE_SIZE = 50;

const POS_TAB_UNDERLINE = {
  ALL: "bg-brand-600",
  GK: "bg-warning-400",
  DEF: "bg-success-400",
  MID: "bg-brand-700",
  FWD: "bg-danger-400",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const positionFilter = searchParams.get("pos") || "ALL";
  // Which expandable panel is open, or "" for none. Fixtures, differentials,
  // xG and prices all behave the same way, so they share one piece of state
  // rather than a boolean for fixtures and a tab index for the other three.
  // In the address bar, so a link can point at the panel it is talking about.
  const panel = searchParams.get("panel") || "";
  const setParam = (key, value) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set(key, value);
      return p;
    });
  };
  // Flagged lives in the URL beside the position filter, because both narrow the
  // table and both are worth keeping on a refresh.
  const flaggedOnly = searchParams.get("flagged") === "1";
  const [sortBy, setSortBy] = useState("predicted_points");
  const [sortDesc, setSortDesc] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  // Null means "whichever model the snapshot published", which usePredictions
  // resolves from the manifest. Copying models[0].id into here once models.json
  // landed changed this hook's argument and refetched the same predictions file
  // a second time, with a loading flash in between.
  const [selectedModel, setSelectedModel] = useState(null);
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const tableHeadingRef = useRef(null);

  const { data, models, isLoading, error } = usePredictions(selectedModel);
  const { data: fixtureData, error: fixtureError } = useFixtures();

  // SHAP lives in players.json, not the predictions file, so it is fetched on
  // the first expand rather than with the table. getPlayer reads the whole file
  // and the browser caches it, so every expand after the first is free.
  const [shapById, setShapById] = useState({});
  const expand = (element) => {
    setExpandedPlayer((cur) => (cur === element ? null : element));
    if (shapById[element] === undefined) {
      setShapById((prev) => ({ ...prev, [element]: null }));
      getPlayer(element)
        .then((full) => setShapById((prev) => ({ ...prev, [element]: full.shap ?? [] })))
        .catch(() => setShapById((prev) => ({ ...prev, [element]: [] })));
    }
  };

  // FPL's own rating of this club's next fixture. Replaces a hardcoded map of
  // club strengths that was a season out of date and missing four clubs.
  const fdrFor = (teamName) =>
    fixtureData?.fixtures[teamName]?.find((f) => f.gw === fixtureData.currentGw)?.atkFdr;
  const predictions = useMemo(() => data?.predictions ?? [], [data]);

  // Everything the other filters allow, before the flagged toggle narrows it.
  // The toggle's own count is read off this, so it answers "how many of what I
  // am looking at" rather than "how many in the whole league".
  const scopedPredictions = useMemo(() => {
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
    return result;
  }, [predictions, positionFilter, searchQuery]);

  const flaggedCount = useMemo(
    () => scopedPredictions.filter(isFlagged).length,
    [scopedPredictions]
  );

  const filteredPredictions = useMemo(() => {
    const result = flaggedOnly ? scopedPredictions.filter(isFlagged) : [...scopedPredictions];
    result.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortDesc ? bVal - aVal : aVal - bVal;
    });
    return result;
  }, [scopedPredictions, flaggedOnly, sortBy, sortDesc]);

  const { page, setPage, totalPages, pageStart, pageItems } = usePagination(
    filteredPredictions,
    PAGE_SIZE
  );

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
        <div className="flex items-center gap-2">
          <span className="text-sm text-surface-500 tabular-nums">
            {filteredPredictions.length === predictions.length
              ? `${predictions.length} players`
              : `${filteredPredictions.length} of ${predictions.length} players`}
          </span>

          <FilterChip
            active={flaggedOnly}
            onClick={() => setParam("flagged", flaggedOnly ? "0" : "1")}
            aria-pressed={flaggedOnly}
          >
            {flaggedCount} flagged
          </FilterChip>

          {/* These four were two mechanisms doing one job: Fixtures was a
              disclosure up here, while Differentials, Goals vs xG and Price
              Watch were a tab strip below the table. Fifty rows and a
              pagination bar sat in between, so nobody scrolled that far. One
              accordion, all four, above the table. */}
          {PANELS.map((p) => (
            <FilterChip
              key={p.id}
              active={panel === p.id}
              onClick={() => setParam("panel", panel === p.id ? "" : p.id)}
              aria-expanded={panel === p.id}
              aria-controls="dashboard-panel"
            >
              {p.label} {panel === p.id ? "▴" : "▾"}
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {models.length > 0 && (
            <label className="flex items-center gap-2">
              <span className="text-xs text-surface-500">Model</span>
              <select
                value={selectedModel || models[0]?.id || ""}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-surface-200 border border-surface-300 rounded px-2 py-1 text-xs text-surface-700 focus:outline-none cursor-pointer"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {panel && (
        <section id="dashboard-panel" aria-label={PANELS.find((p) => p.id === panel)?.label}>
          {panel === "fixtures" &&
            (fixtureError ? (
              <p className="border-y border-surface-200 py-3 text-sm text-surface-600">
                Fixtures are currently unavailable.
              </p>
            ) : (
              <GameweekFixtures fixtureData={fixtureData} />
            ))}
          {panel === "differentials" && <DifferentialsTab predictions={predictions} />}
          {panel === "xg" && <XGTab predictions={predictions} />}
          {panel === "prices" && <PriceTab predictions={predictions} />}
        </section>
      )}

      <h2 ref={tableHeadingRef} tabIndex={-1} className="sr-only">
        Player predictions
      </h2>
      <div className="flex items-center justify-between border-b border-surface-200">
        <div className="flex items-center gap-0">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setParam("pos", pos)}
              className={`px-3 py-2 text-sm font-medium transition-colors relative ${
                positionFilter === pos
                  ? "text-surface-900"
                  : "text-surface-500 hover:text-surface-700"
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
            className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400"
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
            aria-label="Search players"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-b border-surface-300 pl-5 pr-2 py-2 text-sm text-surface-900 placeholder:text-surface-400 w-44 focus:border-surface-500 focus:outline-none transition-colors"
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
              <SortHeader
                field="predicted_points"
                sortBy={sortBy}
                sortDesc={sortDesc}
                onSort={handleSort}
              >
                Predicted
              </SortHeader>
              <th scope="col" className="table-header text-left py-2.5 px-3 w-56">
                Availability
              </th>
              <SortHeader field="form" sortBy={sortBy} sortDesc={sortDesc} onSort={handleSort}>
                Form
                <span className="block text-2xs font-normal normal-case text-surface-400">
                  pts / game
                </span>
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
                Owned by
              </SortHeader>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Effective
                <span className="block text-2xs font-normal normal-case text-surface-400">
                  owned + captained
                </span>
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Fixture
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((p, idx) => (
              <Fragment key={p.element}>
                <tr
                  onClick={() => expand(p.element)}
                  className={`border-t border-surface-200/60 hover:bg-surface-200/40 transition-colors cursor-pointer ${
                    expandedPlayer === p.element ? "bg-surface-200/30" : ""
                  }`}
                >
                  <td className="py-2.5 px-3 w-8">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        expand(p.element);
                      }}
                      aria-expanded={expandedPlayer === p.element}
                      aria-label={`${pageStart + idx + 1}. Why ${p.web_name} is predicted ${p.predicted_points.toFixed(1)}`}
                      className="text-surface-400 text-xs font-data tabular-nums hover:text-surface-700 transition-colors"
                    >
                      {pageStart + idx + 1}
                    </button>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <TeamBadge team={p.team_name} />
                      <div>
                        <PlayerLink
                          element={p.element}
                          stopPropagation
                          className="block font-medium text-surface-900"
                        >
                          {p.web_name}
                        </PlayerLink>
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
                          ? "text-brand-700"
                          : p.predicted_points >= 3.5
                            ? "text-surface-900"
                            : "text-surface-500"
                      }`}
                    >
                      {p.predicted_points.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {p.status === "a" ? (
                      <span className="text-xs text-surface-500">Fit</span>
                    ) : (
                      <StatusBadge status={p.status} />
                    )}
                    {p.news && <p className="text-xs text-surface-500 mt-0.5">{p.news}</p>}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-data tabular-nums ${
                          p.form >= 8
                            ? "text-brand-700 font-semibold"
                            : p.form >= 5
                              ? "text-surface-900"
                              : "text-surface-500"
                        }`}
                      >
                        {p.form.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-surface-700 font-data tabular-nums">
                    £{p.value.toFixed(1)}m
                  </td>
                  <td className="py-2.5 px-3 text-surface-700 font-data tabular-nums">
                    {p.selected_by_percent.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-sm font-data tabular-nums ${
                        calcEO(p) > 100
                          ? "text-danger-400"
                          : calcEO(p) > 60
                            ? "text-warning-400"
                            : "text-surface-600"
                      }`}
                    >
                      {calcEO(p).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <FdrBadge opponent={p.opponent_name} fdr={fdrFor(p.team_name)} />
                  </td>
                </tr>
                {expandedPlayer === p.element && (
                  <tr key={`${p.element}-detail`}>
                    <td colSpan={9} className="bg-surface-200/20">
                      <div className="px-4 py-3">
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="section-label">Why {p.predicted_points.toFixed(1)}</span>
                          <span className="text-2xs text-surface-500">
                            the biggest factors, in points
                          </span>
                        </div>
                        {shapById[p.element] == null ? (
                          <p className="text-xs text-surface-500">Loading...</p>
                        ) : shapById[p.element].length === 0 ? (
                          <p className="text-xs text-surface-500">
                            No breakdown available for this player.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-x-8 gap-y-1 max-w-4xl">
                            {shapById[p.element].map((factor) => (
                              <div
                                key={factor.feature}
                                className="flex items-center gap-2 text-xs w-72"
                              >
                                <span className="text-surface-700 flex-1 truncate">
                                  {describe(factor, p)}
                                </span>
                                <span
                                  className={`font-data tabular-nums font-medium ${
                                    factor.impact > 0 ? "text-success-400" : "text-danger-400"
                                  }`}
                                >
                                  {factor.impact > 0 ? "+" : "\u2212"}
                                  {Math.abs(factor.impact).toFixed(1)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/player/${p.element}`);
                          }}
                          className="link-action mt-2 text-xs"
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
            message={
              searchQuery
                ? "Try a different search or adjust your filters."
                : flaggedOnly
                  ? "No flagged players in this position. Turn off the flagged filter to see everyone."
                  : "Try adjusting the position filter or search query."
            }
          />
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          pageStart={pageStart}
          pageSize={PAGE_SIZE}
          total={filteredPredictions.length}
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
