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
  if (isLoading) return (
    <div className="space-y-6">
      <SkeletonStatStrip items={4} />
      <SkeletonTable rows={4} cols={5} />
    </div>
  );
  if (error) return <ErrorState message="Failed to load model data." />;
  if (!data) return null;
  const { modelVariants, baselines, positionPerformance, ablationConfigs, ablationSignificance, interactionEffect, twoheadMethods, shapFeatures, ensembleWeights, datasetStats, calibrationDeciles, categoryColors, categoryTextColors, exampleShap, tabs: TABS } = data;

  return (
    <div className="space-y-6 stagger">
      <TabBar
        tabs={TABS}
        active={activeTab}
        onChange={(value) => setSearchParams(prev => { const p = new URLSearchParams(prev); p.set("tab", value); return p; })}
        id="insights"
        variant="border"
      />

      <div role="tabpanel" id={`insights-panel-${activeTab}`}>
        {activeTab === "overview" && <OverviewTab modelVariants={modelVariants} baselines={baselines} ensembleWeights={ensembleWeights} datasetStats={datasetStats} twoheadMethods={twoheadMethods} />}
        {activeTab === "shap" && <ShapTab shapFeatures={shapFeatures} categoryColors={categoryColors} categoryTextColors={categoryTextColors} exampleShap={exampleShap} />}
        {activeTab === "ablation" && <AblationTab ablationConfigs={ablationConfigs} ablationSignificance={ablationSignificance} interactionEffect={interactionEffect} />}
        {activeTab === "positions" && <PositionsTab positionPerformance={positionPerformance} />}
        {activeTab === "calibration" && <CalibrationTab calibrationDeciles={calibrationDeciles} />}
      </div>
    </div>
  );
}

// ============================================================
// OVERVIEW TAB
// ============================================================
function OverviewTab({ modelVariants, baselines, ensembleWeights, datasetStats, twoheadMethods }) {
  const bestModel = modelVariants.find((m) => m.best);
  const bestMae = bestModel.mae;

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

      {/* Architecture Comparison Table */}
      <div className="overflow-x-auto">
        <div className="py-3 border-b border-surface-700">
          <span className="section-label">Architecture Comparison</span>
        </div>
        <table className="w-full">
          <thead className="bg-surface-800/30">
            <tr>
              <th scope="col" className="table-header text-left py-2.5 px-3">Model</th>
              <th scope="col" className="table-header text-left py-2.5 px-3">MAE</th>
              <th scope="col" className="table-header text-left py-2.5 px-3">RMSE</th>
              <th scope="col" className="table-header text-left py-2.5 px-3">R²</th>
              <th scope="col" className="table-header text-left py-2.5 px-3">vs Zero</th>
            </tr>
          </thead>
          <tbody>
            {modelVariants.map((model) => (
              <tr key={model.id} className={`border-t border-surface-800 transition-colors ${model.best ? "bg-brand-500/5" : "hover:bg-surface-800/30"}`}>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-surface-100">{model.name}</p>
                    {model.best && <span className="badge bg-brand-500/20 text-brand-400">Best</span>}
                  </div>
                  <p className="text-xs text-surface-500 mt-0.5">{model.description}</p>
                </td>
                <td className="py-2.5 px-3 font-data tabular-nums">
                  <span className={`font-bold ${model.best ? "text-brand-400" : "text-surface-100"}`}>{model.mae.toFixed(4)}</span>
                </td>
                <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">{model.rmse.toFixed(4)}</td>
                <td className="py-2.5 px-3 text-surface-300 font-data tabular-nums">{model.r2.toFixed(4)}</td>
                <td className="py-2.5 px-3 font-data tabular-nums">
                  <span className="text-success-400 font-semibold">-{((1 - model.mae / baselines[0].mae) * 100).toFixed(1)}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ensemble Weights */}
      <div>
        <div className="py-3 border-b border-surface-700 mb-3">
          <span className="section-label">Meta-Learner Weights (Ridge)</span>
        </div>
        <div className="space-y-3">
          {ensembleWeights.map((m) => (
            <div key={m.model} className="flex items-center gap-3">
              <span className="text-sm text-surface-300 w-28 shrink-0">{m.model}</span>
              <div className="flex-1 h-6 bg-surface-800 rounded-md overflow-hidden">
                <div className="h-full bg-brand-500/60 rounded-md flex items-center pl-2" style={{ width: `${(m.weight / ensembleWeights[0].weight) * 100}%` }}>
                  <span className="text-xs font-semibold text-surface-50">{m.weight.toFixed(3)}</span>
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
        <div className="space-y-3">
          {twoheadMethods.map((m) => {
            const barWidth = ((1.2 - m.mae) / (1.2 - 1.0)) * 100;
            return (
              <div key={m.method} className="flex items-center gap-3">
                <span className="text-sm text-surface-300 w-56 shrink-0">{m.method}</span>
                <div className="flex-1 h-6 bg-surface-800 rounded-md overflow-hidden relative">
                  <div className={`h-full rounded-md ${m.best ? "bg-brand-500/60" : "bg-danger-500/40"}`} style={{ width: `${Math.max(barWidth, 5)}%` }} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-surface-100 font-data">{m.mae.toFixed(4)}</span>
                </div>
                {m.best && <span className="badge bg-brand-500/20 text-brand-400 shrink-0">Best</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dataset Breakdown */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="section-label mb-2">Training / Test Split</p>
            <div className="flex h-6 rounded-md overflow-hidden">
              <div className="bg-brand-500/60 flex items-center justify-center" style={{ width: "87.7%" }}>
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
              <div className="bg-success-500/60 flex items-center justify-center" style={{ width: `${datasetStats.playedPct}%` }}>
                <span className="text-2xs font-semibold text-surface-50">Played {datasetStats.playedPct}%</span>
              </div>
              <div className="bg-surface-600 flex items-center justify-center flex-1">
                <span className="text-2xs font-semibold text-surface-300">Not played {datasetStats.notPlayedPct}%</span>
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
function ShapTab({ shapFeatures, categoryColors, categoryTextColors, exampleShap }) {
  const [examplePlayer, setExamplePlayer] = useState(null);
  const maxImportance = shapFeatures[0].importance;

  const categoryTotals = shapFeatures.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + f.importance;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Object.entries(categoryTotals)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, total]) => (
            <div key={cat} className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${categoryColors[cat]}`} />
                <p className="text-xs text-surface-500 uppercase">{cat}</p>
              </div>
              <p className={`text-lg font-bold ${categoryTextColors[cat]}`}>{total.toFixed(1)}%</p>
            </div>
          ))}
      </div>

      <div>
        <div className="space-y-2">
          {shapFeatures.map((f, idx) => (
            <div key={f.feature} className="flex items-center gap-3">
              <span className="text-xs text-surface-500 w-5 text-right shrink-0">{idx + 1}</span>
              <span className="text-sm text-surface-200 w-48 shrink-0 font-data tabular-nums truncate">{f.feature}</span>
              <div className="flex-1 h-5 bg-surface-800 rounded overflow-hidden">
                <div className={`h-full rounded ${categoryColors[f.category]}/40`} style={{ width: `${(f.importance / maxImportance) * 100}%` }} />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-surface-100 w-14 text-right">{f.importance.toFixed(2)}%</span>
                <span className={`text-2xs px-1.5 py-0.5 rounded ${categoryColors[f.category]}/20 ${categoryTextColors[f.category]}`}>{f.category}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 rounded-md bg-surface-800/50 border border-surface-700">
            <p className="text-lg font-bold text-brand-400">18.0%</p>
            <p className="text-xs text-surface-400 mt-1">
              from <span className="text-surface-200 font-medium">minutes_lag1</span> alone -- last GW's minutes is the single strongest signal
            </p>
          </div>
          <div className="p-3 rounded-md bg-surface-800/50 border border-surface-700">
            <p className="text-lg font-bold text-warning-400">25.8%</p>
            <p className="text-xs text-surface-400 mt-1">
              from <span className="text-surface-200 font-medium">extended features</span> -- roll10, season_avg, momentum contribute over a quarter
            </p>
          </div>
          <div className="p-3 rounded-md bg-surface-800/50 border border-surface-700">
            <p className="text-lg font-bold text-success-400">~10%</p>
            <p className="text-xs text-surface-400 mt-1">
              from <span className="text-surface-200 font-medium">static context</span> -- team, value, opponent, position, home/away
            </p>
          </div>
        </div>
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
          <p className="text-sm text-surface-300">Do injury features from the FPL API improve predictions?</p>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-md bg-surface-800/50">
          <span className="badge bg-brand-500/20 text-brand-400 shrink-0">RQ2</span>
          <p className="text-sm text-surface-300">Does Guardian news sentiment add predictive signal?</p>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-md bg-surface-800/50">
          <span className="badge bg-brand-500/20 text-brand-400 shrink-0">RQ3</span>
          <p className="text-sm text-surface-300">Do injury and news features interact or is one redundant?</p>
        </div>
      </div>

      {/* 4 Config Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {ablationConfigs.map((config) => (
          <div key={config.config} className={`p-4 border rounded-md ${config.best ? "border-info-500/30 bg-info-500/5" : config.config === "B" ? "border-brand-500/20" : "border-surface-700"}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-bold uppercase tracking-wider ${config.best ? "text-info-400" : config.config === "B" ? "text-brand-400" : "text-surface-400"}`}>Config {config.config}</span>
              {config.best && <span className="badge bg-info-500/20 text-info-400">Best</span>}
            </div>
            <p className="text-sm font-semibold text-surface-100 mb-1">{config.name}</p>
            <p className="text-xs text-surface-500 mb-4">{config.description}</p>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-surface-500">MAE</p>
                <p className="text-lg font-bold text-surface-100 font-data tabular-nums">{config.mae.toFixed(4)}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-surface-500">R²</p>
                  <p className="text-sm font-semibold text-surface-300 font-data tabular-nums">{config.r2.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-xs text-surface-500">Features</p>
                  <p className="text-sm font-semibold text-surface-300 font-data tabular-nums">{config.features}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MAE Bars */}
      <div className="space-y-4">
        {ablationConfigs.map((config) => {
          const barWidth = ((1.03 - config.mae) / (1.03 - 1.012)) * 100;
          return (
            <div key={config.config} className="flex items-center gap-4">
              <div className="w-24 shrink-0">
                <p className="text-sm font-medium text-surface-200">Config {config.config}</p>
                <p className="text-xs text-surface-500">{config.name}</p>
              </div>
              <div className="flex-1 h-8 bg-surface-800 rounded-md overflow-hidden relative">
                <div className={`h-full ${config.color}/40 rounded-md`} style={{ width: `${Math.max(Math.min(barWidth, 100), 5)}%` }} />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-bold text-surface-100 font-data tabular-nums">{config.mae.toFixed(4)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Significance */}
      <div>
        <div className="py-3 border-b border-surface-700 mb-3">
          <span className="section-label">Statistical Significance (Diebold-Mariano Test)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ablationSignificance.map((s) => (
            <div key={s.pair} className="p-3 rounded-md bg-surface-800/50 border border-surface-700">
              <p className="text-sm font-medium text-surface-200">{s.pair}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-sm font-bold font-data ${s.stars === "n.s." ? "text-surface-500" : "text-brand-400"}`}>{s.stars}</span>
                <span className="text-xs text-surface-500">p = {s.pValue < 0.001 ? "<0.001" : s.pValue.toFixed(3)}</span>
              </div>
              <p className="text-xs text-surface-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Interaction Effect */}
      <div>
        <div className="py-3 border-b border-surface-700 mb-3">
          <span className="section-label">Feature Interaction</span>
        </div>
        <div className="space-y-3">
          {[
            { label: "Injury alone", value: interactionEffect.injuryAlone, color: "bg-brand-500/60" },
            { label: "News alone", value: interactionEffect.newsAlone, color: "bg-warning-500/60" },
            { label: "Combined (actual)", value: interactionEffect.combined, color: "bg-info-500/60" },
            { label: "Expected (if additive)", value: interactionEffect.expected, color: "bg-surface-600" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-sm text-surface-300 w-40 shrink-0">{item.label}</span>
              <div className="flex-1 h-6 bg-surface-800 rounded-md overflow-hidden">
                <div className={`h-full ${item.color} rounded-md flex items-center pl-2`} style={{ width: `${(item.value / interactionEffect.expected) * 100}%` }}>
                  <span className="text-xs font-semibold text-surface-50 font-data">{item.value.toFixed(2)}</span>
                </div>
              </div>
              <span className="text-xs text-surface-500 w-10 text-right font-data">×10⁻³</span>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 rounded-md bg-surface-800/50 border border-surface-700">
          <p className="text-sm text-surface-300">
            <span className="font-semibold text-surface-100">Redundancy: {interactionEffect.redundancy.toFixed(2)}×10⁻³</span>
            {" "}— news signal is largely captured by injury features. Adding news on top of injury provides no statistically significant improvement (p = 0.348).
          </p>
        </div>
      </div>

      {/* Findings */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="badge bg-success-500/20 text-success-400 shrink-0 mt-0.5">RQ1</span>
          <div>
            <p className="text-sm text-surface-200 font-medium">Yes — injury features significantly improve predictions</p>
            <p className="text-xs text-surface-500 mt-1">Config B reduces MAE by 0.90% over baseline (p {"<"} 0.001). Structured injury data adds signal beyond playing time patterns.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="badge bg-warning-500/20 text-warning-400 shrink-0 mt-0.5">RQ2</span>
          <div>
            <p className="text-sm text-surface-200 font-medium">Marginal — news alone helps slightly (p = 0.003)</p>
            <p className="text-xs text-surface-500 mt-1">Config C reduces MAE by 0.22% vs baseline. But when injury features are present, news adds nothing significant.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="badge bg-brand-500/20 text-brand-400 shrink-0 mt-0.5">RQ3</span>
          <div>
            <p className="text-sm text-surface-200 font-medium">Redundant — news signal is already captured by injury data</p>
            <p className="text-xs text-surface-500 mt-1">B → D improvement is not significant (p = 0.348). The {interactionEffect.redundancy.toFixed(2)}×10⁻³ redundancy shows Guardian sentiment overlaps with FPL API injury status.</p>
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
  const maxMae = 1.2;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {positionPerformance.map((pos) => {
          const best = Math.min(pos.baseline, pos.stacked, pos.posSpecific, pos.twohead);
          return (
            <div key={pos.position} className="p-4 border border-surface-700 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <span className="section-label">{positionLabels[pos.position]}</span>
                <span className="badge bg-surface-700 text-surface-300">{pos.samples.toLocaleString()}</span>
              </div>
              <p className="text-lg font-bold text-surface-100 font-data tabular-nums">{best.toFixed(4)}</p>
              <p className="text-xs text-surface-500 mt-1">Best MAE</p>
              <div className="mt-3 h-2 bg-surface-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${pos.position === "GK" ? "bg-success-500" : pos.position === "FWD" ? "bg-danger-500" : "bg-brand-500"}`} style={{ width: `${(1 - best / maxMae) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <div className="py-3 border-b border-surface-700">
          <span className="section-label">MAE by Position × Model</span>
        </div>
        <table className="w-full">
          <thead className="bg-surface-800/30">
            <tr>
              <th scope="col" className="table-header text-left py-2.5 px-3">Position</th>
              <th scope="col" className="table-header text-left py-2.5 px-3">Baseline</th>
              <th scope="col" className="table-header text-left py-2.5 px-3">Stacked</th>
              <th scope="col" className="table-header text-left py-2.5 px-3">Pos-Specific</th>
              <th scope="col" className="table-header text-left py-2.5 px-3">Two-Head</th>
              <th scope="col" className="table-header text-left py-2.5 px-3">Samples</th>
            </tr>
          </thead>
          <tbody>
            {positionPerformance.map((pos) => {
              const values = [pos.baseline, pos.stacked, pos.posSpecific, pos.twohead];
              const minVal = Math.min(...values);
              const Cell = ({ val }) => (
                <td className="py-2.5 px-3">
                  <span className={`font-data tabular-nums ${val === minVal ? "text-brand-400 font-bold" : "text-surface-300"}`}>{val.toFixed(4)}</span>
                </td>
              );
              return (
                <tr key={pos.position} className="border-t border-surface-800 hover:bg-surface-800/30">
                  <td className="py-2.5 px-3">
                    <span className="font-medium text-surface-100">{pos.position}</span>
                    <span className="text-xs text-surface-500 ml-2">{positionLabels[pos.position]}</span>
                  </td>
                  <Cell val={pos.baseline} />
                  <Cell val={pos.stacked} />
                  <Cell val={pos.posSpecific} />
                  <Cell val={pos.twohead} />
                  <td className="py-2.5 px-3 text-surface-400 font-data tabular-nums">{pos.samples.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-3 rounded-md bg-success-500/5 border border-success-500/20">
          <p className="text-sm font-medium text-surface-200">Goalkeepers are most predictable</p>
          <p className="text-xs text-surface-500 mt-1">GK MAE 0.750 -- narrow scoring range (2-4 pts when playing) with fewer hauls or blanks.</p>
        </div>
        <div className="p-3 rounded-md bg-danger-500/5 border border-danger-500/20">
          <p className="text-sm font-medium text-surface-200">Forwards are hardest to predict</p>
          <p className="text-xs text-surface-500 mt-1">FWD MAE 1.146 -- goals are high-variance events. Returns swing between blanks and double-digit hauls.</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CALIBRATION TAB
// ============================================================
function CalibrationTab({ calibrationDeciles }) {
  const maxDecile = Math.max(...calibrationDeciles.baseline, ...calibrationDeciles.stacked);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
        <div>
          <span className="text-lg font-bold text-surface-100">0.500</span>
          <span className="text-xs text-surface-500 ml-1.5">Pearson r (stacked)</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-surface-100">0.667</span>
          <span className="text-xs text-surface-500 ml-1.5">Spearman ρ (stacked)</span>
        </div>
        <div className="w-px h-5 bg-surface-700" />
        <div>
          <span className="text-lg font-bold text-success-400">41.1%</span>
          <span className="text-xs text-surface-500 ml-1.5">captain efficiency</span>
        </div>
      </div>

      <div>
        <div className="py-3 border-b border-surface-700 mb-3">
          <span className="section-label">MAE by Prediction Confidence Decile</span>
          <span className="text-xs text-surface-500 ml-2">(D1 = most confident → D10 = least)</span>
        </div>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-info-500/60" />
            <span className="text-xs text-surface-400">Single LightGBM</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-brand-500/60" />
            <span className="text-xs text-surface-400">Stacked Ensemble</span>
          </div>
        </div>
        <div className="space-y-3">
          {calibrationDeciles.labels.map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs text-surface-500 w-6 text-right shrink-0 font-data">{label}</span>
              <div className="flex-1 space-y-1">
                <div className="h-4 bg-surface-800 rounded overflow-hidden relative">
                  <div className="h-full bg-info-500/50 rounded" style={{ width: `${(calibrationDeciles.baseline[i] / maxDecile) * 100}%` }} />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-2xs font-semibold text-surface-300 font-data">{calibrationDeciles.baseline[i].toFixed(3)}</span>
                </div>
                <div className="h-4 bg-surface-800 rounded overflow-hidden relative">
                  <div className="h-full bg-brand-500/50 rounded" style={{ width: `${(calibrationDeciles.stacked[i] / maxDecile) * 100}%` }} />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-2xs font-semibold text-surface-300 font-data">{calibrationDeciles.stacked[i].toFixed(3)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-3 rounded-md bg-success-500/5 border border-success-500/20">
          <p className="text-sm font-medium text-surface-200">Confident predictions are accurate</p>
          <p className="text-xs text-surface-500 mt-1">D1-D3 MAE ranges 0.03-0.13 -- when the model is confident, it's reliable. These are mostly non-playing or consistently starting players.</p>
        </div>
        <div className="p-3 rounded-md bg-danger-500/5 border border-danger-500/20">
          <p className="text-sm font-medium text-surface-200">Edge cases remain hard</p>
          <p className="text-xs text-surface-500 mt-1">D10 MAE 2.6-2.7 -- high-variance players (FWDs, differentials) with unpredictable returns still challenge the model.</p>
        </div>
      </div>
    </div>
  );
}
