const DISPLAY_NAMES = {
  minutes_lag1: "Minutes played",
  total_points_season_avg: "Season avg pts",
  total_points_lag1: "Last GW pts",
  total_points_roll3: "Avg pts (3 GW)",
  total_points_roll5: "Avg pts (5 GW)",
  value: "Price",
  form: "Form",
  bps_lag1: "Bonus pts system",
  bps_roll3: "BPS (3 GW avg)",
  ict_index_lag1: "ICT Index",
  ict_index_roll3: "ICT (3 GW avg)",
  bonus_lag1: "Bonus last GW",
  bonus_roll3: "Bonus (3 GW avg)",
  was_home: "Home game",
  opponent_strength: "Opponent difficulty",
  played_lag1: "Played last GW",
  consecutive_starts: "Consecutive starts",
  minutes_trend: "Minutes trend",
  points_momentum: "Points momentum",
  chance_this_round: "Chance of playing",
  status_encoded: "Availability",
  selected_by_percent: "Ownership %",
  us_xg_lag1: "xG last GW",
  us_xa_lag1: "xA last GW",
  us_shots_lag1: "Shots last GW",
  us_key_passes_lag1: "Key passes",
  ict_index_roll5: "ICT Index (5 GW avg)",
  ict_index_roll10: "ICT Index (10 GW avg)",
  total_points_roll10: "Avg pts (10 GW)",
  minutes_roll3: "Minutes (3 GW avg)",
  minutes_roll5: "Minutes (5 GW avg)",
  bps_roll5: "BPS (5 GW avg)",
  expected_goals_lag1: "xG last GW",
  expected_assists_lag1: "xA last GW",
  team: "Team strength",
  opponent_team: "Opponent",
  season: "Season",
  position: "Position",
  gws_since_last_injury: "GWs since injury",
  is_available: "Available",
  is_injured: "Injured",
  is_doubtful: "Doubtful",
  news_sentiment: "News sentiment",
  news_mentioned: "In the news",
};

function formatValue(feature, value) {
  if (value === undefined || value === null) return "";
  if (feature === "was_home") return value > 0.5 ? "Yes" : "No";
  if (feature === "played_lag1") return value > 0.5 ? "Yes" : "No";
  if (feature === "value") return `£${value}m`;
  if (feature.includes("opponent") || feature.includes("strength"))
    return String(Math.round(value));
  if (typeof value === "number") return value % 1 === 0 ? String(value) : value.toFixed(1);
  return String(value);
}

export default function ShapBreakdown({ shapData }) {
  if (!shapData || shapData.length === 0) return null;

  const maxImpact = Math.max(...shapData.map((s) => Math.abs(s.impact)), 0.1);

  return (
    <div className="px-4 py-3 bg-surface-800/20">
      <div className="space-y-1">
        {shapData.map((s) => {
          const isPositive = s.impact >= 0;
          const pct = (Math.abs(s.impact) / maxImpact) * 100;
          const name = s.display || DISPLAY_NAMES[s.feature] || s.feature.replace(/_/g, " ");
          const val = formatValue(s.feature, s.value);

          return (
            <div key={s.feature} className="flex items-center gap-2 text-xs h-6">
              <span className="text-surface-400 w-36 shrink-0 truncate">{name}</span>

              <span className="text-surface-500 w-14 shrink-0 text-right font-data tabular-nums">
                {val}
              </span>

              <div className="flex-1 flex items-center h-4">
                <div className="w-1/2 flex justify-end">
                  {!isPositive && (
                    <div className="h-3 bg-danger-500/30 rounded-l" style={{ width: `${pct}%` }} />
                  )}
                </div>
                <div className="w-px h-4 bg-surface-600 shrink-0" />
                <div className="w-1/2">
                  {isPositive && (
                    <div className="h-3 bg-success-500/30 rounded-r" style={{ width: `${pct}%` }} />
                  )}
                </div>
              </div>

              <span
                className={`w-10 text-right font-data tabular-nums font-semibold ${
                  isPositive ? "text-success-400" : "text-danger-400"
                }`}
              >
                {isPositive ? "+" : ""}
                {s.impact.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
