import { NavLink } from "react-router-dom";
import { forwardRef } from "react";

const navItems = [
  {
    section: "PREDICTIONS",
    items: [
      { name: "Dashboard", path: "/" },
      { name: "Optimal XI", path: "/optimal-xi" },
    ],
  },
  {
    section: "PLANNING",
    items: [
      { name: "My Team", path: "/my-team" },
      { name: "Transfers", path: "/transfers" },
      { name: "Chip Advisor", path: "/chip-advisor" },
      { name: "Season Planner", path: "/season-planner" },
      { name: "Fixture Ticker", path: "/fixtures" },
    ],
  },
  {
    section: "SCOUTING",
    items: [
      { name: "Player Compare", path: "/compare" },
      { name: "News & Sentiment", path: "/news" },
      { name: "Watchlist", path: "/watchlist" },
    ],
  },
  {
    section: "ANALYSIS",
    items: [{ name: "Model Insights", path: "/insights" }],
  },
];

const Sidebar = forwardRef(function Sidebar({ open, onClose }, ref) {
  return (
    <aside
      ref={ref}
      className={`fixed left-0 top-0 h-screen w-[200px] bg-surface-900 border-r border-surface-700 flex flex-col z-50 transition-transform duration-150 ${open ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
    >
      {/* Logo */}
      <div className="px-3 py-3 border-b border-surface-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-2xs leading-none">FF</span>
            </div>
            <div>
              <h1 className="font-semibold text-surface-100 text-sm leading-none">
                Fantasy Foresight
              </h1>
              <p className="text-2xs text-surface-500 mt-0.5">GW 24</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden text-surface-400 hover:text-surface-200"
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

      {/* Navigation — flat, always open */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navItems.map((group, idx) => (
          <div
            key={group.section}
            className={idx > 0 ? "mt-1 pt-1 border-t border-surface-700" : ""}
          >
            <p className="text-2xs font-medium text-surface-600 tracking-widest px-2.5 mb-1 mt-2">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) => (isActive ? "nav-item-active" : "nav-item")}
                  >
                    <span>{item.name}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-2.5 pt-2 border-t border-surface-700">
        <div className="flex items-center gap-1.5 px-0.5">
          <span className="status-live" />
          <span className="text-2xs text-surface-400">Live</span>
          <span className="text-2xs text-surface-600 ml-auto">2m ago</span>
        </div>
        <p className="text-2xs text-surface-600 mt-1.5 px-0.5">Sat 8 Feb · 11:00</p>
      </div>
    </aside>
  );
});

export default Sidebar;
