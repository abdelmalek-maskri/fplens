import { useLocation } from "react-router-dom";
import { useState, useCallback } from "react";
import { useTheme } from "../../lib/theme";

const PAGE_TITLES = {
  "/": "Gameweek 24",
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

export default function Header({ onMenuToggle }) {
  const { pathname } = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const [lastUpdated, setLastUpdated] = useState("Just now");
  const [spinning, setSpinning] = useState(false);

  const pageTitle = PAGE_TITLES[pathname] || "Fantasy Foresight";

  const handleRefresh = useCallback(() => {
    setSpinning(true);
    setTimeout(() => {
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setSpinning(false);
    }, 600);
  }, []);

  return (
    <header className="fixed top-0 left-0 lg:left-[220px] right-0 h-14 bg-surface-900/95 backdrop-blur-sm border-b border-surface-800/60 z-30 flex items-center justify-between px-4 sm:px-6">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button onClick={onMenuToggle} aria-label="Toggle menu" className="lg:hidden text-surface-400 hover:text-surface-100 -ml-1 mr-1">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* Title */}
        <div>
          <h2 className="text-sm font-bold text-surface-100 leading-tight">{pageTitle}</h2>
          <p className="text-2xs text-surface-500 hidden sm:block">Gameweek 24 · Deadline Sat 11:00</p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <span className="text-2xs text-surface-500 hidden sm:inline">
          {lastUpdated}
        </span>

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="text-surface-400 hover:text-surface-100 p-1.5 rounded-md hover:bg-surface-800/60 transition-all"
        >
          {isDark ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
        </button>

        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 text-2xs font-medium text-surface-400 hover:text-brand-400 px-2.5 py-1.5 rounded-md hover:bg-brand-500/10 transition-all"
        >
          <svg className={`w-3.5 h-3.5 transition-transform duration-500 ${spinning ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">Sync</span>
        </button>
      </div>
    </header>
  );
}
