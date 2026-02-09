import { useState } from "react";
import ShapBreakdown from "../components/ShapBreakdown";

// ============================================================
// MOCK DATA - matches real ML pipeline outputs
// Will be replaced with: GET /api/model/metrics, /api/model/shap
// ============================================================

const modelVariants = [
  { id: "baseline", name: "Baseline (LightGBM)", mae: 1.0592, rmse: 2.1324, r2: 0.2167, features: 106, description: "Single LightGBM with extended features" },
  { id: "stacked", name: "Stacked Ensemble", mae: 1.046, rmse: 2.1004, r2: 0.24, features: 106, description: "6-model ensemble with Ridge meta-learner", best: true },
  { id: "position", name: "Position-Specific", mae: 1.0695, rmse: 2.1326, r2: 0.2166, features: 79, description: "Separate models per position (GK/DEF/MID/FWD)" },
  { id: "twohead", name: "Two-Head", mae: 1.063, rmse: 2.1558, r2: 0.1994, features: 106, description: "Position-weighted dual output heads" },
];

const baselines = [
  { name: "Zero Baseline", mae: 1.2102 },
  { name: "Mean Baseline", mae: 1.5198 },
  { name: "Position Mean", mae: 1.4763 },
];

const positionPerformance = [
  { position: "GK", baseline: 0.7847, stacked: 0.7578, posSpecific: 0.793, twohead: 0.789, samples: 2705 },
  { position: "DEF", baseline: 1.0172, stacked: 1.0102, posSpecific: 1.0271, twohead: 1.018, samples: 8612 },
  { position: "MID", baseline: 1.0246, stacked: 1.0127, posSpecific: 1.0231, twohead: 1.021, samples: 11557 },
  { position: "FWD", baseline: 1.1665, stacked: 1.1657, posSpecific: 1.185, twohead: 1.172, samples: 2844 },
];

const ablationConfigs = [
  { config: "A", name: "Baseline", description: "No injury data", mae: 1.094, features: 86, color: "bg-surface-500" },
  { config: "B", name: "+ Injury Status", description: "status, chance_of_playing, consecutive_starts", mae: 1.043, features: 93, color: "bg-brand-500" },
  { config: "C", name: "+ Injury NLP", description: "injury_type, return_weeks, sentiment", mae: 1.042, features: 106, color: "bg-success-500" },
];

// Top 20 SHAP features from actual analysis
const shapFeatures = [
  { feature: "minutes_lag1", importance: 20.68, category: "Recency" },
  { feature: "total_points_season_avg", importance: 7.38, category: "Season" },
  { feature: "value", importance: 6.57, category: "Static" },
  { feature: "minutes_roll3", importance: 3.85, category: "Rolling" },
  { feature: "us_time_lag1", importance: 3.65, category: "Understat" },
  { feature: "ict_index_roll3", importance: 3.26, category: "Rolling" },
  { feature: "team", importance: 3.11, category: "Static" },
  { feature: "minutes_season_avg", importance: 2.10, category: "Season" },
  { feature: "total_points_roll3", importance: 2.04, category: "Rolling" },
  { feature: "opponent_team", importance: 1.83, category: "Static" },
  { feature: "position", importance: 1.70, category: "Static" },
  { feature: "bps_season_avg", importance: 1.45, category: "Season" },
  { feature: "minutes_roll5", importance: 1.43, category: "Rolling" },
  { feature: "was_home", importance: 1.30, category: "Static" },
  { feature: "ict_index_roll5", importance: 1.20, category: "Rolling" },
  { feature: "ict_index_lag1", importance: 1.03, category: "Recency" },
  { feature: "threat_season_avg", importance: 1.03, category: "Season" },
  { feature: "us_xgbuildup_lag1", importance: 0.99, category: "Understat" },
  { feature: "expected_assists_lag1", importance: 0.87, category: "Recency" },
  { feature: "creativity_roll10", importance: 0.84, category: "Rolling" },
];

const ensembleWeights = [
  { model: "LightGBM", weight: 0.441 },
  { model: "Played Prob", weight: 0.402 },
  { model: "Ridge", weight: 0.189 },
  { model: "LightGBM v2", weight: 0.163 },
  { model: "XGBoost", weight: 0.078 },
  { model: "Random Forest", weight: 0.024 },
];

const datasetStats = {
  trainRows: 185149,
  testRows: 26000,
  trainSeasons: "2016-17 to 2023-24",
  testSeason: "2024-25",
  playedPct: 39.78,
  notPlayedPct: 60.22,
};

// ============================================================
// CATEGORY COLORS
// ============================================================
const categoryColors = {
  Recency: "bg-brand-500",
  Season: "bg-info-500",
  Static: "bg-success-500",
  Rolling: "bg-warning-500",
  Understat: "bg-pink-500",
};

const categoryTextColors = {
  Recency: "text-brand-400",
  Season: "text-info-400",
  Static: "text-success-400",
  Rolling: "text-warning-400",
  Understat: "text-pink-400",
};

// ============================================================
// PER-PLAYER SHAP EXAMPLES
// ============================================================
const exampleShap = {
  2: [ // Haaland
    { feature: "minutes_lag1", value: 90, impact: +1.8 },
    { feature: "form", value: 8.8, impact: +1.2 },
    { feature: "opponent_strength", value: "BOU (FDR 2)", impact: +0.8 },
    { feature: "total_points_season_avg", value: 6.5, impact: +0.6 },
    { feature: "was_home", value: "Yes", impact: +0.3 },
  ],
  3: [ // Salah
    { feature: "minutes_lag1", value: 90, impact: +1.5 },
    { feature: "form", value: 7.2, impact: +0.9 },
    { feature: "ict_index_roll3", value: 42.1, impact: +0.7 },
    { feature: "opponent_strength", value: "EVE (FDR 2)", impact: +0.6 },
    { feature: "total_points_season_avg", value: 7.0, impact: +0.5 },
  ],
  10: [ // Watkins (injured)
    { feature: "chance_of_playing", value: "0%", impact: -2.8 },
    { feature: "status", value: "Injured", impact: -1.5 },
    { feature: "minutes_lag1", value: 0, impact: -1.2 },
    { feature: "injury_type", value: "Hamstring", impact: -0.4 },
    { feature: "form", value: 5.4, impact: +0.2 },
  ],
};

// ============================================================
// TABS
// ============================================================
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "shap", label: "What Matters Most" },
  { id: "ablation", label: "Injury Data Impact" },
  { id: "positions", label: "By Position" },
];

// ============================================================
// MODEL INSIGHTS PAGE
// ============================================================
export default function ModelInsights() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6 stagger">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-surface-800/50 rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-brand-600 text-white"
                : "text-surface-400 hover:text-surface-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "shap" && <ShapTab />}
      {activeTab === "ablation" && <AblationTab />}
      {activeTab === "positions" && <PositionsTab />}
    </div>
  );
}

// ============================================================
// OVERVIEW TAB
// ============================================================
function OverviewTab() {
  const bestModel = modelVariants.find((m) => m.best);
  const bestMae = bestModel.mae;

  return (
    <div className="space-y-6">
      {/* Quick Stats — inline */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-lg font-bold text-surface-100">Stacked Ensemble</span>
          <span className="text-xs text-surface-500 ml-1.5">MAE {bestMae}</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-success-400">-{((1 - bestMae / baselines[0].mae) * 100).toFixed(1)}%</span>
          <span className="text-xs text-surface-500 ml-1.5">vs zero baseline</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100">{(datasetStats.trainRows / 1000).toFixed(0)}K</span>
          <span className="text-xs text-surface-500 ml-1.5">train rows</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100">{(datasetStats.testRows / 1000).toFixed(0)}K</span>
          <span className="text-xs text-surface-500 ml-1.5">holdout</span>
        </div>
      </div>

      {/* Model Comparison Table */}
      <div className="card overflow-y-hidden overflow-x-auto">
        <div className="px-4 py-3 border-b border-surface-700 bg-surface-800/50">
          <h3 className="text-sm font-semibold text-surface-100">
            Prediction Methods Compared
          </h3>
        </div>
        <table className="w-full">
          <thead className="bg-surface-800/30">
            <tr>
              <th className="table-header text-left py-2.5 px-3">Model</th>
              <th className="table-header text-left py-2.5 px-3">MAE</th>
              <th className="table-header text-left py-2.5 px-3">RMSE</th>
              <th className="table-header text-left py-2.5 px-3">R²</th>
              <th className="table-header text-left py-2.5 px-3">Features</th>
              <th className="table-header text-left py-2.5 px-3">
                vs Zero Baseline
              </th>
            </tr>
          </thead>
          <tbody>
            {modelVariants.map((model) => (
              <tr
                key={model.id}
                className={`border-t border-surface-800 transition-colors ${
                  model.best
                    ? "bg-brand-500/5"
                    : "hover:bg-surface-800/30"
                }`}
              >
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-surface-100">
                      {model.name}
                    </p>
                    {model.best && (
                      <span className="badge bg-brand-500/20 text-brand-400">
                        Best
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {model.description}
                  </p>
                </td>
                <td className="py-2.5 px-3 font-data tabular-nums">
                  <span
                    className={`text-lg font-bold ${
                      model.best ? "text-brand-400" : "text-surface-100"
                    }`}
                  >
                    {model.mae.toFixed(4)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">
                  {model.rmse.toFixed(4)}
                </td>
                <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">
                  {model.r2.toFixed(4)}
                </td>
                <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">{model.features}</td>
                <td className="py-2.5 px-3 font-data tabular-nums">
                  <span className="text-success-400 font-semibold">
                    -{((1 - model.mae / baselines[0].mae) * 100).toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ensemble Weights */}
      <div className="mt-8">
        <div className="space-y-3">
          {ensembleWeights.map((m) => (
            <div key={m.model} className="flex items-center gap-3">
              <span className="text-sm text-surface-300 w-28 shrink-0">
                {m.model}
              </span>
              <div className="flex-1 h-6 bg-surface-800 rounded-md overflow-hidden">
                <div
                  className="h-full bg-brand-500/60 rounded-md flex items-center pl-2"
                  style={{
                    width: `${(m.weight / ensembleWeights[0].weight) * 100}%`,
                  }}
                >
                  <span className="text-xs font-semibold text-white">
                    {m.weight.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dataset Breakdown */}
      <div className="mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-surface-500 uppercase tracking-wide mb-2">
              Training / Test Split
            </p>
            <div className="flex h-6 rounded-md overflow-hidden">
              <div
                className="bg-brand-500/60 flex items-center justify-center"
                style={{ width: "87.7%" }}
              >
                <span className="text-2xs font-semibold text-white">
                  Train: 185K
                </span>
              </div>
              <div className="bg-surface-600 flex items-center justify-center flex-1">
                <span className="text-2xs font-semibold text-surface-300">
                  Test: 26K
                </span>
              </div>
            </div>
            <p className="text-xs text-surface-500 mt-2">
              8 seasons train · 1 season holdout
            </p>
          </div>
          <div>
            <p className="text-xs text-surface-500 uppercase tracking-wide mb-2">
              Played vs Not Played (Test Set)
            </p>
            <div className="flex h-6 rounded-md overflow-hidden">
              <div
                className="bg-success-500/60 flex items-center justify-center"
                style={{ width: `${datasetStats.playedPct}%` }}
              >
                <span className="text-2xs font-semibold text-white">
                  Played {datasetStats.playedPct}%
                </span>
              </div>
              <div className="bg-surface-600 flex items-center justify-center flex-1">
                <span className="text-2xs font-semibold text-surface-300">
                  Not played {datasetStats.notPlayedPct}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SHAP FEATURE IMPORTANCE TAB
// ============================================================
function ShapTab() {
  const [examplePlayer, setExamplePlayer] = useState(null);
  const maxImportance = shapFeatures[0].importance;

  // Group by category for summary
  const categoryTotals = shapFeatures.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + f.importance;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Category Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Object.entries(categoryTotals)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, total]) => (
            <div key={cat} className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${categoryColors[cat]}`} />
                <p className="text-xs text-surface-500 uppercase">{cat}</p>
              </div>
              <p className={`text-lg font-bold ${categoryTextColors[cat]}`}>
                {total.toFixed(1)}%
              </p>
            </div>
          ))}
      </div>

      {/* Feature Importance Bars */}
      <div>
        <div className="space-y-2">
          {shapFeatures.map((f, idx) => (
            <div key={f.feature} className="flex items-center gap-3">
              <span className="text-xs text-surface-500 w-5 text-right shrink-0">
                {idx + 1}
              </span>
              <span className="text-sm text-surface-200 w-48 shrink-0 font-data tabular-nums truncate">
                {f.feature}
              </span>
              <div className="flex-1 h-5 bg-surface-800 rounded overflow-hidden">
                <div
                  className={`h-full rounded ${categoryColors[f.category]}/40`}
                  style={{
                    width: `${(f.importance / maxImportance) * 100}%`,
                  }}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-surface-100 w-14 text-right">
                  {f.importance.toFixed(2)}%
                </span>
                <span
                  className={`text-2xs px-1.5 py-0.5 rounded ${categoryColors[f.category]}/20 ${categoryTextColors[f.category]}`}
                >
                  {f.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Key Insights */}
      <div className="mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700">
            <p className="text-2xl font-bold text-brand-400">20.7%</p>
            <p className="text-xs text-surface-400 mt-1">
              from <span className="text-surface-200 font-medium">minutes_lag1</span> alone -- last GW's minutes is the single strongest signal
            </p>
          </div>
          <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700">
            <p className="text-2xl font-bold text-warning-400">~12%</p>
            <p className="text-xs text-surface-400 mt-1">
              from <span className="text-surface-200 font-medium">rolling windows</span> -- 3/5/10 GW averages of points, ICT, minutes
            </p>
          </div>
          <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700">
            <p className="text-2xl font-bold text-success-400">~8%</p>
            <p className="text-xs text-surface-400 mt-1">
              from <span className="text-surface-200 font-medium">static context</span> -- team, opponent, position, home/away
            </p>
          </div>
        </div>
      </div>

      {/* Per-Player Breakdown */}
      <div className="mt-8">
        <p className="text-xs text-surface-500 uppercase tracking-wide mb-3">Per-Player Breakdown</p>
        <div className="flex gap-2 mb-4">
          {[
            { id: 2, name: "Haaland" },
            { id: 3, name: "Salah" },
            { id: 10, name: "Watkins" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setExamplePlayer(examplePlayer === p.id ? null : p.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                examplePlayer === p.id
                  ? "bg-brand-500/20 text-brand-400"
                  : "bg-surface-800 text-surface-400 hover:text-surface-200"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        {examplePlayer && <ShapBreakdown shapData={exampleShap[examplePlayer]} />}
      </div>
    </div>
  );
}

// ============================================================
// ABLATION STUDY TAB
// ============================================================
function AblationTab() {
  const configA = ablationConfigs[0];
  const configB = ablationConfigs[1];
  const configC = ablationConfigs[2];
  const improvementAB = ((configA.mae - configB.mae) / configA.mae * 100).toFixed(1);
  const improvementAC = ((configA.mae - configC.mae) / configA.mae * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Research Questions */}
      <div>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-800/50">
            <span className="badge bg-brand-500/20 text-brand-400 shrink-0">RQ1</span>
            <p className="text-sm text-surface-300">
              Does injury news help predict points beyond just playing time patterns?
            </p>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-800/50">
            <span className="badge bg-brand-500/20 text-brand-400 shrink-0">RQ2</span>
            <p className="text-sm text-surface-300">
              Does reading injury descriptions add anything over basic availability flags?
            </p>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-800/50">
            <span className="badge bg-brand-500/20 text-brand-400 shrink-0">RQ3</span>
            <p className="text-sm text-surface-300">
              Do injury details overlap with existing data or add fresh signal?
            </p>
          </div>
        </div>
      </div>

      {/* Ablation Configs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {ablationConfigs.map((config) => (
          <div
            key={config.config}
            className={`p-4 border ${
              config.config === "C"
                ? "border-success-500/30 bg-success-500/5"
                : config.config === "B"
                  ? "border-brand-500/20"
                  : "border-surface-700"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                config.config === "C"
                  ? "text-success-400"
                  : config.config === "B"
                    ? "text-brand-400"
                    : "text-surface-400"
              }`}>
                Config {config.config}
              </span>
              {config.config === "C" && (
                <span className="badge bg-success-500/20 text-success-400">Best</span>
              )}
            </div>
            <p className="text-sm font-semibold text-surface-100 mb-1">
              {config.name}
            </p>
            <p className="text-xs text-surface-500 mb-4">
              {config.description}
            </p>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-surface-500">MAE</p>
                <p className="text-2xl font-bold text-surface-100">
                  {config.mae.toFixed(3)}
                </p>
              </div>
              <div>
                <p className="text-xs text-surface-500">Features</p>
                <p className="text-sm font-semibold text-surface-300">
                  {config.features}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Improvement Visualization */}
      <div className="mt-8">
        <div className="space-y-4">
          {ablationConfigs.map((config) => {
            const barWidth = ((1.15 - config.mae) / (1.15 - 1.04)) * 100;
            return (
              <div key={config.config} className="flex items-center gap-4">
                <div className="w-24 shrink-0">
                  <p className="text-sm font-medium text-surface-200">
                    Config {config.config}
                  </p>
                  <p className="text-xs text-surface-500">{config.name}</p>
                </div>
                <div className="flex-1 h-8 bg-surface-800 rounded-md overflow-hidden relative">
                  <div
                    className={`h-full ${config.color}/40 rounded-md transition-all duration-500`}
                    style={{ width: `${Math.max(barWidth, 5)}%` }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-bold text-surface-100">
                    {config.mae.toFixed(3)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-surface-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-brand-500/5 border border-brand-500/20">
              <p className="text-xs text-brand-400 font-medium uppercase mb-1">
                A → B Improvement
              </p>
              <p className="text-xl font-bold text-surface-100">
                -{improvementAB}% MAE
              </p>
              <p className="text-xs text-surface-500 mt-1">
                Adding structured injury data (status, chance_of_playing)
              </p>
            </div>
            <div className="p-3 rounded-lg bg-success-500/5 border border-success-500/20">
              <p className="text-xs text-success-400 font-medium uppercase mb-1">
                A → C Improvement
              </p>
              <p className="text-xl font-bold text-surface-100">
                -{improvementAC}% MAE
              </p>
              <p className="text-xs text-surface-500 mt-1">
                Adding NLP-extracted injury features on top
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Findings */}
      <div className="mt-8">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="badge bg-success-500/20 text-success-400 shrink-0 mt-0.5">RQ1</span>
            <div>
              <p className="text-sm text-surface-200 font-medium">
                Yes — injury status significantly improves predictions
              </p>
              <p className="text-xs text-surface-500 mt-1">
                Config B reduces MAE by {improvementAB}% over baseline. Structured injury data adds signal beyond historical playing patterns.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="badge bg-warning-500/20 text-warning-400 shrink-0 mt-0.5">RQ2</span>
            <div>
              <p className="text-sm text-surface-200 font-medium">
                Marginal — NLP adds small incremental improvement
              </p>
              <p className="text-xs text-surface-500 mt-1">
                Config C improves marginally over B (1.043 to 1.042 MAE). NLP features add limited extra signal.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="badge bg-brand-500/20 text-brand-400 shrink-0 mt-0.5">RQ3</span>
            <div>
              <p className="text-sm text-surface-200 font-medium">
                Largely complementary — injury features account for ~17% SHAP importance
              </p>
              <p className="text-xs text-surface-500 mt-1">
                Injury features contribute ~17% of total SHAP importance in Config C -- distinct from playing time and form signals.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// POSITIONS TAB
// ============================================================
function PositionsTab() {
  const positionLabels = {
    GK: "Goalkeeper",
    DEF: "Defender",
    MID: "Midfielder",
    FWD: "Forward",
  };
  const maxMae = 1.2;

  return (
    <div className="space-y-6">
      {/* Position MAE Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {positionPerformance.map((pos) => {
          const best = Math.min(pos.baseline, pos.stacked, pos.posSpecific, pos.twohead);
          return (
            <div key={pos.position} className="p-4 border border-surface-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-surface-500 uppercase tracking-wide">
                  {positionLabels[pos.position]}
                </span>
                <span className="badge bg-surface-700 text-surface-300">
                  {pos.samples.toLocaleString()} samples
                </span>
              </div>
              <p className="text-2xl font-bold text-surface-100">
                {best.toFixed(4)}
              </p>
              <p className="text-xs text-surface-500 mt-1">Best MAE</p>
              <div className="mt-3 h-2 bg-surface-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    pos.position === "GK"
                      ? "bg-success-500"
                      : pos.position === "FWD"
                        ? "bg-danger-500"
                        : "bg-brand-500"
                  }`}
                  style={{ width: `${(1 - best / maxMae) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Comparison Table */}
      <div className="card overflow-y-hidden overflow-x-auto">
        <div className="px-4 py-3 border-b border-surface-700 bg-surface-800/50">
          <h3 className="text-sm font-semibold text-surface-100">
            MAE by Position × Model
          </h3>
        </div>
        <table className="w-full">
          <thead className="bg-surface-800/30">
            <tr>
              <th className="table-header text-left py-2.5 px-3">Position</th>
              <th className="table-header text-left py-2.5 px-3">Baseline</th>
              <th className="table-header text-left py-2.5 px-3">Stacked</th>
              <th className="table-header text-left py-2.5 px-3">
                Pos-Specific
              </th>
              <th className="table-header text-left py-2.5 px-3">Two-Head</th>
              <th className="table-header text-left py-2.5 px-3">Samples</th>
            </tr>
          </thead>
          <tbody>
            {positionPerformance.map((pos) => {
              const values = [
                pos.baseline,
                pos.stacked,
                pos.posSpecific,
                pos.twohead,
              ];
              const minVal = Math.min(...values);
              const Cell = ({ val }) => (
                <td className="py-2.5 px-3">
                  <span
                    className={`font-data tabular-nums ${
                      val === minVal
                        ? "text-brand-400 font-bold"
                        : "text-surface-300"
                    }`}
                  >
                    {val.toFixed(4)}
                  </span>
                </td>
              );
              return (
                <tr
                  key={pos.position}
                  className="border-t border-surface-800 hover:bg-surface-800/30"
                >
                  <td className="py-2.5 px-3">
                    <span className="font-medium text-surface-100">
                      {pos.position}
                    </span>
                    <span className="text-xs text-surface-500 ml-2">
                      {positionLabels[pos.position]}
                    </span>
                  </td>
                  <Cell val={pos.baseline} />
                  <Cell val={pos.stacked} />
                  <Cell val={pos.posSpecific} />
                  <Cell val={pos.twohead} />
                  <td className="py-2.5 px-3 text-surface-400 font-data tabular-nums">
                    {pos.samples.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Position Insights */}
      <div className="mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-success-500/5 border border-success-500/20">
            <p className="text-sm font-medium text-surface-200">
              Goalkeepers are most predictable
            </p>
            <p className="text-xs text-surface-500 mt-1">
              GK MAE 0.758 -- narrow scoring range (2-4 pts when playing) with fewer hauls or blanks.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-danger-500/5 border border-danger-500/20">
            <p className="text-sm font-medium text-surface-200">
              Forwards are hardest to predict
            </p>
            <p className="text-xs text-surface-500 mt-1">
              FWD MAE 1.166 -- goals are high-variance events. Returns swing between blanks and double-digit hauls.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
