import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { PurchaseOrder } from '../../api';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import { useAppTranslation } from '../../i18n/useAppTranslation';
import {
  ACTIVE_PURCHASE_SUMMARY_BOXES,
  resolveActivePurchaseBucket,
  type ActivePurchaseSummaryBucket,
} from '../revenue/ActivePurchasePage';
import { resolvePurchaseOrderStatusLabel } from '../../data/purchaseOrderStatus';
import { TableScrollContainer } from '../shared/TableScrollContainer';

type Props = {
  orders: PurchaseOrder[];
  openingPurchaseOrderId: number | null;
  selectedPurchaseOrderId: number | null;
  onOpenPurchaseOrder: (order: PurchaseOrder) => void;
};

function orderTotal(order: PurchaseOrder): number {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function TaskTodayPanel({
  orders,
  openingPurchaseOrderId,
  selectedPurchaseOrderId,
  onOpenPurchaseOrder,
}: Props) {
  const { t } = useAppTranslation();
  const { rm } = useCountryFormatters();
  const [selectedBucket, setSelectedBucket] = useState<ActivePurchaseSummaryBucket | null>(null);

  const bucketed = useMemo(() => {
    const map: Record<ActivePurchaseSummaryBucket, PurchaseOrder[]> = {
      purchase_request: [],
      po_accepted: [],
      received: [],
      reconciled: [],
      pre_committed: [],
    };
    for (const order of orders) {
      const bucket = resolveActivePurchaseBucket(order);
      if (bucket) map[bucket].push(order);
    }
    return map;
  }, [orders]);

  const activeBox = ACTIVE_PURCHASE_SUMMARY_BOXES.find(box => box.id === selectedBucket) ?? null;
  const summaryOrders = selectedBucket ? bucketed[selectedBucket] : [];

  return (
    <>
      <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col min-h-0 h-full">
        <div className="px-2.5 py-1.5 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold leading-tight">{t('overview.taskToday')}</h2>
          <p className="text-[11px] text-muted-foreground leading-snug">{t('overview.myOrderSummary')}</p>
        </div>
        <div className="p-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 flex-1 content-start">
          {ACTIVE_PURCHASE_SUMMARY_BOXES.map(box => {
            const count = bucketed[box.id].length;
            const selected = selectedBucket === box.id;
            return (
              <button
                key={box.id}
                type="button"
                onClick={() => setSelectedBucket(box.id)}
                aria-pressed={selected}
                className={`rounded-md border px-2 py-2 text-left transition-colors min-h-[4.25rem] ${
                  selected
                    ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                    : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                }`}
              >
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-snug line-clamp-2">
                  {box.label}
                </p>
                <p className="text-xl font-semibold mt-1 tabular-nums leading-none">{count}</p>
              </button>
            );
          })}
        </div>
      </div>

      {activeBox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-today-summary-title"
          onClick={() => setSelectedBucket(null)}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-xl w-full max-w-3xl max-h-[min(80vh,36rem)] flex flex-col overflow-hidden"
            onClick={event => event.stopPropagation()}
          >
            <div className="px-3 py-2.5 border-b border-border flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3 id="task-today-summary-title" className="text-sm font-semibold leading-tight">
                  {activeBox.label}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{activeBox.hint}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBucket(null)}
                className="rounded-md border border-border p-1 hover:bg-muted shrink-0"
                aria-label={t('common.close')}
              >
                <X size={14} />
              </button>
            </div>
            <TableScrollContainer className="flex-1 min-h-0 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left">
                    <th className="px-3 py-1.5 font-medium">{t('overview.po')}</th>
                    <th className="px-3 py-1.5 font-medium">{t('common.vendor')}</th>
                    <th className="px-3 py-1.5 font-medium">{t('overview.delivery')}</th>
                    <th className="px-3 py-1.5 font-medium text-right">{t('overview.value')}</th>
                    <th className="px-3 py-1.5 font-medium">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        {activeBox.empty}
                      </td>
                    </tr>
                  ) : (
                    summaryOrders.map(order => {
                      const opening = openingPurchaseOrderId === order.id;
                      const selected = selectedPurchaseOrderId === order.id;
                      return (
                        <tr
                          key={order.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Open purchase order ${order.poNumber}`}
                          onClick={() => {
                            setSelectedBucket(null);
                            onOpenPurchaseOrder(order);
                          }}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedBucket(null);
                              onOpenPurchaseOrder(order);
                            }
                          }}
                          className={`border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer ${opening ? 'bg-primary/5' : ''} ${selected ? 'bg-primary/10' : ''}`}
                        >
                          <td className="px-3 py-1.5 font-sans text-primary">{order.poNumber}</td>
                          <td className="px-3 py-1.5">{order.vendorName}</td>
                          <td className="px-3 py-1.5 font-sans text-muted-foreground">{order.deliveryDate || '—'}</td>
                          <td className="px-3 py-1.5 font-sans text-right tabular-nums">{rm(orderTotal(order))}</td>
                          <td className="px-3 py-1.5">
                            <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                              {resolvePurchaseOrderStatusLabel(order)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </TableScrollContainer>
          </div>
        </div>
      ) : null}
    </>
  );
}
