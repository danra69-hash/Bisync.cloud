import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { inlineNumberCls } from '../layout/formControls';

type Props = {
  productName: string;
  batchUnit: string;
  defaultBatchQty: number;
  isSubProduct: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (batchQty: number) => void;
};

export function ProduceBatchModal({
  productName,
  batchUnit,
  defaultBatchQty,
  isSubProduct,
  saving,
  error,
  onClose,
  onConfirm,
}: Props) {
  const [batchQty, setBatchQty] = useState(
    defaultBatchQty > 0 ? String(defaultBatchQty) : '1',
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number.parseFloat(batchQty);
    if (!Number.isFinite(qty) || qty <= 0) return;
    onConfirm(qty);
  }

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
        className="relative w-full max-w-md rounded-lg border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="produce-batch-title" className="text-sm font-semibold">
            Produce {productName}
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

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            {isSubProduct
              ? 'Enter how many batches to produce. Recipe components will be deducted from inventory and sub-product stock will increase.'
              : 'Enter how many units to add to stock.'}
          </p>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="produce-batch-qty">
              Batches to produce
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

          {error ? (
            <p className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2 whitespace-pre-wrap">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save production'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
