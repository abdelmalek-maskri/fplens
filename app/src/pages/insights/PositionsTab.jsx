import GroupedBarChart from "./GroupedBarChart";

export default function PositionsTab({ positionPerformance }) {
  const positionLabels = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };

  const chartSeries = [
    {
      name: "Baseline",
      color: "rgb(var(--surface-400))",
      values: positionPerformance.map((p) => p.baseline),
    },
    {
      name: "LGB Tweedie",
      color: "rgb(var(--danger-400))",
      values: positionPerformance.map((p) => p.tweedie ?? 0),
    },
    {
      name: "Stacked",
      color: "rgb(var(--info-500))",
      values: positionPerformance.map((p) => p.stacked),
    },
    {
      name: "Config D",
      color: "rgb(var(--brand-500))",
      values: positionPerformance.map((p) => p.config_d),
    },
    {
      name: "Pos-Specific",
      color: "rgb(var(--warning-400))",
      values: positionPerformance.map((p) => p.posSpecific),
    },
    {
      name: "Two-Head",
      color: "rgb(var(--surface-500))",
      values: positionPerformance.map((p) => p.twohead),
    },
    {
      name: "CatBoost 2-head",
      color: "rgb(var(--info-400))",
      values: positionPerformance.map((p) => p.cbTwohead ?? 0),
    },
  ];

  const columns = [
    { key: "baseline", label: "Baseline" },
    { key: "tweedie", label: "LGB Tweedie" },
    { key: "stacked", label: "Stacked" },
    { key: "config_d", label: "Config D" },
    { key: "posSpecific", label: "Pos-Specific" },
    { key: "twohead", label: "Two-Head" },
    { key: "cbTwohead", label: "CatBoost 2-head" },
  ];

  return (
    <div className="space-y-6">
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

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-800/30">
            <tr>
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Position
              </th>
              {columns.map((col) => (
                <th key={col.key} scope="col" className="table-header text-left py-2.5 px-3">
                  {col.label}
                </th>
              ))}
              <th scope="col" className="table-header text-left py-2.5 px-3">
                Samples
              </th>
            </tr>
          </thead>
          <tbody>
            {positionPerformance.map((pos) => {
              const values = columns.map((col) => pos[col.key] ?? null);
              const defined = values.filter((v) => v != null);
              const minVal = Math.min(...defined);
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
                      {val != null ? (
                        <span
                          className={`font-data tabular-nums ${val === minVal ? "text-brand-400 font-bold" : "text-surface-300"}`}
                        >
                          {val.toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-surface-600">—</span>
                      )}
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
            GK MAE 0.764,narrow scoring range (2-4 pts when playing) with fewer hauls or blanks.
          </p>
        </div>
        <div className="p-3 rounded-md bg-danger-500/5 border border-danger-500/20">
          <p className="text-sm font-medium text-surface-200">Forwards are hardest to predict</p>
          <p className="text-xs text-surface-500 mt-1">
            FWD MAE 1.140,goals are high-variance events. Returns swing between blanks and
            double-digit hauls.
          </p>
        </div>
      </div>
    </div>
  );
}
