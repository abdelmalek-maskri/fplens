function PageButton({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-1 text-xs rounded border border-surface-700 text-surface-400 hover:text-surface-200 hover:border-surface-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
    >
      {children}
    </button>
  );
}

/**
 * Page controls for a table. Renders nothing for a single page, so a filtered
 * view of a dozen rows stays clean.
 *
 * The controls centre in the full width and the range readout is taken out of
 * flow, so a long count cannot push them off centre. The readout drops below
 * the sm breakpoint, where there is no room beside the buttons.
 */
export default function Pagination({ page, totalPages, pageStart, pageSize, total, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="relative flex items-center justify-center pt-4 mt-4 border-t border-surface-800">
      <span className="absolute left-0 hidden sm:block text-xs text-surface-500 tabular-nums">
        {pageStart + 1} to {Math.min(pageStart + pageSize, total)} of {total}
      </span>

      <div className="flex items-center gap-1">
        <PageButton onClick={() => onChange(1)} disabled={page === 1}>
          First
        </PageButton>
        <PageButton onClick={() => onChange(page - 1)} disabled={page === 1}>
          Previous
        </PageButton>
        <span className="px-2 text-xs text-surface-400 tabular-nums">
          {page} / {totalPages}
        </span>
        <PageButton onClick={() => onChange(page + 1)} disabled={page === totalPages}>
          Next
        </PageButton>
        <PageButton onClick={() => onChange(totalPages)} disabled={page === totalPages}>
          Last
        </PageButton>
      </div>
    </div>
  );
}
