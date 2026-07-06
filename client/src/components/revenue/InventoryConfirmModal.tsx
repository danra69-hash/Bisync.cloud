import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { filterSelectCls } from '../layout/formControls';
import { MODAL_OVERLAY_CLS, MODAL_SHELL_CLS } from '../layout/sidePanelShared';
import { formatStockCardMonthLabel } from './stockCardPeriod';

type Props = {
  periodMonth: string;
  onClose: () => void;
  onConfirm: (effectiveDate: string) => void;
  confirming: boolean;
};

function todayInputValue(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function InventoryConfirmModal({ periodMonth, onClose, onConfirm, confirming }: Props) {
  const [effectiveDate, setEffectiveDate] = useState(todayInputValue());

  return createPortal(
    <div className={MODAL_OVERLAY_CLS} onClick={onClose}>
      <div
        className={`${MODAL_SHELL_CLS} w-full max-w-md`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="inventory-confirm-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="inventory-confirm-title" className="text-lg font-semibold text-foreground">
              Confirm full inventory
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Inventory month: {formatStockCardMonthLabel(periodMonth, false)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Stock adjustments will post at the end of the selected effective date. The effective date may fall in a later
          calendar month while this count remains recorded for{' '}
          {formatStockCardMonthLabel(periodMonth, false)}.
        </p>

        <div className="flex flex-col gap-1 mb-6">
          <label htmlFor="inventory-effective-date" className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
            Effective date
          </label>
          <input
            id="inventory-effective-date"
            type="date"
            value={effectiveDate}
            min={`${periodMonth}-01`}
            max={todayInputValue()}
            onChange={e => {
              if (e.target.value) setEffectiveDate(e.target.value);
            }}
            className={`${filterSelectCls} w-full`}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="h-9 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(effectiveDate)}
            disabled={confirming || !effectiveDate}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {confirming ? 'Confirming…' : 'Confirm & adjust stock'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
