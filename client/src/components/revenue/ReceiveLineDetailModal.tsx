import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardList, X } from 'lucide-react';

type DetailSave = {
  halalCertNo: string;
  productExpiryDate: string;
  receivedTemperature: string;
};

type Props = {
  productName: string;
  componentName: string;
  halalCertNo: string;
  productExpiryDate: string;
  receivedTemperature: string;
  readOnly: boolean;
  onClose: () => void;
  onSave: (next: DetailSave) => void;
};

export function ReceiveLineDetailModal({
  productName,
  componentName,
  halalCertNo,
  productExpiryDate,
  receivedTemperature,
  readOnly,
  onClose,
  onSave,
}: Props) {
  const [halal, setHalal] = useState(halalCertNo);
  const [expiry, setExpiry] = useState(productExpiryDate);
  const [temp, setTemp] = useState(receivedTemperature);

  useEffect(() => {
    setHalal(halalCertNo);
    setExpiry(productExpiryDate);
    setTemp(receivedTemperature);
  }, [halalCertNo, productExpiryDate, receivedTemperature]);

  function handleSave() {
    onSave({
      halalCertNo: halal.trim(),
      productExpiryDate: expiry.trim(),
      receivedTemperature: temp.trim(),
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
              Halal Certification Reference
            </label>
            {readOnly ? (
              <p className="mt-1 text-xs font-medium font-sans">{halal || '—'}</p>
            ) : (
              <input
                type="text"
                value={halal}
                onChange={e => setHalal(e.target.value)}
                placeholder="Optional"
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-xs font-sans"
              />
            )}
          </div>
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
