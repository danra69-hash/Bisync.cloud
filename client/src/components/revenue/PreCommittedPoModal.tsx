import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarRange, Handshake, X } from 'lucide-react';
import { api, type Company } from '../../api';
import {
  groupCartByVendor,
  type OrderCartItem,
} from '../../data/createOrder';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { resolvePurchaseOrderSignatories } from '../../data/purchaseOrderSignatories';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  items: OrderCartItem[];
  selectedCompanyId: number;
  selectedLocationIds: string[];
  onClose: () => void;
  onCreated: (clearedLineKeys: string[], poNumbers: string[]) => void;
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function PreCommittedPoModal({
  items,
  selectedCompanyId,
  selectedLocationIds,
  onClose,
  onCreated,
}: Props) {
  const { rm } = useCountryFormatters();
  const { currentUser, loading: userLoading } = useCurrentUser();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);
  const [commitmentStart, setCommitmentStart] = useState(() => toDateInputValue(today));
  const [commitmentEnd, setCommitmentEnd] = useState(() => {
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    return toDateInputValue(end);
  });

  const groups = useMemo(() => groupCartByVendor(items), [items]);
  const grandTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.deliveryPrice, 0),
    [items],
  );

  const signatories = useMemo(
    () => (currentUser ? resolvePurchaseOrderSignatories(currentUser) : null),
    [currentUser],
  );

  useEffect(() => {
    setLoading(true);
    api.companies()
      .then(rows => setCompany(rows.find(c => c.id === selectedCompanyId) ?? null))
      .catch(() => setCompany(null))
      .finally(() => setLoading(false));
  }, [selectedCompanyId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  async function handleCreate() {
    if (groups.length === 0) {
      setError('Add order quantities on My Order before creating a Pre-committed PO.');
      return;
    }
    if (!commitmentStart || !commitmentEnd) {
      setError('Choose Commitment Date from and to.');
      return;
    }
    if (commitmentEnd < commitmentStart) {
      setError('Commitment end date must be on or after the start date.');
      return;
    }
    if (!signatories) {
      setError('No logged-in user found. Open the sidebar to select your account.');
      return;
    }
    if (!company) {
      setError('Company details are required to create a Pre-committed PO.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const orderDate = toDateInputValue(new Date());
      const created = await api.createPurchaseOrders({
        companyId: selectedCompanyId,
        locationExternalIds: selectedLocationIds,
        initiatedBy: signatories.initiatedBy,
        approvedBy: signatories.approvedBy,
        orders: groups.map(group => ({
          vendorName: group.vendorName,
          vendorExternalId: group.vendorExternalId,
          documentType: 'PO',
          orderDate,
          deliveryDate: commitmentEnd,
          status: 'Committed',
          isPreCommitted: true,
          commitmentStartDate: commitmentStart,
          commitmentEndDate: commitmentEnd,
          items: group.items.map(item => ({
            componentId: item.componentId,
            componentName: item.componentName,
            vendorProductId: item.vendorProductId,
            name: item.productName,
            quantity: item.quantity,
            unitPrice: item.deliveryPrice,
            unit: item.deliveryUnitLabel,
            componentUom: item.componentUom,
            deliveryPackage: item.deliveryUnitLabel,
          })),
        })),
      });

      if (!Array.isArray(created) || created.length === 0) {
        throw new Error('Failed to create Pre-committed PO.');
      }

      onCreated(
        items.map(i => i.lineKey),
        created.map(po => po.poNumber),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create Pre-committed PO.');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-3xl rounded-lg border border-border bg-card shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Handshake size={16} className="text-primary" />
              <h3 className="text-sm font-semibold">Pre-committed PO</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Commit a large quantity to a vendor at a special price over a date range. Later orders for these
              products draw down from this commitment. Same PO format as a regular PO, plus commitment dates.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading || userLoading ? (
            <MillstoneLoader size="sm" layout="block" label="Loading…" />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <CalendarRange size={11} />
                    Commitment Date from
                  </span>
                  <input
                    type="date"
                    value={commitmentStart}
                    onChange={e => setCommitmentStart(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <CalendarRange size={11} />
                    Commitment Date to
                  </span>
                  <input
                    type="date"
                    value={commitmentEnd}
                    onChange={e => setCommitmentEnd(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
                  />
                </label>
              </div>

              <div className="rounded-md border border-border divide-y divide-border">
                {groups.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                    Enter order quantities on My Order first — those lines become the committed quantity at the
                    listed delivery price (special arrangement).
                  </p>
                ) : (
                  groups.map(group => (
                    <div key={group.vendorExternalId || group.vendorName} className="px-4 py-3 space-y-2">
                      <p className="text-xs font-semibold">{group.vendorName}</p>
                      <ul className="space-y-1.5">
                        {group.items.map(item => (
                          <li
                            key={item.lineKey}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="min-w-0 truncate">
                              {item.productName}
                              <span className="text-muted-foreground"> · {item.quantity} {item.deliveryUnitLabel}</span>
                            </span>
                            <span className="font-sans tabular-nums shrink-0">
                              {rm(item.quantity * item.deliveryPrice)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>

              {groups.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Commitment value</span>
                  <span className="font-semibold font-sans">{rm(grandTotal)}</span>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-md border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={saving || loading || groups.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
          >
            <Handshake size={14} />
            {saving ? 'Creating…' : 'Create Pre-committed PO'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
