import { useParams, useNavigate } from "react-router-dom";
import { FDR_COLORS, POSITION_COLORS, POSITION_BG } from "../lib/constants";
import TeamBadge from "../components/badges/TeamBadge";
import StatusBadge from "../components/badges/StatusBadge";
import ErrorState from "../components/feedback/ErrorState";
import Loading from "../components/feedback/Loading";
import SentimentDot from "../components/badges/SentimentDot";
import { usePlayer } from "../hooks";

const num = (v, dp = 1) => (Number.isInteger(v) ? String(v) : Number(v).toFixed(dp));

// One plain sentence per SHAP row. Only the features that show up often get
// their own wording; everything else falls back to the job's display name.
function describe(s, player) {
  const f = s.feature;
  const v = s.value;

  // s.value is in model units (tenths), the header price is what people know
  if (f === "value") return `Price £${player.value.toFixed(1)}m`;
  if (f === "minutes_lag1" || f === "us_time_lag1") {
    if (v >= 90) return "Played the full 90 last GW";
    return v > 0 ? `Played ${num(v, 0)} mins last GW` : "Did not play last GW";
  }
  if (f === "minutes_roll3") return `${num(v, 0)} mins per game over the last 3`;
  if (f === "minutes_roll5") return `${num(v, 0)} mins per game over the last 5`;
  if (f === "total_points_season_avg") return `Averaging ${num(v)} pts this season`;
  if (f === "total_points_roll3") return `Averaging ${num(v)} pts over the last 3`;
  if (f === "total_points_roll10") return `Averaging ${num(v)} pts over the last 10`;
  if (f === "total_points_lag1") return `${num(v, 0)} pts last GW`;
  if (f === "chance_next_round" || f === "chance_this_round")
    return `${num(v, 0)}% chance of playing`;
  if (f === "status_encoded") return "Availability status";
  if (f === "team") return "Team";
  if (f === "opponent_team") return "This week's opponent";
  if (f === "news_sentiment_pos") return "Positive news coverage";
  if (f === "news_sentiment_neg") return "Negative news coverage";
  if (f === "injury_count_season") return `${num(v, 0)} injuries this season`;
  if (f === "gws_since_last_injury") return `${num(v, 0)} GWs since last injury`;
  if (f.startsWith("fdr_")) return "Upcoming fixture difficulty";
  if (f === "position") return `Position: ${v}`;

  return typeof v === "number" ? `${s.display}: ${num(v)}` : s.display;
}

const Stat = ({ value, label, tone = "text-surface-100" }) => (
  <div>
    <span className={`text-lg font-bold font-data tabular-nums ${tone}`}>{value}</span>
    <span className="text-xs text-surface-500 ml-1">{label}</span>
  </div>
);

export default function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: player, isLoading, error } = usePlayer(id);
  if (isLoading) return <Loading />;
  if (error) return <ErrorState message="Failed to load player data." />;
  if (!player) return null;

  const netTransfers = player.transfers_in_event - player.transfers_out_event;
  const [low, high] = player.predicted_range;
  const displayName = player.first_name?.startsWith(player.web_name)
    ? player.web_name
    : `${player.first_name?.split(" ")[0]} ${player.web_name}`;

  return (
    <div className="space-y-8 stagger">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="flex items-start justify-between gap-6">
        <div>
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
          <h2 className="text-xl font-bold text-surface-100">{displayName}</h2>
          <p className="text-sm text-surface-500">
            {player.team_name} · £{player.value.toFixed(1)}m · {player.selected_by_percent}% owned
          </p>
          {player.news && <p className="text-xs text-warning-400 mt-1">{player.news}</p>}
        </div>

        <div className="text-right shrink-0">
          <span className="text-4xl font-bold text-brand-400 font-data tabular-nums leading-none">
            {player.predicted_points.toFixed(1)}
          </span>
          <p className="text-xs text-surface-500 mt-1">predicted points</p>
          <p className="text-xs text-surface-500 font-data tabular-nums">
            likely {low.toFixed(1)} to {high.toFixed(1)}
          </p>
        </div>
      </div>

      {player.shap?.length > 0 && (
        <div>
          <span className="section-label">Why {player.predicted_points.toFixed(1)}</span>
          <div className="mt-3 max-w-md space-y-1.5">
            {player.shap.map((s) => (
              <div key={s.feature} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-surface-300">{describe(s, player)}</span>
                <span
                  className={`font-data tabular-nums font-medium ${s.impact > 0 ? "text-success-400" : "text-danger-400"}`}
                >
                  {s.impact > 0 ? "+" : "−"}
                  {Math.abs(s.impact).toFixed(1)}
                </span>
              </div>
            ))}
            <p className="text-2xs text-surface-500 pt-1">
              The {player.shap.length} biggest factors, in points. Smaller ones make up the rest.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-5 flex-wrap py-3 border-y border-surface-800">
        <Stat value={player.total_points} label="pts this season" />
        <div className="w-px h-4 bg-surface-700" />
        <Stat value={player.form} label="form" />
        <div className="w-px h-4 bg-surface-700" />
        <Stat value={player.minutes.toLocaleString()} label="mins" />
        <div className="w-px h-4 bg-surface-700" />
        <Stat
          value={`${netTransfers > 0 ? "+" : ""}${(netTransfers / 1000).toFixed(1)}k`}
          label="transfers this GW"
          tone={
            netTransfers > 0
              ? "text-success-400"
              : netTransfers < 0
                ? "text-danger-400"
                : "text-surface-100"
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <span className="section-label">Recent form</span>
          <div className="mt-3 max-w-sm">
            <div className="flex items-center gap-3 py-1 text-2xs text-surface-500 uppercase tracking-wide">
              <span className="w-10">GW</span>
              <span className="w-10 text-right">Pts</span>
              <span className="w-10 text-right">Mins</span>
              <span className="w-10 text-right">xG</span>
              <span className="w-10 text-right">xA</span>
              <span className="w-10 text-right">Bonus</span>
            </div>
            {player.pts_history.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-1 text-sm font-data tabular-nums">
                <span className="w-10 text-xs text-surface-500">{player.gw_labels[i]}</span>
                <span
                  className={`w-10 text-right font-bold ${p >= 8 ? "text-brand-400" : p >= 3 ? "text-surface-100" : "text-surface-500"}`}
                >
                  {p}
                </span>
                <span className="w-10 text-right text-surface-300">
                  {player.minutes_history[i]}
                </span>
                <span className="w-10 text-right text-surface-300">
                  {num(player.xg_history[i], 2)}
                </span>
                <span className="w-10 text-right text-surface-300">
                  {num(player.xa_history[i], 2)}
                </span>
                <span className="w-10 text-right text-surface-300">{player.bonus_history[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <span className="section-label">Upcoming fixtures</span>
          <div className="mt-3 space-y-1">
            {player.fixtures.map((f) => (
              <div key={f.gw} className="flex items-center gap-3 py-1 text-sm">
                <span className="text-xs text-surface-500 w-10 font-data tabular-nums">
                  GW{f.gw}
                </span>
                <span className="text-surface-100 w-10">{f.opponent}</span>
                <span className="text-xs text-surface-500 w-4">{f.home ? "H" : "A"}</span>
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded text-2xs font-bold ${FDR_COLORS[f.fdr].bg} ${FDR_COLORS[f.fdr].text}`}
                  title={FDR_COLORS[f.fdr].label}
                >
                  {f.fdr}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <span className="section-label">This season</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
          {[
            { label: "Goals", value: player.goals, sub: `${num(player.xG, 2)} xG` },
            { label: "Assists", value: player.assists, sub: `${num(player.xA, 2)} xA` },
            { label: "Clean sheets", value: player.clean_sheets },
            { label: "Bonus", value: player.bonus },
          ].map((stat) => (
            <div key={stat.label}>
              <span className="text-lg font-bold text-surface-100 font-data tabular-nums">
                {stat.value}
              </span>
              {stat.sub && <span className="text-xs text-surface-500 ml-1.5">{stat.sub}</span>}
              <p className="text-xs text-surface-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {player.news_mentions?.length > 0 && (
        <div>
          <span className="section-label">News mentions</span>
          <div className="mt-3 space-y-2">
            {player.news_mentions.map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2 border-b border-surface-800/60 last:border-0"
              >
                <SentimentDot value={a.sentiment} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-200">{a.headline}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-2xs text-surface-500">{a.source}</span>
                    <span className="text-2xs text-surface-600">{a.date}</span>
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
