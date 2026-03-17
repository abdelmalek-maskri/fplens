import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { POSITION_COLORS } from "../../lib/constants";
import TeamBadge from "../../components/badges/TeamBadge";

const calcDifferential = (p) => p.predicted_points * (1 - p.selected_by_percent / 100);

export default function DifferentialsTab({ predictions }) {
  const navigate = useNavigate();

  const diffs = useMemo(
    () =>
      [...predictions]
        .filter((p) => p.status === "a" && p.selected_by_percent < 30)
        .sort((a, b) => calcDifferential(b) - calcDifferential(a))
        .slice(0, 5),
    [predictions]
  );

  const maxImpact = Math.max(...diffs.map((p) => calcDifferential(p)));

  return (
    <>
      <p className="text-xs text-surface-500 mb-3">
        Low-ownership players your opponents likely don't have. High impact = high predicted points
        at low ownership.
      </p>
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-800/60">
            <th scope="col" className="text-xs text-surface-500 text-left py-1.5 font-normal w-8">
              #
            </th>
            <th scope="col" className="text-xs text-surface-500 text-left py-1.5 font-normal">
              Player
            </th>
            <th scope="col" className="text-xs text-surface-500 text-right py-1.5 font-normal w-16">
              Own%
            </th>
            <th scope="col" className="text-xs text-surface-500 text-right py-1.5 font-normal w-16">
              Pred.
            </th>
            <th scope="col" className="text-xs text-surface-500 text-right py-1.5 font-normal w-24">
              Impact
            </th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((p, idx) => {
            const impact = calcDifferential(p);
            const barPct = (impact / maxImpact) * 100;
            return (
              <tr key={p.element} className="border-b border-surface-800/40">
                <td className="py-2 text-xs text-surface-600 font-data">{idx + 1}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <TeamBadge team={p.team_name} size="sm" />
                    <span
                      className="text-sm text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
                      onClick={() => navigate(`/player/${p.element}`)}
                    >
                      {p.web_name}
                    </span>
                    <span
                      className={`text-xs ${POSITION_COLORS[p.position] || "text-surface-500"}`}
                    >
                      {p.position}
                    </span>
                  </div>
                </td>
                <td className="py-2 text-xs text-surface-500 text-right font-data tabular-nums">
                  {p.selected_by_percent}%
                </td>
                <td className="py-2 text-sm text-surface-300 text-right font-data tabular-nums">
                  {p.predicted_points.toFixed(1)}
                </td>
                <td className="py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-12 h-1.5 bg-surface-800 rounded overflow-hidden">
                      <div
                        className="h-full bg-brand-500/60 rounded"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-surface-100 font-data tabular-nums w-8">
                      {impact.toFixed(1)}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
