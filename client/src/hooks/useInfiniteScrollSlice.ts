import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

export const DEFAULT_INFINITE_SCROLL_PAGE_SIZE = 50;

type Options = {
  pageSize?: number;
  scrollRootRef?: RefObject<HTMLElement | null>;
};

export function useInfiniteScrollSlice<T>(items: T[], options: Options = {}) {
  const pageSize = options.pageSize ?? DEFAULT_INFINITE_SCROLL_PAGE_SIZE;
  const scrollRootRef = options.scrollRootRef;
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLElement | null>(null);

  const itemsLength = items.length;

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items, pageSize]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );

  const hasMore = visibleCount < itemsLength;

  const loadMore = useCallback(() => {
    setVisibleCount(current => Math.min(current + pageSize, itemsLength));
  }, [itemsLength, pageSize]);

  useEffect(() => {
    if (!hasMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const root = scrollRootRef?.current ?? null;

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          loadMore();
        }
      },
      { root, rootMargin: '240px', threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, scrollRootRef, visibleCount, itemsLength]);

  return {
    visibleItems,
    hasMore,
    sentinelRef,
    totalCount: itemsLength,
    visibleCount: visibleItems.length,
    loadMore,
  };
}
