// ============================================================
// MOCK DATA - Transfer planner
// Will be replaced with: GET /api/transfers/plan + GET /api/predictions/multi-gw
// ============================================================
export const mockMyTeam = [
  { element: 20, web_name: "Raya", team: "ARS", position: "GK", value: 5.5, selling_price: 5.3, predicted: [4.2, 3.8, 4.5], form: 4.8, status: "a", fdr: [4, 2, 3], pts_last5: [6, 2, 6, 1, 6] },
  { element: 15, web_name: "Alexander-Arnold", team: "LIV", position: "DEF", value: 7.1, selling_price: 7.0, predicted: [5.4, 4.8, 5.1], form: 6.1, status: "a", fdr: [2, 3, 2], pts_last5: [2, 9, 6, 1, 8] },
  { element: 12, web_name: "Gabriel", team: "ARS", position: "DEF", value: 6.2, selling_price: 6.0, predicted: [5.1, 4.2, 4.8], form: 5.8, status: "a", fdr: [4, 2, 3], pts_last5: [6, 2, 8, 6, 6] },
  { element: 25, web_name: "Saliba", team: "ARS", position: "DEF", value: 5.8, selling_price: 5.6, predicted: [4.8, 4.0, 4.5], form: 5.5, status: "a", fdr: [4, 2, 3], pts_last5: [6, 1, 6, 2, 6] },
  { element: 61, web_name: "Mykolenko", team: "EVE", position: "DEF", value: 4.3, selling_price: 4.1, predicted: [3.1, 2.5, 3.0], form: 3.5, status: "a", fdr: [5, 3, 2], pts_last5: [1, 2, 6, 1, 2] },
  { element: 3, web_name: "Salah", team: "LIV", position: "MID", value: 13.2, selling_price: 13.0, predicted: [6.8, 5.5, 6.2], form: 7.2, status: "a", fdr: [2, 3, 2], pts_last5: [12, 3, 8, 5, 15] },
  { element: 7, web_name: "Palmer", team: "CHE", position: "MID", value: 9.5, selling_price: 9.3, predicted: [6.1, 5.8, 4.2], form: 9.2, status: "a", fdr: [5, 2, 3], pts_last5: [5, 13, 2, 10, 8] },
  { element: 5, web_name: "Saka", team: "ARS", position: "MID", value: 10.1, selling_price: 9.9, predicted: [4.2, 5.8, 5.5], form: 6.5, status: "d", fdr: [4, 2, 3], pts_last5: [8, 2, 6, 3, 9] },
  { element: 40, web_name: "Mbeumo", team: "BRE", position: "MID", value: 7.8, selling_price: 7.6, predicted: [4.5, 3.8, 5.2], form: 5.6, status: "a", fdr: [2, 3, 2], pts_last5: [3, 7, 2, 5, 6] },
  { element: 62, web_name: "Wharton", team: "CRY", position: "MID", value: 4.8, selling_price: 4.6, predicted: [2.8, 3.0, 2.5], form: 2.9, status: "a", fdr: [3, 2, 2], pts_last5: [2, 1, 3, 2, 3] },
  { element: 2, web_name: "Haaland", team: "MCI", position: "FWD", value: 15.3, selling_price: 15.1, predicted: [7.2, 5.8, 6.5], form: 8.8, status: "a", fdr: [2, 4, 2], pts_last5: [13, 2, 9, 5, 12] },
  { element: 50, web_name: "Isak", team: "NEW", position: "FWD", value: 8.8, selling_price: 8.6, predicted: [5.5, 6.2, 5.0], form: 7.0, status: "a", fdr: [2, 3, 4], pts_last5: [8, 5, 2, 10, 6] },
  { element: 10, web_name: "Watkins", team: "AVL", position: "FWD", value: 9.0, selling_price: 8.8, predicted: [1.8, 0.0, 3.5], form: 5.4, status: "i", fdr: [2, 3, 2], pts_last5: [2, 6, 3, 2, 5] },
  { element: 60, web_name: "Flekken", team: "BRE", position: "GK", value: 4.5, selling_price: 4.3, predicted: [3.6, 3.2, 4.0], form: 3.2, status: "a", fdr: [2, 3, 2], pts_last5: [3, 6, 1, 3, 6] },
  { element: 63, web_name: "Archer", team: "SOU", position: "FWD", value: 4.5, selling_price: 4.3, predicted: [2.1, 1.8, 2.0], form: 1.8, status: "a", fdr: [3, 4, 3], pts_last5: [1, 2, 1, 2, 1] },
];

export const mockTransferTargets = [
  { element: 70, web_name: "Cunha", team: "WOL", position: "FWD", value: 7.2, predicted: [5.8, 5.2, 4.5], form: 7.5, status: "a", fdr: [3, 2, 2], price_trend: "rise", pts_last5: [9, 2, 7, 5, 8] },
  { element: 71, web_name: "Solanke", team: "TOT", position: "FWD", value: 7.5, predicted: [5.0, 5.5, 6.0], form: 6.2, status: "a", fdr: [2, 3, 2], price_trend: "stable", pts_last5: [5, 3, 6, 2, 7] },
  { element: 72, web_name: "Son", team: "TOT", position: "MID", value: 10.0, predicted: [5.8, 6.2, 5.5], form: 6.8, status: "a", fdr: [2, 3, 2], price_trend: "stable", pts_last5: [6, 8, 5, 3, 10] },
  { element: 73, web_name: "Gordon", team: "NEW", position: "MID", value: 7.5, predicted: [5.2, 5.8, 4.8], form: 6.8, status: "a", fdr: [2, 3, 4], price_trend: "rise", pts_last5: [6, 8, 2, 5, 7] },
  { element: 74, web_name: "Gross", team: "BHA", position: "MID", value: 6.2, predicted: [4.5, 4.8, 5.0], form: 5.5, status: "a", fdr: [2, 2, 3], price_trend: "stable", pts_last5: [3, 5, 4, 6, 3] },
  { element: 75, web_name: "Wood", team: "NFO", position: "FWD", value: 6.5, predicted: [4.8, 4.2, 5.5], form: 6.0, status: "a", fdr: [2, 4, 2], price_trend: "stable", pts_last5: [7, 2, 5, 8, 3] },
  { element: 76, web_name: "Eze", team: "CRY", position: "MID", value: 6.8, predicted: [4.2, 5.0, 5.5], form: 5.8, status: "a", fdr: [3, 2, 2], price_trend: "rise", pts_last5: [4, 6, 2, 8, 5] },
  { element: 77, web_name: "Sch\u00e4r", team: "NEW", position: "DEF", value: 5.2, predicted: [4.5, 4.0, 3.8], form: 5.2, status: "a", fdr: [2, 3, 4], price_trend: "stable", pts_last5: [6, 1, 2, 6, 2] },
  { element: 78, web_name: "Henderson", team: "CRY", position: "GK", value: 4.5, predicted: [3.8, 4.2, 4.0], form: 4.5, status: "a", fdr: [3, 2, 2], price_trend: "stable", pts_last5: [3, 6, 1, 6, 3] },
  { element: 79, web_name: "Munoz", team: "CRY", position: "DEF", value: 4.8, predicted: [3.8, 4.2, 3.5], form: 4.8, status: "a", fdr: [3, 2, 2], price_trend: "rise", pts_last5: [2, 6, 1, 5, 6] },
];

export const GW_LABELS = ["GW24", "GW25", "GW26"];
