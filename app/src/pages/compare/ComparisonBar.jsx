function ComparisonBar({ label, valueA, valueB, format, higherIsBetter = true, suffix = "" }) {
  const a = typeof valueA === "number" ? valueA : 0;
  const b = typeof valueB === "number" ? valueB : 0;

  const aWins = higherIsBetter ? a > b : a < b;
  const bWins = higherIsBetter ? b > a : b < a;
  const tie = a === b;

  const formatVal = (v) => {
    if (format === "price") return `£${v}m`;
    if (format === "pct") return `${v}%`;
    if (format === "int") return Math.round(v).toLocaleString();
    return typeof v === "number" ? v.toFixed(1) : v;
  };

  return (
    <div className="flex items-center py-2 border-b border-surface-800/30 last:border-0">
      <span
        className={`w-20 text-right font-data tabular-nums text-sm ${
          aWins ? "text-brand-400 font-bold" : tie ? "text-surface-200" : "text-surface-500"
        }`}
      >
        {formatVal(valueA)}
        {suffix}
      </span>
      <span className="flex-1 text-center text-xs text-surface-400 px-3">{label}</span>
      <span
        className={`w-20 text-left font-data tabular-nums text-sm ${
          bWins ? "text-brand-400 font-bold" : tie ? "text-surface-200" : "text-surface-500"
        }`}
      >
        {formatVal(valueB)}
        {suffix}
      </span>
    </div>
  );
}

export default ComparisonBar;
