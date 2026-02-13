// ============================================================
// DATA - matches real ML pipeline outputs
// Will be replaced with: GET /api/model/metrics, /api/model/shap
// ============================================================

export const modelVariants = [
  { id: "baseline", name: "Baseline (LightGBM)", mae: 1.0597, rmse: 2.1262, r2: 0.2212, features: 106, description: "Single LightGBM with extended features" },
  { id: "stacked", name: "Stacked Ensemble", mae: 1.0508, rmse: 2.0948, r2: 0.2441, features: 106, description: "6-model ensemble with Ridge meta-learner", best: true },
  { id: "position", name: "Position-Specific", mae: 1.0713, rmse: 2.1346, r2: 0.2151, features: 106, description: "Separate models per position (GK/DEF/MID/FWD)" },
  { id: "twohead", name: "Two-Head", mae: 1.0630, rmse: 2.1507, r2: 0.2032, features: 106, description: "Classifier × Regressor with soft combination" },
];

export const baselines = [
  { name: "Zero Baseline", mae: 1.2102 },
  { name: "Mean Baseline", mae: 1.5199 },
  { name: "Position Mean", mae: 1.4763 },
];

export const positionPerformance = [
  { position: "GK", baseline: 0.7870, stacked: 0.7500, posSpecific: 0.7945, twohead: 0.8040, samples: 2705 },
  { position: "DEF", baseline: 1.0163, stacked: 1.0205, posSpecific: 1.0322, twohead: 1.0172, samples: 8612 },
  { position: "MID", baseline: 1.0256, stacked: 1.0093, posSpecific: 1.0250, twohead: 1.0276, samples: 11557 },
  { position: "FWD", baseline: 1.1654, stacked: 1.1827, posSpecific: 1.1769, twohead: 1.1460, samples: 2844 },
];

export const ablationConfigs = [
  { config: "A", name: "Baseline", description: "FPL stats only", mae: 1.0255, r2: 0.238, rho: 0.671, features: 106, color: "bg-surface-500" },
  { config: "B", name: "+ Injury", description: "FPL API injury data", mae: 1.0163, r2: 0.245, rho: 0.684, features: 138, color: "bg-brand-500" },
  { config: "C", name: "+ News", description: "Guardian NLP sentiment", mae: 1.0232, r2: 0.233, rho: 0.670, features: 113, color: "bg-warning-500" },
  { config: "D", name: "+ Both", description: "Injury + News combined", mae: 1.0157, r2: 0.244, rho: 0.684, features: 145, color: "bg-info-500", best: true },
];

export const ablationSignificance = [
  { pair: "A → B", pValue: 1.42e-8, stars: "***", label: "Injury helps" },
  { pair: "A → C", pValue: 0.003, stars: "**", label: "News helps" },
  { pair: "A → D", pValue: 1.17e-9, stars: "***", label: "Both help" },
  { pair: "B → D", pValue: 0.348, stars: "n.s.", label: "News adds nothing over injury" },
];

export const interactionEffect = {
  injuryAlone: 9.22,
  newsAlone: 2.27,
  combined: 9.80,
  expected: 11.49,
  redundancy: 1.69,
};

export const twoheadMethods = [
  { method: "Hard (threshold × regressor)", mae: 1.1588 },
  { method: "Soft (probability × regressor)", mae: 1.0630, best: true },
];

export const shapFeatures = [
  { feature: "minutes_lag1", importance: 17.99, category: "Recency" },
  { feature: "value", importance: 6.90, category: "Static" },
  { feature: "total_points_season_avg", importance: 5.45, category: "Season" },
  { feature: "minutes_roll3", importance: 4.72, category: "Rolling" },
  { feature: "ict_index_roll3", importance: 3.48, category: "Rolling" },
  { feature: "us_time_lag1", importance: 3.18, category: "Understat" },
  { feature: "team", importance: 3.12, category: "Static" },
  { feature: "total_points_roll10", importance: 2.90, category: "Rolling" },
  { feature: "ict_index_roll10", importance: 2.57, category: "Rolling" },
  { feature: "total_points_roll3", importance: 2.08, category: "Rolling" },
];

export const ensembleWeights = [
  { model: "Ridge", weight: 0.367 },
  { model: "Random Forest", weight: 0.319 },
  { model: "Played Prob", weight: 0.317 },
  { model: "LightGBM v2", weight: 0.174 },
  { model: "LightGBM", weight: 0.041 },
  { model: "XGBoost", weight: 0.017 },
];

export const datasetStats = {
  trainRows: 185149,
  testRows: 26000,
  trainSeasons: "2016-17 to 2023-24",
  testSeason: "2024-25",
  playedPct: 39.78,
  notPlayedPct: 60.22,
};

export const calibrationDeciles = {
  labels: ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10"],
  baseline: [0.028, 0.059, 0.134, 0.334, 0.832, 1.299, 1.495, 1.770, 1.922, 2.724],
  stacked: [0.062, 0.056, 0.125, 0.333, 0.736, 1.240, 1.547, 1.732, 2.059, 2.619],
};

export const categoryColors = {
  Recency: "bg-brand-500",
  Season: "bg-info-500",
  Static: "bg-success-500",
  Rolling: "bg-warning-500",
  Understat: "bg-surface-500",
};

export const categoryTextColors = {
  Recency: "text-brand-400",
  Season: "text-info-400",
  Static: "text-success-400",
  Rolling: "text-warning-400",
  Understat: "text-surface-300",
};

export const exampleShap = {
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

export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "shap", label: "What Matters Most" },
  { id: "ablation", label: "Ablation Study" },
  { id: "positions", label: "By Position" },
  { id: "calibration", label: "Calibration" },
];
