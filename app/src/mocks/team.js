// ============================================================
// MOCK DATA - matches real FPL API structure for user's team
// Will be replaced with: GET /api/team/{fpl_id}
// ============================================================

export const mockUserTeam = {
  manager: "Abdelmalek Maskri",
  teamName: "ML FC",
  overallRank: 48201,
  gameweekPoints: 62,
  totalPoints: 1284,
  budget: 2.3,
  freeTransfers: 1,
  picks: [
    // Starting 11
    { element: 20, web_name: "Raya", position: "GK", team_name: "ARS", value: 5.5, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 4.2, form: 4.8, status: "a", chance_of_playing: 100, news: "", opponent_name: "CHE", selected_by_percent: 18.2, selling_price: 5.3 },
    { element: 15, web_name: "Alexander-Arnold", position: "DEF", team_name: "LIV", value: 7.1, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 5.4, form: 6.1, status: "a", chance_of_playing: 100, news: "", opponent_name: "EVE", selected_by_percent: 28.9, selling_price: 7.0 },
    { element: 12, web_name: "Gabriel", position: "DEF", team_name: "ARS", value: 6.2, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 5.1, form: 5.8, status: "a", chance_of_playing: 100, news: "", opponent_name: "CHE", selected_by_percent: 31.2, selling_price: 6.0 },
    { element: 30, web_name: "Saliba", position: "DEF", team_name: "ARS", value: 6.0, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 4.8, form: 5.2, status: "a", chance_of_playing: 100, news: "", opponent_name: "CHE", selected_by_percent: 22.1, selling_price: 5.8 },
    { element: 3, web_name: "Salah", position: "MID", team_name: "LIV", value: 13.2, multiplier: 2, is_captain: true, is_vice: false, predicted_points: 6.8, form: 7.2, status: "a", chance_of_playing: 100, news: "", opponent_name: "EVE", selected_by_percent: 52.1, selling_price: 13.0 },
    { element: 7, web_name: "Palmer", position: "MID", team_name: "CHE", value: 9.5, multiplier: 1, is_captain: false, is_vice: true, predicted_points: 6.1, form: 9.2, status: "a", chance_of_playing: 100, news: "", opponent_name: "ARS", selected_by_percent: 45.8, selling_price: 9.3 },
    { element: 5, web_name: "Saka", position: "MID", team_name: "ARS", value: 10.1, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 4.2, form: 6.5, status: "d", chance_of_playing: 75, news: "Muscle injury - 75% chance of playing", opponent_name: "CHE", selected_by_percent: 38.4, selling_price: 9.9 },
    { element: 40, web_name: "Mbeumo", position: "MID", team_name: "BRE", value: 7.8, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 4.5, form: 5.6, status: "a", chance_of_playing: 100, news: "", opponent_name: "NFO", selected_by_percent: 19.5, selling_price: 7.6 },
    { element: 2, web_name: "Haaland", position: "FWD", team_name: "MCI", value: 15.3, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 7.2, form: 8.8, status: "a", chance_of_playing: 100, news: "", opponent_name: "BOU", selected_by_percent: 85.2, selling_price: 15.1 },
    { element: 50, web_name: "Isak", position: "FWD", team_name: "NEW", value: 8.8, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 5.5, form: 7.0, status: "a", chance_of_playing: 100, news: "", opponent_name: "WOL", selected_by_percent: 24.3, selling_price: 8.6 },
    { element: 10, web_name: "Watkins", position: "FWD", team_name: "AVL", value: 9.0, multiplier: 1, is_captain: false, is_vice: false, predicted_points: 1.8, form: 5.4, status: "i", chance_of_playing: 0, news: "Hamstring injury - Expected back in 2-3 weeks", opponent_name: "NFO", selected_by_percent: 22.3, selling_price: 8.8 },
    // Bench
    { element: 60, web_name: "Flekken", position: "GK", team_name: "BRE", value: 4.5, multiplier: 0, is_captain: false, is_vice: false, predicted_points: 3.6, form: 3.2, status: "a", chance_of_playing: 100, news: "", opponent_name: "NFO", selected_by_percent: 5.1, selling_price: 4.3 },
    { element: 61, web_name: "Mykolenko", position: "DEF", team_name: "EVE", value: 4.3, multiplier: 0, is_captain: false, is_vice: false, predicted_points: 3.1, form: 3.5, status: "a", chance_of_playing: 100, news: "", opponent_name: "LIV", selected_by_percent: 4.2, selling_price: 4.1 },
    { element: 62, web_name: "Wharton", position: "MID", team_name: "CRY", value: 4.8, multiplier: 0, is_captain: false, is_vice: false, predicted_points: 2.8, form: 2.9, status: "a", chance_of_playing: 100, news: "", opponent_name: "MUN", selected_by_percent: 3.8, selling_price: 4.6 },
    { element: 63, web_name: "Archer", position: "FWD", team_name: "SOU", value: 4.5, multiplier: 0, is_captain: false, is_vice: false, predicted_points: 2.1, form: 1.8, status: "a", chance_of_playing: 100, news: "", opponent_name: "TOT", selected_by_percent: 1.2, selling_price: 4.3 },
  ],
};

export const mockTransferSuggestions = [
  {
    out: { element: 10, web_name: "Watkins", team_name: "AVL", position: "FWD", predicted_points: 1.8, status: "i", value: 9.0, selling_price: 8.8 },
    in: { element: 70, web_name: "Cunha", team_name: "WOL", position: "FWD", predicted_points: 5.8, status: "a", value: 7.2 },
    points_gain: 4.0,
    cost_saving: 1.6,
  },
  {
    out: { element: 5, web_name: "Saka", team_name: "ARS", position: "MID", predicted_points: 4.2, status: "d", value: 10.1, selling_price: 9.9 },
    in: { element: 71, web_name: "Son", team_name: "TOT", position: "MID", predicted_points: 5.8, status: "a", value: 10.0 },
    points_gain: 1.6,
    cost_saving: -0.1,
  },
];
