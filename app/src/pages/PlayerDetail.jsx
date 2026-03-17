import { useParams, useNavigate } from "react-router-dom";
import { FDR_COLORS, POSITION_COLORS, POSITION_BG } from "../lib/constants";
import TeamBadge from "../components/TeamBadge";
import StatusBadge from "../components/StatusBadge";
import ErrorState from "../components/ErrorState";
import { SkeletonStatStrip, SkeletonCard } from "../components/skeletons";
import { usePlayer } from "../hooks";

// ============================================================
// FORM BAR CHART — last 10 GW points
// ============================================================
const FormChart = ({ pts, labels }) => {
  return (
    <div className="flex gap-2">
      {pts.map((p, i) => (
        <div
          key={i}
          className={`flex-1 flex flex-col items-center py-2 rounded ${
            p >= 8 ? "bg-brand-500/15" : p >= 5 ? "bg-surface-800/50" : "bg-transparent"
          }`}
        >
          <span
            className={`text-sm font-data tabular-nums font-bold ${
              p >= 8 ? "text-brand-400" : p >= 5 ? "text-surface-100" : p >= 3 ? "text-surface-400" : "text-surface-600"
            }`}
          >
            {p}
          </span>
          <span className="text-[9px] text-surface-600 mt-0.5">GW{labels[i]?.replace("GW", "")}</span>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// SENTIMENT DOT
// ============================================================
const SentimentDot = ({ value }) => {
  const color = value >= 0.5 ? "bg-success-400" : value >= 0 ? "bg-surface-400" : "bg-danger-400";
  return <div className={`w-2 h-2 rounded-full ${color}`} />;
};

// ============================================================
// PLAYER DETAIL PAGE
// ============================================================
export default function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: player, isLoading, error } = usePlayer(id);
  if (isLoading)
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-6 w-48" />
            <div className="skeleton h-3 w-36" />
          </div>
          <div className="skeleton h-8 w-16" />
        </div>
        <SkeletonStatStrip items={5} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={6} />
        </div>
      </div>
    );
  if (error) return <ErrorState message="Failed to load player data." />;
  if (!player) return null;

  const netTransfers = player.transfers_in_event - player.transfers_out_event;
  const ppg = player.minutes > 0 ? (player.total_points / (player.minutes / 90)).toFixed(1) : "0.0";

  return (
    <div className="space-y-6 stagger">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Player header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <TeamBadge team={player.team_name} />
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${POSITION_BG[player.position]} ${POSITION_COLORS[player.position]}`}
            >
              {player.position}
            </span>
            {player.status !== "a" && (
              <StatusBadge status={player.status} chance={player.chance_of_playing} compact />
            )}
          </div>
          <h2 className="text-xl font-bold text-surface-100">
            {player.first_name?.startsWith(player.web_name)
              ? player.web_name
              : `${player.first_name?.split(" ")[0]} ${player.web_name}`}
          </h2>
          <p className="text-sm text-surface-500">
            {player.team_name} · £{player.value}m · {player.selected_by_percent}% owned
          </p>
          {player.news && <p className="text-xs text-warning-400 mt-1">{player.news}</p>}
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-brand-400 font-data tabular-nums">
            {player.predicted_points.toFixed(1)}
          </span>
          <p className="text-xs text-surface-500">predicted pts</p>
          <p className="text-2xs text-surface-600 font-data tabular-nums">
            {player.predicted_range[0].toFixed(1)} – {player.predicted_range[1].toFixed(1)} range
          </p>
        </div>
      </div>

      {/* Stat strip */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-y border-surface-800">
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">
            {player.total_points}
          </span>
          <span className="text-xs text-surface-500 ml-1">total pts</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">
            {player.form}
          </span>
          <span className="text-xs text-surface-500 ml-1">form</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">{ppg}</span>
          <span className="text-xs text-surface-500 ml-1">pts/90</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">
            {player.ict_index}
          </span>
          <span className="text-xs text-surface-500 ml-1">ICT</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span
            className={`text-lg font-bold font-data tabular-nums ${netTransfers > 0 ? "text-success-400" : netTransfers < 0 ? "text-danger-400" : "text-surface-100"}`}
          >
            {netTransfers > 0 ? "+" : ""}
            {(netTransfers / 1000).toFixed(1)}k
          </span>
          <span className="text-xs text-surface-500 ml-1">net transfers</span>
        </div>
      </div>

      {/* Two-column layout: Form + Fixtures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form chart */}
        <div>
          <span className="section-label">Recent form</span>
          <div className="mt-3">
            <FormChart pts={player.pts_history} labels={player.gw_labels} />
          </div>
        </div>

        {/* Fixture run */}
        <div>
          <span className="section-label">Upcoming fixtures</span>
          <div className="mt-3 space-y-1.5">
            {player.fixtures.map((f) => (
              <div key={f.gw} className="flex items-center gap-3 py-1.5">
                <span className="text-xs text-surface-500 w-10 font-data tabular-nums">
                  GW{f.gw}
                </span>
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded text-2xs font-bold ${FDR_COLORS[f.fdr].bg} ${FDR_COLORS[f.fdr].text}`}
                >
                  {f.fdr}
                </span>
                <span className="text-sm text-surface-100">{f.opponent}</span>
                <span className="text-xs text-surface-500">{f.home ? "(H)" : "(A)"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Season stats */}
      <div>
        <span className="section-label">Season stats</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mt-3">
          {[
            { label: "Goals", value: player.goals, compare: player.xG, compareLabel: "xG" },
            { label: "Assists", value: player.assists, compare: player.xA, compareLabel: "xA" },
            { label: "Clean Sheets", value: player.clean_sheets },
            { label: "Minutes", value: player.minutes.toLocaleString() },
            { label: "Bonus", value: player.bonus },
            { label: "BPS", value: player.bps },
          ].map((stat) => (
            <div key={stat.label} className="py-2">
              <span className="text-lg font-bold text-surface-100 font-data tabular-nums">
                {stat.value}
              </span>
              {stat.compare !== undefined && (
                <span className="text-xs text-surface-500 ml-1.5">
                  / {stat.compare} {stat.compareLabel}
                </span>
              )}
              <p className="text-xs text-surface-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Prediction Factors — plain language from SHAP */}
      {player.shap && player.shap.length > 0 && (() => {
        const positives = player.shap.filter((s) => s.impact > 0);
        const negatives = player.shap.filter((s) => s.impact < 0);

        const translate = (s) => {
          const val = s.value;
          if (s.feature === "minutes_lag1") return val >= 80 ? "Played full match last GW" : val > 0 ? `Played ${val} mins last GW` : "Did not play last GW";
          if (s.feature === "was_home") return val > 0.5 ? "Playing at home" : "Playing away";
          if (s.feature === "form") return `Form rating: ${val}`;
          if (s.feature === "value") return `Price: £${val}m`;
          if (s.feature.includes("season_avg")) return `Season avg: ${typeof val === "number" ? val.toFixed(1) : val} pts`;
          if (s.feature.includes("ict")) return `ICT Index: ${typeof val === "number" ? val.toFixed(1) : val}`;
          if (s.feature.includes("roll3")) return `Last 3 games average`;
          if (s.feature.includes("roll5")) return `Last 5 games average`;
          if (s.feature.includes("opponent") || s.feature.includes("strength")) return `Fixture difficulty`;
          if (s.feature.includes("injury") || s.feature.includes("gws_since")) return val > 0 ? `${Math.round(val)} GWs since injury` : "Recent injury";
          if (s.feature === "team") return "Team strength";
          if (s.feature.includes("bonus")) return "Bonus points record";
          if (s.feature === "position") return "Position";
          return s.display || s.feature.replace(/_/g, " ");
        };

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {positives.length > 0 && (
              <div>
                <span className="text-xs font-medium text-success-400 uppercase tracking-wide">
                  In favour
                </span>
                <div className="mt-2 space-y-1">
                  {positives.map((s) => (
                    <div key={s.feature} className="flex items-center gap-2 text-sm text-surface-300">
                      <span className="w-1 h-1 rounded-full bg-success-400 shrink-0" />
                      {translate(s)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {negatives.length > 0 && (
              <div>
                <span className="text-xs font-medium text-danger-400 uppercase tracking-wide">
                  Against
                </span>
                <div className="mt-2 space-y-1">
                  {negatives.map((s) => (
                    <div key={s.feature} className="flex items-center gap-2 text-sm text-surface-300">
                      <span className="w-1 h-1 rounded-full bg-danger-400 shrink-0" />
                      {translate(s)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* News mentions */}
      {player.news_mentions && player.news_mentions.length > 0 && (
        <div>
          <span className="section-label">News mentions</span>
          <div className="mt-3 space-y-2">
            {player.news_mentions.map((article, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2 border-b border-surface-800/60 last:border-0"
              >
                <SentimentDot value={article.sentiment} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-200">{article.headline}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-2xs text-surface-500">{article.source}</span>
                    <span className="text-2xs text-surface-600">{article.date}</span>
                    <span
                      className={`text-2xs font-data tabular-nums ${
                        article.sentiment >= 0.5
                          ? "text-success-400"
                          : article.sentiment >= 0
                            ? "text-surface-400"
                            : "text-danger-400"
                      }`}
                    >
                      {article.sentiment > 0 ? "+" : ""}
                      {article.sentiment.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
