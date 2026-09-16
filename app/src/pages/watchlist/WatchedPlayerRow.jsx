import { POSITION_COLORS } from "../../lib/constants";
import TeamBadge from "../../components/badges/TeamBadge";

export const ROW_COLS = "grid grid-cols-[1fr_5rem_4rem_4rem_5rem_2rem] items-center gap-3";

function WatchedPlayerRow({ p, onNavigate, onRemove }) {
  return (
    <div className={`${ROW_COLS} py-3 border-t border-surface-800/60`}>
      <div className="flex items-center gap-3 min-w-0">
        <TeamBadge team={p.team_name} />
        <div className="min-w-0">
          <button
            onClick={() => onNavigate(`/player/${p.element}`)}
            className="text-sm font-semibold text-surface-100 hover:text-brand-400 transition-colors"
          >
            {p.web_name}
          </button>
          <p className="text-2xs text-surface-500">
            <span className={POSITION_COLORS[p.position]}>{p.position}</span> · £
            {p.value.toFixed(1)}m
          </p>
          {p.news && <p className="text-2xs text-warning-400 truncate">{p.news}</p>}
        </div>
      </div>

      <div className="text-right">
        <p className="text-sm font-bold text-brand-400 font-data tabular-nums">
          {p.predicted_points.toFixed(1)}
        </p>
        <p className="text-2xs text-surface-500 font-data tabular-nums">
          {p.predicted_range_low.toFixed(1)} to {p.predicted_range_high.toFixed(1)}
        </p>
      </div>

      <p className="text-right text-sm text-surface-200 font-data tabular-nums">
        {p.form.toFixed(1)}
      </p>

      <p className="text-right text-sm text-surface-200">{p.opponent_name}</p>

      <p className="text-right text-sm text-surface-400 font-data tabular-nums">
        {p.selected_by_percent.toFixed(1)}%
      </p>

      <button
        onClick={onRemove}
        aria-label={`Remove ${p.web_name} from watchlist`}
        className="justify-self-end text-surface-600 hover:text-danger-400 transition-colors p-1"
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
  );
}

export default WatchedPlayerRow;
