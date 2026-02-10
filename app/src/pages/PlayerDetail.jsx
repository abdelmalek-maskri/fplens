import { useParams, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { FDR_COLORS, POSITION_COLORS, POSITION_BG } from "../lib/constants";
import TeamBadge from "../components/TeamBadge";
import StatusBadge from "../components/StatusBadge";
import ShapBreakdown from "../components/ShapBreakdown";

// ============================================================
// MOCK PLAYER DATA
// Will be replaced with: GET /api/player/{id}
// ============================================================
const mockPlayers = {
  2: {
    element: 2,
    web_name: "Haaland",
    first_name: "Erling",
    second_name: "Haaland",
    team_name: "MCI",
    position: "FWD",
    value: 15.3,
    selected_by_percent: 85.2,
    form: 8.8,
    predicted_points: 7.2,
    predicted_range: [5.8, 8.6],
    status: "a",
    chance_of_playing: 100,
    news: "",
    total_points: 168,
    minutes: 1890,
    goals: 18,
    assists: 4,
    clean_sheets: 5,
    goals_conceded: 22,
    bonus: 28,
    bps: 512,
    xG: 16.8,
    xA: 3.2,
    ict_index: 285.4,
    transfers_in_event: 45200,
    transfers_out_event: 12800,
    price_trend: "stable",
    pts_history: [13, 2, 9, 5, 12, 2, 8, 6, 15, 3],
    gw_labels: ["GW15", "GW16", "GW17", "GW18", "GW19", "GW20", "GW21", "GW22", "GW23", "GW24"],
    fixtures: [
      { gw: 25, opponent: "ARS", fdr: 5, home: false },
      { gw: 26, opponent: "IPS", fdr: 1, home: true },
      { gw: 27, opponent: "NFO", fdr: 2, home: false },
      { gw: 28, opponent: "LEI", fdr: 2, home: true },
      { gw: 29, opponent: "CHE", fdr: 4, home: false },
      { gw: 30, opponent: "WHU", fdr: 2, home: true },
    ],
    shap: [
      { feature: "minutes_played", value: "90", impact: 1.8 },
      { feature: "form_last5", value: "8.8", impact: 1.5 },
      { feature: "xG_per90", value: "0.82", impact: 1.2 },
      { feature: "fixture_difficulty", value: "2 (BOU)", impact: 0.8 },
      { feature: "home_advantage", value: "Yes", impact: 0.5 },
      { feature: "team_strength", value: "4.2", impact: 0.4 },
      { feature: "opponent_xGA", value: "1.45", impact: 0.3 },
      { feature: "rest_days", value: "6", impact: 0.1 },
      { feature: "yellow_cards", value: "3", impact: -0.2 },
      { feature: "injury_flag", value: "None", impact: 0.0 },
    ],
    news_mentions: [
      { headline: "Haaland in contention for Ballon d'Or after record-breaking run", source: "The Guardian", date: "2025-02-08", sentiment: 0.85 },
      { headline: "Manchester City eye title charge as Haaland leads scoring charts", source: "The Guardian", date: "2025-02-05", sentiment: 0.72 },
      { headline: "Guardiola praises Haaland's work rate in emphatic victory", source: "The Guardian", date: "2025-02-01", sentiment: 0.68 },
    ],
  },
  3: {
    element: 3,
    web_name: "Salah",
    first_name: "Mohamed",
    second_name: "Salah",
    team_name: "LIV",
    position: "MID",
    value: 13.2,
    selected_by_percent: 52.1,
    form: 7.2,
    predicted_points: 6.8,
    predicted_range: [4.5, 9.1],
    status: "a",
    chance_of_playing: 100,
    news: "",
    total_points: 182,
    minutes: 2070,
    goals: 16,
    assists: 10,
    clean_sheets: 8,
    goals_conceded: 14,
    bonus: 32,
    bps: 548,
    xG: 14.2,
    xA: 8.5,
    ict_index: 312.8,
    transfers_in_event: 38500,
    transfers_out_event: 8200,
    price_trend: "rise",
    pts_history: [12, 3, 8, 5, 15, 6, 2, 10, 8, 13],
    gw_labels: ["GW15", "GW16", "GW17", "GW18", "GW19", "GW20", "GW21", "GW22", "GW23", "GW24"],
    fixtures: [
      { gw: 25, opponent: "SOU", fdr: 1, home: true },
      { gw: 26, opponent: "MUN", fdr: 3, home: false },
      { gw: 27, opponent: "BRE", fdr: 2, home: true },
      { gw: 28, opponent: "AVL", fdr: 3, home: false },
      { gw: 29, opponent: "CRY", fdr: 2, home: true },
      { gw: 30, opponent: "ARS", fdr: 5, home: false },
    ],
    shap: [
      { feature: "assists_last5", value: "4", impact: 1.6 },
      { feature: "form_last5", value: "7.2", impact: 1.4 },
      { feature: "xG_per90", value: "0.65", impact: 0.9 },
      { feature: "xA_per90", value: "0.38", impact: 0.8 },
      { feature: "fixture_difficulty", value: "2 (EVE)", impact: 0.7 },
      { feature: "home_advantage", value: "No", impact: -0.3 },
      { feature: "team_strength", value: "4.5", impact: 0.5 },
      { feature: "minutes_played", value: "90", impact: 0.4 },
      { feature: "penalty_taker", value: "Yes", impact: 0.3 },
      { feature: "news_sentiment", value: "0.72", impact: 0.1 },
    ],
    news_mentions: [
      { headline: "Salah contract saga continues as Liverpool weigh options", source: "The Guardian", date: "2025-02-07", sentiment: -0.15 },
      { headline: "Salah scores twice in dominant Liverpool display", source: "The Guardian", date: "2025-02-03", sentiment: 0.82 },
    ],
  },
};

// Fallback for unknown player IDs
const defaultPlayer = {
  element: 0,
  web_name: "Unknown",
  first_name: "Unknown",
  second_name: "Player",
  team_name: "???",
  position: "MID",
  value: 5.0,
  selected_by_percent: 0,
  form: 0,
  predicted_points: 2.0,
  predicted_range: [1.0, 3.0],
  status: "a",
  chance_of_playing: 100,
  news: "",
  total_points: 0,
  minutes: 0,
  goals: 0,
  assists: 0,
  clean_sheets: 0,
  goals_conceded: 0,
  bonus: 0,
  bps: 0,
  xG: 0,
  xA: 0,
  ict_index: 0,
  transfers_in_event: 0,
  transfers_out_event: 0,
  price_trend: "stable",
  pts_history: [2, 1, 2, 3, 1, 2, 2, 1, 3, 2],
  gw_labels: ["GW15", "GW16", "GW17", "GW18", "GW19", "GW20", "GW21", "GW22", "GW23", "GW24"],
  fixtures: [
    { gw: 25, opponent: "TBD", fdr: 3, home: true },
    { gw: 26, opponent: "TBD", fdr: 3, home: false },
    { gw: 27, opponent: "TBD", fdr: 3, home: true },
    { gw: 28, opponent: "TBD", fdr: 3, home: false },
    { gw: 29, opponent: "TBD", fdr: 3, home: true },
    { gw: 30, opponent: "TBD", fdr: 3, home: false },
  ],
  shap: [
    { feature: "form_last5", value: "2.0", impact: 0.3 },
    { feature: "minutes_played", value: "90", impact: 0.2 },
    { feature: "fixture_difficulty", value: "3", impact: 0.0 },
  ],
  news_mentions: [],
};

// ============================================================
// FORM BAR CHART — last 10 GW points
// ============================================================
const FormChart = ({ pts, labels }) => {
  const max = Math.max(...pts, 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {pts.map((p, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-2xs text-surface-400 font-data tabular-nums">
            {p}
          </span>
          <div
            className={`w-full rounded-t transition-all ${
              p >= 8 ? "bg-brand-400" : p >= 5 ? "bg-brand-500/60" : p >= 3 ? "bg-surface-500" : "bg-surface-700"
            }`}
            style={{ height: `${(p / max) * 100}%`, minHeight: p > 0 ? "4px" : "1px" }}
          />
          <span className="text-2xs text-surface-600 truncate w-full text-center">
            {labels[i]?.replace("GW", "")}
          </span>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// SENTIMENT DOT
// ============================================================
const SentimentDot = ({ value }) => {
  const color =
    value >= 0.5 ? "bg-success-400" : value >= 0 ? "bg-surface-400" : "bg-danger-400";
  return <div className={`w-2 h-2 rounded-full ${color}`} />;
};

// ============================================================
// PLAYER DETAIL PAGE
// ============================================================
export default function PlayerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const player = useMemo(
    () => mockPlayers[id] || { ...defaultPlayer, element: Number(id), web_name: `Player #${id}` },
    [id]
  );

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
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${POSITION_BG[player.position]} ${POSITION_COLORS[player.position]}`}>
              {player.position}
            </span>
            {player.status !== "a" && (
              <StatusBadge status={player.status} chance={player.chance_of_playing} compact />
            )}
          </div>
          <h2 className="text-xl font-bold text-surface-100">
            {player.first_name} {player.second_name}
          </h2>
          <p className="text-sm text-surface-500">{player.team_name} · £{player.value}m · {player.selected_by_percent}% owned</p>
          {player.news && (
            <p className="text-xs text-warning-400 mt-1">{player.news}</p>
          )}
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-brand-400 font-data tabular-nums">
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
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">{player.total_points}</span>
          <span className="text-xs text-surface-500 ml-1">total pts</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">{player.form}</span>
          <span className="text-xs text-surface-500 ml-1">form</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">{ppg}</span>
          <span className="text-xs text-surface-500 ml-1">pts/90</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100 font-data tabular-nums">{player.ict_index}</span>
          <span className="text-xs text-surface-500 ml-1">ICT</span>
        </div>
        <div className="w-px h-4 bg-surface-700" />
        <div>
          <span className={`text-lg font-bold font-data tabular-nums ${netTransfers > 0 ? "text-success-400" : netTransfers < 0 ? "text-danger-400" : "text-surface-100"}`}>
            {netTransfers > 0 ? "+" : ""}{(netTransfers / 1000).toFixed(1)}k
          </span>
          <span className="text-xs text-surface-500 ml-1">net transfers</span>
        </div>
      </div>

      {/* Two-column layout: Form + Fixtures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form chart */}
        <div>
          <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
            Recent form
          </span>
          <div className="mt-3">
            <FormChart pts={player.pts_history} labels={player.gw_labels} />
          </div>
        </div>

        {/* Fixture run */}
        <div>
          <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
            Upcoming fixtures
          </span>
          <div className="mt-3 space-y-1.5">
            {player.fixtures.map((f) => (
              <div key={f.gw} className="flex items-center gap-3 py-1.5">
                <span className="text-xs text-surface-500 w-10 font-data tabular-nums">GW{f.gw}</span>
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-2xs font-bold ${FDR_COLORS[f.fdr].bg} ${FDR_COLORS[f.fdr].text}`}>
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
        <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
          Season stats
        </span>
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
              <span className="text-2xl font-bold text-surface-100 font-data tabular-nums">
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

      {/* SHAP Breakdown */}
      {player.shap && player.shap.length > 0 && (
        <div>
          <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
            Prediction breakdown
          </span>
          <div className="mt-3 card">
            <ShapBreakdown shapData={player.shap} />
          </div>
        </div>
      )}

      {/* News mentions */}
      {player.news_mentions && player.news_mentions.length > 0 && (
        <div>
          <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">
            News mentions
          </span>
          <div className="mt-3 space-y-2">
            {player.news_mentions.map((article, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-surface-800/60 last:border-0">
                <SentimentDot value={article.sentiment} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-200">{article.headline}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-2xs text-surface-500">{article.source}</span>
                    <span className="text-2xs text-surface-600">{article.date}</span>
                    <span className={`text-2xs font-data tabular-nums ${
                      article.sentiment >= 0.5 ? "text-success-400" : article.sentiment >= 0 ? "text-surface-400" : "text-danger-400"
                    }`}>
                      {article.sentiment > 0 ? "+" : ""}{article.sentiment.toFixed(2)}
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
