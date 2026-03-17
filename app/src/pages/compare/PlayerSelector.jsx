import { useState, useMemo } from "react";
import { POSITION_COLORS, STATUS_CONFIG } from "../../lib/constants";
import TeamBadge from "../../components/badges/TeamBadge";

function PlayerSelector({ selected, onChange, label, excludeId, allPlayers }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allPlayers
      .filter((p) => p.id !== excludeId)
      .filter(
        (p) =>
          !q ||
          p.web_name.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q)
      );
  }, [search, excludeId, allPlayers]);

  const selectedPlayer = allPlayers.find((p) => p.id === selected);

  return (
    <div className="relative">
      <p className="section-label mb-2">{label}</p>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-surface-800 border border-surface-700 rounded-md px-4 py-3 text-left hover:border-surface-600 transition-colors"
      >
        {selectedPlayer ? (
          <div className="flex items-center gap-3">
            <TeamBadge team={selectedPlayer.team} />
            <div>
              <p className="text-sm font-medium text-surface-100">{selectedPlayer.web_name}</p>
              <p className="text-xs text-surface-500">
                <span className={POSITION_COLORS[selectedPlayer.position]}>
                  {selectedPlayer.position}
                </span>{" "}
                · £{selectedPlayer.value}m
              </p>
            </div>
          </div>
        ) : (
          <span className="text-surface-500 text-sm">Select a player...</span>
        )}
        <svg
          className={`w-4 h-4 text-surface-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface-800 border border-surface-700 rounded-md max-h-72 overflow-hidden">
          <div className="p-2 border-b border-surface-700">
            <input
              type="text"
              placeholder="Search name, team, position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-900 border border-surface-700 rounded px-3 py-1.5 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:border-brand-500"
              autoFocus
            />
          </div>
          <ul className="overflow-y-auto max-h-56">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-700/50 transition-colors ${
                    p.id === selected ? "bg-brand-600/20" : ""
                  }`}
                >
                  <TeamBadge team={p.team} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-100 truncate">{p.web_name}</p>
                    <p className="text-xs text-surface-500">
                      <span className={POSITION_COLORS[p.position]}>{p.position}</span> · £{p.value}
                      m · {p.predicted_points.toFixed(1)} pts
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium ${STATUS_CONFIG[p.status]?.cls || "text-surface-400"}`}
                  >
                    {STATUS_CONFIG[p.status]?.label}
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-center text-surface-500 text-sm">No players found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default PlayerSelector;
