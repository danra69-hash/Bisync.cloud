import type { RefObject } from 'react';

type SentinelProps = {
  hasMore: boolean;
  sentinelRef: RefObject<HTMLElement | null>;
  totalCount?: number;
  visibleCount?: number;
};

export function InfiniteScrollTableSentinel({
  colSpan,
  hasMore,
  sentinelRef,
  totalCount,
  visibleCount,
}: SentinelProps & { colSpan: number }) {
  if (!hasMore) return null;

  const label =
    visibleCount != null && totalCount != null
      ? `Showing ${visibleCount} of ${totalCount} — scroll for more`
      : 'Scroll for more…';

  return (
    <tr ref={sentinelRef as RefObject<HTMLTableRowElement | null>} className="bg-muted/10">
      <td colSpan={colSpan} className="px-3 py-3 text-center text-xs text-muted-foreground">
        {label}
      </td>
    </tr>
  );
}

export function InfiniteScrollDivSentinel({
  hasMore,
  sentinelRef,
  totalCount,
  visibleCount,
}: SentinelProps) {
  if (!hasMore) return null;

  const label =
    visibleCount != null && totalCount != null
      ? `Showing ${visibleCount} of ${totalCount} — scroll for more`
      : 'Scroll for more…';

  return (
    <div ref={sentinelRef as RefObject<HTMLDivElement | null>} className="py-3 text-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}
