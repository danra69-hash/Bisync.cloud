import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import {
  api,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from '../../api';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { inputCls } from '../../data/componentForm';

type LineDraft = {
  id: number;
  quantity: string;
  unitPrice: string;
};

type Props = {
  selectedCompanyId: number;
  onApproved: () => void;
};

export function ActiveSalesInboundPanel({ selectedCompanyId, onApproved }: Props) {
  const { rm } = useCountryFormatters();
  const { currentUser } = useCurrentUser();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [acceptedBy, setAcceptedBy] = useState(currentUser?.fullName ?? '');
  const [drafts, setDrafts] = useState<Record<number, LineDraft[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.inboundSalesOrders(selectedCompanyId);
      setOrders(rows);
      const nextDrafts: Record<number, LineDraft[]> = {};
      for (const order of rows) {
        nextDrafts[order.id] = (order.items ?? []).map((item: PurchaseOrderItem) => ({
          id: item.id,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
        }));
      }
      setDrafts(nextDrafts);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : 'Failed to load inbound purchase orders.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (currentUser?.fullName) setAcceptedBy(currentUser.fullName);
  }, [currentUser?.fullName]);

  const pendingCount = orders.length;

  async function handleApprove(order: PurchaseOrder) {
    if (!acceptedBy.trim()) {
      setError('Enter your name before approving.');
      return;
    }
    setBusyId(order.id);
    setError(null);
    try {
      const lineDrafts = drafts[order.id] ?? [];
      const lines = lineDrafts.map(d => ({
        id: d.id,
        quantity: Number(d.quantity),
        unitPrice: Number(d.unitPrice),
      }));
      await api.vendorApprovePurchaseOrder(order.id, {
        acceptedBy: acceptedBy.trim(),
        lines,
      });
      setExpandedId(null);
      await load();
      onApproved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve purchase order.');
    } finally {
      setBusyId(null);
    }
  }

  function updateDraft(orderId: number, lineId: number, patch: Partial<LineDraft>) {
    setDrafts(prev => ({
      ...prev,
      [orderId]: (prev[orderId] ?? []).map(row => (row.id === lineId ? { ...row, ...patch } : row)),
    }));
  }

  const header = useMemo(
    () => (
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-sans uppercase tracking-widest text-muted-foreground">Inbound purchase orders</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            {pendingCount === 0 ? 'No pending operator orders' : `${pendingCount} awaiting approval`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>
    ),
    [pendingCount, loading, load],
  );

  if (pendingCount === 0 && !loading && !error) {
    return (
      <div className="rounded-lg border border-border bg-muted/10 px-4 py-3 space-y-1">
        {header}
        <p className="text-xs text-muted-foreground">
          Once engaged online, operator purchase orders appear here for approval (with optional qty/price changes).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">{header}</div>
      {error ? (
        <p className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}
      <div className="divide-y divide-border">
        {loading && orders.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted-foreground text-center">Loading inbound orders…</p>
        ) : (
          orders.map(order => {
            const open = expandedId === order.id;
            const lineDrafts = drafts[order.id] ?? [];
            return (
              <div key={order.id} className="px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{order.poNumber}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.orderDate} · {order.initiatedBy || 'Operator'} · {order.items?.length ?? 0} items ·{' '}
                      {rm((order.items ?? []).reduce((sum, i) => sum + i.quantity * i.unitPrice, 0))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : order.id)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {open ? 'Hide' : 'Review & approve'}
                  </button>
                </div>

                {open ? (
                  <div className="space-y-3 pt-1">
                    <div className="overflow-x-auto rounded-md border border-border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                          <tr className="border-b border-border text-left">
                            <th className="px-2 py-1.5 font-medium">Product</th>
                            <th className="px-2 py-1.5 font-medium text-right">Qty</th>
                            <th className="px-2 py-1.5 font-medium text-right">Unit price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(order.items ?? []).map((item, index) => {
                            const draft = lineDrafts[index] ?? {
                              id: item.id,
                              quantity: String(item.quantity),
                              unitPrice: String(item.unitPrice),
                            };
                            return (
                              <tr key={item.id} className="border-b border-border/60">
                                <td className="px-2 py-1.5 font-medium">{item.name}</td>
                                <td className="px-2 py-1.5 text-right">
                                  <input
                                    className={`${inputCls} w-24 text-right ml-auto`}
                                    value={draft.quantity}
                                    onChange={e => updateDraft(order.id, item.id, { quantity: e.target.value })}
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <input
                                    className={`${inputCls} w-28 text-right ml-auto`}
                                    value={draft.unitPrice}
                                    onChange={e => updateDraft(order.id, item.id, { unitPrice: e.target.value })}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex flex-col gap-1 min-w-[12rem]">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Approved by</span>
                        <input
                          className={inputCls}
                          value={acceptedBy}
                          onChange={e => setAcceptedBy(e.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => void handleApprove(order)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
                      >
                        <Check size={12} />
                        {busyId === order.id ? 'Approving…' : 'Approve order'}
                      </button>
                      <p className="text-[10px] text-muted-foreground max-w-sm">
                        Qty/price changes notify the operator. Approved orders appear in the sales summary below.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
