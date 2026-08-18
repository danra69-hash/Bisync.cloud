import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export type FxRateEntryResult = {
  rate: number;
  rateDate: string;
};

type Props = {
  open: boolean;
  foreignCurrency: string;
  functionalCurrency: string;
  /** Transaction / remittance day — rate is for this date. */
  defaultRateDate: string;
  /** Prefill when adjusting (e.g. PO estimate → remittance). */
  initialRate?: string;
  title?: string;
  hint?: string;
  confirmLabel?: string;
  onConfirm: (result: FxRateEntryResult) => void;
  onCancel: () => void;
};

/** Popup for manual FX entry when a non-home currency is selected. */
export function FxRateEntryModal({
  open,
  foreignCurrency,
  functionalCurrency,
  defaultRateDate,
  initialRate = '',
  title,
  hint,
  confirmLabel = 'Use rate',
  onConfirm,
  onCancel,
}: Props) {
  const [rate, setRate] = useState(initialRate);
  const [rateDate, setRateDate] = useState(defaultRateDate);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRate(initialRate);
    setRateDate(defaultRateDate);
    setLocalError(null);
  }, [open, initialRate, defaultRateDate, foreignCurrency]);

  if (!open) return null;

  const rateNum = Number(rate);
  const ok = Number.isFinite(rateNum) && rateNum > 0 && Boolean(rateDate);

  const submit = () => {
    if (!ok) {
      setLocalError(`Enter ${functionalCurrency} per 1 ${foreignCurrency} for the transaction date.`);
      return;
    }
    onConfirm({ rate: rateNum, rateDate });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fx-rate-entry-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-background border border-border rounded-lg shadow-lg p-4 space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 id="fx-rate-entry-title" className="text-sm font-semibold">
              {title ?? `FX rate · ${foreignCurrency} → ${functionalCurrency}`}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              {hint
                ?? `Enter the conversion rate for the day this transaction happened (${functionalCurrency} per 1 ${foreignCurrency}). Rates can be adjusted later if remittance differs from the estimate.`}
            </p>
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-0.5"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="text-muted-foreground">Rate date</span>
            <input
              type="date"
              className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans"
              value={rateDate}
              onChange={e => setRateDate(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground">
              Rate ({functionalCurrency} / 1 {foreignCurrency})
            </span>
            <input
              className="w-full border border-border rounded-md px-2 py-1.5 bg-background font-sans"
              inputMode="decimal"
              autoFocus
              placeholder="e.g. 4.70"
              value={rate}
              onChange={e => setRate(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </label>
        </div>

        {localError && <p className="text-xs text-destructive">{localError}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            className="text-xs font-semibold border border-border px-3 py-1.5 rounded-md hover:bg-muted/40"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ok}
            className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-md disabled:opacity-50"
            onClick={submit}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
