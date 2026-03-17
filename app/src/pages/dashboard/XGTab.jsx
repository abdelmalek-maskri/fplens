import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

export default function XGTab({ predictions }) {
  const navigate = useNavigate();

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
            <span
              className="text-sm text-surface-300 w-28 truncate hover:text-brand-400 transition-colors cursor-pointer"
              onClick={() => navigate(`/player/${p.element}`)}
            >
              {p.web_name}
            </span>
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
      <div className="flex items-center gap-4 mt-3 text-2xs text-surface-600">
        <span>+ outscoring xG</span>
        <span>− underperforming</span>
      </div>
    </div>
  );
}
