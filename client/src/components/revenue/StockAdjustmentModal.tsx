import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, X } from 'lucide-react';
import { api, type StockCardAsOfSnapshot } from '../../api';
import { formatCountryNumber } from '../../utils/numberFormat';
import { useOrgCountryCode } from '../../context/OrgCountryContext';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { filterSelectCls, inlineNumberCls } from '../layout/formControls';
import { MODAL_OVERLAY_CLS, MODAL_SHELL_CLS } from '../layout/sidePanelShared';

type Props = {
  itemType: string;
  itemKey: string;
  itemName: string;
  companyId: number;
  locationIds: string[];
  uomMode: 'inventory' | 'recipe';
  periodStart: string;
  periodEnd: string;
  isCurrentMonth: boolean;
  defaultUom: string;
  recipeUom: string;
  inventoryUom: string;
  onClose: () => void;
  onSaved: () => void;
};

function fmtQty(value: number, countryCode: string) {
  if (!Number.isFinite(value)) return formatCountryNumber(0, countryCode);
  return Number.isInteger(value) && value !== 0 ? String(value) : formatCountryNumber(value, countryCode);
}

function todayInputValue(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function toInputDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayInputValue();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}-${day}`;
}

function minDateFromIso(iso: string): string {
  return toInputDate(iso);
}

function maxDateFromIso(iso: string, isCurrentMonth: boolean): string {
  if (isCurrentMonth) return todayInputValue();
  return toInputDate(iso);
}

export function StockAdjustmentModal({
  itemType,
  itemKey,
  itemName,
  companyId,
  locationIds,
  uomMode,
  periodStart,
  periodEnd,
  isCurrentMonth,
  defaultUom,
  recipeUom,
  inventoryUom,
  onClose,
  onSaved,
}: Props) {
  const countryCode = useOrgCountryCode();
  const { rm } = useCountryFormatters();
  const uomOptions = useMemo(
    () => [...new Set([inventoryUom, recipeUom].map(u => u.trim()).filter(Boolean))],
    [inventoryUom, recipeUom],
  );
  const canChooseUom = uomOptions.length > 1;

  const [locationExternalId, setLocationExternalId] = useState(locationIds[0] ?? '');
  const [adjustmentDate, setAdjustmentDate] = useState(() => {
    const end = toInputDate(periodEnd);
    const today = todayInputValue();
    return end < today ? end : today;
  });
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [quantity, setQuantity] = useState('1');
  const [inboundUom, setInboundUom] = useState(defaultUom);
  const [reason, setReason] = useState('');
  const [snapshot, setSnapshot] = useState<StockCardAsOfSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minDate = minDateFromIso(periodStart);
  const maxDate = maxDateFromIso(periodEnd, isCurrentMonth);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  useEffect(() => {
    if (!locationExternalId || !adjustmentDate) {
      setSnapshot(null);
      return;
    }

    setSnapshotLoading(true);
    setSnapshotError(null);
    api
      .stockCardAsOf(itemType, itemKey, companyId, locationIds, locationExternalId, adjustmentDate, { uomMode })
      .then(setSnapshot)
      .catch(e => {
        setSnapshot(null);
        setSnapshotError(e instanceof Error ? e.message : 'Failed to load stock for selected date.');
      })
      .finally(() => setSnapshotLoading(false));
  }, [itemType, itemKey, companyId, locationIds, locationExternalId, adjustmentDate, uomMode]);

  useEffect(() => {
    setInboundUom(defaultUom);
  }, [defaultUom]);

  const parsedQty = useMemo(() => {
    const value = Number(quantity);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [quantity]);

  const canSubmit = parsedQty > 0 && reason.trim().length > 0 && !!locationExternalId;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await api.createStockAdjustment(itemType, itemKey, {
        companyId,
        locationIds: locationIds.join(','),
        locationExternalId,
        uomMode,
        adjustmentDate,
        quantity: parsedQty,
        direction,
        reason: reason.trim(),
        ...(direction === 'in' ? { inboundUom } : {}),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save adjustment.');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <>
      <div className={MODAL_OVERLAY_CLS} onClick={saving ? undefined : onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-adjustment-title"
        className={`${MODAL_SHELL_CLS} w-full max-w-lg rounded-lg border border-border bg-card shadow-xl flex flex-col max-h-[90vh]`}
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Stock adjustment</p>
            <h2 id="stock-adjustment-title" className="text-lg font-semibold truncate">{itemName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {locationIds.length > 1 ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Location</label>
              <select
                value={locationExternalId}
                onChange={e => setLocationExternalId(e.target.value)}
                className={filterSelectCls}
              >
                {locationIds.map(id => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <label htmlFor="adjustment-date" className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
              Adjustment date
            </label>
            <input
              id="adjustment-date"
              type="date"
              value={adjustmentDate}
              min={minDate}
              max={maxDate}
              onChange={e => setAdjustmentDate(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm font-sans"
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Available stock on {adjustmentDate}
            </p>
            {snapshotLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : snapshotError ? (
              <p className="text-sm text-destructive">{snapshotError}</p>
            ) : snapshot ? (
              <>
                <p className="text-base font-semibold tabular-nums text-primary">
                  {fmtQty(snapshot.onHandQty, countryCode)} <span className="text-sm font-normal text-muted-foreground">{snapshot.uom || defaultUom}</span>
                </p>
                {snapshot.layers.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 border-t border-border/60 pt-2">
                    {snapshot.layers.filter(l => l.quantity > 0).map(layer => (
                      <li
                        key={`${layer.unitPrice}-${layer.quantity}`}
                        className="text-xs tabular-nums text-muted-foreground"
                      >
                        {fmtQty(layer.quantity, countryCode)} @ {rm(layer.unitPrice)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">No FIFO layers on this date.</p>
                )}
              </>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Adjustment</span>
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDirection('in')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    direction === 'in' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('out')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-l border-border transition-colors ${
                    direction === 'out' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
                  }`}
                >
                  <Minus className="w-4 h-4" />
                  Deplete
                </button>
              </div>
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className={`${inlineNumberCls} w-28`}
                aria-label="Adjustment quantity"
              />
              <span className="text-sm text-muted-foreground">
                {direction === 'in' ? inboundUom : (snapshot?.uom || defaultUom)}
              </span>
            </div>

            {direction === 'in' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">UOM</label>
                  {canChooseUom ? (
                    <select
                      value={inboundUom}
                      onChange={e => setInboundUom(e.target.value)}
                      className={filterSelectCls}
                    >
                      {uomOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="h-9 flex items-center rounded-md border border-border bg-muted/20 px-3 text-sm">
                      {inboundUom || defaultUom}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">UOM price (FIFO)</span>
                  <div className="h-9 flex items-center rounded-md border border-border bg-muted/20 px-3 text-sm tabular-nums">
                    {snapshot?.suggestedAdjustmentInUnitPrice && snapshot.suggestedAdjustmentInUnitPrice > 0
                      ? rm(snapshot.suggestedAdjustmentInUnitPrice)
                      : '—'}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Matches prior count short, or oldest FIFO layer on this date.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="adjustment-reason" className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
              Reason for adjustment
            </label>
            <textarea
              id="adjustment-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Count short, spoilage found, stocktake correction"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-sans resize-none"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 px-4 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save adjustment'}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
