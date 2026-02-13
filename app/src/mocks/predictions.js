// Dashboard mock data
// Will be replaced with: GET /api/predictions?model={model}

export const mockPredictions = [
  { element: 2, web_name: "Haaland", name: "Erling Haaland", team_name: "MCI", position: "FWD", value: 15.3, status: "a", predicted_points: 7.2, form: 8.8, total_points: 156, chance_of_playing: 100, selected_by_percent: 85.2, captain_pct: 42.5, news: "", opponent_name: "BOU", rank: 1, uncertainty: 1.8, goals: 16, xG: 14.8, assists: 5, xA: 3.2, transfers_in: 42100, transfers_out: 18200, price_trend: "rise", pts_last5: [12, 2, 8, 6, 15] },
  { element: 3, web_name: "Salah", name: "Mohamed Salah", team_name: "LIV", position: "MID", value: 13.2, status: "a", predicted_points: 6.8, form: 7.2, total_points: 168, chance_of_playing: 100, selected_by_percent: 52.1, captain_pct: 28.3, news: "", opponent_name: "EVE", rank: 2, uncertainty: 1.5, goals: 15, xG: 12.5, assists: 10, xA: 8.1, transfers_in: 35800, transfers_out: 22400, price_trend: "rise", pts_last5: [8, 10, 3, 14, 6] },
  { element: 7, web_name: "Palmer", name: "Cole Palmer", team_name: "CHE", position: "MID", value: 9.5, status: "a", predicted_points: 6.1, form: 9.2, total_points: 158, chance_of_playing: 100, selected_by_percent: 45.8, captain_pct: 12.1, news: "", opponent_name: "ARS", rank: 3, uncertainty: 1.6, goals: 14, xG: 11.2, assists: 8, xA: 6.8, transfers_in: 28900, transfers_out: 31200, price_trend: "fall", pts_last5: [14, 8, 12, 2, 10] },
  { element: 15, web_name: "Alexander-Arnold", name: "Trent Alexander-Arnold", team_name: "LIV", position: "DEF", value: 7.1, status: "a", predicted_points: 5.4, form: 6.1, total_points: 118, chance_of_playing: 100, selected_by_percent: 28.9, captain_pct: 0.8, news: "", opponent_name: "EVE", rank: 4, uncertainty: 1.4, goals: 2, xG: 1.4, assists: 8, xA: 6.5, transfers_in: 18200, transfers_out: 15600, price_trend: "stable", pts_last5: [6, 8, 1, 6, 9] },
  { element: 12, web_name: "Gabriel", name: "Gabriel Magalhães", team_name: "ARS", position: "DEF", value: 6.2, status: "a", predicted_points: 5.1, form: 5.8, total_points: 129, chance_of_playing: 100, selected_by_percent: 31.2, captain_pct: 0.3, news: "", opponent_name: "CHE", rank: 5, uncertainty: 1.3, goals: 4, xG: 2.8, assists: 1, xA: 0.5, transfers_in: 12400, transfers_out: 14100, price_trend: "stable", pts_last5: [6, 2, 8, 6, 8] },
  { element: 20, web_name: "Raya", name: "David Raya", team_name: "ARS", position: "GK", value: 5.5, status: "a", predicted_points: 4.2, form: 4.8, total_points: 98, chance_of_playing: 100, selected_by_percent: 18.2, captain_pct: 0.1, news: "", opponent_name: "CHE", rank: 6, uncertainty: 1.1, goals: 0, xG: 0, assists: 0, xA: 0, transfers_in: 8900, transfers_out: 6200, price_trend: "rise", pts_last5: [6, 2, 6, 3, 7] },
  { element: 50, web_name: "Isak", name: "Alexander Isak", team_name: "NEW", position: "FWD", value: 8.8, status: "a", predicted_points: 5.5, form: 7.0, total_points: 130, chance_of_playing: 100, selected_by_percent: 24.3, captain_pct: 5.2, news: "", opponent_name: "WOL", rank: 7, uncertainty: 1.7, goals: 12, xG: 11.9, assists: 4, xA: 2.8, transfers_in: 48200, transfers_out: 9100, price_trend: "rise", pts_last5: [6, 8, 2, 12, 5] },
  { element: 5, web_name: "Saka", name: "Bukayo Saka", team_name: "ARS", position: "MID", value: 10.1, status: "d", predicted_points: 4.2, form: 6.5, total_points: 142, chance_of_playing: 75, selected_by_percent: 38.4, captain_pct: 3.5, news: "Muscle injury - 75% chance of playing", opponent_name: "CHE", rank: 8, uncertainty: 2.4, goals: 8, xG: 7.5, assists: 10, xA: 8.8, transfers_in: 5200, transfers_out: 62400, price_trend: "fall", pts_last5: [8, 3, 2, 6, 5] },
  { element: 40, web_name: "Mbeumo", name: "Bryan Mbeumo", team_name: "BRE", position: "MID", value: 7.8, status: "a", predicted_points: 4.5, form: 5.6, total_points: 110, chance_of_playing: 100, selected_by_percent: 19.5, captain_pct: 1.8, news: "", opponent_name: "NFO", rank: 9, uncertainty: 1.3, goals: 10, xG: 8.2, assists: 5, xA: 4.1, transfers_in: 22100, transfers_out: 11800, price_trend: "rise", pts_last5: [2, 6, 8, 3, 5] },
  { element: 10, web_name: "Watkins", name: "Ollie Watkins", team_name: "AVL", position: "FWD", value: 9.0, status: "i", predicted_points: 1.8, form: 5.4, total_points: 112, chance_of_playing: 0, selected_by_percent: 22.3, captain_pct: 0.4, news: "Hamstring injury - Expected back in 2-3 weeks", opponent_name: "NFO", rank: 45, uncertainty: 3.1, goals: 10, xG: 11.0, assists: 6, xA: 4.5, transfers_in: 1200, transfers_out: 85400, price_trend: "fall", pts_last5: [5, 8, 2, 1, 0] },
];

export const mockLocalShap = {
  2: [
    { feature: "minutes_lag1", value: 90, impact: +1.8 },
    { feature: "form", value: 8.8, impact: +1.2 },
    { feature: "opponent_strength", value: "BOU (FDR 2)", impact: +0.8 },
    { feature: "total_points_season_avg", value: 6.5, impact: +0.6 },
    { feature: "was_home", value: "Yes", impact: +0.3 },
  ],
  3: [
    { feature: "minutes_lag1", value: 90, impact: +1.5 },
    { feature: "form", value: 7.2, impact: +0.9 },
    { feature: "ict_index_roll3", value: 42.1, impact: +0.7 },
    { feature: "opponent_strength", value: "EVE (FDR 2)", impact: +0.6 },
    { feature: "total_points_season_avg", value: 7.0, impact: +0.5 },
  ],
  10: [
    { feature: "chance_of_playing", value: "0%", impact: -2.8 },
    { feature: "status", value: "Injured", impact: -1.5 },
    { feature: "minutes_lag1", value: 0, impact: -1.2 },
    { feature: "injury_type", value: "Hamstring", impact: -0.4 },
    { feature: "form", value: 5.4, impact: +0.2 },
  ],
};

export const defaultShap = [
  { feature: "minutes_lag1", value: 90, impact: +0.8 },
  { feature: "total_points_season_avg", value: 4.5, impact: +0.5 },
  { feature: "form", value: 5.0, impact: +0.3 },
  { feature: "opponent_strength", value: "FDR 3", impact: -0.1 },
  { feature: "was_home", value: "No", impact: -0.2 },
];

export const MODEL_OPTIONS = [
  { id: "lgbm_c", name: "LightGBM Config C", mae: 1.043, description: "Best overall — 141 features, tuned" },
  { id: "lgbm_a", name: "LightGBM Config A", mae: 1.059, description: "Single LightGBM, 106 features" },
  { id: "position", name: "Position-Specific", mae: 1.070, description: "Separate models per position" },
  { id: "twohead", name: "Two-Head", mae: 1.063, description: "Position-weighted dual heads" },
];
