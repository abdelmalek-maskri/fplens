export const modelVariants = [
  {
    id: "config_d",
    name: "Config D (Best)",
    mae: 1.0289,
    rmse: 2.0781,
    r2: 0.256,
    spearman: 0.687,
    features: 155,
    description: "Stacked ensemble with injury + news features",
    best: true,
  },
  {
    id: "config_b",
    name: "Config B",
    mae: 1.0315,
    rmse: 2.0826,
    r2: 0.253,
    spearman: 0.685,
    features: 148,
    description: "Stacked ensemble with injury features",
  },
  {
    id: "config_c",
    name: "Config C",
    mae: 1.0372,
    rmse: 2.0893,
    r2: 0.248,
    spearman: 0.675,
    features: 123,
    description: "Stacked ensemble with news features",
  },
  {
    id: "config_a",
    name: "Config A",
    mae: 1.0387,
    rmse: 2.091,
    r2: 0.247,
    spearman: 0.674,
    features: 116,
    description: "Stacked ensemble, FPL + Understat only",
  },
  {
    id: "baseline_tweedie",
    name: "LightGBM Tweedie",
    mae: 1.0214,
    rmse: 2.1214,
    r2: 0.221,
    spearman: 0.662,
    features: 116,
    description: "Single LightGBM with Tweedie loss",
  },
  {
    id: "stacked_ensemble",
    name: "Stacked Ensemble",
    mae: 1.0804,
    rmse: 2.0825,
    r2: 0.253,
    spearman: 0.669,
    features: 116,
    description: "6-model ensemble with Ridge meta-learner (FPL + Understat)",
  },
  {
    id: "twohead",
    name: "Two-Head",
    mae: 1.0871,
    rmse: 2.1104,
    r2: 0.233,
    spearman: 0.655,
    features: 116,
    description: "LightGBM classifier × regressor with soft combination",
  },
  {
    id: "baseline",
    name: "Single LightGBM",
    mae: 1.091,
    rmse: 2.1087,
    r2: 0.234,
    spearman: 0.661,
    features: 116,
    description: "Single LightGBM baseline",
  },
  {
    id: "position_specific",
    name: "Position-Specific",
    mae: 1.0948,
    rmse: 2.1172,
    r2: 0.228,
    spearman: 0.633,
    features: 116,
    description: "Separate LightGBM per position (GK/DEF/MID/FWD)",
  },
  {
    id: "catboost_twohead",
    name: "CatBoost Two-Head",
    mae: 1.0969,
    rmse: 2.0926,
    r2: 0.246,
    spearman: 0.667,
    features: 116,
    description: "CatBoost classifier + Tweedie regressor",
  },
];

export const baselines = [
  { name: "Zero Baseline", mae: 1.2102 },
  { name: "Mean Baseline", mae: 1.5199 },
  { name: "Position Mean", mae: 1.4763 },
];

export const positionPerformance = [
  {
    position: "GK",
    config_d: 0.7635,
    baseline: 0.7909,
    stacked: 0.795,
    posSpecific: 0.8166,
    twohead: 0.8031,
    tweedie: 0.7227,
    cbTwohead: 0.796,
    samples: 2705,
  },
  {
    position: "DEF",
    config_d: 1.004,
    baseline: 1.0636,
    stacked: 1.0537,
    posSpecific: 1.0655,
    twohead: 1.0524,
    tweedie: 0.9742,
    cbTwohead: 1.095,
    samples: 8612,
  },
  {
    position: "MID",
    config_d: 0.9804,
    baseline: 1.0547,
    stacked: 1.0309,
    posSpecific: 1.0373,
    twohead: 1.0394,
    tweedie: 0.9902,
    cbTwohead: 1.035,
    samples: 11557,
  },
  {
    position: "FWD",
    config_d: 1.1396,
    baseline: 1.1877,
    stacked: 1.1926,
    posSpecific: 1.2197,
    twohead: 1.198,
    tweedie: 1.1165,
    cbTwohead: 1.209,
    samples: 2844,
  },
];

export const ablationConfigs = [
  {
    config: "A",
    name: "Baseline",
    description: "FPL + Understat only",
    mae: 1.0387,
    rmse: 2.091,
    r2: 0.247,
    rho: 0.674,
    features: 116,
    color: "bg-surface-500",
  },
  {
    config: "B",
    name: "+ Injury",
    description: "FPL API injury data",
    mae: 1.0315,
    rmse: 2.0826,
    r2: 0.253,
    rho: 0.685,
    features: 148,
    color: "bg-brand-500",
  },
  {
    config: "C",
    name: "+ News",
    description: "Guardian NLP sentiment",
    mae: 1.0372,
    rmse: 2.0893,
    r2: 0.248,
    rho: 0.675,
    features: 123,
    color: "bg-warning-500",
  },
  {
    config: "D",
    name: "+ Both",
    description: "Injury + News combined",
    mae: 1.0289,
    rmse: 2.0781,
    r2: 0.256,
    rho: 0.687,
    features: 155,
    color: "bg-info-500",
    best: true,
  },
];

export const ablationSignificance = [
  { pair: "A → B", pValue: 2.84e-6, stars: "***", label: "Injury helps" },
  { pair: "A → C", pValue: 6.28e-3, stars: "**", label: "News helps" },
  { pair: "A → D", pValue: 1.07e-10, stars: "***", label: "Both help" },
  { pair: "B → D", pValue: 6.11e-5, stars: "***", label: "News adds over injury" },
];

export const interactionEffect = {
  injuryAlone: 0.69,
  newsAlone: 0.15,
  combined: 0.95,
  expected: 0.84,
  synergy: 0.11,
};

export const twoheadMethods = [
  { method: "Hard (threshold × regressor)", mae: 1.1625 },
  { method: "Soft (probability × regressor)", mae: 1.0871, best: true },
];

export const shapFeatures = [
  { feature: "minutes_lag1", importance: 13.73, category: "Recency" },
  { feature: "value", importance: 6.53, category: "Static" },
  { feature: "minutes_roll3", importance: 6.11, category: "Rolling" },
  { feature: "total_points_season_avg", importance: 4.85, category: "Season" },
  { feature: "ict_index_roll3", importance: 3.84, category: "Rolling" },
  { feature: "us_time_lag1", importance: 3.04, category: "Understat" },
  { feature: "team", importance: 2.99, category: "Static" },
  { feature: "chance_next_round", importance: 2.33, category: "Injury" },
  { feature: "status_encoded", importance: 2.27, category: "Injury" },
  { feature: "total_points_roll10", importance: 2.12, category: "Rolling" },
];

export const ensembleWeights = [
  { model: "Played Prob (clf)", weight: 0.173 },
  { model: "LightGBM v2", weight: 0.168 },
  { model: "Random Forest", weight: 0.167 },
  { model: "LightGBM", weight: 0.166 },
  { model: "Ridge", weight: 0.164 },
  { model: "XGBoost", weight: 0.163 },
];

export const datasetStats = {
  trainRows: 185149,
  testRows: 26000,
  trainSeasons: "2016-17 to 2023-24",
  testSeason: "2024-25",
  playedPct: 39.78,
  notPlayedPct: 60.22,
  cvMae: 1.165,
  cvStd: 0.105,
};

export const calibrationDeciles = {
  labels: ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10"],
  config_d: [0.026, 0.056, 0.131, 0.328, 0.697, 1.214, 1.487, 1.696, 2.048, 2.604],
  baseline: [0.054, 0.085, 0.164, 0.296, 0.792, 1.356, 1.496, 1.704, 2.168, 2.797],
  stacked: [0.055, 0.074, 0.145, 0.327, 1.03, 1.122, 1.448, 1.752, 2.103, 2.738],
};

export const categoryColors = {
  Recency: "bg-brand-500",
  Season: "bg-info-500",
  Static: "bg-success-500",
  Rolling: "bg-warning-500",
  Understat: "bg-surface-500",
  Injury: "bg-danger-500",
};

export const categoryTextColors = {
  Recency: "text-brand-400",
  Season: "text-info-400",
  Static: "text-success-400",
  Rolling: "text-warning-400",
  Understat: "text-surface-300",
  Injury: "text-danger-400",
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

export const calibrationStats = {
  pearsonR: 0.516,
  spearmanRho: 0.687,
  captainEfficiency: 38.2,
  highReturnMae: 5.574,
  playedMae: 1.89,
  notPlayedMae: 0.46,
  captainTop1: 8.3,
  captainTop3: 8.3,
  captainTop5: 16.7,
};

export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "shap", label: "What Matters Most" },
  { id: "ablation", label: "Ablation Study" },
  { id: "positions", label: "By Position" },
  { id: "calibration", label: "Calibration" },
];
