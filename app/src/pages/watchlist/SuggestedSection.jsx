import { useMemo } from "react";
import TeamBadge from "../../components/badges/TeamBadge";

const CATEGORIES = [
  {
    key: "form",
    label: "Hot Form",
    tag: (p) => `Form ${p.form}`,
    sort: (a, b) => parseFloat(b.form ?? 0) - parseFloat(a.form ?? 0),
  },
  {
    key: "value",
    label: "Value Picks",
    tag: (p) =>
      p.value ? `${(p.predicted_points / p.value).toFixed(2)} pts/£m` : `${p.predicted_points} pts`,
    sort: (a, b) =>
      (b.predicted_points ?? 0) / (b.value || 1) - (a.predicted_points ?? 0) / (a.value || 1),
  },
  {
    key: "transfers",
    label: "Price Risers",
    tag: (p) => `+${Math.round((p.transfers_in ?? 0) / 1000)}k transfers`,
    sort: (a, b) => (b.transfers_in ?? 0) - (a.transfers_in ?? 0),
  },
];

function SuggestedSection({ allPlayers, watchedIds, onAdd }) {
  const eligible = useMemo(
    () =>
      allPlayers.filter(
        (p) => !watchedIds.includes(p.element) && p.status === "a" && (p.predicted_points ?? 0) > 0
      ),
    [allPlayers, watchedIds]
  );

  if (!eligible.length) return null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-500 uppercase tracking-wider font-medium">Suggested</p>
      {CATEGORIES.map((cat) => {
        const picks = [...eligible].sort(cat.sort).slice(0, 3);
        if (!picks.length) return null;
        return (
          <div key={cat.key}>
            <p className="text-2xs text-surface-500 mb-2">{cat.label}</p>
            <div className="flex flex-wrap gap-2">
              {picks.map((p) => (
                <div
                  key={p.element}
                  className="flex items-center gap-2 px-3 py-2 bg-surface-900 border border-surface-800 rounded-md"
                >
                  <TeamBadge team={p.team_name} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-surface-100 truncate">{p.web_name}</p>
                    <p className="text-2xs text-surface-500">{cat.tag(p)}</p>
                  </div>
                  <button
                    onClick={() => onAdd(p.element)}
                    className="ml-1 text-2xs text-brand-400 hover:text-brand-300 font-medium transition-colors whitespace-nowrap"
                  >
                    + Watch
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SuggestedSection;
