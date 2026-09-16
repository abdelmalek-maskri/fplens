import { FDR_COLORS } from "../../lib/constants";

export default function FdrBadge({ opponent, fdr, fdrMap }) {
  const rating = fdr ?? fdrMap?.[opponent] ?? 3;
  const colors = FDR_COLORS[rating];
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded text-2xs font-bold ${colors.bg} ${colors.text}`}
      >
        {rating}
      </span>
      <span className="text-sm text-surface-300">{opponent}</span>
    </div>
  );
}
