import { useRef, useCallback } from "react";

/**
 * Accessible tab bar with ARIA roles and keyboard navigation.
 *
 * @param {Array}  tabs      - [{ id, label, color?, borderColor?, activeColor? }]
 * @param {string} active    - Currently active tab id
 * @param {Function} onChange - Called with tab id on change
 * @param {string} id        - Namespace for ARIA IDs (default "tabs")
 * @param {"underline"|"border"} variant - Visual style
 * @param {string} className - Extra classes on the container
 */
export default function TabBar({
  tabs,
  active,
  onChange,
  id = "tabs",
  variant = "underline",
  className = "",
}) {
  const listRef = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      const ids = tabs.map((t) => t.id);
      const idx = ids.indexOf(active);
      let next;

      if (e.key === "ArrowRight") next = ids[(idx + 1) % ids.length];
      else if (e.key === "ArrowLeft") next = ids[(idx - 1 + ids.length) % ids.length];
      else if (e.key === "Home") next = ids[0];
      else if (e.key === "End") next = ids[ids.length - 1];

      if (next !== undefined) {
        e.preventDefault();
        onChange(next);
        listRef.current?.querySelector(`[data-tab="${next}"]`)?.focus();
      }
    },
    [tabs, active, onChange]
  );

  const isBorder = variant === "border";

  return (
    <div
      ref={listRef}
      role="tablist"
      className={`flex items-center gap-0 ${isBorder ? "border-b border-surface-700" : "border-b border-surface-800"} ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            data-tab={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`${id}-panel-${tab.id}`}
            id={`${id}-tab-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={handleKeyDown}
            className={
              isBorder
                ? `px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    isActive
                      ? `${tab.borderColor || "border-brand-400"} ${tab.activeColor || "text-brand-400"}`
                      : "border-transparent text-surface-500 hover:text-surface-300"
                  }`
                : `px-3 py-2 text-sm font-medium transition-colors relative ${
                    isActive ? "text-surface-100" : "text-surface-500 hover:text-surface-300"
                  }`
            }
          >
            {tab.label}
            {!isBorder && isActive && (
              <span
                className={`absolute bottom-0 left-3 right-3 h-[2px] rounded-full ${tab.color || "bg-brand-500"}`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
