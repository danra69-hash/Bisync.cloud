import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, X } from 'lucide-react';
import {
  api,
  type ReturnableGoodsLedgerRow,
  type ReturnableGoodsOverview,
  type ReturnableGoodsSummaryRow,
} from '../../api';
import { pageShellClass } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { filterSelectCls, inlineNumberCls } from '../layout/formControls';
import { ColGroup } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { MillstoneLoader, TableLoadingRow } from '../shared/MillstoneLoader';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import {
  DETAIL_PANEL_OVERLAY_ELEVATED_CLS,
  DETAIL_PANEL_SHELL_ELEVATED_CLS,
} from '../layout/sidePanelShared';

type Props = {
  selectedCompanyId: number | null;
};

function toDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function emptyOverview(): ReturnableGoodsOverview {
  return { ledger: [], summary: [], returns: [] };
}

export function ReturnableGoodsPage({ selectedCompanyId }: Props) {
  const { rm, uomPrice, number: formatNumber } = useCountryFormatters();
  const [overview, setOverview] = useState<ReturnableGoodsOverview>(emptyOverview());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState('');
  const [qtyReturned, setQtyReturned] = useState('');
  const [returnDate, setReturnDate] = useState(toDateInputValue());
  const [creditNoteNumber, setCreditNoteNumber] = useState('');
  const [savingReturn, setSavingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

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
      setError(e instanceof Error ? e.message : 'Failed to load returnable goods.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summaryByName = useMemo(() => {
    const map = new Map<string, ReturnableGoodsSummaryRow>();
    for (const row of overview.summary) {
      map.set(row.returnableItemName.toLowerCase(), row);
    }
    return map;
  }, [overview.summary]);

  const selectedSummary = selectedItem
    ? summaryByName.get(selectedItem.toLowerCase()) ?? null
    : null;

  const uom = selectedSummary?.uom ?? '';
  const unitPrice = selectedSummary?.unitPrice ?? 0;
  const qty = parseFloat(qtyReturned) || 0;
  const totalSum = qty * unitPrice;

  function openReturnModal() {
    setReturnError(null);
    setQtyReturned('');
    setCreditNoteNumber('');
    setReturnDate(toDateInputValue());
    const first = overview.summary.find(row => row.balanceQty > 0)?.returnableItemName
      ?? overview.summary[0]?.returnableItemName
      ?? '';
    setSelectedItem(first);
    setReturnOpen(true);
  }

  async function submitReturn() {
    if (!selectedCompanyId) {
      setReturnError('Select a company in the header.');
      return;
    }
    if (!selectedItem.trim()) {
      setReturnError('Select a returnable item.');
      return;
    }
    if (qty <= 0) {
      setReturnError('Enter quantity returned.');
      return;
    }
    if (!creditNoteNumber.trim()) {
      setReturnError('Credit note number is required.');
      return;
    }
    setSavingReturn(true);
    setReturnError(null);
    try {
      await api.createReturnableGoodsReturn({
        companyId: selectedCompanyId,
        returnableItemName: selectedItem.trim(),
        quantity: qty,
        uom,
        unitPrice,
        returnDate,
        creditNoteNumber: creditNoteNumber.trim(),
      });
      setReturnOpen(false);
      await load();
    } catch (e) {
      setReturnError(e instanceof Error ? e.message : 'Failed to save return.');
    } finally {
      setSavingReturn(false);
    }
  }

  return (
    <div className={pageShellClass()}>
      <PageStickyFilters opaque className="space-y-3 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">Returnable Goods</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track container deposits from purchase orders and record returns against credit notes.
            </p>
          </div>
          <button
            type="button"
            onClick={openReturnModal}
            disabled={!selectedCompanyId || overview.summary.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            <RotateCcw size={14} />
            Returned
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <p className="text-[11px] font-sans uppercase tracking-wider text-muted-foreground">
            Deposit situation
          </p>
          {!selectedCompanyId ? (
            <p className="text-xs text-muted-foreground">Select a company to view returnable deposits.</p>
          ) : loading ? (
            <MillstoneLoader label="Loading deposit summary…" />
          ) : overview.summary.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No returnable deposits yet. Enable Returnable deposit on a vendor product and place an order.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <ColGroup widths={['22%', '8%', '14%', '14%', '14%', '14%', '14%']} />
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-2 py-1.5">Returnable goods</th>
                    <th className="px-2 py-1.5">UOM</th>
                    <th className="px-2 py-1.5 text-right">Incoming qty</th>
                    <th className="px-2 py-1.5 text-right">Incoming amt</th>
                    <th className="px-2 py-1.5 text-right">Returned qty</th>
                    <th className="px-2 py-1.5 text-right">Returned amt</th>
                    <th className="px-2 py-1.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.summary.map(row => (
                    <tr key={row.returnableItemName} className="border-b border-border/70">
                      <td className="px-2 py-1.5 font-medium text-foreground">{row.returnableItemName}</td>
                      <td className="px-2 py-1.5">{row.uom || '—'}</td>
                      <td className="px-2 py-1.5 text-right font-sans">{formatNumber(row.incomingQty)}</td>
                      <td className="px-2 py-1.5 text-right font-sans">{rm(row.incomingAmount)}</td>
                      <td className="px-2 py-1.5 text-right font-sans">{formatNumber(row.returnedQty)}</td>
                      <td className="px-2 py-1.5 text-right font-sans">{rm(row.returnedAmount)}</td>
                      <td className="px-2 py-1.5 text-right font-sans">
                        {formatNumber(row.balanceQty)} / {rm(row.balanceAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageStickyFilters>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}

      <TableScrollContainer>
        <table className="w-full border-collapse text-xs">
          <ColGroup widths={['22%', '10%', '12%', '10%', '14%', '14%']} />
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-2 py-1.5">Returnable Item Name</th>
              <th className="px-2 py-1.5">UOM</th>
              <th className="px-2 py-1.5 text-right">UOM Price</th>
              <th className="px-2 py-1.5 text-right">QTY</th>
              <th className="px-2 py-1.5 text-right">Amount total</th>
              <th className="px-2 py-1.5">PO number</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={6} label="Loading returnable ledger…" />
            ) : overview.ledger.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No returnable deposit lines on purchase orders yet.
                </td>
              </tr>
            ) : (
              overview.ledger.map((row: ReturnableGoodsLedgerRow) => (
                <tr key={row.id} className="border-b border-border/70">
                  <td className="px-2 py-1.5 font-medium text-foreground">{row.returnableItemName}</td>
                  <td className="px-2 py-1.5">{row.uom || '—'}</td>
                  <td className="px-2 py-1.5 text-right font-sans">{uomPrice(row.uomPrice)}</td>
                  <td className="px-2 py-1.5 text-right font-sans">{formatNumber(row.qty)}</td>
                  <td className="px-2 py-1.5 text-right font-sans">{rm(row.amountTotal)}</td>
                  <td className="px-2 py-1.5 font-sans">{row.poNumber || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableScrollContainer>

      {returnOpen
        ? createPortal(
            <div className={DETAIL_PANEL_OVERLAY_ELEVATED_CLS}>
              <div className={`${DETAIL_PANEL_SHELL_ELEVATED_CLS} max-w-lg w-full p-4 space-y-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Record return</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Offset deposit balance with a vendor credit note.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReturnOpen(false)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Returnable item</span>
                    <select
                      className={filterSelectCls}
                      value={selectedItem}
                      onChange={e => {
                        setSelectedItem(e.target.value);
                        setQtyReturned('');
                      }}
                    >
                      <option value="">Select item</option>
                      {overview.summary.map(row => (
                        <option key={row.returnableItemName} value={row.returnableItemName}>
                          {row.returnableItemName} (bal {formatNumber(row.balanceQty)})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">QTY returned</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className={inlineNumberCls}
                        value={qtyReturned}
                        onChange={e => setQtyReturned(e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">UOM</span>
                      <input className={filterSelectCls} value={uom} readOnly />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">UOM Price</span>
                      <input className={filterSelectCls} value={uomPrice(unitPrice)} readOnly />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Sum</span>
                      <input className={filterSelectCls} value={rm(totalSum)} readOnly />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Date</span>
                    <input
                      type="date"
                      className={filterSelectCls}
                      value={returnDate}
                      max={toDateInputValue()}
                      onChange={e => setReturnDate(e.target.value)}
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Credit Note Number</span>
                    <input
                      className={filterSelectCls}
                      value={creditNoteNumber}
                      onChange={e => setCreditNoteNumber(e.target.value)}
                      placeholder="CN-…"
                    />
                  </label>
                </div>

                {returnError ? <p className="text-xs text-destructive">{returnError}</p> : null}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setReturnOpen(false)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitReturn()}
                    disabled={savingReturn}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {savingReturn ? 'Saving…' : 'Save return'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
