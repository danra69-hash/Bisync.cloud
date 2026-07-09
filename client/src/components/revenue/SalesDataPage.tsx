import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, type SalesDataRow } from '../../api';
import { formatRm } from '../../data/createOrder';
import { pageShellClass, TABLE_SCROLL_CLS } from '../layout/pageLayout';
import { filterSelectCls } from '../layout/formControls';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { tableHeaderCls } from '../shared/tableHeaderStyles';
import {
  currentStockCardMonth,
  earliestStockCardMonth,
  formatStockCardMonthLabel,
} from './stockCardPeriod';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  embedded?: boolean;
};

type ViewBy = 'product' | 'customer';

const tdCls = 'px-3 py-2.5 align-middle border-r border-b border-border last:border-r-0 text-xs';
const filterCls = filterSelectCls;

function formatQty(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  return value.toFixed(2);
}

function formatDisplayDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupKey(row: SalesDataRow, viewBy: ViewBy): string {
  return viewBy === 'customer'
    ? row.customerName || 'Walk-in'
    : row.productName || '—';
}

export function SalesDataPage({ selectedCompanyId, selectedLocationIds, embedded = false }: Props) {
  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;
  const [selectedMonth, setSelectedMonth] = useState(currentStockCardMonth);
  const [viewBy, setViewBy] = useState<ViewBy>('product');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    totalQuantity: 0,
    totalValue: 0,
    lineCount: 0,
    productCount: 0,
    customerCount: 0,
  });
  const [rows, setRows] = useState<SalesDataRow[]>([]);

  const loadData = useCallback(async () => {
    if (!selectedCompanyId || selectedLocationIds.length === 0) {
      setRows([]);
      setSummary({
        totalQuantity: 0,
        totalValue: 0,
        lineCount: 0,
        productCount: 0,
        customerCount: 0,
      });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.salesData(
        selectedCompanyId,
        selectedLocationIds,
        selectedMonth,
        viewBy,
      );
      setRows(result.rows);
      setSummary(result.summary);
    } catch (e) {
      setRows([]);
      setSummary({
        totalQuantity: 0,
        totalValue: 0,
        lineCount: 0,
        productCount: 0,
        customerCount: 0,
      });
      setError(e instanceof Error ? e.message : 'Failed to load sales data.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, selectedLocationIds, selectedMonth, viewBy]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const groupedRows = useMemo(() => {
    const groups: { key: string; rows: SalesDataRow[] }[] = [];
    let currentKey = '';
    for (const row of rows) {
      const key = groupKey(row, viewBy);
      if (key !== currentKey) {
        groups.push({ key, rows: [row] });
        currentKey = key;
      } else {
        groups[groups.length - 1].rows.push(row);
      }
    }
    return groups;
  }, [rows, viewBy]);

  return (
    <div className={pageShellClass({ embedded })}>
      {!orgReady ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg px-4 py-5 text-center">
          Select a company and at least one location in the header to view sales data.
        </p>
      ) : (
        <>
          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Filters</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1 shrink-0">
                <label className="text-xs text-muted-foreground uppercase tracking-wider" htmlFor="sales-data-month">
                  Month
                </label>
                <input
                  id="sales-data-month"
                  type="month"
                  value={selectedMonth}
                  min={earliestStockCardMonth()}
                  max={currentStockCardMonth()}
                  onChange={e => {
                    if (e.target.value) setSelectedMonth(e.target.value);
                  }}
                  className={`${filterCls} min-w-[140px]`}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">View by</span>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={viewBy === 'product'}
                      onChange={() => setViewBy('product')}
                      className="rounded border-border"
                    />
                    Product
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={viewBy === 'customer'}
                      onChange={() => setViewBy('customer')}
                      className="rounded border-border"
                    />
                    Customer
                  </label>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground shrink-0 pb-1">
                {formatStockCardMonthLabel(selectedMonth, selectedMonth === currentStockCardMonth())}
              </p>

              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[11px] font-medium hover:bg-muted disabled:opacity-50 shrink-0 ml-auto"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="rounded-lg border border-border bg-card px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total QTY Sold</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{formatQty(summary.totalQuantity)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Value</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{formatRm(summary.totalValue)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Lines</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{summary.lineCount}</p>
            </div>
            <div className="rounded-lg border border-border bg-card px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Products</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{summary.productCount}</p>
            </div>
            <div className="rounded-lg border border-border bg-card px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Customers</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{summary.customerCount}</p>
            </div>
          </div>

          {error ? (
            <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
              {error}
            </p>
          ) : null}

          <TableScrollContainer className={TABLE_SCROLL_CLS}>
            <table className="w-full border-collapse min-w-[60rem]">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className={tableHeaderCls('left')}>Date</th>
                  <th className={tableHeaderCls('left')}>Category / Group</th>
                  <th className={tableHeaderCls('left')}>Product Name</th>
                  <th className={tableHeaderCls('left')}>UOM</th>
                  <th className={tableHeaderCls('left')}>Type</th>
                  <th className={tableHeaderCls('left')}>Sales channel</th>
                  <th className={tableHeaderCls('right')}>QTY Sold</th>
                  <th className={tableHeaderCls('right')}>RRP</th>
                  <th className={tableHeaderCls('right')}>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      Loading sales data…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      No sales data for this month.
                    </td>
                  </tr>
                ) : (
                  groupedRows.flatMap(group => [
                    <tr key={`group-${group.key}`} className="bg-muted/30 border-b border-border">
                      <td colSpan={9} className="px-3 py-2 text-[11px] font-semibold text-foreground">
                        {viewBy === 'customer' ? `Customer: ${group.key}` : `Product: ${group.key}`}
                        <span className="text-muted-foreground font-normal ml-2">
                          ({group.rows.length} line{group.rows.length !== 1 ? 's' : ''})
                        </span>
                      </td>
                    </tr>,
                    ...group.rows.map((row, index) => (
                      <tr key={`${group.key}-${row.date}-${row.productName}-${index}`} className="hover:bg-muted/20 border-b border-border">
                        <td className={tdCls}>{formatDisplayDate(row.date)}</td>
                        <td className={tdCls}>
                          <p>{row.category || '—'}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{row.group || '—'}</p>
                        </td>
                        <td className={tdCls}>
                          <p className="font-medium">{row.productName}</p>
                          {viewBy === 'customer' ? null : (
                            <p className="text-[10px] text-muted-foreground mt-0.5">{row.customerName || 'Walk-in'}</p>
                          )}
                        </td>
                        <td className={tdCls}>{row.uom || '—'}</td>
                        <td className={tdCls}>{row.productType || '—'}</td>
                        <td className={tdCls}>{row.salesChannel || '—'}</td>
                        <td className={`${tdCls} text-right tabular-nums`}>{formatQty(row.qtySold)}</td>
                        <td className={`${tdCls} text-right tabular-nums`}>{formatMoney(row.rrp)}</td>
                        <td className={`${tdCls} text-right tabular-nums font-medium`}>{formatMoney(row.totalValue)}</td>
                      </tr>
                    )),
                  ])
                )}
              </tbody>
            </table>
          </TableScrollContainer>
        </>
      )}
    </div>
  );
}
