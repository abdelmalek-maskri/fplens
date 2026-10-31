export default function OverviewTab({
  modelVariants,
  baselines,
  ensembleWeights,
  datasetStats,
  twoheadMethods,
}) {
  const bestModel = modelVariants.find((m) => m.best);
  const bestMae = bestModel.mae;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-200">
        <div>
          <span className="text-lg font-bold text-surface-900">Stats + injuries + news</span>
          <span className="text-xs text-surface-500 ml-1.5">
            in use &middot; avg miss {bestMae}
          </span>
        </div>
        <div className="w-px h-5 bg-surface-300" />
        <div>
          <span className="text-lg font-bold text-success-400">
            -{((1 - bestMae / baselines[0].mae) * 100).toFixed(1)}%
          </span>
          <span className="text-xs text-surface-500 ml-1.5">
            less error than guessing zero for everyone
          </span>
        </div>
        <div className="w-px h-5 bg-surface-300" />
        <div>
          <span className="text-lg font-bold text-surface-900">
            {datasetStats.cvMae}{" "}
            <span className="text-sm text-surface-600">± {datasetStats.cvStd}</span>
          </span>
          <span className="text-xs text-surface-500 ml-1.5">avg miss across 8 training folds</span>
        </div>
        <div className="w-px h-5 bg-surface-300" />
        <div>
          <span className="text-lg font-bold text-surface-900">
            {(datasetStats.trainRows / 1000).toFixed(0)}K
          </span>
          <span className="text-xs text-surface-500 ml-1.5">train</span>
        </div>
        <div className="w-px h-5 bg-surface-300" />
        <div>
          <span className="text-lg font-bold text-surface-900">
            {(datasetStats.testRows / 1000).toFixed(0)}K
          </span>
          <span className="text-xs text-surface-500 ml-1.5">holdout</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="py-3 border-b border-surface-300">
          <span className="section-label">Every model tried</span>
          <span className="text-xs text-surface-500 ml-2">(holdout 2024-25)</span>
        </div>
        <table className="w-full">
          <thead className="bg-surface-200/30">
            <tr>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Model
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Ranking
                <span className="block text-2xs font-normal normal-case text-surface-400">
                  1 = perfect order
                </span>
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Avg miss
                <span className="block text-2xs font-normal normal-case text-surface-400">
                  points per player
                </span>
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                RMSE
                <span className="block text-2xs font-normal normal-case text-surface-400">
                  punishes big misses
                </span>
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                R&sup2;
                <span className="block text-2xs font-normal normal-case text-surface-400">
                  variance explained
                </span>
              </th>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                vs guessing zero
                <span className="block text-2xs font-normal normal-case text-surface-400">
                  lower error is better
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {modelVariants.map((model) => (
              <tr
                key={model.id}
                className={`border-t border-surface-200 transition-colors ${model.best ? "bg-brand-600/5" : "hover:bg-surface-200/30"}`}
              >
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-surface-900">{model.name}</p>
                    {model.best && (
                      <span className="badge bg-brand-600/20 text-brand-700">Best</span>
                    )}
                  </div>
                  <p className="text-xs text-surface-500 mt-0.5">{model.description}</p>
                </td>
                {/* rho is emphasised, not MAE. The "Best" badge is awarded on
                    ranking, and leading with MAE contradicted it visibly: Tweedie
                    sits lower in this table with a better MAE than the best model. */}
                <td className="py-2.5 px-3 font-data tabular-nums">
                  <span
                    className={`font-bold ${model.best ? "text-brand-700" : "text-surface-900"}`}
                  >
                    {model.spearman.toFixed(3)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-surface-700 font-data tabular-nums">
                  {model.mae.toFixed(4)}
                </td>
                <td className="py-2.5 px-3 text-surface-700 font-data tabular-nums">
                  {model.rmse.toFixed(4)}
                </td>
                <td className="py-2.5 px-3 text-surface-700 font-data tabular-nums">
                  {model.r2.toFixed(4)}
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
      </div>

      <div>
        <div className="py-3 border-b border-surface-300 mb-3">
          <span className="section-label">How the six models are blended</span>
          <p className="text-xs text-surface-500 mt-1">
            Each one predicts separately, then they are averaged. A model with lower error
            out-of-fold gets a bigger share, which is why these land close together.
          </p>
        </div>
        <div className="space-y-3">
          {ensembleWeights.map((m) => (
            <div key={m.model} className="flex items-center gap-3">
              <span className="text-sm text-surface-700 w-28 shrink-0">{m.model}</span>
              <div className="flex-1 h-6 bg-surface-200 rounded-md overflow-hidden">
                <div
                  className="h-full bg-brand-600/60 rounded-md flex items-center pl-2"
                  style={{ width: `${(m.weight / ensembleWeights[0].weight) * 100}%` }}
                >
                  <span className="text-xs font-semibold text-surface-950">
                    {m.weight.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="py-3 border-b border-surface-300 mb-3">
          <span className="section-label">Two-Head: Hard vs Soft</span>
          <span className="text-xs text-surface-500 ml-3">Classifier AUC: 0.896</span>
        </div>
        <table className="w-full">
          <thead className="bg-surface-200/30">
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
                className={`border-t border-surface-200 ${m.best ? "bg-brand-600/5" : ""}`}
              >
                <td className="py-2 px-3">
                  <span className="text-sm text-surface-800">{m.method}</span>
                  {m.best && (
                    <span className="badge bg-brand-600/20 text-brand-700 ml-2">Best</span>
                  )}
                </td>
                <td className="py-2 px-3 font-data tabular-nums font-bold text-surface-900">
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
                className="bg-brand-600/60 flex items-center justify-center"
                style={{ width: "87.7%" }}
              >
                <span className="text-2xs font-semibold text-surface-950">Train: 185K</span>
              </div>
              <div className="bg-surface-300 flex items-center justify-center flex-1">
                <span className="text-2xs font-semibold text-surface-700">Test: 26K</span>
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
                <span className="text-2xs font-semibold text-surface-950">
                  Played {datasetStats.playedPct}%
                </span>
              </div>
              <div className="bg-surface-300 flex items-center justify-center flex-1">
                <span className="text-2xs font-semibold text-surface-700">
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
