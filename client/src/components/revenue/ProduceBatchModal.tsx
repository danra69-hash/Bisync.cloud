import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { filterSelectCls, inlineNumberCls } from '../layout/formControls';
import type { ProduceBatchShortage } from '../../api';
import { fromApiUom } from '../../data/componentForm';

type Props = {
  productName: string;
  batchUnit: string;
  defaultBatchQty: number;
  isSubProduct: boolean;
  expiryPeriodDays?: number;
  purpose: 'queue' | 'produce' | 'edit';
  batchNumber?: string | null;
  initialProductionDate?: string | null;
  initialExpiryDate?: string | null;
  saving: boolean;
  error: string | null;
  components?: ProduceBatchShortage[];
  onClose: () => void;
  onConfirm: (batchQty: number, productionDate: string, expiryDate?: string, overrideStock?: boolean) => void;
};

function todayInputValue(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function addDaysToIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function compareIsoDates(a: string, b: string): number {
  return a.localeCompare(b);
}

function formatStockQty(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function ProduceBatchModal({
  productName,
  batchUnit,
  defaultBatchQty,
  isSubProduct,
  expiryPeriodDays = 0,
  purpose,
  batchNumber = null,
  initialProductionDate = null,
  initialExpiryDate = null,
  saving,
  error,
  components = [],
  onClose,
  onConfirm,
}: Props) {
  const defaultExpiryDays = expiryPeriodDays > 0 ? expiryPeriodDays : 7;
  const [batchQty, setBatchQty] = useState(
    defaultBatchQty > 0 ? String(defaultBatchQty) : '1',
  );
  const [productionDate, setProductionDate] = useState(
    () => initialProductionDate || todayInputValue(),
  );
  const [expiryDate, setExpiryDate] = useState(
    () => initialExpiryDate || addDaysToIso(initialProductionDate || todayInputValue(), defaultExpiryDays),
  );
  const [expiryManuallyEdited, setExpiryManuallyEdited] = useState(purpose === 'edit');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  useEffect(() => {
    if (purpose !== 'produce' || expiryManuallyEdited) return;
    setExpiryDate(addDaysToIso(productionDate, defaultExpiryDays));
  }, [purpose, productionDate, defaultExpiryDays, expiryManuallyEdited]);

  useEffect(() => {
    if (purpose !== 'edit' || expiryManuallyEdited) return;
    setExpiryDate(addDaysToIso(productionDate, defaultExpiryDays));
  }, [purpose, productionDate, defaultExpiryDays, expiryManuallyEdited]);

  function handleSubmit(e?: React.FormEvent, overrideStock = false) {
    e?.preventDefault();
    setValidationError(null);

    const qty = Number.parseFloat(batchQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setValidationError('Enter a quantity greater than zero.');
      return;
    }

    if (!productionDate) {
      setValidationError('Select a production date.');
      return;
    }

    if (purpose === 'produce' || purpose === 'edit') {
      if (!expiryDate) {
        setValidationError('Select an expiry date.');
        return;
      }
      if (compareIsoDates(expiryDate, productionDate) < 0) {
        setValidationError('Expiry date must be on or after the production date.');
        return;
      }
      onConfirm(qty, productionDate, expiryDate, overrideStock);
      return;
    }

    onConfirm(qty, productionDate);
  }

  const displayError = validationError ?? error;
  const hasInsufficientComponents = components.some(
    line => line.isSufficient === false || line.onHandQty + 0.0001 < line.requiredQty,
  );
  const showComponentTable = (purpose === 'produce' || purpose === 'edit')
    && components.length > 0
    && (displayError || hasInsufficientComponents);

  const modalTitle = purpose === 'queue'
    ? `To Produce — ${productName}`
    : purpose === 'edit'
      ? `Edit batch — ${productName}`
      : `Produced — ${productName}`;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-herme-ink/40 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="produce-batch-title"
        className="relative w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="produce-batch-title" className="text-sm font-semibold">
            {modalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1 rounded hover:bg-muted disabled:opacity-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            {purpose === 'queue'
              ? (isSubProduct
                ? 'Enter how many batches to queue for production. This is an instruction only and does not change inventory.'
                : 'Enter how many units to queue for production. This is an instruction only and does not change inventory.')
              : purpose === 'edit'
                ? (batchNumber
                  ? `Correct the quantity or dates for batch ${batchNumber}. Inventory is adjusted by the difference.`
                  : 'Correct the quantity or dates for this batch. Inventory is adjusted by the difference.')
                : (isSubProduct
                  ? 'Enter how many batches were produced. Recipe components will be deducted and stock will increase.'
                  : 'Enter how many units were produced and added to stock.')}
          </p>
          {purpose === 'edit' && batchNumber ? (
            <p className="text-[10px] font-mono text-muted-foreground">{batchNumber}</p>
          ) : null}

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="produce-batch-qty">
              Quantity
            </label>
            <div className="flex items-center gap-2">
              <input
                id="produce-batch-qty"
                type="number"
                min={0.01}
                step="any"
                value={batchQty}
                onChange={e => setBatchQty(e.target.value)}
                className={`${inlineNumberCls} flex-1`}
                disabled={saving}
                autoFocus
              />
              <span className="text-xs font-medium text-muted-foreground shrink-0">
                × {batchUnit}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="produce-batch-date">
              Production date
            </label>
            <input
              id="produce-batch-date"
              type="date"
              value={productionDate}
              onChange={e => setProductionDate(e.target.value)}
              className={`${filterSelectCls} w-full`}
              disabled={saving}
            />
          </div>

          {purpose === 'produce' || purpose === 'edit' ? (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="produce-batch-expiry">
                Expiry date
              </label>
              <input
                id="produce-batch-expiry"
                type="date"
                value={expiryDate}
                onChange={e => {
                  setExpiryManuallyEdited(true);
                  setExpiryDate(e.target.value);
                }}
                className={`${filterSelectCls} w-full`}
                disabled={saving}
              />
              {expiryPeriodDays > 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  Defaults to production date + {expiryPeriodDays} day{expiryPeriodDays === 1 ? '' : 's'} from product settings.
                </p>
              ) : null}
            </div>
          ) : null}

          {displayError ? (
            <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2 whitespace-pre-wrap">
              {displayError}
            </p>
          ) : null}

          {showComponentTable ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Component stock check
              </p>
              <div className="border border-border rounded-md overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-[11px] min-w-[28rem]">
                  <thead className="sticky top-0 bg-muted/40">
                    <tr className="text-left">
                      <th className="px-2 py-1.5 font-semibold text-muted-foreground">Component</th>
                      <th className="px-2 py-1.5 font-semibold text-muted-foreground">UOM</th>
                      <th className="px-2 py-1.5 font-semibold text-muted-foreground text-right">Required</th>
                      <th className="px-2 py-1.5 font-semibold text-muted-foreground text-right">On hand</th>
                      <th className="px-2 py-1.5 font-semibold text-muted-foreground text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {components.map(line => {
                      const insufficient = line.isSufficient === false || line.onHandQty + 0.0001 < line.requiredQty;
                      return (
                        <tr
                          key={`${line.locationExternalId}-${line.componentId}-${line.uom}`}
                          className={`border-t border-border ${insufficient ? 'bg-destructive/5' : ''}`}
                        >
                          <td className="px-2 py-1.5">
                            <span className="font-medium">{line.componentName || line.componentId}</span>
                            <p className="text-[10px] text-muted-foreground font-mono">{line.componentId}</p>
                          </td>
                          <td className="px-2 py-1.5 text-muted-foreground">{fromApiUom(line.uom)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-medium">{formatStockQty(line.requiredQty)}</td>
                          <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${insufficient ? 'text-destructive' : ''}`}>
                            {formatStockQty(line.onHandQty)}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {insufficient ? (
                              <span className="text-destructive font-semibold">Short</span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {hasInsufficientComponents ? (
                <p className="text-[10px] text-muted-foreground px-1">
                  Not enough stock for one or more components. Use Override to record production anyway (stock may go negative).
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            {(purpose === 'produce' || purpose === 'edit') && hasInsufficientComponents ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSubmit(undefined, true)}
                className="px-3 py-1.5 rounded-md border border-amber-400 bg-amber-50 text-amber-900 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
                title="Save anyway; component stock may go negative"
              >
                {saving ? 'Saving…' : 'Override'}
              </button>
            ) : null}
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit()}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : purpose === 'queue' ? 'Add to queue' : purpose === 'edit' ? 'Save changes' : 'Record production'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
