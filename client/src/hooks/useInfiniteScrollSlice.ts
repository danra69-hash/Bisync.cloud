import { useCallback, useEffect, useMemo, useState } from 'react';

/** Rows shown initially, and appended each time the user clicks Load next. */
export const DEFAULT_TABLE_PAGE_SIZE = 100;

/** @deprecated Use DEFAULT_TABLE_PAGE_SIZE */
export const DEFAULT_INFINITE_SCROLL_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;

type Options = {
  pageSize?: number;
  /** Ignored — kept for call-site compatibility after removing infinite scroll. */
  scrollRootRef?: unknown;
};

/**
 * Progressive table paging: show the first `pageSize` rows, then append another
 * `pageSize` on each Load next click without removing earlier rows.
 */
export function useInfiniteScrollSlice<T>(items: T[], options: Options = {}) {
  const pageSize = options.pageSize ?? DEFAULT_TABLE_PAGE_SIZE;
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const itemsLength = items.length;

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items, pageSize]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );

  const hasMore = visibleCount < itemsLength;
  const remainingCount = Math.max(0, itemsLength - visibleCount);
  const nextPageSize = Math.min(pageSize, remainingCount);

  const loadMore = useCallback(() => {
    setVisibleCount(current => Math.min(current + pageSize, itemsLength));
  }, [itemsLength, pageSize]);

  return {
    visibleItems,
    hasMore,
    /** @deprecated No longer used; load-more is button-driven. */
    sentinelRef: { current: null },
    totalCount: itemsLength,
    visibleCount: visibleItems.length,
    pageSize,
    nextPageSize,
    remainingCount,
    loadMore,
  };
}
