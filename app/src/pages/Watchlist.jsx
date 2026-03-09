import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FDR_COLORS, POSITION_COLORS } from "../lib/constants";
import MiniSparkline from "../components/MiniSparkline";
import TeamBadge from "../components/TeamBadge";
import UncertaintyBar from "../components/UncertaintyBar";
import { useWatchlist } from "../hooks";
import { SkeletonCard } from "../components/skeletons";
import ErrorState from "../components/ErrorState";
import EmptyState from "../components/EmptyState";

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function Watchlist() {
  const navigate = useNavigate();
  const { data: watchData, isLoading, error, add, remove, watchIds } = useWatchlist();
  const watchedIds = watchIds;
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const allPlayers = watchData ? watchData.allPlayers : [];
  const watchedPlayers = watchData ? watchData.players : [];

  const searchResults = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return allPlayers
      .filter((p) => !watchedIds.includes(p.element))
      .filter(
        (p) =>
          p.web_name.toLowerCase().includes(q) ||
          (p.team_name || p.team || "").toLowerCase().includes(q)
      );
  }, [allPlayers, search, watchedIds]);

  if (isLoading)
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    );

  if (error) return <ErrorState message="Failed to load watchlist." />;

  if (!watchData) return null;

  const toggleWatch = (id) => {
    watchedIds.includes(id) ? remove(id) : add(id);
  };

  return (
    <div className="space-y-6 stagger">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${showAdd ? "bg-surface-700 text-surface-200" : "bg-brand-600 text-white hover:bg-brand-700"}`}
        >
          {showAdd ? "Done" : "+ Add Player"}
        </button>
      </div>

      {/* Add Player Panel */}
      {showAdd && (
        <div className="pb-4 border-b border-surface-800">
          <div className="relative mb-3">
            <input
              type="text"
              placeholder="Search player or team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-900 border border-surface-700 rounded-md px-4 py-2 pl-9 text-sm text-surface-100 placeholder:text-surface-500 focus:border-brand-500 focus:outline-none"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {searchResults.map((p) => (
                <div
                  key={p.element}
                  onClick={() => {
                    toggleWatch(p.element);
                    setSearch("");
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-surface-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-surface-100">{p.web_name}</span>
                    <span className="text-2xs text-surface-500">
                      {p.team} · <span className={POSITION_COLORS[p.position]}>{p.position}</span> ·
                      £{p.value}m
                    </span>
                  </div>
                  <span className="text-xs text-brand-400">+ Add</span>
                </div>
              ))}
            </div>
          )}
          {search && searchResults.length === 0 && (
            <p className="text-xs text-surface-500 text-center py-3">No players found</p>
          )}
        </div>
      )}

      {/* Watchlist Cards */}
      {watchedPlayers.length > 0 ? (
        <div className="space-y-3">
          {watchedPlayers.map((p) => {
            const fdrNext3 = p.fdr_next3 ?? [];
            const sum3 = fdrNext3.reduce((s, f) => s + f, 0);
            return (
              <div key={p.element} className="py-3 border-b border-surface-800 last:border-0">
                <div className="flex items-center gap-4">
                  {/* Player Info */}
                  <div className="flex items-center gap-3 w-48">
                    <TeamBadge team={p.team_name ?? p.team} />
                    <div>
                      <p
                        className="text-sm font-semibold text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
                        onClick={() => navigate(`/player/${p.element}`)}
                      >
                        {p.web_name}
                      </p>
                      <p className="text-2xs text-surface-500">
                        <span className={POSITION_COLORS[p.position]}>{p.position}</span> · £
                        {p.value}m
                      </p>
                    </div>
                  </div>

                  {/* Form Sparkline */}
                  <div className="flex items-center gap-2">
                    <div className="text-center">
                      <p className="text-2xs text-surface-500">Form</p>
                      <p className="text-sm font-bold text-surface-100">{p.form}</p>
                    </div>
                    <MiniSparkline pts={p.pts_last5 ?? []} />
                  </div>

                  {/* Predicted */}
                  <div className="text-center">
                    <p className="text-2xs text-surface-500">Predicted</p>
                    <p className="text-sm font-bold text-brand-400">
                      {p.predicted_points ?? p.predicted}
                    </p>
                    <UncertaintyBar
                      predicted={p.predicted_points ?? p.predicted}
                      uncertainty={p.uncertainty}
                    />
                  </div>

                  {/* Ownership */}
                  <div className="text-center">
                    <p className="text-2xs text-surface-500">Own%</p>
                    <p className="text-sm text-surface-300">
                      {p.selected_by_percent ?? p.ownership ?? "—"}%
                    </p>
                  </div>

                  {/* Next 3 FDR */}
                  <div>
                    <p className="text-2xs text-surface-500 mb-1">Next 3 GWs</p>
                    <div className="flex items-center gap-1">
                      {fdrNext3.map((fdr, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center justify-center w-6 h-6 rounded text-2xs font-bold ${FDR_COLORS[fdr].text} ${FDR_COLORS[fdr].bg}`}
                        >
                          {fdr}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* News */}
                  <div className="flex-1 text-right">
                    {p.news ? (
                      <span className="text-xs text-warning-400">{p.news}</span>
                    ) : (
                      <span
                        className={`text-xs ${sum3 <= 7 ? "text-success-400" : sum3 >= 10 ? "text-danger-400" : "text-surface-500"}`}
                      >
                        {sum3 <= 7
                          ? "Good run coming"
                          : sum3 >= 10
                            ? "Tough fixtures"
                            : "Mixed fixtures"}
                      </span>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => toggleWatch(p.element)}
                    aria-label={`Remove ${p.web_name} from watchlist`}
                    className="text-surface-600 hover:text-danger-400 transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No players tracked"
          message="Add players to monitor form and fixtures."
        />
      )}
    </div>
  );
}
