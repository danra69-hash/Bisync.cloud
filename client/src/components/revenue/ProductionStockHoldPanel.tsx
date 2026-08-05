import { useCallback, useEffect, useState } from 'react';
import { api, type ProductionStockHold } from '../../api';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { filterSelectCls } from '../layout/formControls';
import { ColGroup } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { TableLoadingRow } from '../shared/MillstoneLoader';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function ProductionStockHoldPanel({ selectedCompanyId, selectedLocationIds }: Props) {
  const { rm, number: formatNumber } = useCountryFormatters();
  const [rows, setRows] = useState<ProductionStockHold[]>([]);
  const [status, setStatus] = useState<'held' | 'depleted' | 'all'>('held');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedCompanyId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.productionStockHolds(selectedCompanyId, selectedLocationIds, status);
      setRows(data ?? []);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'Failed to load stock hold.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, selectedLocationIds, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3">
      <PageStickyFilters opaque className="space-y-2 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Stock Hold</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Components issued from Central Store for production. Marked depleted when Produced
              confirms the batch.
            </p>
          </div>
          <select
            className={filterSelectCls}
            value={status}
            onChange={e => setStatus(e.target.value as typeof status)}
          >
            <option value="held">Held</option>
            <option value="depleted">Depleted</option>
            <option value="all">All</option>
          </select>
        </div>
      </PageStickyFilters>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <TableScrollContainer>
        <table className="w-full border-collapse text-xs">
          <ColGroup widths={['20%', '18%', '8%', '10%', '12%', '12%', '10%', '10%']} />
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-2 py-1.5">Component</th>
              <th className="px-2 py-1.5">For product</th>
              <th className="px-2 py-1.5">UOM</th>
              <th className="px-2 py-1.5 text-right">Qty</th>
              <th className="px-2 py-1.5 text-right">Unit price</th>
              <th className="px-2 py-1.5">Issued</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Depleted</th>
            </tr>
          </thead>
          <tbody>
            {!selectedCompanyId ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  Select a company to view stock hold.
                </td>
              </tr>
            ) : loading ? (
              <TableLoadingRow colSpan={8} label="Loading stock hold…" />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No held components. Issue a Central Store requisition to place stock on hold.
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.id} className="border-b border-border/70">
                  <td className="px-2 py-1.5 font-medium text-foreground">{row.componentName}</td>
                  <td className="px-2 py-1.5">{row.productName || '—'}</td>
                  <td className="px-2 py-1.5">{row.uom || '—'}</td>
                  <td className="px-2 py-1.5 text-right font-sans">{formatNumber(row.quantity)}</td>
                  <td className="px-2 py-1.5 text-right font-sans">{rm(row.unitPrice)}</td>
                  <td className="px-2 py-1.5 font-sans">{formatWhen(row.createdAt)}</td>
                  <td className="px-2 py-1.5 capitalize">{row.status}</td>
                  <td className="px-2 py-1.5 font-sans">{formatWhen(row.depletedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableScrollContainer>
    </div>
  );
}
