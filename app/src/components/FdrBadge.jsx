import { FDR_COLORS } from "../lib/constants";

/**
 * FdrBadge — fixture difficulty rating badge with opponent name
 * @param {string} opponent - team abbreviation (e.g. "ARS")
 * @param {object} fdrMap - mapping of team abbreviation to FDR 1-5
 */
export default function FdrBadge({ opponent, fdrMap }) {
  const fdr = fdrMap?.[opponent] || 3;
  const colors = FDR_COLORS[fdr];
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-2xs font-bold ${colors.bg} ${colors.text}`}>
        {fdr}
      </span>
      <span className="text-sm text-surface-300">{opponent}</span>
    </div>
  );
}
