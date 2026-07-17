import { DEFAULT_TABLE_PAGE_SIZE } from '../../hooks/useInfiniteScrollSlice';

type LoadMoreProps = {
  hasMore: boolean;
  onLoadMore: () => void;
  totalCount?: number;
  visibleCount?: number;
  pageSize?: number;
  nextPageSize?: number;
  /** @deprecated Ignored — kept so existing call sites compile during migration. */
  sentinelRef?: unknown;
};

function loadMoreLabel({
  visibleCount,
  totalCount,
  nextPageSize,
  pageSize,
}: {
  visibleCount?: number;
  totalCount?: number;
  nextPageSize?: number;
  pageSize: number;
}): { button: string; status: string | null } {
  const chunk = nextPageSize != null && nextPageSize > 0 ? nextPageSize : pageSize;
  const button = chunk === pageSize ? `Load next ${pageSize} lines` : `Load remaining ${chunk} lines`;
  const status =
    visibleCount != null && totalCount != null
      ? `Showing ${visibleCount} of ${totalCount}`
      : null;
  return { button, status };
}

export function InfiniteScrollTableSentinel({
  colSpan,
  hasMore,
  onLoadMore,
  totalCount,
  visibleCount,
  pageSize = DEFAULT_TABLE_PAGE_SIZE,
  nextPageSize,
}: LoadMoreProps & { colSpan: number }) {
  if (!hasMore) {
    if (visibleCount != null && totalCount != null && totalCount > 0) {
      return (
        <tr className="bg-muted/10">
          <td colSpan={colSpan} className="px-3 py-2 text-center text-xs text-muted-foreground">
            Showing all {totalCount} lines
          </td>
        </tr>
      );
    }
    return null;
  }

  const { button, status } = loadMoreLabel({ visibleCount, totalCount, nextPageSize, pageSize });

  return (
    <tr className="bg-muted/10">
      <td colSpan={colSpan} className="px-3 py-3 text-center">
        <div className="flex flex-col items-center gap-2">
          {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
          <button
            type="button"
            onClick={onLoadMore}
            className="text-xs font-sans px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-muted/40 transition-colors"
          >
            {button}
          </button>
        </div>
      </td>
    </tr>
  );
}

export function InfiniteScrollDivSentinel({
  hasMore,
  onLoadMore,
  totalCount,
  visibleCount,
  pageSize = DEFAULT_TABLE_PAGE_SIZE,
  nextPageSize,
}: LoadMoreProps) {
  if (!hasMore) {
    if (visibleCount != null && totalCount != null && totalCount > 0) {
      return (
        <div className="py-2 text-center text-xs text-muted-foreground">
          Showing all {totalCount} lines
        </div>
      );
    }
    return null;
  }

  const { button, status } = loadMoreLabel({ visibleCount, totalCount, nextPageSize, pageSize });

  return (
    <div className="py-3 flex flex-col items-center gap-2">
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
      <button
        type="button"
        onClick={onLoadMore}
        className="text-xs font-sans px-4 py-2 rounded-md border border-border bg-background text-foreground hover:bg-muted/40 transition-colors"
      >
        {button}
      </button>
    </div>
  );
}
