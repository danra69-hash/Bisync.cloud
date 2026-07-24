import { useEffect, useMemo, useState } from 'react';
import { api, type ProductAuditResult } from '../../api';
import { inputCls, selectCls } from '../../data/componentForm';
import { pageShellClass } from '../layout/pageLayout';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { MillstoneLoader } from '../shared/MillstoneLoader';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';
import {
  currentStockCardMonth,
  formatStockCardMonthLabel,
} from './stockCardPeriod';

type Props = {
  selectedCompanyId: number | null;
};

const MONTH_COUNT = 24;

function lastMonthOptions(): string[] {
  const now = new Date();
  const options: string[] = [];
  for (let i = 0; i < MONTH_COUNT; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    options.push(`${d.getFullYear()}-${month}`);
  }
  return options;
}

function formatEffectiveDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ProductAuditPage({ selectedCompanyId }: Props) {
  useRevMgmtPageLabel('Product Audit');
  const months = useMemo(() => lastMonthOptions(), []);
  const [month, setMonth] = useState(currentStockCardMonth);
  const [result, setResult] = useState<ProductAuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState('');

  useEffect(() => {
    if (!selectedCompanyId) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.productAudit(selectedCompanyId, month)
      .then(data => {
        if (!cancelled) setResult(data);
      })
      .catch(err => {
        if (cancelled) return;
        setResult(null);
        setError(err instanceof Error ? err.message : 'Failed to load product audit.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedCompanyId, month]);

  const rows = useMemo(() => {
    const all = result?.rows ?? [];
    const q = productFilter.trim().toLowerCase();
    if (!q) return all;
    return all.filter(r =>
      r.productId.toLowerCase().includes(q)
      || r.productName.toLowerCase().includes(q)
      || r.changes.toLowerCase().includes(q));
  }, [result, productFilter]);

  if (!selectedCompanyId) {
    return (
      <div className={pageShellClass()}>
        <p className="text-sm text-muted-foreground">Select a company to view product audit.</p>
      </div>
    );
  }

  return (
    <div className={pageShellClass()}>
      <div
        data-page-filters
        className="flex flex-wrap items-end gap-3 border-b border-border/60 bg-background/95 pb-3 backdrop-blur-sm"
      >
        <label className="space-y-1">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Month</span>
          <select
            className={`${selectCls} min-w-[12rem]`}
            value={month}
            onChange={e => setMonth(e.target.value)}
          >
            {months.map(m => (
              <option key={m} value={m}>
                {formatStockCardMonthLabel(m, m === currentStockCardMonth())}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 min-w-[14rem] flex-1">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Search</span>
          <input
            className={inputCls}
            value={productFilter}
            onChange={e => setProductFilter(e.target.value)}
            placeholder="Product ID, name, or change…"
          />
        </label>
        <p className="text-xs text-muted-foreground pb-2">
          {loading ? 'Loading…' : `${rows.length} change${rows.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {error && <p className="text-sm text-destructive pt-3">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-12"><MillstoneLoader /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center border border-dashed border-border rounded-lg mt-4">
          No product changes recorded for {formatStockCardMonthLabel(month)}.
        </p>
      ) : (
        <div className="mt-3 bg-card border border-border rounded-lg overflow-hidden">
          <TableScrollContainer className="max-h-[calc(100vh-14rem)] overflow-y-auto">
            <table className="w-full min-w-[880px] text-left border-collapse">
              <thead className="bg-muted/40 sticky top-0 z-10">
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold border-b border-border">Product ID</th>
                  <th className="px-3 py-2 font-semibold border-b border-border">Product Name</th>
                  <th className="px-3 py-2 font-semibold border-b border-border">Changes</th>
                  <th className="px-3 py-2 font-semibold border-b border-border">Changes from</th>
                  <th className="px-3 py-2 font-semibold border-b border-border">Changes to</th>
                  <th className="px-3 py-2 font-semibold border-b border-border">Effective Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.productId}-${row.effectiveDate}-${row.changes}-${index}`} className="text-xs hover:bg-muted/20">
                    <td className="px-3 py-2.5 border-b border-border font-mono">{row.productId || '—'}</td>
                    <td className="px-3 py-2.5 border-b border-border font-medium">{row.productName || '—'}</td>
                    <td className="px-3 py-2.5 border-b border-border">{row.changes || '—'}</td>
                    <td className="px-3 py-2.5 border-b border-border text-muted-foreground whitespace-pre-wrap break-words max-w-[16rem]">
                      {row.changesFrom || '—'}
                    </td>
                    <td className="px-3 py-2.5 border-b border-border whitespace-pre-wrap break-words max-w-[16rem]">
                      {row.changesTo || '—'}
                    </td>
                    <td className="px-3 py-2.5 border-b border-border whitespace-nowrap">
                      {formatEffectiveDate(row.effectiveDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScrollContainer>
        </div>
      )}
    </div>
  );
}
