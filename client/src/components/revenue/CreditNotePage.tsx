import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Plus, Search, X } from 'lucide-react';
import {
  api,
  type CreditNotePoSearchItem,
  type CreditNotePoSearchRow,
  type CreditNoteRow,
} from '../../api';
import { pageShellClass } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { filterSelectCls, inlineNumberCls } from '../layout/formControls';
import { ColGroup } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { TableLoadingRow } from '../shared/MillstoneLoader';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import {
  DETAIL_PANEL_OVERLAY_ELEVATED_CLS,
  DETAIL_PANEL_SHELL_ELEVATED_CLS,
} from '../layout/sidePanelShared';

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
};

function toDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(value: string) {
  if (!value) return '—';
  return value.slice(0, 10) || value;
}

const fieldCls =
  'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40';
const labelCls = 'block text-[11px] font-sans uppercase tracking-wide text-muted-foreground mb-1';

export function CreditNotePage({ selectedCompanyId, selectedLocationIds }: Props) {
  const { rm, number: formatNumber } = useCountryFormatters();
  const primaryLocation = selectedLocationIds[0] ?? '';

  const [rows, setRows] = useState<CreditNoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [poQuery, setPoQuery] = useState('');
  const [poResults, setPoResults] = useState<CreditNotePoSearchRow[]>([]);
  const [poSearching, setPoSearching] = useState(false);
  const [selectedPo, setSelectedPo] = useState<CreditNotePoSearchRow | null>(null);
  const [selectedItem, setSelectedItem] = useState<CreditNotePoSearchItem | null>(null);
  const [creditQty, setCreditQty] = useState('');
  const [creditNoteNumber, setCreditNoteNumber] = useState('');
  const [creditNoteDate, setCreditNoteDate] = useState(toDateInputValue());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [detailRow, setDetailRow] = useState<CreditNoteRow | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [savingNumber, setSavingNumber] = useState(false);
  const [cancelPoNumber, setCancelPoNumber] = useState('');
  const [cancelDoOrInvoice, setCancelDoOrInvoice] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedCompanyId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.creditNotes(selectedCompanyId, selectedLocationIds);
      setRows(data ?? []);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'Failed to load credit notes.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, selectedLocationIds]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!createOpen || !selectedCompanyId) return;
    const q = poQuery.trim();
    const handle = window.setTimeout(() => {
      void (async () => {
        setPoSearching(true);
        try {
          const data = await api.searchCreditNotePurchaseOrders(selectedCompanyId, q);
          setPoResults(data ?? []);
        } catch {
          setPoResults([]);
        } finally {
          setPoSearching(false);
        }
      })();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [createOpen, selectedCompanyId, poQuery]);

  const creditedAmount = useMemo(() => {
    const qty = parseFloat(creditQty) || 0;
    const price = selectedItem?.unitPrice ?? 0;
    return qty * price;
  }, [creditQty, selectedItem]);

  const activeAmount = useMemo(
    () => rows.filter(r => r.status === 'confirmed').reduce((s, r) => s + (r.amount || 0), 0),
    [rows],
  );

  function openCreate() {
    setFormError(null);
    setPoQuery('');
    setPoResults([]);
    setSelectedPo(null);
    setSelectedItem(null);
    setCreditQty('');
    setCreditNoteNumber('');
    setCreditNoteDate(toDateInputValue());
    setCreateOpen(true);
  }

  function selectPo(po: CreditNotePoSearchRow) {
    setSelectedPo(po);
    setSelectedItem(null);
    setCreditQty('');
    setFormError(null);
  }

  function selectItem(item: CreditNotePoSearchItem) {
    setSelectedItem(item);
    setCreditQty('');
    setFormError(null);
  }

  async function saveCreditNote() {
    if (!selectedCompanyId) {
      setFormError('Select a company first.');
      return;
    }
    if (!selectedPo) {
      setFormError('Select a purchase order.');
      return;
    }
    if (!selectedItem) {
      setFormError('Select a vendor product from the PO.');
      return;
    }
    const qty = parseFloat(creditQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError('Enter a credit quantity greater than zero.');
      return;
    }
    if (qty > (selectedItem.deliveredQuantity || 0) + 0.0001) {
      setFormError(`Credit qty cannot exceed delivered qty (${selectedItem.deliveredQuantity}).`);
      return;
    }
    if (!creditNoteDate.trim()) {
      setFormError('Credit note date is required.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await api.createCreditNote({
        companyId: selectedCompanyId,
        purchaseOrderId: selectedPo.id,
        purchaseOrderItemId: selectedItem.id,
        quantity: qty,
        creditNoteNumber: creditNoteNumber.trim() || undefined,
        creditNoteDate,
        locationExternalId:
          primaryLocation
          || selectedPo.locationExternalIds?.[0]
          || undefined,
      });
      setCreateOpen(false);
      setSelectedPo(null);
      setSelectedItem(null);
      setCreditQty('');
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to save credit note.');
    } finally {
      setSaving(false);
    }
  }

  function openDetail(row: CreditNoteRow) {
    setDetailRow(row);
    setEditNumber(row.creditNoteNumber || '');
    setCancelPoNumber('');
    setCancelDoOrInvoice('');
    setDetailError(null);
  }

  async function saveNumber() {
    if (!selectedCompanyId || !detailRow) return;
    setSavingNumber(true);
    setDetailError(null);
    try {
      const updated = await api.updateCreditNoteNumber(
        detailRow.id,
        selectedCompanyId,
        editNumber.trim(),
      );
      setRows(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      setDetailRow(null);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Failed to update credit note number.');
    } finally {
      setSavingNumber(false);
    }
  }

  async function cancelCreditNote() {
    if (!selectedCompanyId || !detailRow) return;
    if (!cancelPoNumber.trim() || !cancelDoOrInvoice.trim()) {
      setDetailError('Enter the replacement PO number and DO or invoice number.');
      return;
    }
    setCancelling(true);
    setDetailError(null);
    try {
      const updated = await api.cancelCreditNote(detailRow.id, {
        companyId: selectedCompanyId,
        cancelPoNumber: cancelPoNumber.trim(),
        cancelDoOrInvoiceNumber: cancelDoOrInvoice.trim(),
      });
      setRows(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      setDetailRow(null);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Failed to cancel credit note.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className={pageShellClass()}>
      <PageStickyFilters opaque className="space-y-3 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">Credit Note</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Credit short deliveries against a PO. Confirming adjusts stock outbound; cancel only
              after a free replacement receipt to revalue zero-cost stock.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {selectedCompanyId && rows.length > 0 ? (
              <p className="text-xs text-muted-foreground font-sans">
                Active {rm(activeAmount)}
              </p>
            ) : null}
            <button
              type="button"
              onClick={openCreate}
              disabled={!selectedCompanyId}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              <Plus size={14} />
              Create credit note
            </button>
          </div>
        </div>
      </PageStickyFilters>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <TableScrollContainer>
        <table className="w-full border-collapse text-xs">
          <ColGroup widths={['12%', '10%', '12%', '10%', '18%', '8%', '8%', '10%', '12%']} />
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-2 py-1.5">Credit note #</th>
              <th className="px-2 py-1.5">Date</th>
              <th className="px-2 py-1.5">PO</th>
              <th className="px-2 py-1.5">Vendor</th>
              <th className="px-2 py-1.5">Product</th>
              <th className="px-2 py-1.5">UOM</th>
              <th className="px-2 py-1.5 text-right">Qty</th>
              <th className="px-2 py-1.5 text-right">Amount</th>
              <th className="px-2 py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {!selectedCompanyId ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  Select a company to view credit notes.
                </td>
              </tr>
            ) : loading ? (
              <TableLoadingRow colSpan={9} label="Loading credit notes…" />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  No credit notes yet. Create one against a received purchase order.
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr
                  key={row.id}
                  className="border-b border-border/70 cursor-pointer hover:bg-muted/40"
                  onClick={() => openDetail(row)}
                >
                  <td className="px-2 py-1.5 font-medium font-sans text-foreground">
                    {row.creditNoteNumber || '—'}
                  </td>
                  <td className="px-2 py-1.5 font-sans">{formatDate(row.creditNoteDate)}</td>
                  <td className="px-2 py-1.5 font-sans">{row.poNumber || '—'}</td>
                  <td className="px-2 py-1.5">{row.vendorName || '—'}</td>
                  <td className="px-2 py-1.5 text-foreground">{row.productName || '—'}</td>
                  <td className="px-2 py-1.5">{row.deliveryUom || '—'}</td>
                  <td className="px-2 py-1.5 text-right font-sans">{formatNumber(row.quantity)}</td>
                  <td className="px-2 py-1.5 text-right font-sans">{rm(row.amount)}</td>
                  <td className="px-2 py-1.5 capitalize">
                    {row.status === 'cancelled' ? (
                      <span className="text-muted-foreground">Cancelled</span>
                    ) : (
                      <span className="text-foreground">Confirmed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableScrollContainer>

      {createOpen
        ? createPortal(
            <>
              <div
                className={DETAIL_PANEL_OVERLAY_ELEVATED_CLS}
                onClick={() => {
                  if (!saving) setCreateOpen(false);
                }}
              />
              <aside
                className={DETAIL_PANEL_SHELL_ELEVATED_CLS}
                role="dialog"
                aria-label="Create credit note"
                onClick={e => e.stopPropagation()}
              >
                <form
                  className="flex h-full min-h-0 flex-col"
                  onSubmit={e => {
                    e.preventDefault();
                    void saveCreditNote();
                  }}
                >
                  <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 shrink-0">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Create credit note</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Search a received PO, select the vendor product, and confirm the short qty.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => !saving && setCreateOpen(false)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                      aria-label="Close"
                    >
                      <X size={16} />
                    </button>
                  </header>

                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
                    <div>
                      <label className={labelCls}>Search PO by number or vendor</label>
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                        <input
                          className={`${fieldCls} pl-8`}
                          value={poQuery}
                          onChange={e => {
                            setPoQuery(e.target.value);
                            setSelectedPo(null);
                            setSelectedItem(null);
                          }}
                          placeholder="PO number or vendor name"
                        />
                      </div>
                      {!selectedPo ? (
                        <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border">
                          {poSearching ? (
                            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
                          ) : poResults.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-muted-foreground">
                              No received POs matched.
                            </p>
                          ) : (
                            poResults.map(po => (
                              <button
                                key={po.id}
                                type="button"
                                onClick={() => selectPo(po)}
                                className="flex w-full items-start justify-between gap-2 border-b border-border/70 px-3 py-2 text-left text-xs hover:bg-muted/50 last:border-0"
                              >
                                <span>
                                  <span className="font-medium font-sans text-foreground">{po.poNumber}</span>
                                  <span className="text-muted-foreground"> · {po.vendorName}</span>
                                </span>
                                <span className="text-muted-foreground font-sans">{po.orderDate}</span>
                              </button>
                            ))
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                          <span>
                            <span className="font-medium font-sans">{selectedPo.poNumber}</span>
                            <span className="text-muted-foreground"> · {selectedPo.vendorName}</span>
                          </span>
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => {
                              setSelectedPo(null);
                              setSelectedItem(null);
                            }}
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </div>

                    {selectedPo ? (
                      <div>
                        <label className={labelCls}>Vendor product (from PO)</label>
                        <select
                          className={filterSelectCls}
                          value={selectedItem?.id ?? ''}
                          onChange={e => {
                            const id = Number(e.target.value);
                            const item = selectedPo.items.find(i => i.id === id) ?? null;
                            if (item) selectItem(item);
                          }}
                        >
                          <option value="">Select product…</option>
                          {selectedPo.items.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                              {item.vendorProductId ? ` (${item.vendorProductId})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    {selectedItem ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-md border border-border p-3">
                        <div>
                          <p className={labelCls}>Delivery UOM</p>
                          <p className="text-sm text-foreground">{selectedItem.unit || '—'}</p>
                        </div>
                        <div>
                          <p className={labelCls}>Delivered qty</p>
                          <p className="text-sm font-sans text-foreground">
                            {formatNumber(selectedItem.deliveredQuantity)}
                          </p>
                        </div>
                        <div>
                          <p className={labelCls}>Unit price</p>
                          <p className="text-sm font-sans text-foreground">{rm(selectedItem.unitPrice)}</p>
                        </div>
                      </div>
                    ) : null}

                    {selectedItem ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Credit qty ({selectedItem.unit || 'UOM'})</label>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            className={inlineNumberCls}
                            value={creditQty}
                            onChange={e => setCreditQty(e.target.value)}
                            placeholder="Qty to credit"
                            required
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Amount credited</label>
                          <p className="rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm font-sans">
                            {rm(creditedAmount)}
                          </p>
                        </div>
                        <div>
                          <label className={labelCls}>Credit note number</label>
                          <input
                            className={fieldCls}
                            value={creditNoteNumber}
                            onChange={e => setCreditNoteNumber(e.target.value)}
                            placeholder="Optional — can add later"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Date</label>
                          <input
                            type="date"
                            className={fieldCls}
                            value={creditNoteDate}
                            onChange={e => setCreditNoteDate(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    ) : null}

                    {formError ? (
                      <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
                        {formError}
                      </p>
                    ) : null}
                  </div>

                  <footer className="shrink-0 flex justify-end gap-2 border-t border-border px-4 py-3 bg-card">
                    <button
                      type="button"
                      onClick={() => setCreateOpen(false)}
                      disabled={saving}
                      className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !selectedItem}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                    >
                      <FileText size={14} />
                      {saving ? 'Saving…' : 'Save credit note'}
                    </button>
                  </footer>
                </form>
              </aside>
            </>,
            document.body,
          )
        : null}

      {detailRow
        ? createPortal(
            <>
              <div
                className={DETAIL_PANEL_OVERLAY_ELEVATED_CLS}
                onClick={() => {
                  if (!savingNumber && !cancelling) setDetailRow(null);
                }}
              />
              <aside
                className={DETAIL_PANEL_SHELL_ELEVATED_CLS}
                role="dialog"
                aria-label="Credit note detail"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex h-full min-h-0 flex-col">
                  <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 shrink-0">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Credit note detail</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {detailRow.poNumber} · {detailRow.productName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailRow(null)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                      aria-label="Close"
                    >
                      <X size={16} />
                    </button>
                  </header>

                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className={labelCls}>Status</p>
                        <p className="capitalize text-foreground">{detailRow.status}</p>
                      </div>
                      <div>
                        <p className={labelCls}>Date</p>
                        <p className="font-sans">{formatDate(detailRow.creditNoteDate)}</p>
                      </div>
                      <div>
                        <p className={labelCls}>Vendor</p>
                        <p>{detailRow.vendorName}</p>
                      </div>
                      <div>
                        <p className={labelCls}>Qty / UOM</p>
                        <p className="font-sans">
                          {formatNumber(detailRow.quantity)} {detailRow.deliveryUom}
                        </p>
                      </div>
                      <div>
                        <p className={labelCls}>Unit price</p>
                        <p className="font-sans">{rm(detailRow.deliveryUnitPrice)}</p>
                      </div>
                      <div>
                        <p className={labelCls}>Amount</p>
                        <p className="font-sans">{rm(detailRow.amount)}</p>
                      </div>
                    </div>

                    {detailRow.status === 'confirmed' ? (
                      <>
                        <div>
                          <label className={labelCls}>Credit note number</label>
                          <input
                            className={fieldCls}
                            value={editNumber}
                            onChange={e => setEditNumber(e.target.value)}
                            placeholder="Enter vendor CN number"
                          />
                        </div>

                        <div className="space-y-3 rounded-md border border-border p-3">
                          <div>
                            <p className="text-xs font-medium text-foreground">Cancel credit note</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              After the vendor sends a free replacement, receive it at 0 cost on a PO,
                              then cancel here with that PO and DO/invoice. Stock qty is not restored —
                              only zero-cost units are revalued to this credit note&apos;s unit price.
                            </p>
                          </div>
                          <div>
                            <label className={labelCls}>Replacement PO number</label>
                            <input
                              className={fieldCls}
                              value={cancelPoNumber}
                              onChange={e => setCancelPoNumber(e.target.value)}
                              placeholder="PO number"
                            />
                          </div>
                          <div>
                            <label className={labelCls}>DO or invoice number</label>
                            <input
                              className={fieldCls}
                              value={cancelDoOrInvoice}
                              onChange={e => setCancelDoOrInvoice(e.target.value)}
                              placeholder="Vendor DO or invoice #"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void cancelCreditNote()}
                            disabled={cancelling}
                            className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive disabled:opacity-50"
                          >
                            {cancelling ? 'Cancelling…' : 'Cancel credit note'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
                        <p>
                          Cancelled against PO{' '}
                          <span className="font-sans font-medium">{detailRow.cancelPoNumber || '—'}</span>
                        </p>
                        <p>
                          DO / Invoice{' '}
                          <span className="font-sans">
                            {detailRow.cancelDoOrInvoiceNumber || '—'}
                          </span>
                        </p>
                      </div>
                    )}

                    {detailError ? (
                      <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
                        {detailError}
                      </p>
                    ) : null}
                  </div>

                  {detailRow.status === 'confirmed' ? (
                    <footer className="shrink-0 flex justify-end gap-2 border-t border-border px-4 py-3 bg-card">
                      <button
                        type="button"
                        onClick={() => setDetailRow(null)}
                        disabled={savingNumber}
                        className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveNumber()}
                        disabled={savingNumber}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {savingNumber ? 'Saving…' : 'Save'}
                      </button>
                    </footer>
                  ) : null}
                </div>
              </aside>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
