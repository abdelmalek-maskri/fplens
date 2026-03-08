import { useNavigate, useSearchParams } from "react-router-dom";
import { POSITION_COLORS, FDR_MAP } from "../lib/constants";
import { PitchView } from "../components/pitch";
import TeamBadge from "../components/TeamBadge";
import FdrBadge from "../components/FdrBadge";
import ErrorState from "../components/ErrorState";
import { SkeletonStatStrip, SkeletonPitch } from "../components/skeletons";
import { useBestXI } from "../hooks";

// ============================================================
// OPTIMAL XI PAGE
// Backend solver picks the best starting 11 from all ~800
// Premier League players for the upcoming GW.
// ============================================================
export default function OptimalXI() {
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

  const { data, isLoading, error } = useBestXI();

  if (isLoading)
    return (
      <div className="space-y-6">
        <SkeletonStatStrip items={3} />
        <SkeletonPitch id="optimal-sk" />
      </div>
    );
  if (error) return <ErrorState message="Failed to load squad data." />;
  if (!data) return null;

  const { starters, bench, captainId, viceId, formation, totalWithCaptain } = data;
  const captain = starters.find((p) => p.element === captainId);

  return (
    <div className="space-y-6 stagger">
      {/* Stats strip */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-lg font-bold text-brand-400 font-data tabular-nums">
            {totalWithCaptain.toFixed(1)}
          </span>
          <span className="text-xs text-surface-500 ml-1.5">predicted pts</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-sm font-semibold text-surface-100">{formation}</span>
          <span className="text-xs text-surface-500 ml-1.5">formation</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        {captain && (
          <div>
            <span className="text-sm font-semibold text-surface-100">{captain.web_name}</span>
            <span className="text-xs text-warning-400 ml-1"> (C)</span>
            <span className="text-xs text-surface-500 ml-1">
              · {(captain.predicted_points * 2).toFixed(1)} pts
            </span>
          </div>
        )}

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

      {viewMode === "pitch" ? (
        <PitchView
          starters={starters}
          bench={bench}
          captainId={captainId}
          viceId={viceId}
          id="optimal"
          benchLabel="Bench order"
        />
      ) : (
        /* ---- Table View ---- */
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
                  Role
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Starters */}
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
                        className={`w-1 h-8 rounded-full ${p.element === captainId ? "bg-warning-400" : p.element === viceId ? "bg-surface-400" : "bg-brand-500/40"}`}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <TeamBadge team={p.team_name} />
                        <div>
                          <p
                            className="font-medium text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
                            onClick={() => navigate(`/player/${p.element}`)}
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
                      {p.element === captainId && (
                        <span className="text-xs text-warning-400 ml-1">×2</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">
                      {p.form}
                    </td>
                    <td className="py-2.5 px-3">
                      <FdrBadge opponent={p.opponent_name} fdrMap={FDR_MAP} />
                    </td>
                    <td className="py-2.5 px-3">
                      {p.element === captainId ? (
                        <span className="text-xs font-semibold text-warning-400">Captain</span>
                      ) : p.element === viceId ? (
                        <span className="text-xs text-surface-400">Vice</span>
                      ) : (
                        <span className="text-xs text-surface-500">Starter</span>
                      )}
                    </td>
                  </tr>
                ))}
              {/* Bench divider */}
              <tr>
                <td colSpan={6} className="py-2 px-3">
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
                          onClick={() => navigate(`/player/${p.element}`)}
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
                  <td className="py-2.5 px-3 text-xs text-surface-600">Bench {idx + 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
