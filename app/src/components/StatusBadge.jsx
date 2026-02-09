/**
 * StatusBadge — player availability status indicator
 * @param {string} status - a | d | i | u | s
 * @param {number} [chance] - chance of playing percentage (for doubtful)
 * @param {boolean} [compact] - use short labels (Fit, 75%, etc.)
 */
export default function StatusBadge({ status, chance, compact = false }) {
  const config = {
    a: { label: compact ? "Fit" : "Available", cls: "bg-success-500/20 text-success-400" },
    d: { label: compact ? `${chance}%` : `Doubtful (${chance}%)`, cls: "bg-warning-500/20 text-warning-400" },
    i: { label: "Injured", cls: "bg-danger-500/20 text-danger-400" },
    u: { label: compact ? "Out" : "Unavailable", cls: "bg-surface-600 text-surface-400" },
    s: { label: "Suspended", cls: "bg-danger-500/20 text-danger-400" },
  };
  const c = config[status] || config.u;
  return <span className={`badge ${c.cls}`}>{c.label}</span>;
}
