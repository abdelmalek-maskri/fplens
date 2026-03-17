import { FDR_COLORS, POSITION_COLORS } from "../../lib/constants";
import MiniSparkline from "../../components/charts/MiniSparkline";
import TeamBadge from "../../components/badges/TeamBadge";

function WatchedPlayerRow({ p, onNavigate, onRemove }) {
  const fdrNext3 = p.fdr_next3 ?? [];
  const sum3 = fdrNext3.reduce((s, f) => s + f, 0);

  return (
    <div className="py-3 border-b border-surface-800 last:border-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 w-48">
          <TeamBadge team={p.team_name} />
          <div>
            <p
              className="text-sm font-semibold text-surface-100 hover:text-brand-400 transition-colors cursor-pointer"
              onClick={() => onNavigate(`/player/${p.element}`)}
            >
              {p.web_name}
            </p>
            <p className="text-2xs text-surface-500">
              <span className={POSITION_COLORS[p.position]}>{p.position}</span> · £{p.value}m
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-center">
            <p className="text-2xs text-surface-500">Form</p>
            <p className="text-sm font-bold text-surface-100">{p.form}</p>
          </div>
          <MiniSparkline pts={p.pts_last5 ?? []} />
        </div>

        <div className="text-center">
          <p className="text-2xs text-surface-500">Predicted</p>
          <p className="text-sm font-bold text-brand-400">{p.predicted_points ?? p.predicted}</p>
          {p.uncertainty > 0 && (
            <p className="text-[10px] text-surface-500 font-data tabular-nums">
              {Math.max(0, (p.predicted_points ?? p.predicted) - p.uncertainty).toFixed(1)}–
              {((p.predicted_points ?? p.predicted) + p.uncertainty).toFixed(1)}
            </p>
          )}
        </div>

        <div className="text-center">
          <p className="text-2xs text-surface-500">Own%</p>
          <p className="text-sm text-surface-300">{p.selected_by_percent ?? p.ownership ?? "—"}%</p>
        </div>

        {fdrNext3.length > 0 && (
          <div>
            <p className="text-2xs text-surface-500 mb-1">Next 3 GWs</p>
            <div className="flex items-center gap-1">
              {fdrNext3.map((fdr, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center justify-center w-6 h-6 rounded text-2xs font-bold ${FDR_COLORS[fdr].text} ${FDR_COLORS[fdr].bg}`}
                >
                  {fdr}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 text-right">
          {p.news ? (
            <span className="text-xs text-warning-400">{p.news}</span>
          ) : fdrNext3.length > 0 ? (
            <span
              className={`text-xs ${sum3 <= 7 ? "text-success-400" : sum3 >= 10 ? "text-danger-400" : "text-surface-500"}`}
            >
              {sum3 <= 7 ? "Good run coming" : sum3 >= 10 ? "Tough fixtures" : "Mixed fixtures"}
            </span>
          ) : null}
        </div>

        <button
          onClick={onRemove}
          aria-label={`Remove ${p.web_name} from watchlist`}
          className="text-surface-600 hover:text-danger-400 transition-colors p-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default WatchedPlayerRow;
