import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { POSITION_COLORS, FDR_MAP } from "../lib/constants";
import { PitchView } from "../components/pitch";
import StatusBadge from "../components/StatusBadge";
import TeamBadge from "../components/TeamBadge";
import FdrBadge from "../components/FdrBadge";
import ErrorState from "../components/ErrorState";
import { useTeam } from "../hooks";

// ============================================================
// FPL ID HELP — collapsible details
// ============================================================
const FplIdHelp = () => (
  <details className="text-surface-400">
    <summary className="cursor-pointer text-sm text-surface-400 hover:text-surface-200 transition-colors">
      How to find your FPL ID
    </summary>
    <div className="mt-3 space-y-0 text-sm text-surface-400">
      <div className="border-l-2 border-surface-700 pl-3 py-2.5">
        <p className="text-surface-200 font-medium mb-2">Website</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Log in at <span className="font-mono text-surface-300">fantasy.premierleague.com</span>
          </li>
          <li>
            Click <span className="text-surface-200">Points</span> or{" "}
            <span className="text-surface-200">My Team</span>
          </li>
          <li>
            Copy the number after <span className="font-mono text-brand-400">/entry/</span> in the
            URL
          </li>
        </ol>
        <div className="mt-2.5 bg-surface-800 rounded px-3 py-2 font-mono text-xs text-surface-500 inline-block">
          fantasy.premierleague.com/entry/
          <span className="text-brand-400 font-semibold">1234567</span>/event/20
        </div>
      </div>
      <div className="border-l-2 border-surface-700 pl-3 py-2.5">
        <p className="text-surface-200 font-medium mb-2">Mobile App</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Open the FPL app → <span className="text-surface-200">Points</span> tab
          </li>
          <li>
            Tap <span className="text-surface-200">⋯</span> (top-right) →{" "}
            <span className="text-surface-200">Share Team Link</span>
          </li>
          <li>The number in the shared link is your ID</li>
        </ol>
      </div>
    </div>
  </details>
);

// ============================================================
// MY TEAM PAGE
// ============================================================
export default function MyTeam() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = searchParams.get("view") || "pitch";
  const setViewMode = (value) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("view", value);
      return p;
    });
  };
  const submittedId = searchParams.get("fpl_id") || localStorage.getItem("fpl_id") || null;
  const [fplId, setFplId] = useState(submittedId || "");

  // Recent FPL IDs history
  const getRecentIds = () => {
    try {
      return JSON.parse(localStorage.getItem("fpl_id_history") || "[]");
    } catch {
      return [];
    }
  };
  const [recentIds, setRecentIds] = useState(getRecentIds);

  const saveToHistory = (id, managerName) => {
    const history = getRecentIds().filter((h) => h.id !== id);
    history.unshift({ id, name: managerName || `Team ${id}`, time: Date.now() });
    const trimmed = history.slice(0, 5); // keep last 5
    localStorage.setItem("fpl_id_history", JSON.stringify(trimmed));
    setRecentIds(trimmed);
  };

  const removeFromHistory = (id) => {
    const history = getRecentIds().filter((h) => h.id !== id);
    localStorage.setItem("fpl_id_history", JSON.stringify(history));
    setRecentIds(history);
    if (id === submittedId) setSubmittedId(null);
  };

  const setSubmittedId = (id) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (id) {
        p.set("fpl_id", id);
        localStorage.setItem("fpl_id", id);
      } else {
        p.delete("fpl_id");
        localStorage.removeItem("fpl_id");
      }
      return p;
    });
  };

  const { data: teamData, isLoading, error } = useTeam(submittedId);

  const team = teamData?.team ?? null;
  const transferSuggestions = teamData?.transferSuggestions ?? [];

  // Save to history when team loads successfully
  const managerName = team?.manager_name || teamData?.manager_name;
  if (team && submittedId) {
    const already = recentIds.find((h) => h.id === submittedId);
    if (!already || (managerName && already.name !== managerName)) {
      saveToHistory(submittedId, managerName);
    }
  }

  const handleLoadTeam = (e) => {
    e.preventDefault();
    if (fplId) setSubmittedId(fplId);
  };

  const handlePlayerClick = (elementId) => {
    navigate(`/player/${elementId}`);
  };

  // ---- FPL ID input screen ----
  if (!team) {
    return (
      <div className="max-w-sm mx-auto mt-16 space-y-5">
        <form onSubmit={handleLoadTeam} className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={fplId}
            onChange={(e) => setFplId(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter your FPL Team ID"
            className="w-full bg-surface-800 border border-surface-700 rounded pl-9 pr-20 py-2.5 text-surface-100 font-data tabular-nums placeholder:text-surface-600 focus:border-brand-500 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!fplId || isLoading}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded bg-brand-600 text-white text-sm font-medium transition-colors hover:bg-brand-500 disabled:opacity-40 disabled:pointer-events-none"
          >
            {isLoading ? "Loading…" : "Load"}
          </button>
        </form>
        {error && (
          <p className="text-sm text-danger-400">
            {error.message || "Failed to load team. Check your FPL ID."}
          </p>
        )}

        {/* Recent IDs */}
        {recentIds.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider text-surface-500 font-medium">
              Recent
            </span>
            {recentIds.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-2 group"
              >
                <button
                  onClick={() => {
                    setFplId(h.id);
                    setSubmittedId(h.id);
                  }}
                  className="flex-1 text-left px-3 py-1.5 rounded border border-surface-700/50 text-sm hover:border-brand-500/30 hover:bg-brand-500/5 transition-colors"
                >
                  <span className="text-surface-200 font-data">{h.id}</span>
                  <span className="text-surface-500 ml-2">{h.name}</span>
                </button>
                <button
                  onClick={() => removeFromHistory(h.id)}
                  className="text-surface-700 hover:text-danger-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <FplIdHelp />
      </div>
    );
  }

  // ---- Team loaded ----
  const starters = team.picks.filter((p) => p.multiplier >= 1);
  const bench = team.picks.filter((p) => p.multiplier === 0);

  // Captain recommendations based on predicted points
  const sortedByPredicted = [...starters].sort((a, b) => b.predicted_points - a.predicted_points);
  const recommendedCaptain = sortedByPredicted[0];
  const recommendedVice = sortedByPredicted[1];
  const currentCaptain = starters.find((p) => p.is_captain);
  const captainMismatch =
    recommendedCaptain && currentCaptain && recommendedCaptain.element !== currentCaptain.element;

  const totalPredicted = starters.reduce((sum, p) => sum + p.predicted_points * p.multiplier, 0);

  // Alerts: injuries, doubtful, tough fixtures, bench outscoring starters
  const injuredStarters = starters.filter((p) => p.status === "i");
  const doubtfulStarters = starters.filter((p) => p.status === "d");
  const toughFixtureStarters = starters.filter(
    (p) => p.status !== "i" && FDR_MAP[p.opponent_name] >= 4
  );
  const benchOutscoring = bench.filter((bp) =>
    starters.some(
      (sp) =>
        sp.position === bp.position &&
        sp.status === "a" &&
        bp.predicted_points > sp.predicted_points
    )
  );

  const hasAlerts =
    injuredStarters.length > 0 ||
    doubtfulStarters.length > 0 ||
    toughFixtureStarters.length > 0 ||
    benchOutscoring.length > 0;

  const formation = `${starters.filter((p) => p.position === "DEF").length}-${starters.filter((p) => p.position === "MID").length}-${starters.filter((p) => p.position === "FWD").length}`;

  return (
    <div className="space-y-6 stagger">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/optimal-xi")} className="btn-ghost text-sm">
            Optimal XI
          </button>
          <button onClick={() => navigate("/transfers")} className="btn-ghost text-sm">
            Plan Transfers
          </button>
        </div>
        <button
          onClick={() => {
            setSubmittedId(null);
            setFplId("");
          }}
          className="btn-ghost text-sm"
        >
          Change Team
        </button>
      </div>

      {/* Captain Recommendation */}
      <div className="flex items-start gap-4 py-4 border-b border-surface-800">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-brand-400 uppercase tracking-wide">
              Recommended Captain
            </span>
            {captainMismatch && (
              <span className="badge bg-brand-500/20 text-brand-400">Change suggested</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p
              className="font-semibold text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
              onClick={() => handlePlayerClick(recommendedCaptain.element)}
            >
              {recommendedCaptain.web_name}
            </p>
            <span className="text-xs text-surface-500">
              {recommendedCaptain.position} · {recommendedCaptain.team_name} vs{" "}
              {recommendedCaptain.opponent_name}
            </span>
            <span className="text-sm font-bold text-surface-100 font-data tabular-nums ml-auto">
              {recommendedCaptain.predicted_points.toFixed(1)} pts
              <span className="text-xs text-surface-500 font-normal ml-1">
                ×2 = {(recommendedCaptain.predicted_points * 2).toFixed(1)}
              </span>
            </span>
          </div>
        </div>
        <div className="w-px h-10 bg-surface-700 hidden sm:block" />
        <div className="flex-1 hidden sm:block">
          <span className="section-label">Vice Captain</span>
          <div className="flex items-center gap-3 mt-1">
            <p
              className="font-semibold text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
              onClick={() => handlePlayerClick(recommendedVice.element)}
            >
              {recommendedVice.web_name}
            </p>
            <span className="text-xs text-surface-500">
              {recommendedVice.position} · {recommendedVice.team_name} vs{" "}
              {recommendedVice.opponent_name}
            </span>
            <span className="text-sm font-bold text-surface-100 font-data tabular-nums ml-auto">
              {recommendedVice.predicted_points.toFixed(1)} pts
            </span>
          </div>
        </div>
      </div>

      {/* Team Overview — horizontal stat strip */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">
            {team.overallRank.toLocaleString()}
          </span>
          <span className="text-xs text-surface-500 ml-1.5">rank</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-brand-400 font-data tabular-nums">
            {totalPredicted.toFixed(1)}
          </span>
          <span className="text-xs text-surface-500 ml-1.5">predicted pts</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-sm font-semibold text-surface-100">{formation}</span>
          <span className="text-xs text-surface-500 ml-1.5">formation</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">
            £{team.budget}m
          </span>
          <span className="text-xs text-surface-500 ml-1.5">ITB</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">
            {team.freeTransfers}
          </span>
          <span className="text-xs text-surface-500 ml-1.5">
            FT{team.freeTransfers !== 1 ? "s" : ""}
          </span>
        </div>

        {/* View toggle */}
        <div className="ml-auto flex items-center border border-surface-700 rounded overflow-hidden">
          <button
            onClick={() => setViewMode("pitch")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "pitch" ? "bg-surface-700 text-surface-100" : "text-surface-500 hover:text-surface-300"}`}
          >
            Pitch
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "table" ? "bg-surface-700 text-surface-100" : "text-surface-500 hover:text-surface-300"}`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Alerts — left-border list */}
      {hasAlerts && (
        <div className="space-y-0.5">
          {injuredStarters.map((p) => (
            <div
              key={`inj-${p.element}`}
              className="flex items-center gap-2 py-1 pl-3 border-l-2 border-danger-500"
            >
              <span className="text-sm text-surface-300">
                <span
                  className="font-medium text-surface-100 cursor-pointer hover:text-brand-400 transition-colors"
                  onClick={() => handlePlayerClick(p.element)}
                >
                  {p.web_name}
                </span>{" "}
                <span className="text-surface-500">{p.team_name}</span>
                {" — "}
                {p.news || "Injured"}
              </span>
            </div>
          ))}
          {doubtfulStarters.map((p) => (
            <div
              key={`dbt-${p.element}`}
              className="flex items-center gap-2 py-1 pl-3 border-l-2 border-warning-500"
            >
              <span className="text-sm text-surface-300">
                <span
                  className="font-medium text-surface-100 cursor-pointer hover:text-brand-400 transition-colors"
                  onClick={() => handlePlayerClick(p.element)}
                >
                  {p.web_name}
                </span>{" "}
                <span className="text-surface-500">{p.team_name}</span>
                {" — "}
                {p.news || "Doubtful"}
              </span>
            </div>
          ))}
          {toughFixtureStarters.map((p) => (
            <div
              key={`fdr-${p.element}`}
              className="flex items-center gap-2 py-1 pl-3 border-l-2 border-surface-600"
            >
              <span className="text-sm text-surface-300">
                <span
                  className="font-medium text-surface-100 cursor-pointer hover:text-brand-400 transition-colors"
                  onClick={() => handlePlayerClick(p.element)}
                >
                  {p.web_name}
                </span>
                {" — tough fixture vs "}
                <span className="text-surface-200">{p.opponent_name}</span>
                {` (FDR ${FDR_MAP[p.opponent_name]})`}
              </span>
            </div>
          ))}
          {benchOutscoring.map((p) => (
            <div
              key={`bench-${p.element}`}
              className="flex items-center gap-2 py-1 pl-3 border-l-2 border-brand-500"
            >
              <span className="text-sm text-surface-300">
                <span
                  className="font-medium text-surface-100 cursor-pointer hover:text-brand-400 transition-colors"
                  onClick={() => handlePlayerClick(p.element)}
                >
                  {p.web_name}
                </span>{" "}
                <span className="text-surface-500">(bench)</span>
                {" — predicted "}
                <span className="text-brand-400 font-data">{p.predicted_points.toFixed(1)}</span>
                {" pts, outscoring a starter"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pitch or Table View */}
      {viewMode === "pitch" ? (
        <PitchView
          starters={starters}
          bench={bench}
          onPlayerClick={handlePlayerClick}
          id="myteam"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700">
                <th scope="col" className="table-header text-left py-2.5 px-3 w-8"></th>
                <th scope="col" className="table-header text-left py-2.5 px-3">
                  Player
                </th>
                <th scope="col" className="table-header text-left py-2.5 px-3">
                  Predicted
                </th>
                <th scope="col" className="table-header text-left py-2.5 px-3">
                  Form
                </th>
                <th scope="col" className="table-header text-left py-2.5 px-3">
                  Fixture
                </th>
                <th scope="col" className="table-header text-left py-2.5 px-3">
                  Value
                </th>
                <th scope="col" className="table-header text-left py-2.5 px-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Starters sorted by position then predicted */}
              {[...starters]
                .sort((a, b) => {
                  const posOrder = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
                  return (
                    posOrder[a.position] - posOrder[b.position] ||
                    b.predicted_points - a.predicted_points
                  );
                })
                .map((p) => (
                  <tr
                    key={p.element}
                    className="border-t border-surface-800/60 hover:bg-surface-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <div
                        className={`w-1 h-8 rounded-full ${p.is_captain ? "bg-warning-400" : p.is_vice ? "bg-surface-400" : "bg-brand-500/40"}`}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <TeamBadge team={p.team_name} />
                        <div>
                          <p
                            className="font-medium text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
                            onClick={() => handlePlayerClick(p.element)}
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
                        className={`text-base font-semibold font-data tabular-nums ${p.predicted_points >= 6 ? "text-brand-400" : "text-surface-100"}`}
                      >
                        {p.predicted_points.toFixed(1)}
                      </span>
                      {p.is_captain && <span className="text-xs text-warning-400 ml-1">×2</span>}
                    </td>
                    <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">
                      {p.form}
                    </td>
                    <td className="py-2.5 px-3">
                      <FdrBadge opponent={p.opponent_name} fdrMap={FDR_MAP} />
                    </td>
                    <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">
                      £{p.value}m
                    </td>
                    <td className="py-2.5 px-3">
                      {p.status !== "a" ? (
                        <StatusBadge status={p.status} chance={p.chance_of_playing} compact />
                      ) : (
                        <span className="text-xs text-surface-600">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              {/* Bench divider */}
              <tr>
                <td colSpan={7} className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-surface-700" />
                    <span className="text-2xs text-surface-500 uppercase tracking-wider">
                      Bench
                    </span>
                    <div className="h-px flex-1 bg-surface-700" />
                  </div>
                </td>
              </tr>
              {/* Bench players */}
              {bench.map((p, idx) => (
                <tr key={p.element} className="border-t border-surface-800/60 opacity-60">
                  <td className="py-2.5 px-3 text-xs text-surface-600 font-data">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <TeamBadge team={p.team_name} />
                      <div>
                        <p
                          className="font-medium text-surface-300 hover:text-brand-400 transition-colors cursor-pointer"
                          onClick={() => handlePlayerClick(p.element)}
                        >
                          {p.web_name}
                        </p>
                        <p className="text-xs text-surface-600">
                          <span className={POSITION_COLORS[p.position]}>{p.position}</span>
                          {" · "}
                          {p.team_name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-surface-500 font-data tabular-nums">
                    {p.predicted_points.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 text-surface-500 font-data tabular-nums">{p.form}</td>
                  <td className="py-2.5 px-3">
                    <FdrBadge opponent={p.opponent_name} fdrMap={FDR_MAP} />
                  </td>
                  <td className="py-2.5 px-3 text-surface-500 font-data tabular-nums">
                    £{p.value}m
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-xs text-surface-600">Bench {idx + 1}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transfer Suggestions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="section-label">Suggested Transfers</span>
          <button
            onClick={() => navigate("/transfers")}
            className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            View all →
          </button>
        </div>
        <div className="space-y-3">
          {transferSuggestions.map((transfer, idx) => (
            <div
              key={idx}
              className="flex items-center gap-4 p-3 rounded-md bg-surface-800/50 border border-surface-700"
            >
              {/* Out */}
              <div className="flex-1">
                <p className="text-xs text-danger-400 font-medium uppercase mb-1">Sell</p>
                <p
                  className="font-medium text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
                  onClick={() => handlePlayerClick(transfer.out.element)}
                >
                  {transfer.out.web_name}
                </p>
                <p className="text-xs text-surface-500">
                  {transfer.out.position} · {transfer.out.team_name} ·{" "}
                  {transfer.out.predicted_points.toFixed(1)} pts
                </p>
                {transfer.out.status !== "a" && (
                  <StatusBadge status={transfer.out.status} chance={0} compact />
                )}
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center gap-1">
                <svg
                  className="w-5 h-5 text-brand-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
                <span className="text-xs font-semibold text-success-400">
                  +{transfer.points_gain.toFixed(1)} pts
                </span>
              </div>

              {/* In */}
              <div className="flex-1">
                <p className="text-xs text-success-400 font-medium uppercase mb-1">Buy</p>
                <p className="font-medium text-surface-100">{transfer.in.web_name}</p>
                <p className="text-xs text-surface-500">
                  {transfer.in.position} · {transfer.in.team_name} ·{" "}
                  {transfer.in.predicted_points.toFixed(1)} pts
                </p>
                <p className="text-xs text-surface-500 mt-1">
                  £{transfer.in.value}m
                  {transfer.cost_saving > 0 && (
                    <span className="text-success-400">
                      {" "}
                      (save £{transfer.cost_saving.toFixed(1)}m)
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
