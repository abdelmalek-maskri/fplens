/**
 * Generic card skeleton with text line placeholders.
 * @param {number} lines  Number of text lines (default 3)
 */
export default function SkeletonCard({ lines = 3 }) {
  const widths = ["w-3/4", "w-1/2", "w-2/3", "w-1/3"];

  return (
    <div className="p-4 border border-surface-700 rounded-md space-y-3">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={`skeleton h-4 ${widths[i % widths.length]}`} />
      ))}
    </div>
  );
}
