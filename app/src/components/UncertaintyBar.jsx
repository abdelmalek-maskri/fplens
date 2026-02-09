const UncertaintyBar = ({ predicted, uncertainty }) => {
  const low = Math.max(0, predicted - uncertainty);
  const high = predicted + uncertainty;
  const maxVal = 12;
  const leftPct = (low / maxVal) * 100;
  const widthPct = ((high - low) / maxVal) * 100;
  const pointPct = (predicted / maxVal) * 100;

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 bg-surface-800 rounded w-24">
        <div
          className="absolute h-full bg-surface-600 rounded"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 bg-surface-300 rounded-sm"
          style={{ left: `${pointPct}%` }}
        />
      </div>
      <span className="text-2xs text-surface-500 font-data tabular-nums whitespace-nowrap">
        {low.toFixed(1)}–{high.toFixed(1)}
      </span>
    </div>
  );
};

export default UncertaintyBar;
