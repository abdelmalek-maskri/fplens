export default function AblationTab({ ablationConfigs, ablationSignificance, interactionEffect }) {
  return (
    <div className="space-y-6">
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
                  <td className="py-2.5 px-3 text-xs text-surface-400">{config.features}</td>
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
