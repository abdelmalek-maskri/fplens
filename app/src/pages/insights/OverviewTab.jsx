export default function OverviewTab({
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

      <div className="overflow-x-auto">
        <div className="py-3 border-b border-surface-700">
          <span className="section-label">Architecture Comparison</span>
          <span className="text-xs text-surface-500 ml-2">(holdout 2024-25)</span>
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

      <div>
        <div className="py-3 border-b border-surface-700 mb-3">
          <span className="section-label">Two-Head: Hard vs Soft</span>
          <span className="text-xs text-surface-500 ml-3">Classifier AUC: 0.896</span>
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
