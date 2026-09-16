import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { POSITION_COLORS } from "../lib/constants";
import { useWatchlist } from "../hooks";
import Loading from "../components/feedback/Loading";
import ErrorState from "../components/feedback/ErrorState";
import SuggestedSection from "./watchlist/SuggestedSection";
import WatchedPlayerRow, { ROW_COLS } from "./watchlist/WatchedPlayerRow";

export default function Watchlist() {
  const navigate = useNavigate();
  const { data: watchData, isLoading, error, add, remove, watchIds } = useWatchlist();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const allPlayers = useMemo(() => watchData?.allPlayers ?? [], [watchData]);
  const watchedPlayers = useMemo(
    () => [...(watchData?.players ?? [])].sort((a, b) => b.predicted_points - a.predicted_points),
    [watchData]
  );

  const searchResults = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return allPlayers
      .filter((p) => !watchIds.includes(p.element))
      .filter(
        (p) => p.web_name.toLowerCase().includes(q) || (p.team_name || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [allPlayers, search, watchIds]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Failed to load watchlist." />;
  if (!watchData) return null;

  return (
    <div className="space-y-8 stagger">
      <div>
        <div className="flex items-center justify-between">
          <span className="section-label">Your watchlist</span>
          <button
            onClick={() => {
              setShowAdd(!showAdd);
              setSearch("");
            }}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              showAdd
                ? "bg-surface-700 text-surface-200"
                : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {showAdd ? "Done" : "+ Add player"}
          </button>
        </div>

        {showAdd && (
          <div className="mt-3 max-w-md">
            <input
              type="text"
              aria-label="Search player or team"
              placeholder="Search player or team"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full bg-surface-900 border border-surface-700 rounded-md px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:border-brand-500 focus:outline-none"
            />
            {searchResults.length > 0 && (
              <div className="mt-1 border border-surface-800 rounded-md divide-y divide-surface-800/60">
                {searchResults.map((p) => (
                  <button
                    key={p.element}
                    onClick={() => {
                      add(p.element);
                      setSearch("");
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-800 transition-colors"
                  >
                    <span className="text-sm text-surface-100">
                      {p.web_name}
                      <span className="text-2xs text-surface-500 ml-2">
                        {p.team_name} ·{" "}
                        <span className={POSITION_COLORS[p.position]}>{p.position}</span> · £
                        {p.value.toFixed(1)}m
                      </span>
                    </span>
                    <span className="text-xs text-brand-400">+ Add</span>
                  </button>
                ))}
              </div>
            )}
            {search && searchResults.length === 0 && (
              <p className="text-xs text-surface-500 py-3">No players found</p>
            )}
          </div>
        )}

        {watchedPlayers.length > 0 ? (
          <div className="mt-3">
            <div className={`${ROW_COLS} py-1 text-2xs text-surface-500 uppercase tracking-wide`}>
              <span>Player</span>
              <span className="text-right">Predicted</span>
              <span className="text-right">Form</span>
              <span className="text-right">Next</span>
              <span className="text-right">Owned</span>
              <span />
            </div>
            {watchedPlayers.map((p) => (
              <WatchedPlayerRow
                key={p.element}
                p={p}
                onNavigate={navigate}
                onRemove={() => remove(p.element)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-surface-500">
            Nothing here yet. Add a player above, or pick one from the lists below.
          </p>
        )}
      </div>

      <SuggestedSection allPlayers={allPlayers} watchedIds={watchIds} onAdd={add} />
    </div>
  );
}
