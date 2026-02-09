import { useState, useMemo } from "react";
import { FDR_COLORS, POSITION_COLORS } from "../lib/constants";
import MiniSparkline from "../components/MiniSparkline";
import TeamBadge from "../components/TeamBadge";
import UncertaintyBar from "../components/UncertaintyBar";

// ============================================================
// MOCK DATA - Player watchlist
// Will be replaced with: GET/POST /api/watchlist
// ============================================================
const allPlayers = [
  { element: 2, web_name: "Haaland", team: "MCI", position: "FWD", value: 15.3, form: 8.8, predicted: 7.2, uncertainty: 1.8, pts_last5: [12, 2, 8, 6, 15], ownership: 85.2, fdr_next3: [2, 4, 2], news: "" },
  { element: 3, web_name: "Salah", team: "LIV", position: "MID", value: 13.2, form: 7.2, predicted: 6.8, uncertainty: 1.5, pts_last5: [8, 10, 3, 14, 6], ownership: 52.1, fdr_next3: [2, 3, 2], news: "" },
  { element: 7, web_name: "Palmer", team: "CHE", position: "MID", value: 9.5, form: 9.2, predicted: 6.1, uncertainty: 1.6, pts_last5: [14, 8, 12, 2, 10], ownership: 45.8, fdr_next3: [5, 2, 3], news: "" },
  { element: 50, web_name: "Isak", team: "NEW", position: "FWD", value: 8.8, form: 7.0, predicted: 5.5, uncertainty: 1.7, pts_last5: [6, 8, 2, 12, 5], ownership: 24.3, fdr_next3: [2, 3, 4], news: "" },
  { element: 60, web_name: "Cunha", team: "WOL", position: "FWD", value: 7.2, form: 7.5, predicted: 5.8, uncertainty: 1.4, pts_last5: [8, 5, 10, 3, 6], ownership: 12.1, fdr_next3: [3, 2, 2], news: "" },
  { element: 62, web_name: "Gordon", team: "NEW", position: "MID", value: 7.5, form: 6.8, predicted: 5.2, uncertainty: 1.5, pts_last5: [6, 8, 3, 5, 10], ownership: 18.5, fdr_next3: [2, 3, 4], news: "" },
  { element: 65, web_name: "Eze", team: "CRY", position: "MID", value: 6.8, form: 5.8, predicted: 4.2, uncertainty: 1.3, pts_last5: [2, 8, 5, 3, 6], ownership: 8.2, fdr_next3: [3, 2, 2], news: "" },
  { element: 5, web_name: "Saka", team: "ARS", position: "MID", value: 10.1, form: 6.5, predicted: 4.2, uncertainty: 2.4, pts_last5: [8, 3, 2, 6, 5], ownership: 38.4, fdr_next3: [4, 2, 3], news: "Muscle injury — 75% chance" },
  { element: 15, web_name: "Alexander-Arnold", team: "LIV", position: "DEF", value: 7.1, form: 6.1, predicted: 5.4, uncertainty: 1.4, pts_last5: [6, 8, 1, 6, 9], ownership: 28.9, fdr_next3: [2, 3, 2], news: "" },
  { element: 40, web_name: "Mbeumo", team: "BRE", position: "MID", value: 7.8, form: 5.6, predicted: 4.5, uncertainty: 1.3, pts_last5: [2, 6, 8, 3, 5], ownership: 19.5, fdr_next3: [2, 3, 2], news: "" },
  { element: 64, web_name: "Wood", team: "NFO", position: "FWD", value: 6.5, form: 6.0, predicted: 4.8, uncertainty: 1.2, pts_last5: [5, 2, 8, 6, 3], ownership: 15.2, fdr_next3: [2, 4, 2], news: "" },
  { element: 12, web_name: "Gabriel", team: "ARS", position: "DEF", value: 6.2, form: 5.8, predicted: 5.1, uncertainty: 1.3, pts_last5: [6, 2, 8, 6, 8], ownership: 31.2, fdr_next3: [4, 2, 3], news: "" },
];

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function Watchlist() {
  const [watchedIds, setWatchedIds] = useState([50, 60, 62, 65, 5]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const watchedPlayers = useMemo(() =>
    allPlayers.filter(p => watchedIds.includes(p.element)),
    [watchedIds]
  );

  const searchResults = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return allPlayers
      .filter(p => !watchedIds.includes(p.element))
      .filter(p => p.web_name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
  }, [search, watchedIds]);

  const toggleWatch = (id) => {
    setWatchedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 stagger">
      <div className="flex items-center justify-end">
        <button onClick={() => setShowAdd(!showAdd)}
          className={`btn-primary text-sm ${showAdd ? "bg-surface-700 text-surface-100" : ""}`}>
          {showAdd ? "Done" : "+ Add Player"}
        </button>
      </div>

      {/* Add Player Panel */}
      {showAdd && (
        <div className="pb-4 border-b border-surface-800">
          <div className="relative mb-3">
            <input type="text" placeholder="Search player or team..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-4 py-2 pl-9 text-sm text-surface-100 placeholder:text-surface-500 focus:border-brand-500 focus:outline-none" />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {searchResults.map(p => (
                <div key={p.element} onClick={() => { toggleWatch(p.element); setSearch(""); }}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-800 cursor-pointer transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-surface-100">{p.web_name}</span>
                    <span className="text-2xs text-surface-500">{p.team} · <span className={POSITION_COLORS[p.position]}>{p.position}</span> · £{p.value}m</span>
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
          {watchedPlayers.map(p => {
            const sum3 = p.fdr_next3.reduce((s, f) => s + f, 0);
            return (
              <div key={p.element} className="py-3 border-b border-surface-800 last:border-0">
                <div className="flex items-center gap-4">
                  {/* Player Info */}
                  <div className="flex items-center gap-3 w-48">
                    <TeamBadge team={p.team} />
                    <div>
                      <p className="text-sm font-semibold text-surface-100">{p.web_name}</p>
                      <p className="text-2xs text-surface-500"><span className={POSITION_COLORS[p.position]}>{p.position}</span> · £{p.value}m</p>
                    </div>
                  </div>

                  {/* Form Sparkline */}
                  <div className="flex items-center gap-2">
                    <div className="text-center">
                      <p className="text-2xs text-surface-500">Form</p>
                      <p className="text-sm font-bold text-surface-100">{p.form}</p>
                    </div>
                    <MiniSparkline pts={p.pts_last5} />
                  </div>

                  {/* Predicted */}
                  <div className="text-center">
                    <p className="text-2xs text-surface-500">Predicted</p>
                    <p className="text-sm font-bold text-brand-400">{p.predicted}</p>
                    <UncertaintyBar predicted={p.predicted} uncertainty={p.uncertainty} />
                  </div>

                  {/* Ownership */}
                  <div className="text-center">
                    <p className="text-2xs text-surface-500">Own%</p>
                    <p className="text-sm text-surface-300">{p.ownership}%</p>
                  </div>

                  {/* Next 3 FDR */}
                  <div>
                    <p className="text-2xs text-surface-500 mb-1">Next 3 GWs</p>
                    <div className="flex items-center gap-1">
                      {p.fdr_next3.map((fdr, i) => (
                        <span key={i} className={`inline-flex items-center justify-center w-6 h-6 rounded text-2xs font-bold ${FDR_COLORS[fdr].text} ${FDR_COLORS[fdr].bg}`}>
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
                      <span className={`text-xs ${sum3 <= 7 ? "text-success-400" : sum3 >= 10 ? "text-danger-400" : "text-surface-500"}`}>
                        {sum3 <= 7 ? "Good run coming" : sum3 >= 10 ? "Tough fixtures" : "Mixed fixtures"}
                      </span>
                    )}
                  </div>

                  {/* Remove */}
                  <button onClick={() => toggleWatch(p.element)}
                    aria-label={`Remove ${p.web_name} from watchlist`}
                    className="text-surface-600 hover:text-danger-400 transition-colors p-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center">
          <svg className="w-12 h-12 text-surface-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <p className="text-surface-400">No players tracked</p>
          <p className="text-xs text-surface-500 mt-1">Add players to monitor form and fixtures</p>
        </div>
      )}
    </div>
  );
}
