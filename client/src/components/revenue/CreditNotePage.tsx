import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  type ReturnableGoodsOverview,
  type ReturnableGoodsReturnRow,
} from '../../api';
import { pageShellClass } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { ColGroup } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { TableLoadingRow } from '../shared/MillstoneLoader';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';

type Props = {
  selectedCompanyId: number | null;
};

function emptyOverview(): ReturnableGoodsOverview {
  return { ledger: [], summary: [], returns: [] };
}

function formatReturnDate(value: string) {
  if (!value) return '—';
  const d = value.slice(0, 10);
  return d || value;
}

export function CreditNotePage({ selectedCompanyId }: Props) {
  const { rm, number: formatNumber } = useCountryFormatters();
  const [overview, setOverview] = useState<ReturnableGoodsOverview>(emptyOverview());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedCompanyId) {
      setOverview(emptyOverview());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.returnableGoods(selectedCompanyId);
      setOverview(data ?? emptyOverview());
    } catch (e) {
      setOverview(emptyOverview());
      setError(e instanceof Error ? e.message : 'Failed to load credit notes.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const returns = useMemo(() => {
    const rows = [...(overview.returns ?? [])];
    rows.sort((a, b) => {
      const byDate = (b.returnDate || '').localeCompare(a.returnDate || '');
      if (byDate !== 0) return byDate;
      return (b.id ?? 0) - (a.id ?? 0);
    });
    return rows;
  }, [overview.returns]);

  const totalAmount = useMemo(
    () => returns.reduce((sum, row) => sum + (row.amount || 0), 0),
    [returns],
  );

  return (
    <div className={pageShellClass()}>
      <PageStickyFilters opaque className="space-y-3 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">Credit Note</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vendor credit notes recorded from returnable goods returns.
            </p>
          </div>
          {selectedCompanyId && returns.length > 0 ? (
            <p className="text-xs text-muted-foreground font-sans">
              {returns.length} note{returns.length === 1 ? '' : 's'} · {rm(totalAmount)}
            </p>
          ) : null}
        </div>
      </PageStickyFilters>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}

      <TableScrollContainer>
        <table className="w-full border-collapse text-xs">
          <ColGroup widths={['16%', '12%', '22%', '8%', '10%', '12%', '12%']} />
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-2 py-1.5">Credit note #</th>
              <th className="px-2 py-1.5">Return date</th>
              <th className="px-2 py-1.5">Returnable item</th>
              <th className="px-2 py-1.5">UOM</th>
              <th className="px-2 py-1.5 text-right">Qty</th>
              <th className="px-2 py-1.5 text-right">Unit price</th>
              <th className="px-2 py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {!selectedCompanyId ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Select a company to view credit notes.
                </td>
              </tr>
            ) : loading ? (
              <TableLoadingRow colSpan={7} label="Loading credit notes…" />
            ) : returns.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No credit notes yet. Record a return under Returnable Goods to create one.
                </td>
              </tr>
            ) : (
              returns.map((row: ReturnableGoodsReturnRow) => (
                <tr key={row.id} className="border-b border-border/70">
                  <td className="px-2 py-1.5 font-medium text-foreground font-sans">
                    {row.creditNoteNumber || '—'}
                  </td>
                  <td className="px-2 py-1.5 font-sans">{formatReturnDate(row.returnDate)}</td>
                  <td className="px-2 py-1.5 text-foreground">{row.returnableItemName || '—'}</td>
                  <td className="px-2 py-1.5">{row.uom || '—'}</td>
                  <td className="px-2 py-1.5 text-right font-sans">{formatNumber(row.quantity)}</td>
                  <td className="px-2 py-1.5 text-right font-sans">{rm(row.unitPrice)}</td>
                  <td className="px-2 py-1.5 text-right font-sans">{rm(row.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableScrollContainer>
    </div>
  );
}
