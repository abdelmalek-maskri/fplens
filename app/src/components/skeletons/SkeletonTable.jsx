/**
 * Animated table skeleton.
 * @param {number} rows  Number of body rows (default 10)
 * @param {number} cols  Number of columns (default 6)
 */
export default function SkeletonTable({ rows = 10, cols = 6 }) {
  // Vary widths per column to look realistic
  const colWidths = ["w-8", "w-32", "w-14", "w-12", "w-16", "w-10", "w-14", "w-12", "w-10"];

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-700">
            {Array.from({ length: cols }, (_, i) => (
              <th key={i} className="py-2.5 px-3">
                <div className={`skeleton h-3 ${colWidths[i % colWidths.length]}`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, rowIdx) => (
            <tr key={rowIdx} className="border-t border-surface-800/60">
              {Array.from({ length: cols }, (_, colIdx) => (
                <td key={colIdx} className="py-2.5 px-3">
                  <div className={`skeleton h-4 ${colWidths[colIdx % colWidths.length]}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
