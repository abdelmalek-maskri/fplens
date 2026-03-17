import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { POSITION_COLORS } from "../lib/constants";
import { useWatchlist } from "../hooks";
import { SkeletonCard } from "../components/skeletons";
import ErrorState from "../components/feedback/ErrorState";
import SuggestedSection from "./watchlist/SuggestedSection";
import WatchedPlayerRow from "./watchlist/WatchedPlayerRow";

export default function Watchlist() {
  const navigate = useNavigate();
  const { data: watchData, isLoading, error, add, remove, watchIds } = useWatchlist();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const allPlayers = useMemo(() => watchData?.allPlayers ?? [], [watchData]);
  const watchedPlayers = useMemo(() => watchData?.players ?? [], [watchData]);

  const searchResults = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return allPlayers
      .filter((p) => !watchIds.includes(p.element))
      .filter(
        (p) => p.web_name.toLowerCase().includes(q) || (p.team_name || "").toLowerCase().includes(q)
      );
  }, [allPlayers, search, watchIds]);

  const toggleWatch = (id) => {
    watchIds.includes(id) ? remove(id) : add(id);
  };

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

  return (
    <div className="space-y-6 stagger">
      <SuggestedSection allPlayers={allPlayers} watchedIds={watchIds} onAdd={add} />

      <div className="flex items-center justify-between border-t border-surface-800 pt-4">
        <p className="text-xs text-surface-500 uppercase tracking-wider font-medium">
          Your Watchlist
        </p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
            showAdd
              ? "bg-surface-700 text-surface-200"
              : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          {showAdd ? "Done" : "+ Add Player"}
        </button>
      </div>

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
                      {p.team_name} ·{" "}
                      <span className={POSITION_COLORS[p.position]}>{p.position}</span> · £{p.value}
                      m
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

      {watchedPlayers.length > 0 ? (
        <div className="space-y-0">
          {watchedPlayers.map((p) => (
            <WatchedPlayerRow
              key={p.element}
              p={p}
              onNavigate={navigate}
              onRemove={() => toggleWatch(p.element)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-surface-500 text-center py-6">
          No players tracked yet — add from suggestions or search above.
        </p>
      )}
    </div>
  );
}
