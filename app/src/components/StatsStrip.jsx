import { Fragment } from "react";

export default function StatsStrip({ items, className = "" }) {
  return (
    <div
      className={`flex items-center gap-5 flex-wrap py-3 border-b border-surface-800 ${className}`}
    >
      {items.map((item, idx) => (
        <Fragment key={idx}>
          {idx > 0 && <div className="w-px h-5 bg-surface-700" />}
          <div>
            <span className={`text-xl font-bold ${item.valueClass || "text-surface-100"}`}>
              {item.value}
            </span>
            <span className="text-xs text-surface-500 ml-1.5">{item.label}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
