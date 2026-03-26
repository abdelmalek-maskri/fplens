export default function ShapTab({ shapFeatures }) {
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
    Injury: "Availability status and chance of playing from FPL API",
  };

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
    chance_next_round: "Chance of playing next GW",
    status_encoded: "Availability status",
  };

  const barColors = {
    Recency: "#10B981",
    Rolling: "#F59E0B",
    Static: "#3B82F6",
    Season: "#8B5CF6",
    Understat: "#EC4899",
    Injury: "#EF4444",
  };

  return (
    <div className="space-y-6">
      <div className="py-3 border-b border-surface-700">
        <span className="section-label">What Drives Predictions</span>
        <p className="text-xs text-surface-500 mt-1">
          SHAP analysis shows how much each input variable influences the model&apos;s predicted
          points. The percentage represents each variable&apos;s share of total influence,higher
          means the model relies on it more when making predictions.
        </p>
      </div>

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
            const maxPct = shapFeatures[0].importance_pct
              ? parseFloat(shapFeatures[0].importance_pct)
              : maxImportance;
            const thisPct = f.importance_pct ? parseFloat(f.importance_pct) : f.importance;
            const pct = (thisPct / maxPct) * 100;
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
                      {f.importance_pct
                        ? `${parseFloat(f.importance_pct).toFixed(1)}%`
                        : `${f.importance.toFixed(1)}%`}
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
    </div>
  );
}
