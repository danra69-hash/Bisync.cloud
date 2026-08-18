import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { pageShellClass, TABLE_SCROLL_CLS } from '../../layout/pageLayout';
import { PageStickyFilters } from '../../layout/PageStickyFilters';
import { filterSelectCls } from '../../layout/formControls';
import { ColGroup } from '../../shared/SortableTableHead';
import { TableScrollContainer } from '../../shared/TableScrollContainer';
import { tableHeaderCls } from '../../shared/tableHeaderStyles';
import { TableLoadingRow } from '../../shared/MillstoneLoader';
import { useInfiniteScrollSlice } from '../../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../../shared/infiniteScroll';
import {
  currentStockCardMonth,
  formatStockCardMonthLabel,
} from '../stockCardPeriod';
import { downloadReportCsv } from '../../../data/reportExport';

export type ReportColumn = {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: string | number;
  format?: (value: unknown, row: Record<string, unknown>) => ReactNode;
};

export type ReportMetric = {
  label: string;
  value: ReactNode;
};

type Props = {
  title: string;
  description?: string;
  tableId: string;
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  metrics?: ReportMetric[];
  loading?: boolean;
  error?: string | null;
  period: string;
  onPeriodChange: (period: string) => void;
  onRefresh: () => void;
  csvFilename: string;
  extraFilters?: ReactNode;
  /** When false, hide the built-in month period select (use extraFilters instead). */
  showPeriodSelect?: boolean;
  visual?: ReactNode;
  /** When true, render the chart/visual before metric cards. */
  visualFirst?: boolean;
  secondaryTable?: {
    title: string;
    columns: ReportColumn[];
    rows: Record<string, unknown>[];
  };
};

function last24MonthOptions(): string[] {
  const now = new Date();
  const options: string[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return options;
}

function defaultFormat(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    return Number.isInteger(value) ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(value);
}

export function ReportPageShell({
  title,
  description,
  tableId,
  selectedCompanyId,
  selectedLocationIds,
  columns,
  rows,
  metrics = [],
  loading = false,
  error = null,
  period,
  onPeriodChange,
  onRefresh,
  csvFilename,
  extraFilters,
  showPeriodSelect = true,
  visual,
  visualFirst = false,
  secondaryTable,
}: Props) {
  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;
  const periods = useMemo(() => last24MonthOptions(), []);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(row =>
      columns.some(col => String(row[col.key] ?? '').toLowerCase().includes(q)),
    );
  }, [rows, search, columns]);

  const { visibleItems, hasMore, totalCount, visibleCount, nextPageSize, loadMore } =
    useInfiniteScrollSlice(filtered, { scrollRootRef });

  const widths = columns.map(c => c.width ?? `${Math.max(10, Math.floor(100 / columns.length))}%`);

  return (
    <div className={pageShellClass()}>
      <PageStickyFilters className="px-3 py-2 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
          ) : null}
        </div>
        {showPeriodSelect ? (
          <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Period
            <select
              className={filterSelectCls}
              value={period}
              onChange={e => onPeriodChange(e.target.value)}
              disabled={!orgReady}
            >
              {periods.map(m => (
                <option key={m} value={m}>
                  {formatStockCardMonthLabel(m, m === currentStockCardMonth())}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {extraFilters}
        <label className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground min-w-[10rem]">
          Search
          <input
            className={filterSelectCls}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter rows…"
            disabled={!orgReady}
          />
        </label>
        <button
          type="button"
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border bg-card text-xs font-semibold disabled:opacity-50"
          onClick={onRefresh}
          disabled={!orgReady || loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} />
          Refresh
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
          onClick={() => downloadReportCsv(csvFilename, columns, filtered)}
          disabled={!orgReady || filtered.length === 0}
        >
          <Download size={14} />
          Export CSV
        </button>
      </PageStickyFilters>

      {!orgReady ? (
        <p className="px-3 py-6 text-sm text-muted-foreground">
          Select a company and at least one location to run this report.
        </p>
      ) : (
        <div className="p-2 sm:p-3 space-y-3">
          {error ? (
            <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
              {error}
            </p>
          ) : null}

          {visualFirst ? visual : null}

          {metrics.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {metrics.map(metric => (
                <div
                  key={metric.label}
                  className="rounded-lg border border-border bg-card px-3 py-2"
                >
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    {metric.label}
                  </p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{metric.value}</p>
                </div>
              ))}
            </div>
          ) : null}

          {!visualFirst ? visual : null}

          <TableScrollContainer
            ref={scrollRootRef}
            className={TABLE_SCROLL_CLS}
            tableId={tableId}
          >
            <table className="w-full border-collapse text-sm">
              <ColGroup widths={widths} columnKeys={columns.map(c => c.key)} />
              <thead>
                <tr className="border-b border-border">
                  {columns.map(col => (
                    <th
                      key={col.key}
                      data-col-key={col.key}
                      className={tableHeaderCls(col.align ?? 'left')}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableLoadingRow colSpan={columns.length} label="Loading report…" />
                ) : visibleItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-3 py-8 text-center text-xs text-muted-foreground"
                    >
                      No rows for {formatStockCardMonthLabel(period)}.
                    </td>
                  </tr>
                ) : (
                  visibleItems.map((row, index) => (
                    <tr key={index} className="border-b border-border/60 hover:bg-muted/20">
                      {columns.map(col => (
                        <td
                          key={col.key}
                          className={`px-2 py-1.5 text-xs align-top ${
                            col.align === 'right'
                              ? 'text-right'
                              : col.align === 'center'
                                ? 'text-center'
                                : 'text-left'
                          }`}
                        >
                          {col.format
                            ? col.format(row[col.key], row)
                            : defaultFormat(row[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
                <InfiniteScrollTableSentinel
                  colSpan={columns.length}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                  nextPageSize={nextPageSize}
                  totalCount={totalCount}
                  visibleCount={visibleCount}
                />
              </tbody>
            </table>
          </TableScrollContainer>

          {secondaryTable && secondaryTable.rows.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {secondaryTable.title}
              </h3>
              <TableScrollContainer
                className="overflow-x-auto rounded-lg border border-border bg-card max-h-[18rem] overflow-y-auto"
                tableId={`${tableId}.secondary`}
              >
                <table className="w-full border-collapse text-sm">
                  <ColGroup
                    widths={secondaryTable.columns.map(
                      c => c.width ?? `${Math.max(12, Math.floor(100 / secondaryTable.columns.length))}%`,
                    )}
                    columnKeys={secondaryTable.columns.map(c => c.key)}
                  />
                  <thead>
                    <tr className="border-b border-border">
                      {secondaryTable.columns.map(col => (
                        <th
                          key={col.key}
                          data-col-key={col.key}
                          className={tableHeaderCls(col.align ?? 'left')}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {secondaryTable.rows.map((row, index) => (
                      <tr key={index} className="border-b border-border/60">
                        {secondaryTable.columns.map(col => (
                          <td
                            key={col.key}
                            className={`px-2 py-1.5 text-xs ${
                              col.align === 'right' ? 'text-right' : 'text-left'
                            }`}
                          >
                            {col.format
                              ? col.format(row[col.key], row)
                              : defaultFormat(row[col.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScrollContainer>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
