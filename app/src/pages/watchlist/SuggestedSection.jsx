import { useMemo } from "react";
import TeamBadge from "../../components/badges/TeamBadge";

// Three ways to find a player worth watching. Each card also shows the
// prediction, since that is what the reader is here to compare.
const CATEGORIES = [
  {
    key: "form",
    label: "In form",
    tag: (p) => `form ${p.form.toFixed(1)}`,
    sort: (a, b) => b.form - a.form,
  },
  {
    key: "value",
    label: "Best value",
    tag: (p) => `${(p.predicted_points / p.value).toFixed(2)} pts per £m`,
    sort: (a, b) => b.predicted_points / b.value - a.predicted_points / a.value,
  },
  {
    key: "transfers",
    label: "Most transferred in",
    tag: (p) => `+${Math.round(p.transfers_in / 1000)}k this GW`,
    sort: (a, b) => b.transfers_in - a.transfers_in,
  },
];

function SuggestedSection({ allPlayers, watchedIds, onAdd }) {
  const eligible = useMemo(
    () =>
      allPlayers.filter(
        (p) => !watchedIds.includes(p.element) && p.status === "a" && p.predicted_points > 0
      ),
    [allPlayers, watchedIds]
  );

  if (!eligible.length) return null;

  return (
    <div>
      <span className="section-label">Worth a look</span>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-8">
        {CATEGORIES.map((cat) => (
          <div key={cat.key}>
            <p className="text-xs text-surface-500 mb-2">{cat.label}</p>
            <div className="space-y-1">
              {[...eligible]
                .sort(cat.sort)
                .slice(0, 4)
                .map((p) => (
                  <div key={p.element} className="flex items-center gap-2 py-1">
                    <TeamBadge team={p.team_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-100 truncate">{p.web_name}</p>
                      <p className="text-2xs text-surface-500">{cat.tag(p)}</p>
                    </div>
                    <span className="text-sm font-bold text-brand-400 font-data tabular-nums">
                      {p.predicted_points.toFixed(1)}
                    </span>
                    <button
                      onClick={() => onAdd(p.element)}
                      aria-label={`Watch ${p.web_name}`}
                      className="ml-1 text-xs text-surface-500 hover:text-brand-400 transition-colors"
                    >
                      + Watch
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SuggestedSection;
