import { useCallback, useEffect, useMemo, useState } from 'react';

/** Rows shown initially, and appended each time the user clicks Load next. */
export const DEFAULT_TABLE_PAGE_SIZE = 100;

/** @deprecated Use DEFAULT_TABLE_PAGE_SIZE */
export const DEFAULT_INFINITE_SCROLL_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;

type Options = {
  pageSize?: number;
  /** Ignored — kept for call-site compatibility after removing infinite scroll. */
  scrollRootRef?: unknown;
  /**
   * When this value changes (filters, search, deactivated toggle), reset to the
   * first page so matches like Ginger Ale are not stuck past the first 100 rows.
   */
  resetKey?: string | number | boolean;
};

/**
 * Progressive table paging: show the first `pageSize` rows, then append another
 * `pageSize` on each Load next click without removing earlier rows.
 */
export function useInfiniteScrollSlice<T>(items: T[], options: Options = {}) {
  const pageSize = options.pageSize ?? DEFAULT_TABLE_PAGE_SIZE;
  const resetKey = options.resetKey;
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const itemsLength = items.length;

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [resetKey, pageSize]);

  useEffect(() => {
    setVisibleCount(prev => {
      if (itemsLength === 0) return pageSize;
      return Math.min(Math.max(prev, pageSize), Math.max(pageSize, itemsLength));
    });
  }, [itemsLength, pageSize]);

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
