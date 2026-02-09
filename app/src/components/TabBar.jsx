export default function TabBar({ tabs, active, onChange, className = "" }) {
  return (
    <div className={`flex items-center gap-0 border-b border-surface-800 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-3 py-2 text-sm font-medium transition-colors relative ${
            active === tab.id ? "text-surface-100" : "text-surface-500 hover:text-surface-300"
          }`}
        >
          {tab.label}
          {active === tab.id && (
            <span className={`absolute bottom-0 left-3 right-3 h-[2px] rounded-full ${tab.color || "bg-brand-500"}`} />
          )}
        </button>
      ))}
    </div>
  );
}
