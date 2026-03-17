import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

const TREND_CONFIG = {
  rise: { icon: "▲", cls: "text-success-400 bg-success-500/15", label: "Rising" },
  fall: { icon: "▼", cls: "text-danger-400 bg-danger-500/15", label: "Falling" },
  stable: { icon: "–", cls: "text-surface-400 bg-surface-700", label: "Stable" },
};

export default function PriceTab({ predictions }) {
  const navigate = useNavigate();

  const players = useMemo(
    () =>
      [...predictions]
        .sort(
          (a, b) =>
            Math.abs(b.transfers_in - b.transfers_out) - Math.abs(a.transfers_in - a.transfers_out)
        )
        .slice(0, 6),
    [predictions]
  );

  return (
    <div className="space-y-2">
      {players.map((p) => {
        const net = p.transfers_in - p.transfers_out;
        const t = TREND_CONFIG[p.price_trend] || TREND_CONFIG.stable;
        return (
          <div key={p.element} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded text-2xs font-bold ${t.cls}`}
              >
                {t.icon}
              </span>
              <span
                className="text-sm text-surface-200 hover:text-brand-400 transition-colors cursor-pointer"
                onClick={() => navigate(`/player/${p.element}`)}
              >
                {p.web_name}
              </span>
              <span className="text-xs text-surface-500">£{p.value}m</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span
                  className={`text-xs font-mono ${net > 0 ? "text-success-400" : "text-danger-400"}`}
                >
                  {net > 0 ? "+" : ""}
                  {(net / 1000).toFixed(1)}k net
                </span>
              </div>
              <span className={`badge text-2xs ${t.cls}`}>{t.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
