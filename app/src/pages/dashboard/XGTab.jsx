import { useMemo } from "react";
import PlayerLink from "../../components/ui/PlayerLink";

export default function XGTab({ predictions }) {
  const players = useMemo(
    () =>
      [...predictions]
        .filter((p) => p.position !== "GK" && p.goals > 0)
        .sort((a, b) => Math.abs(b.goals - b.xG) - Math.abs(a.goals - a.xG))
        .slice(0, 5),
    [predictions]
  );

  return (
    <div className="space-y-2">
      {players.map((p) => {
        const diff = p.goals - p.xG;
        const over = diff > 0;
        const maxBar = 4;
        const barPct = Math.min((Math.abs(diff) / maxBar) * 100, 100);
        return (
          <div key={p.element} className="flex items-center gap-3">
            <PlayerLink element={p.element} className="text-sm text-surface-700 w-28 truncate">
              {p.web_name}
            </PlayerLink>
            <span className="text-xs text-surface-500 w-20 text-right shrink-0">
              {p.goals}G / {p.xG}xG
            </span>
            <div className="flex-1 flex items-center">
              {over ? (
                <div className="flex items-center w-full">
                  <div className="w-1/2" />
                  <div
                    className="h-2.5 bg-success-500/50 rounded-r"
                    style={{ width: `${barPct / 2}%` }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-end w-full">
                  <div
                    className="h-2.5 bg-warning-500/50 rounded-l"
                    style={{ width: `${barPct / 2}%` }}
                  />
                  <div className="w-1/2" />
                </div>
              )}
            </div>
            <span
              className={`text-xs font-bold w-10 text-right ${over ? "text-success-400" : "text-warning-400"}`}
            >
              {over ? "+" : ""}
              {diff.toFixed(1)}
            </span>
          </div>
        );
      })}
      {/* Carries the bar colours, because the bars are the thing being
          explained and two grey words beside them explain nothing. At 2xs on
          surface-400 this was the faintest text on the page, which is the
          wrong weight for the only line that says what the chart means. */}
      <div className="flex items-center gap-5 flex-wrap mt-3 pt-3 border-t border-surface-200 text-xs text-surface-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded bg-success-500/50" />
          <span className="font-semibold text-success-400">+</span>
          more goals than xG expected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded bg-warning-500/50" />
          <span className="font-semibold text-warning-400">−</span>
          fewer
        </span>
      </div>
    </div>
  );
}
