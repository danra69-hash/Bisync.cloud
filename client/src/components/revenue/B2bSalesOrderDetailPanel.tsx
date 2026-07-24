import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, ExternalLink, X } from 'lucide-react';
import { api, type B2bSalesOrder } from '../../api';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';
import {
  buildSalesOrderShareUrl,
  buildSalesOrderWhatsAppUrl,
  copySalesOrderShareLink,
} from '../../data/salesOrderShare';
import {
  DETAIL_PANEL_OVERLAY_ELEVATED_CLS,
  DETAIL_PANEL_SHELL_ELEVATED_CLS,
} from '../layout/sidePanelShared';
import { TableScrollContainer } from '../shared/TableScrollContainer';

type Props = {
  order: B2bSalesOrder;
  onClose: () => void;
  onUpdated?: (order: B2bSalesOrder) => void;
};

function orderTotal(order: B2bSalesOrder): number {
  return (order.lines ?? []).reduce((sum, line) => sum + line.quantityOrdered * line.rrp, 0);
}

function statusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Pending Approval';
    case 'issued':
      return 'Issued';
    case 'confirmed':
      return 'Confirmed';
    case 'fulfilled':
      return 'Fulfilled';
    case 'expired':
      return 'Expired';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status || '—';
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-amber-100 text-amber-800';
    case 'issued':
      return 'bg-sky-100 text-sky-800';
    case 'confirmed':
      return 'bg-emerald-100 text-emerald-800';
    case 'fulfilled':
      return 'bg-violet-100 text-violet-800';
    case 'expired':
      return 'bg-muted text-muted-foreground';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value?.trim()) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleString();
}

export function B2bSalesOrderDetailPanel({ order: initialOrder, onClose, onUpdated }: Props) {
  const { rm } = useCountryFormatters();
  const [order, setOrder] = useState(initialOrder);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api.b2bSalesOrder(initialOrder.id)
      .then(fresh => {
        if (cancelled) return;
        setOrder(fresh);
        onUpdated?.(fresh);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load sales order.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [initialOrder.id]);

  const total = useMemo(() => orderTotal(order), [order]);
  const token = order.shareToken?.trim() ?? '';
  const canShare = order.status === 'issued' || order.status === 'confirmed';

  async function ensureToken(): Promise<string> {
    if (token) return token;
    const refreshed = await api.ensureB2bSalesOrderShareToken(order.id);
    setOrder(refreshed);
    onUpdated?.(refreshed);
    return refreshed.shareToken?.trim() ?? '';
  }

  async function handleCopy() {
    setBusy(true);
    setError(null);
    try {
      const nextToken = await ensureToken();
      if (!nextToken) throw new Error('Share link is not available.');
      await copySalesOrderShareLink(nextToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy link.');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <>
      <div className={DETAIL_PANEL_OVERLAY_ELEVATED_CLS} onClick={onClose} />
      <aside className={DETAIL_PANEL_SHELL_ELEVATED_CLS} role="dialog" aria-label={`Sales order ${order.orderNumber}`}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-sans uppercase tracking-widest text-muted-foreground">
              Order on Hand
            </p>
            <h2 className="text-base font-semibold mt-1">{order.orderNumber}</h2>
            <p className="text-xs text-muted-foreground mt-1">{order.customerName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          ) : null}
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading order details…</p>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">SO Number</p>
              <p className="font-sans font-medium mt-0.5">{order.orderNumber}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Customer</p>
              <p className="font-medium mt-0.5">{order.customerName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="mt-0.5">
                <span className={`text-[10px] font-sans px-1.5 py-0.5 rounded ${statusBadgeClass(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total</p>
              <p className="font-sans font-medium mt-0.5">{rm(total)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Issued</p>
              <p className="font-sans mt-0.5">{order.issuedDate?.trim() || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-sans mt-0.5">{formatDate(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Updated</p>
              <p className="font-sans mt-0.5">{formatDate(order.updatedAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Source</p>
              <p className="mt-0.5">{order.source || '—'}</p>
            </div>
          </div>

          {canShare ? (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-border hover:bg-muted disabled:opacity-50"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              {token ? (
                <a
                  href={buildSalesOrderWhatsAppUrl(token, order.orderNumber, order.customerName)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#25D366] text-white hover:bg-[#1ebe57]"
                  title={buildSalesOrderShareUrl(token)}
                >
                  <ExternalLink size={11} />
                  WhatsApp
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-muted/20">
              <h3 className="text-xs font-semibold">Lines</h3>
            </div>
            <TableScrollContainer className="max-h-[50vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Location</th>
                    <th className="px-3 py-2 font-medium text-right">Qty</th>
                    <th className="px-3 py-2 font-medium">UOM</th>
                    <th className="px-3 py-2 font-medium text-right">RRP</th>
                    <th className="px-3 py-2 font-medium text-right">Line total</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.lines ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        No lines on this order.
                      </td>
                    </tr>
                  ) : (
                    (order.lines ?? []).map(line => (
                      <tr key={line.id} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 font-medium">{line.productName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{line.locationExternalId || '—'}</td>
                        <td className="px-3 py-2 text-right font-sans">{line.quantityOrdered}</td>
                        <td className="px-3 py-2">{line.uom || '—'}</td>
                        <td className="px-3 py-2 text-right font-sans">{rm(line.rrp)}</td>
                        <td className="px-3 py-2 text-right font-sans font-semibold">
                          {rm(line.quantityOrdered * line.rrp)}
                        </td>
                        <td className="px-3 py-2">{line.status || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableScrollContainer>
          </div>
        </div>
      </aside>
    </>,
    document.body,
  );
}
