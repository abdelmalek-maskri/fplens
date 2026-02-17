export default function ShapBreakdown({ shapData }) {
  const maxImpact = Math.max(...shapData.map((s) => Math.abs(s.impact)));

  return (
    <div className="px-4 py-3 bg-surface-800/30 border-t border-surface-800">
      <p className="text-xs font-medium text-surface-400 uppercase tracking-wide mb-2">
        Prediction Breakdown
      </p>
      <div className="space-y-1.5">
        {shapData.map((s) => {
          const isPositive = s.impact >= 0;
          const barWidth = (Math.abs(s.impact) / maxImpact) * 100;
          return (
            <div key={s.feature} className="flex items-center gap-3 text-xs">
              <span className="text-surface-400 w-40 shrink-0 font-mono truncate">{s.feature}</span>
              <span className="text-surface-500 w-20 shrink-0 text-right">{s.value}</span>
              <div className="flex-1 flex items-center gap-1">
                {isPositive ? (
                  <div className="flex items-center w-full">
                    <div className="w-1/2" />
                    <div
                      className="h-3 bg-success-500/40 rounded-r"
                      style={{ width: `${barWidth / 2}%` }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-end w-full">
                    <div
                      className="h-3 bg-danger-500/40 rounded-l"
                      style={{ width: `${barWidth / 2}%` }}
                    />
                    <div className="w-1/2" />
                  </div>
                )}
              </div>
              <span
                className={`w-12 text-right font-semibold ${
                  isPositive ? "text-success-400" : "text-danger-400"
                }`}
              >
                {isPositive ? "+" : ""}
                {s.impact.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
