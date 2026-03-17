import GroupedBarChart from "./GroupedBarChart";

export default function CalibrationTab({ calibrationDeciles, calibrationStats }) {
  return (
    <div className="space-y-6">
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
