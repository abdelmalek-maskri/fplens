// One plain sentence per SHAP row, shared by the dashboard table and the player
// page so the two can never word the same factor differently.

export const num = (v, dp = 1) => (Number.isInteger(v) ? String(v) : Number(v).toFixed(dp));

// One plain sentence per SHAP row. Only the features that show up often get
// their own wording; everything else falls back to the job's display name.
export function describe(s, player) {
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
