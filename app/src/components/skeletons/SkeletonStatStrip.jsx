/**
 * Horizontal stat placeholders separated by dividers.
 * Matches the "stat strip" pattern used across pages.
 * @param {number} items  Number of stat groups (default 3)
 */
export default function SkeletonStatStrip({ items = 3 }) {
  return (
    <div className="flex items-center gap-5 flex-wrap py-3 border-b border-surface-800">
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="flex items-center gap-5">
          {i > 0 && <div className="w-px h-5 bg-surface-700" />}
          <div className="flex items-center gap-1.5">
            <div className="skeleton h-5 w-12" />
            <div className="skeleton h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
