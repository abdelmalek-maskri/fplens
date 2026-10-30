import { useState, useEffect } from "react";

/**
 * Page a list that is already filtered and sorted.
 *
 * Resets to page one whenever `items` changes identity. Callers build their
 * list with useMemo, so a new array means the filters or the sort moved and the
 * current page number no longer refers to anything. Without this, narrowing a
 * list while on page six shows an empty table with no visible cause.
 */
export function usePagination(items, pageSize) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageStart = (page - 1) * pageSize;

  return {
    page,
    setPage,
    totalPages,
    pageStart,
    pageItems: items.slice(pageStart, pageStart + pageSize),
  };
}
