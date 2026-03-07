import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import ShapBreakdown from "../components/ShapBreakdown";
import TabBar from "../components/TabBar";
import ErrorState from "../components/ErrorState";
import { SkeletonStatStrip, SkeletonTable } from "../components/skeletons";
import { useModelInsights } from "../hooks";

// ============================================================
// MODEL INSIGHTS PAGE
// ============================================================
export default function ModelInsights() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { data, isLoading, error } = useModelInsights();
  if (isLoading)
    return (
      <div className="space-y-6">
        <SkeletonStatStrip items={4} />
        <SkeletonTable rows={4} cols={5} />
      </div>
    );
  if (error) return <ErrorState message="Failed to load model data." />;
  if (!data) return null;
  const {
    modelVariants,
    baselines,
    positionPerformance,
    ablationConfigs,
    ablationSignificance,
    interactionEffect,
    twoheadMethods,
    shapFeatures,
    ensembleWeights,
    datasetStats,
    calibrationDeciles,
    calibrationStats,
    exampleShap,
    tabs: TABS,
  } = data;

  return (
    <div className="space-y-6 stagger">
      <TabBar
        tabs={TABS}
        active={activeTab}
        onChange={(value) =>
          setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.set("tab", value);
            return p;
          })
        }
        id="insights"
        variant="border"
      />

      <div role="tabpanel" id={`insights-panel-${activeTab}`}>
        {activeTab === "overview" && (
          <OverviewTab
            modelVariants={modelVariants}
            baselines={baselines}
            ensembleWeights={ensembleWeights}
            datasetStats={datasetStats}
            twoheadMethods={twoheadMethods}
            ablationConfigs={ablationConfigs}
          />
        )}
        {activeTab === "shap" && <ShapTab shapFeatures={shapFeatures} exampleShap={exampleShap} />}
        {activeTab === "ablation" && (
          <AblationTab
            ablationConfigs={ablationConfigs}
            ablationSignificance={ablationSignificance}
            interactionEffect={interactionEffect}
          />
        )}
        {activeTab === "positions" && <PositionsTab positionPerformance={positionPerformance} />}
        {activeTab === "calibration" && (
          <CalibrationTab
            calibrationDeciles={calibrationDeciles}
            calibrationStats={calibrationStats}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// REUSABLE SVG GROUPED BAR CHART
// ============================================================
function GroupedBarChart({ labels, series, yMin = 0, yMax, yStep = 0.5 }) {
  const n = labels.length;
  const numSeries = series.length;

  const barW = numSeries <= 2 ? 18 : 18;
  const barGap = 2;
  const groupGap = numSeries <= 2 ? 14 : 16;
  const groupW = numSeries * barW + (numSeries - 1) * barGap;

  const padL = 38;
  const padR = 8;
  const padT = 8;
  const padB = 26;

  const chartW = n * groupW + (n - 1) * groupGap;
  const chartH = 180;
  const svgW = padL + chartW + padR;
  const svgH = padT + chartH + padB;

  const yRange = yMax - yMin;
  const toY = (val) =>
    padT + chartH - ((Math.min(Math.max(val, yMin), yMax) - yMin) / yRange) * chartH;

  const ticks = [];
  for (let t = yMin; t <= yMax + yStep * 0.01; t += yStep) {
    ticks.push(parseFloat(t.toFixed(4)));
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full"
        style={{ maxWidth: Math.max(svgW * 1.1, 480), minWidth: 360 }}
        role="img"
      >
        {/* Y gridlines + labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              y1={toY(t)}
              x2={padL + chartW}
              y2={toY(t)}
              style={{ stroke: "rgb(var(--surface-700))", strokeWidth: 0.5 }}
            />
            <text
              x={padL - 5}
              y={toY(t) + 3.5}
              textAnchor="end"
              style={{ fill: "rgb(var(--surface-400))", fontSize: 9 }}
            >
              {yStep < 0.5 ? t.toFixed(2) : t.toFixed(1)}
            </text>
          </g>
        ))}

        {/* X baseline */}
        <line
          x1={padL}
          y1={toY(yMin)}
          x2={padL + chartW}
          y2={toY(yMin)}
          style={{ stroke: "rgb(var(--surface-500))", strokeWidth: 0.5 }}
        />

        {/* Bar groups */}
        {labels.map((label, i) => {
          const groupX = padL + i * (groupW + groupGap);
          return (
            <g key={label}>
              {series.map((s, si) => {
                const val = s.values[i];
                const x = groupX + si * (barW + barGap);
                const barH = Math.max(((Math.max(val, yMin) - yMin) / yRange) * chartH, 1);
                return (
                  <rect
                    key={s.name}
                    x={x}
                    y={toY(val)}
                    width={barW}
                    height={barH}
                    rx={2}
                    style={{ fill: s.color, fillOpacity: 0.7 }}
                  />
                );
              })}
              <text
                x={groupX + groupW / 2}
                y={toY(yMin) + 15}
                textAnchor="middle"
                style={{ fill: "rgb(var(--surface-400))", fontSize: 9 }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 ml-10">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: s.color, opacity: 0.7 }} />
            <span className="text-xs text-surface-400">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// OVERVIEW TAB
// ============================================================
function OverviewTab({
  modelVariants,
  baselines,
  ensembleWeights,
  datasetStats,
  twoheadMethods,
  ablationConfigs,
}) {
  const bestModel = modelVariants.find((m) => m.best);
  const bestMae = bestModel.mae;
  const configD = ablationConfigs.find((c) => c.best);

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-lg font-bold text-surface-100">Stacked Ensemble</span>
          <span className="text-xs text-surface-500 ml-1.5">MAE {bestMae}</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-success-400">
            -{((1 - bestMae / baselines[0].mae) * 100).toFixed(1)}%
          </span>
          <span className="text-xs text-surface-500 ml-1.5">vs zero baseline</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100">
            {datasetStats.cvMae}{" "}
            <span className="text-sm text-surface-400">± {datasetStats.cvStd}</span>
          </span>
          <span className="text-xs text-surface-500 ml-1.5">CV MAE (8-fold)</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100">
            {(datasetStats.trainRows / 1000).toFixed(0)}K
          </span>
          <span className="text-xs text-surface-500 ml-1.5">train</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100">
            {(datasetStats.testRows / 1000).toFixed(0)}K
          </span>
          <span className="text-xs text-surface-500 ml-1.5">holdout</span>
        </div>
      </div>

      {/* Architecture Comparison Table */}
      <div className="overflow-x-auto">
        <div className="py-3 border-b border-surface-700">
          <span className="section-label">Architecture Comparison</span>
          <span className="text-xs text-surface-500 ml-2">
            ({bestModel.features} features, holdout 2024-25)
          </span>
        </div>
        <table className="w-full">
          <thead className="bg-surface-800/30">
            <tr>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Model
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                MAE
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                RMSE
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                R²
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Spearman ρ
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                vs Zero
              </th>
            </tr>
          </thead>
          <tbody>
            {modelVariants.map((model) => (
              <tr
                key={model.id}
                className={`border-t border-surface-800 transition-colors ${model.best ? "bg-brand-500/5" : "hover:bg-surface-800/30"}`}
              >
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-surface-100">{model.name}</p>
                    {model.best && (
                      <span className="badge bg-brand-500/20 text-brand-400">Best</span>
                    )}
                  </div>
                  <p className="text-xs text-surface-500 mt-0.5">{model.description}</p>
                </td>
                <td className="py-2.5 px-3 font-data tabular-nums">
                  <span
                    className={`font-bold ${model.best ? "text-brand-400" : "text-surface-100"}`}
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
                <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">
                  {model.spearman.toFixed(3)}
                </td>
                <td className="py-2.5 px-3 font-data tabular-nums">
                  <span className="text-success-400 font-semibold">
                    -{((1 - model.mae / baselines[0].mae) * 100).toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Config D note */}
        {configD && (
          <div className="mt-3 p-3 rounded-md bg-info-500/5 border border-info-500/20">
            <p className="text-sm text-surface-300">
              <span className="font-semibold text-surface-100">Deployed model: Config D</span> —
              Stacked Ensemble with injury + news features ({configD.features} features). MAE{" "}
              <span className="font-data font-semibold text-info-400">
                {configD.mae.toFixed(4)}
              </span>
              , Spearman ρ <span className="font-data">{configD.rho.toFixed(3)}</span>. See Ablation
              Study tab for comparison.
            </p>
          </div>
        )}
      </div>

      {/* Meta-Learner Weights */}
      <div>
        <div className="py-3 border-b border-surface-700 mb-3">
          <span className="section-label">Meta-Learner Weights (Ridge)</span>
        </div>
        <div className="space-y-3">
          {ensembleWeights.map((m) => (
            <div key={m.model} className="flex items-center gap-3">
              <span className="text-sm text-surface-300 w-28 shrink-0">{m.model}</span>
              <div className="flex-1 h-6 bg-surface-800 rounded-md overflow-hidden">
                <div
                  className="h-full bg-brand-500/60 rounded-md flex items-center pl-2"
                  style={{ width: `${(m.weight / ensembleWeights[0].weight) * 100}%` }}
                >
                  <span className="text-xs font-semibold text-surface-50">
                    {m.weight.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-Head Comparison */}
      <div>
        <div className="py-3 border-b border-surface-700 mb-3">
          <span className="section-label">Two-Head: Hard vs Soft</span>
          <span className="text-xs text-surface-500 ml-3">Classifier AUC: 0.882</span>
        </div>
        <table className="w-full">
          <thead className="bg-surface-800/30">
            <tr>
              <th scope="col" className="table-header text-left py-2 px-3">
                Method
              </th>
              <th scope="col" className="table-header text-left py-2 px-3">
                MAE
              </th>
              <th scope="col" className="table-header text-left py-2 px-3">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            {twoheadMethods.map((m) => (
              <tr
                key={m.method}
                className={`border-t border-surface-800 ${m.best ? "bg-brand-500/5" : ""}`}
              >
                <td className="py-2 px-3">
                  <span className="text-sm text-surface-200">{m.method}</span>
                  {m.best && (
                    <span className="badge bg-brand-500/20 text-brand-400 ml-2">Best</span>
                  )}
                </td>
                <td className="py-2 px-3 font-data tabular-nums font-bold text-surface-100">
                  {m.mae.toFixed(4)}
                </td>
                <td className="py-2 px-3 font-data tabular-nums text-sm">
                  {m.best ? (
                    <span className="text-success-400">baseline</span>
                  ) : (
                    <span className="text-danger-400">
                      +
                      {(
                        ((m.mae - twoheadMethods.find((x) => x.best).mae) /
                          twoheadMethods.find((x) => x.best).mae) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dataset Breakdown */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="section-label mb-2">Training / Test Split</p>
            <div className="flex h-6 rounded-md overflow-hidden">
              <div
                className="bg-brand-500/60 flex items-center justify-center"
                style={{ width: "87.7%" }}
              >
                <span className="text-2xs font-semibold text-surface-50">Train: 185K</span>
              </div>
              <div className="bg-surface-600 flex items-center justify-center flex-1">
                <span className="text-2xs font-semibold text-surface-300">Test: 26K</span>
              </div>
            </div>
            <p className="text-xs text-surface-500 mt-2">8 seasons train · 1 season holdout</p>
          </div>
          <div>
            <p className="section-label mb-2">Played vs Not Played (Test Set)</p>
            <div className="flex h-6 rounded-md overflow-hidden">
              <div
                className="bg-success-500/60 flex items-center justify-center"
                style={{ width: `${datasetStats.playedPct}%` }}
              >
                <span className="text-2xs font-semibold text-surface-50">
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
// SHAP TAB
// ============================================================
function ShapTab({ shapFeatures, exampleShap }) {
  const [examplePlayer, setExamplePlayer] = useState(null);
  const maxImportance = shapFeatures[0].importance;

  const categoryTotals = shapFeatures.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + f.importance;
    return acc;
  }, {});

  const categoryDescriptions = {
    Recency: "What happened last gameweek (e.g. minutes played, points scored)",
    Rolling: "Averages over recent gameweeks (3, 5, or 10 GW windows)",
    Static: "Fixed player info like team, price, and position",
    Season: "Full-season averages up to this point",
    Understat: "Expected stats from Understat (xG, xA, shot data)",
  };

  // Map raw feature names to human-readable labels
  const featureLabels = {
    minutes_lag1: "Minutes played last GW",
    value: "Player price (£m)",
    total_points_season_avg: "Avg points this season",
    minutes_roll3: "Avg minutes (last 3 GWs)",
    ict_index_roll3: "Avg ICT index (last 3 GWs)",
    us_time_lag1: "Understat minutes last GW",
    team: "Team",
    total_points_roll10: "Avg points (last 10 GWs)",
    ict_index_roll10: "Avg ICT index (last 10 GWs)",
    total_points_roll3: "Avg points (last 3 GWs)",
  };

  // Solid colors per category for bar fills
  const barColors = {
    Recency: "#10B981",
    Rolling: "#F59E0B",
    Static: "#3B82F6",
    Season: "#8B5CF6",
    Understat: "#EC4899",
  };

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="py-3 border-b border-surface-700">
        <span className="section-label">What Drives Predictions</span>
        <p className="text-xs text-surface-500 mt-1">
          SHAP analysis shows how much each input variable influences the model&apos;s predicted
          points. The percentage represents each variable&apos;s share of total influence — higher
          means the model relies on it more when making predictions.
        </p>
      </div>

      {/* Category summary with descriptions */}
      <div>
        <p className="text-xs text-surface-500 mb-2">
          Variables are grouped into categories. Percentages show each category&apos;s share of
          total influence (all categories sum to ~100%).
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, total]) => {
              const color = barColors[cat] || "#6B7280";
              return (
                <div key={cat} className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <p className="text-xs text-surface-500 uppercase">{cat}</p>
                  </div>
                  <p className="text-lg font-bold" style={{ color }}>
                    {total.toFixed(1)}%
                  </p>
                  <p className="text-2xs text-surface-500 mt-0.5">
                    {categoryDescriptions[cat] || ""}
                  </p>
                </div>
              );
            })}
        </div>
      </div>

      {/* Feature bars */}
      <div>
        <div className="py-3 border-b border-surface-700 mb-3">
          <span className="section-label">Top 10 Most Influential Variables</span>
          <p className="text-xs text-surface-500 mt-1">
            Each bar shows how much that single variable contributes to the prediction, as a
            percentage of total influence across all variables.
          </p>
        </div>
        <div className="space-y-2.5">
          {shapFeatures.map((f, idx) => {
            const pct = (f.importance / maxImportance) * 100;
            const color = barColors[f.category] || "#6B7280";
            return (
              <div key={f.feature} className="flex items-center gap-3">
                <span className="text-xs text-surface-500 w-5 text-right shrink-0">{idx + 1}</span>
                <div className="w-52 shrink-0">
                  <span className="text-sm text-surface-200 block truncate">
                    {featureLabels[f.feature] || f.feature}
                  </span>
                  {featureLabels[f.feature] && (
                    <span className="text-2xs text-surface-600 font-data">{f.feature}</span>
                  )}
                </div>
                <div className="flex-1 h-7 bg-surface-800 rounded overflow-hidden relative">
                  <div
                    className="h-full rounded flex items-center"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: color,
                      opacity: 0.75,
                      minWidth: "2.5rem",
                    }}
                  >
                    <span className="text-xs font-bold text-white pl-2 font-data">
                      {f.importance.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <span
                  className="text-2xs px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {f.category}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key takeaways */}
      <div className="py-3 border-b border-surface-700">
        <span className="section-label">Key Takeaways</span>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-surface-300">
          <span className="text-surface-100 font-medium">Minutes played last GW</span> is by far the
          strongest predictor (18%) — whether a player featured recently is the best signal for
          whether they&apos;ll score points next.
        </p>
        <p className="text-sm text-surface-300">
          <span className="text-surface-100 font-medium">Rolling averages</span> (recent form over
          3-10 gameweeks) collectively account for ~16% — consistent recent performance matters more
          than any single stat.
        </p>
        <p className="text-sm text-surface-300">
          <span className="text-surface-100 font-medium">Player price and team</span> together
          contribute ~10% — the model learns that premium players in top teams have higher baseline
          expectations.
        </p>
      </div>

      <div>
        <span className="section-label">Per-Player Breakdown</span>
        <div className="flex items-center gap-0 border-b border-surface-700 mt-3 mb-4">
          {[
            { id: 2, name: "Haaland" },
            { id: 3, name: "Salah" },
            { id: 10, name: "Watkins" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setExamplePlayer(examplePlayer === p.id ? null : p.id)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                examplePlayer === p.id
                  ? "border-brand-400 text-brand-400"
                  : "border-transparent text-surface-500 hover:text-surface-300"
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
// ABLATION TAB
// ============================================================
function AblationTab({ ablationConfigs, ablationSignificance, interactionEffect }) {
  return (
    <div className="space-y-6">
      {/* Research Questions */}
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 rounded-md bg-surface-800/50">
          <span className="badge bg-brand-500/20 text-brand-400 shrink-0">RQ1</span>
          <p className="text-sm text-surface-300">
            Do injury features from the FPL API improve predictions?
          </p>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-md bg-surface-800/50">
          <span className="badge bg-brand-500/20 text-brand-400 shrink-0">RQ2</span>
          <p className="text-sm text-surface-300">
            Does Guardian news sentiment add predictive signal?
          </p>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-md bg-surface-800/50">
          <span className="badge bg-brand-500/20 text-brand-400 shrink-0">RQ3</span>
          <p className="text-sm text-surface-300">
            Do injury and news features interact or is one redundant?
          </p>
        </div>
      </div>

      {/* Config Comparison Table (replaces cards + bars) */}
      <div className="overflow-x-auto">
        <div className="py-3 border-b border-surface-700">
          <span className="section-label">Ablation Configurations</span>
          <span className="text-xs text-surface-500 ml-2">(Stacked Ensemble architecture)</span>
        </div>
        <table className="w-full">
          <thead className="bg-surface-800/30">
            <tr>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Config
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Features
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                MAE
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                R²
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Spearman ρ
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                N Features
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                vs Baseline
              </th>
            </tr>
          </thead>
          <tbody>
            {ablationConfigs.map((config) => {
              const baselineMae = ablationConfigs[0].mae;
              const improvement = ((1 - config.mae / baselineMae) * 100).toFixed(2);
              return (
                <tr
                  key={config.config}
                  className={`border-t border-surface-800 transition-colors ${config.best ? "bg-info-500/5" : "hover:bg-surface-800/30"}`}
                >
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-surface-100">
                        {config.config}: {config.name}
                      </span>
                      {config.best && (
                        <span className="badge bg-info-500/20 text-info-400">Best</span>
                      )}
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5">{config.description}</p>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-surface-400">{config.description}</td>
                  <td className="py-2.5 px-3 font-data tabular-nums">
                    <span
                      className={`font-bold ${config.best ? "text-info-400" : "text-surface-100"}`}
                    >
                      {config.mae.toFixed(4)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">
                    {config.r2.toFixed(3)}
                  </td>
                  <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">
                    {config.rho.toFixed(3)}
                  </td>
                  <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">
                    {config.features}
                  </td>
                  <td className="py-2.5 px-3 font-data tabular-nums">
                    {config.config === "A" ? (
                      <span className="text-surface-500">—</span>
                    ) : (
                      <span className="text-success-400 font-semibold">-{improvement}%</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Statistical Significance Table */}
      <div className="overflow-x-auto">
        <div className="py-3 border-b border-surface-700">
          <span className="section-label">Statistical Significance (Diebold-Mariano Test)</span>
        </div>
        <table className="w-full">
          <thead className="bg-surface-800/30">
            <tr>
              <th scope="col" className="table-header text-left py-2 px-3">
                Comparison
              </th>
              <th scope="col" className="table-header text-left py-2 px-3">
                p-value
              </th>
              <th scope="col" className="table-header text-left py-2 px-3">
                Significance
              </th>
              <th scope="col" className="table-header text-left py-2 px-3">
                Interpretation
              </th>
            </tr>
          </thead>
          <tbody>
            {ablationSignificance.map((s) => (
              <tr key={s.pair} className="border-t border-surface-800 hover:bg-surface-800/30">
                <td className="py-2 px-3 font-medium text-surface-200 font-data">{s.pair}</td>
                <td className="py-2 px-3 font-data tabular-nums text-surface-300">
                  {s.pValue < 0.001 ? "<0.001" : s.pValue.toFixed(3)}
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`font-bold font-data ${s.stars === "n.s." ? "text-surface-500" : "text-brand-400"}`}
                  >
                    {s.stars}
                  </span>
                </td>
                <td className="py-2 px-3 text-sm text-surface-400">{s.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Interaction Effect */}
      <div>
        <div className="py-3 border-b border-surface-700 mb-3">
          <span className="section-label">Feature Interaction</span>
        </div>
        <div className="space-y-3">
          {[
            {
              label: "Injury alone",
              value: interactionEffect.injuryAlone,
              color: "bg-brand-500/60",
            },
            { label: "News alone", value: interactionEffect.newsAlone, color: "bg-warning-500/60" },
            {
              label: "Combined (actual)",
              value: interactionEffect.combined,
              color: "bg-info-500/60",
            },
            {
              label: "Expected (if additive)",
              value: interactionEffect.expected,
              color: "bg-surface-600",
            },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-sm text-surface-300 w-40 shrink-0">{item.label}</span>
              <div className="flex-1 h-6 bg-surface-800 rounded-md overflow-hidden">
                <div
                  className={`h-full ${item.color} rounded-md flex items-center pl-2`}
                  style={{ width: `${(item.value / interactionEffect.expected) * 100}%` }}
                >
                  <span className="text-xs font-semibold text-surface-50 font-data">
                    {item.value.toFixed(2)}
                  </span>
                </div>
              </div>
              <span className="text-xs text-surface-500 w-10 text-right font-data">
                &times;10&sup3;
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 rounded-md bg-surface-800/50 border border-surface-700">
          <p className="text-sm text-surface-300">
            <span className="font-semibold text-surface-100">
              Redundancy: {interactionEffect.redundancy.toFixed(2)}&times;10&sup3;
            </span>{" "}
            — news signal is largely captured by injury features. Adding news on top of injury
            provides no statistically significant improvement (p = 0.348).
          </p>
        </div>
      </div>

      {/* Findings */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="badge bg-success-500/20 text-success-400 shrink-0 mt-0.5">RQ1</span>
          <div>
            <p className="text-sm text-surface-200 font-medium">
              Yes — injury features significantly improve predictions
            </p>
            <p className="text-xs text-surface-500 mt-1">
              Config B reduces MAE by 0.90% over baseline (p {"<"} 0.001). Structured injury data
              adds signal beyond playing time patterns.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="badge bg-warning-500/20 text-warning-400 shrink-0 mt-0.5">RQ2</span>
          <div>
            <p className="text-sm text-surface-200 font-medium">
              Marginal — news alone helps slightly (p = 0.003)
            </p>
            <p className="text-xs text-surface-500 mt-1">
              Config C reduces MAE by 0.22% vs baseline. But when injury features are present, news
              adds nothing significant.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="badge bg-brand-500/20 text-brand-400 shrink-0 mt-0.5">RQ3</span>
          <div>
            <p className="text-sm text-surface-200 font-medium">
              Redundant — news signal is already captured by injury data
            </p>
            <p className="text-xs text-surface-500 mt-1">
              B → D improvement is not significant (p = 0.348). The{" "}
              {interactionEffect.redundancy.toFixed(2)}&times;10&sup3; redundancy shows Guardian
              sentiment overlaps with FPL API injury status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// POSITIONS TAB
// ============================================================
function PositionsTab({ positionPerformance }) {
  const positionLabels = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };

  const chartSeries = [
    {
      name: "Baseline",
      color: "rgb(var(--surface-400))",
      values: positionPerformance.map((p) => p.baseline),
    },
    {
      name: "Stacked",
      color: "rgb(var(--brand-500))",
      values: positionPerformance.map((p) => p.stacked),
    },
    {
      name: "Pos-Specific",
      color: "rgb(var(--info-500))",
      values: positionPerformance.map((p) => p.posSpecific),
    },
    {
      name: "Two-Head",
      color: "rgb(var(--warning-400))",
      values: positionPerformance.map((p) => p.twohead),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Grouped Bar Chart */}
      <div>
        <div className="py-3 border-b border-surface-700 mb-3">
          <span className="section-label">MAE by Position &times; Model Architecture</span>
        </div>
        <GroupedBarChart
          labels={positionPerformance.map((p) => p.position)}
          series={chartSeries}
          yMin={0.6}
          yMax={1.25}
          yStep={0.1}
        />
      </div>

      {/* Detailed Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-800/30">
            <tr>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Position
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Baseline
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Stacked
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Pos-Specific
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Two-Head
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Samples
              </th>
            </tr>
          </thead>
          <tbody>
            {positionPerformance.map((pos) => {
              const values = [pos.baseline, pos.stacked, pos.posSpecific, pos.twohead];
              const minVal = Math.min(...values);
              return (
                <tr
                  key={pos.position}
                  className="border-t border-surface-800 hover:bg-surface-800/30"
                >
                  <td className="py-2.5 px-3">
                    <span className="font-medium text-surface-100">{pos.position}</span>
                    <span className="text-xs text-surface-500 ml-2">
                      {positionLabels[pos.position]}
                    </span>
                  </td>
                  {values.map((val, vi) => (
                    <td key={vi} className="py-2.5 px-3">
                      <span
                        className={`font-data tabular-nums ${val === minVal ? "text-brand-400 font-bold" : "text-surface-300"}`}
                      >
                        {val.toFixed(4)}
                      </span>
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-surface-400 font-data tabular-nums">
                    {pos.samples.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-3 rounded-md bg-success-500/5 border border-success-500/20">
          <p className="text-sm font-medium text-surface-200">Goalkeepers are most predictable</p>
          <p className="text-xs text-surface-500 mt-1">
            GK MAE 0.750 — narrow scoring range (2-4 pts when playing) with fewer hauls or blanks.
          </p>
        </div>
        <div className="p-3 rounded-md bg-danger-500/5 border border-danger-500/20">
          <p className="text-sm font-medium text-surface-200">Forwards are hardest to predict</p>
          <p className="text-xs text-surface-500 mt-1">
            FWD MAE 1.146 — goals are high-variance events. Returns swing between blanks and
            double-digit hauls.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CALIBRATION TAB
// ============================================================
function CalibrationTab({ calibrationDeciles, calibrationStats }) {
  return (
    <div className="space-y-6">
      {/* Correlation Stats */}
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-lg font-bold text-surface-100 font-data">
            {calibrationStats.pearsonR.toFixed(3)}
          </span>
          <span className="text-xs text-surface-500 ml-1.5">Pearson r</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100 font-data">
            {calibrationStats.spearmanRho.toFixed(3)}
          </span>
          <span className="text-xs text-surface-500 ml-1.5">Spearman ρ</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-success-400 font-data">
            {calibrationStats.captainEfficiency}%
          </span>
          <span className="text-xs text-surface-500 ml-1.5">captain efficiency</span>
        </div>
      </div>

      {/* Played vs Not-Played MAE */}
      <div>
        <div className="py-3 border-b border-surface-700 mb-3">
          <span className="section-label">MAE by Playing Status</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 border border-surface-700 rounded-md">
            <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Not Played</p>
            <p className="text-xl font-bold text-surface-100 font-data">
              {calibrationStats.notPlayedMae.toFixed(2)}
            </p>
            <p className="text-xs text-surface-500 mt-1">
              60% of samples — model predicts near-zero correctly
            </p>
          </div>
          <div className="p-4 border border-surface-700 rounded-md">
            <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Played</p>
            <p className="text-xl font-bold text-surface-100 font-data">
              {calibrationStats.playedMae.toFixed(2)}
            </p>
            <p className="text-xs text-surface-500 mt-1">
              40% of samples — harder to predict exact returns
            </p>
          </div>
          <div className="p-4 border border-danger-500/20 rounded-md bg-danger-500/5">
            <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">
              High Return (10+ pts)
            </p>
            <p className="text-xl font-bold text-danger-400 font-data">
              {calibrationStats.highReturnMae.toFixed(2)}
            </p>
            <p className="text-xs text-surface-500 mt-1">
              Hauls are rare events — hardest to predict
            </p>
          </div>
        </div>
      </div>

      {/* Decile Bar Chart */}
      <div>
        <div className="py-3 border-b border-surface-700 mb-3">
          <span className="section-label">MAE by Prediction Decile</span>
          <p className="text-xs text-surface-500 mt-1">
            Players are split into 10 equal groups (deciles) by predicted points. D1 = players
            predicted lowest points, D10 = predicted highest. Each bar shows the average prediction
            error (MAE) for that group — taller bars mean less accurate predictions.
          </p>
        </div>
        <GroupedBarChart
          labels={calibrationDeciles.labels}
          series={[
            {
              name: "Single LightGBM",
              color: "rgb(var(--info-500))",
              values: calibrationDeciles.baseline,
            },
            {
              name: "Stacked Ensemble",
              color: "rgb(var(--brand-500))",
              values: calibrationDeciles.stacked,
            },
          ]}
          yMin={0}
          yMax={3.0}
          yStep={0.5}
        />
      </div>

      {/* Captain Accuracy */}
      <div>
        <div className="py-3 border-b border-surface-700 mb-3">
          <span className="section-label">Captain Pick Accuracy</span>
          <span className="text-xs text-surface-500 ml-2">
            (model&apos;s #1 pick vs actual top scorer)
          </span>
        </div>
        <table className="w-full">
          <thead className="bg-surface-800/30">
            <tr>
              <th scope="col" className="table-header text-left py-2 px-3">
                Metric
              </th>
              <th scope="col" className="table-header text-left py-2 px-3">
                Hit Rate
              </th>
              <th scope="col" className="table-header text-left py-2 px-3">
                Meaning
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-surface-800">
              <td className="py-2 px-3 font-medium text-surface-200">Top-1 Accuracy</td>
              <td className="py-2 px-3 font-data tabular-nums font-bold text-surface-100">
                {calibrationStats.captainTop1}%
              </td>
              <td className="py-2 px-3 text-xs text-surface-400">
                Model&apos;s #1 pick was the actual highest scorer
              </td>
            </tr>
            <tr className="border-t border-surface-800">
              <td className="py-2 px-3 font-medium text-surface-200">Top-3 Accuracy</td>
              <td className="py-2 px-3 font-data tabular-nums font-bold text-brand-400">
                {calibrationStats.captainTop3}%
              </td>
              <td className="py-2 px-3 text-xs text-surface-400">
                Model&apos;s #1 pick was in the actual top 3 scorers
              </td>
            </tr>
            <tr className="border-t border-surface-800">
              <td className="py-2 px-3 font-medium text-surface-200">Top-5 Accuracy</td>
              <td className="py-2 px-3 font-data tabular-nums font-bold text-surface-100">
                {calibrationStats.captainTop5}%
              </td>
              <td className="py-2 px-3 text-xs text-surface-400">
                Model&apos;s #1 pick was in the actual top 5 scorers
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary Insights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-3 rounded-md bg-success-500/5 border border-success-500/20">
          <p className="text-sm font-medium text-surface-200">Low predictions are accurate</p>
          <p className="text-xs text-surface-500 mt-1">
            D1-D3 MAE ranges 0.03-0.13 — when the model predicts low, it&apos;s reliable. These are
            mostly non-playing or fringe players.
          </p>
        </div>
        <div className="p-3 rounded-md bg-danger-500/5 border border-danger-500/20">
          <p className="text-sm font-medium text-surface-200">Premium players remain hard</p>
          <p className="text-xs text-surface-500 mt-1">
            D10 MAE 2.6-2.7 — high-predicted players (FWDs, premiums) have unpredictable returns due
            to goals being rare, high-variance events.
          </p>
        </div>
      </div>
    </div>
  );
}
