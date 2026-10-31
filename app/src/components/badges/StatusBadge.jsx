// FPL reports chance_of_playing as 0 or 100 for most players, including ones
// whose news says "75% chance of playing". Only an intermediate value carries
// information, so only that is shown; otherwise the word stands on its own.
const meaningful = (chance) => typeof chance === "number" && chance > 0 && chance < 100;

export default function StatusBadge({ status, chance, compact = false }) {
  const pct = meaningful(chance) ? `${chance}%` : null;

  const config = {
    a: { label: compact ? "Fit" : "Available", cls: "bg-success-500/20 text-success-700" },
    d: {
      label: pct ? (compact ? pct : `Doubtful (${pct})`) : "Doubtful",
      cls: "bg-warning-500/20 text-warning-700",
    },
    i: { label: "Injured", cls: "bg-danger-500/20 text-danger-700" },
    u: { label: compact ? "Out" : "Unavailable", cls: "bg-surface-700 text-surface-200" },
    s: { label: "Suspended", cls: "bg-danger-500/20 text-danger-700" },
  };
  const c = config[status] || config.u;
  return <span className={`badge ${c.cls}`}>{c.label}</span>;
}
