import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { ApproveVendorEngagementPayload, VendorEngagement, VendorPaymentTerms } from '../../api';
import { inputCls } from '../../data/componentForm';

type Props = {
  engagement: VendorEngagement;
  saving: boolean;
  serverError?: string | null;
  defaultApprovedBy?: string;
  onClose: () => void;
  onApprove: (payload: ApproveVendorEngagementPayload) => void;
  onReject: (reason: string) => void;
};

const PAYMENT_OPTIONS: { value: VendorPaymentTerms; label: string }[] = [
  { value: 'cod', label: 'COD' },
  { value: 'prepaid', label: 'Prepaid' },
  { value: 'postpaid', label: 'Postpaid' },
];

export function VendorEngageApproveModal({
  engagement,
  saving,
  serverError,
  defaultApprovedBy = '',
  onClose,
  onApprove,
  onReject,
}: Props) {
  const [minOrderAmount, setMinOrderAmount] = useState('0');
  const [deliveryCharge, setDeliveryCharge] = useState('0');
  const [paymentTerms, setPaymentTerms] = useState<VendorPaymentTerms>('cod');
  const [approvedBy, setApprovedBy] = useState(defaultApprovedBy);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMinOrderAmount('0');
    setDeliveryCharge('0');
    setPaymentTerms('cod');
    setApprovedBy(defaultApprovedBy);
    setRejectReason('');
    setError(null);
  }, [engagement.externalId, defaultApprovedBy]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  function submitApprove() {
    const min = Number(minOrderAmount);
    const charge = Number(deliveryCharge);
    if (!Number.isFinite(min) || min < 0) {
      setError('Enter a valid minimum order amount.');
      return;
    }
    if (!Number.isFinite(charge) || charge < 0) {
      setError('Enter a valid delivery charge.');
      return;
    }
    if (!approvedBy.trim()) {
      setError('Enter your name to approve.');
      return;
    }
    setError(null);
    onApprove({
      minOrderAmount: min,
      deliveryChargeBelowMin: charge,
      paymentTerms,
      approvedBy: approvedBy.trim(),
    });
  }

  function submitReject() {
    if (!approvedBy.trim()) {
      setError('Enter your name to decline.');
      return;
    }
    setError(null);
    onReject(rejectReason.trim());
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      onClick={saving ? undefined : onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-lg shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Approve engage ${engagement.name}`}
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest">Approve Engage</p>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">{engagement.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Requested by {engagement.engageRequestedBy || 'operator'}
              {engagement.engageRequestedAt
                ? ` · ${new Date(engagement.engageRequestedAt).toLocaleString()}`
                : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="p-1 rounded-md hover:bg-muted transition-colors shrink-0 disabled:opacity-50">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Set trading conditions for this operator. Purchase orders will appear on Active Sales after engage is approved.
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Minimum order amount</span>
            <input
              className={inputCls}
              type="number"
              min={0}
              step="0.01"
              value={minOrderAmount}
              onChange={e => setMinOrderAmount(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">
              Delivery charge if minimum not met
            </span>
            <input
              className={inputCls}
              type="number"
              min={0}
              step="0.01"
              value={deliveryCharge}
              onChange={e => setDeliveryCharge(e.target.value)}
            />
          </label>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Payment terms</legend>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs cursor-pointer ${
                    paymentTerms === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment-terms"
                    className="sr-only"
                    checked={paymentTerms === opt.value}
                    onChange={() => setPaymentTerms(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Your name</span>
            <input
              className={inputCls}
              value={approvedBy}
              onChange={e => setApprovedBy(e.target.value)}
              placeholder="Approver name"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Decline reason (optional)</span>
            <input
              className={inputCls}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Only used if you decline"
            />
          </label>
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
          {error && <p className="text-xs text-red-500">{error}</p>}
          {serverError && <p className="text-xs text-red-500">{serverError}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-xs font-sans text-muted-foreground border border-border rounded-md px-3 py-2 hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitReject}
              disabled={saving}
              className="text-xs font-sans border border-red-300 text-red-700 rounded-md px-3 py-2 hover:bg-red-50 disabled:opacity-50"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={submitApprove}
              disabled={saving}
              className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-3 py-2 hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Approve Engage'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
