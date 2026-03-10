import { useLocation } from "react-router-dom";
import { useState, useCallback } from "react";
import { refresh } from "../../lib/api";

const PAGE_TITLES = {
  "/optimal-xi": "Optimal XI",
  "/my-team": "My Team",
  "/transfers": "Transfers",
  "/chip-advisor": "Chip Advisor",
  "/fixtures": "Fixture Ticker",
  "/compare": "Player Compare",
  "/news": "News & Sentiment",
  "/watchlist": "Watchlist",
  "/insights": "Model Insights",
  "/season-planner": "Season Planner",
};

function formatDeadlineShort(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return "Deadline " + d.toLocaleDateString("en-GB", { weekday: "short" }) +
    " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function Header({ onMenuToggle, gwData }) {
  const { pathname } = useLocation();
  const [lastUpdated, setLastUpdated] = useState("Just now");
  const [spinning, setSpinning] = useState(false);

  const currentGw = gwData?.current_gw;
  const pageTitle = pathname === "/"
    ? (currentGw ? `Gameweek ${currentGw}` : "Dashboard")
    : (PAGE_TITLES[pathname] || "Fantasy Foresight");
  const deadlineLabel = formatDeadlineShort(gwData?.deadline);

  const handleRefresh = useCallback(() => {
    setSpinning(true);
    refresh()
      .then(() => {
        setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      })
      .catch(() => {
        setLastUpdated("Sync failed");
      })
      .finally(() => setSpinning(false));
  }, []);

  return (
    <header className="fixed top-0 left-0 lg:left-[200px] right-0 h-11 bg-surface-900/95 backdrop-blur-sm border-b border-surface-700 z-30 flex items-center justify-between px-4">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onMenuToggle}
          aria-label="Toggle menu"
          className="lg:hidden text-surface-400 hover:text-surface-200 -ml-1 mr-0.5"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            />
          </svg>
        </button>
        <h2 className="text-sm font-semibold text-surface-100 leading-none">{pageTitle}</h2>
        {deadlineLabel && <span className="text-2xs text-surface-600 hidden sm:inline">{deadlineLabel}</span>}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-2xs text-surface-600 hidden sm:inline">{lastUpdated}</span>
        <button
          onClick={handleRefresh}
          aria-label="Sync data"
          className="flex items-center gap-1 text-2xs font-medium text-surface-500 hover:text-brand-400 px-2 py-1 rounded hover:bg-surface-800/50 transition-colors"
        >
          <svg
            className={`w-3 h-3 transition-transform duration-500 ${spinning ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span className="hidden sm:inline">Sync</span>
        </button>
      </div>
    </header>
  );
}
