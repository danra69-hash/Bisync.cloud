import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList, X } from 'lucide-react';
import { api, type CreditNoteRow } from '../../api';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  productName: string;
  componentName: string;
  vendorProductId: string;
  companyId: number | null;
  locationIds: string[];
  /** Extra (unordered) receive lines can settle a matching credit note. */
  allowCreditNoteLink: boolean;
  productExpiryDate: string;
  receivedTemperature: string;
  linkedCreditNoteId: number | null;
  /** Credit note ids already linked on other receive lines. */
  reservedCreditNoteIds: Set<number>;
  readOnly: boolean;
  onClose: () => void;
  onSave: (next: {
    productExpiryDate: string;
    receivedTemperature: string;
    linkedCreditNoteId: number | null;
  }) => void;
};

function formatCnLabel(cn: CreditNoteRow): string {
  const doc = cn.creditNoteNumber?.trim() || `CN #${cn.id}`;
  const qty = Number.isFinite(cn.quantity) ? cn.quantity : 0;
  return `${doc} · ${qty} ${cn.deliveryUom || ''} · PO ${cn.poNumber}`.trim();
}

export function ReceiveLineDetailModal({
  productName,
  componentName,
  vendorProductId,
  companyId,
  locationIds,
  allowCreditNoteLink,
  productExpiryDate,
  receivedTemperature,
  linkedCreditNoteId,
  reservedCreditNoteIds,
  readOnly,
  onClose,
  onSave,
}: Props) {
  const [expiry, setExpiry] = useState(productExpiryDate);
  const [temp, setTemp] = useState(receivedTemperature);
  const [creditNoteId, setCreditNoteId] = useState<number | null>(linkedCreditNoteId);
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[]>([]);
  const [cnLoading, setCnLoading] = useState(false);
  const [cnError, setCnError] = useState<string | null>(null);

  useEffect(() => {
    setExpiry(productExpiryDate);
    setTemp(receivedTemperature);
    setCreditNoteId(linkedCreditNoteId);
  }, [productExpiryDate, receivedTemperature, linkedCreditNoteId]);

  useEffect(() => {
    if (!allowCreditNoteLink || readOnly) return;
    const vp = vendorProductId.trim();
    if (!vp || companyId == null) {
      setCreditNotes([]);
      return;
    }

    let cancelled = false;
    setCnLoading(true);
    setCnError(null);
    void (async () => {
      try {
        const rows = await api.creditNotes(
          companyId,
          locationIds.length > 0 ? locationIds : undefined,
        );
        if (cancelled) return;
        const matched = rows.filter(cn =>
          String(cn.status).toLowerCase() === 'confirmed'
          && (cn.vendorProductId ?? '').trim().toLowerCase() === vp.toLowerCase()
          && (!reservedCreditNoteIds.has(cn.id) || cn.id === linkedCreditNoteId),
        );
        matched.sort((a, b) => {
          const da = a.creditNoteDate || '';
          const db = b.creditNoteDate || '';
          return db.localeCompare(da) || b.id - a.id;
        });
        setCreditNotes(matched);
      } catch (e) {
        if (!cancelled) {
          setCnError(e instanceof Error ? e.message : 'Failed to load credit notes.');
          setCreditNotes([]);
        }
      } finally {
        if (!cancelled) setCnLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [
    allowCreditNoteLink,
    readOnly,
    vendorProductId,
    companyId,
    locationIds.join('|'),
    reservedCreditNoteIds,
    linkedCreditNoteId,
  ]);

  const selectedCn = useMemo(
    () => creditNotes.find(cn => cn.id === creditNoteId) ?? null,
    [creditNotes, creditNoteId],
  );

  function handleSave() {
    onSave({
      productExpiryDate: expiry.trim(),
      receivedTemperature: temp.trim(),
      linkedCreditNoteId: allowCreditNoteLink ? creditNoteId : linkedCreditNoteId,
    });
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Receive line detail"
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-primary shrink-0" />
              <h3 className="text-sm font-semibold">
                {readOnly ? 'Line detail' : 'Add Detail'}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate" title={productName}>
              {productName}
            </p>
            <p className="text-[11px] text-muted-foreground truncate" title={componentName}>
              {componentName}
            </p>
            {vendorProductId.trim() ? (
              <p className="text-[10px] font-sans text-muted-foreground mt-0.5">
                Vendor Product ID: {vendorProductId}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
              Expiry date
            </label>
            {readOnly ? (
              <p className="mt-1 text-xs font-medium font-sans">{expiry || '—'}</p>
            ) : (
              <input
                type="date"
                value={expiry}
                onChange={e => setExpiry(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-xs font-sans"
              />
            )}
          </div>
          <div>
            <label className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
              Temp °C
            </label>
            {readOnly ? (
              <p className="mt-1 text-xs font-medium font-sans">
                {temp.trim() ? `${temp}°C` : '—'}
              </p>
            ) : (
              <input
                type="number"
                step="0.1"
                value={temp}
                onChange={e => setTemp(e.target.value)}
                placeholder="Optional"
                title="Optional temperature check (°C)"
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-xs font-sans"
              />
            )}
          </div>

          {allowCreditNoteLink ? (
            <div>
              <label className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground">
                Credit note
              </label>
              {readOnly ? (
                <p className="mt-1 text-xs font-medium font-sans">
                  {selectedCn ? formatCnLabel(selectedCn) : linkedCreditNoteId ? `CN #${linkedCreditNoteId}` : '—'}
                </p>
              ) : cnLoading ? (
                <div className="mt-2">
                  <MillstoneLoader size="sm" layout="inline" label="Loading credit notes…" />
                </div>
              ) : cnError ? (
                <p className="mt-1 text-xs text-red-600">{cnError}</p>
              ) : (
                <>
                  <select
                    value={creditNoteId ?? ''}
                    onChange={e => {
                      const raw = e.target.value;
                      setCreditNoteId(raw ? Number(raw) : null);
                    }}
                    className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-xs font-sans"
                  >
                    <option value="">None — freebie / no CN</option>
                    {creditNotes.map(cn => (
                      <option key={cn.id} value={cn.id}>
                        {formatCnLabel(cn)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Only confirmed credit notes for this exact vendor product. On confirm receive,
                    the CN is cancelled as replaced. If receive qty is lower than the CN qty,
                    the CN quantity is reduced first, then cancelled.
                  </p>
                  {creditNotes.length === 0 ? (
                    <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
                      No matching confirmed credit notes for this vendor product.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted/50"
          >
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly ? (
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
            >
              Save
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
