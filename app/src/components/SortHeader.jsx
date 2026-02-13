/**
 * SortHeader — sortable table column header
 * @param {string} field - the field key to sort by
 * @param {string} sortBy - currently active sort field
 * @param {boolean} sortDesc - current sort direction
 * @param {function} onSort - callback when header is clicked
 * @param {React.ReactNode} children - header label content
 */
export default function SortHeader({ field, sortBy, sortDesc, onSort, children }) {
  return (
    <th
      scope="col"
      className="table-header text-left py-2.5 px-3 cursor-pointer hover:text-surface-300 transition-colors"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortBy === field && (
          <span className="text-brand-400">{sortDesc ? "\u2193" : "\u2191"}</span>
        )}
      </div>
    </th>
  );
}
