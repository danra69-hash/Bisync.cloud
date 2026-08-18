import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, ClipboardList, PackageCheck, Layers, BadgeCheck } from 'lucide-react';
import { api, type PurchaseOrder } from '../../api';
import { resolvePurchaseOrderStatusLabel } from '../../data/purchaseOrderStatus';
import { ActivePurchasePanel } from '../../components/revenue/ActivePurchasePanel';
import { dateKeyInRange, formatTeamDate, rmsListDateWindow } from './teamRmsDates';

type ListKind = 'to-approve' | 'active' | 'received' | 'consolidated';

type Props = {
  onBackToTeam?: () => void;
  showBack?: boolean;
  /** Team employee display name — enables approve/receive/reconcile without platform AppUser. */
  employeeName?: string;
};

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('pending') || s.includes('approval')) return 'is-warn';
  if (s.includes('receiv') || s.includes('partial')) return 'is-info';
  if (s.includes('reconcil') || s.includes('consolidat') || s.includes('closed')) return 'is-ok';
  return '';
}

function orderSortDate(order: PurchaseOrder, kind: ListKind): string {
  if (kind === 'received') {
    return (order.receivedAt || order.deliveryDate || order.orderDate || '').slice(0, 10);
  }
  if (kind === 'consolidated') {
    return (order.reconciledAt || order.receivedAt || order.orderDate || '').slice(0, 10);
  }
  return (order.orderDate || order.deliveryDate || '').slice(0, 10);
}

function matchesKind(order: PurchaseOrder, kind: ListKind): boolean {
  const status = (order.status || '').trim();
  if (kind === 'to-approve') {
    return status === 'Pending Approval' || order.canApprove === true;
  }
  if (kind === 'active') {
    if (order.isPreCommitted) return false;
    if (status === 'Pending Approval') return false;
    return ![
      'Received',
      'Reconciled',
      'Commitment Closed',
    ].includes(status);
  }
  if (kind === 'received') {
    return status === 'Received'
      || status === 'Partially Delivered'
      || Boolean(order.receivedAt);
  }
  return status === 'Reconciled'
    || status === 'Commitment Closed'
    || Boolean(order.reconciledAt);
}

function inWindow(order: PurchaseOrder, kind: ListKind, from: string, to: string): boolean {
  const primary = orderSortDate(order, kind);
  if (dateKeyInRange(primary, from, to)) return true;
  return dateKeyInRange(order.orderDate, from, to);
}

function listTitle(kind: ListKind): string {
  if (kind === 'to-approve') return 'To Approve';
  if (kind === 'active') return 'Active Order';
  if (kind === 'received') return 'Received';
  return 'Consolidated';
}

function actionHint(order: PurchaseOrder): string {
  if (order.canApprove || order.status === 'Pending Approval') return 'Tap to approve';
  if (order.canReceive) return 'Tap to receive';
  if (order.canReconcile) return 'Tap to consolidate';
  return 'Tap to view';
}

export function TeamRmsLanding({ onBackToTeam, showBack = true, employeeName }: Props) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listKind, setListKind] = useState<ListKind | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const window = useMemo(() => rmsListDateWindow(), []);

  const refreshOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let list: PurchaseOrder[] = [];
      try {
        list = await api.purchaseOrders();
      } catch {
        list = await api.activePurchaseOrders();
      }
      setOrders(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load orders.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  const groupCounts = useMemo(() => {
    const counts: Record<ListKind, number> = {
      'to-approve': 0,
      active: 0,
      received: 0,
      consolidated: 0,
    };
    for (const kind of Object.keys(counts) as ListKind[]) {
      counts[kind] = orders.filter(
        o => matchesKind(o, kind) && inWindow(o, kind, window.from, window.to),
      ).length;
    }
    return counts;
  }, [orders, window.from, window.to]);

  const listed = useMemo(() => {
    if (!listKind) return [];
    const rows = orders.filter(
      o => matchesKind(o, listKind) && inWindow(o, listKind, window.from, window.to),
    );
    rows.sort((a, b) => {
      const da = orderSortDate(a, listKind);
      const db = orderSortDate(b, listKind);
      if (listKind === 'active' || listKind === 'to-approve') return da.localeCompare(db);
      return db.localeCompare(da);
    });
    return rows;
  }, [orders, listKind, window.from, window.to]);

  const openOrder = async (order: PurchaseOrder) => {
    setOpenError(null);
    setOpeningId(order.id);
    try {
      // Prefer full detail (items + workflow flags) for approve/receive/reconcile.
      const full = await api.purchaseOrder(order.id);
      setSelectedOrder(full);
    } catch {
      setSelectedOrder(order);
      setOpenError('Loaded summary only — some line details may be incomplete.');
    } finally {
      setOpeningId(null);
    }
  };

  const handleOrderUpdated = (updated: PurchaseOrder) => {
    setOrders(prev => {
      const idx = prev.findIndex(o => o.id === updated.id);
      if (idx < 0) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
    setSelectedOrder(updated);
    setOpenError(null);
  };

  if (listKind) {
    const title = listTitle(listKind);
    const count = groupCounts[listKind];
    return (
      <>
        <section className="team-card">
          <div className="team-panel-head">
            <button type="button" className="team-back-btn" onClick={() => setListKind(null)}>
              <ChevronRight style={{ transform: 'rotate(180deg)' }} size={16} />
              RMS home
            </button>
            <h3>
              {title}
              <span className="team-rms-group-count" aria-label={`${count} purchase orders`}>
                {loading ? '…' : count}
              </span>
            </h3>
          </div>
          <p className="team-muted" style={{ margin: '0 0 8px', fontSize: 11 }}>
            {formatTeamDate(window.from)} – {formatTeamDate(window.to)}
            {' · '}
            {loading ? '…' : `${count} PO${count === 1 ? '' : 's'}`}
            {' · '}
            {listKind === 'active' || listKind === 'to-approve' ? 'Oldest first' : 'Newest first'}
            {' · '}
            Tap a row to open
          </p>
          {loading ? <p className="team-muted">Loading…</p> : null}
          {error ? <p className="team-inline-error">{error}</p> : null}
          {openError ? <p className="team-inline-error">{openError}</p> : null}
          {!loading && !error && listed.length === 0 ? (
            <p className="team-muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>
              No {title.toLowerCase()} documents in this period.
            </p>
          ) : null}
          <ul className="team-rm-list">
            {listed.map(order => (
              <li key={order.id}>
                <button
                  type="button"
                  className="team-rm-list-item team-rm-list-item-btn"
                  onClick={() => void openOrder(order)}
                  disabled={openingId === order.id}
                >
                  <div>
                    <strong>{order.poNumber || `PO-${order.id}`}</strong>
                    <span className="team-muted">
                      {order.vendorName || 'Vendor'}
                      {' · '}
                      {formatTeamDate(orderSortDate(order, listKind))}
                      {' · '}
                      {openingId === order.id ? 'Opening…' : actionHint(order)}
                    </span>
                  </div>
                  <span className={`team-rm-status ${statusTone(order.status)}`}>
                    {resolvePurchaseOrderStatusLabel(order)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {selectedOrder ? (
          <ActivePurchasePanel
            order={selectedOrder}
            teamActorName={employeeName?.trim() || undefined}
            onClose={() => {
              setSelectedOrder(null);
              setOpenError(null);
              void refreshOrders();
            }}
            onUpdated={handleOrderUpdated}
          />
        ) : null}
      </>
    );
  }

  return (
    <section className="team-card team-landing-box">
      {showBack && onBackToTeam ? (
        <div className="team-panel-head">
          <button type="button" className="team-back-btn" onClick={onBackToTeam}>
            <ChevronRight style={{ transform: 'rotate(180deg)' }} size={16} />
            Chats
          </button>
        </div>
      ) : null}
      <header className="team-landing-box-head">
        <h3>Revenue Management</h3>
      </header>
      <p className="team-muted" style={{ margin: 0 }}>
        MTD plus last week of previous month
        {' · '}
        {formatTeamDate(window.from)} – {formatTeamDate(window.to)}
      </p>
      <p className="team-muted" style={{ margin: '6px 0 0', fontSize: 11 }}>
        Open a list, then tap an order to approve, receive, or consolidate. Adjust qty/price, add products, and enter vendor rating in the detail.
      </p>

      <button type="button" className="team-landing-row" onClick={() => setListKind('to-approve')}>
        <span className="team-landing-icon"><BadgeCheck size={16} /></span>
        <span className="team-landing-copy">
          <strong>To Approve</strong>
          <em>Pending approval · tap to open</em>
        </span>
        <span
          className={`team-landing-badge${groupCounts['to-approve'] === 0 ? ' is-zero' : ''}`}
          aria-label={`${loading ? 'Loading' : groupCounts['to-approve']} to approve`}
        >
          {loading ? '…' : groupCounts['to-approve']}
        </span>
        <ChevronRight size={16} className="team-landing-chevron" />
      </button>

      <button type="button" className="team-landing-row" onClick={() => setListKind('active')}>
        <span className="team-landing-icon"><ClipboardList size={16} /></span>
        <span className="team-landing-copy">
          <strong>Active Order</strong>
          <em>Open orders · receive from detail</em>
        </span>
        <span
          className={`team-landing-badge${groupCounts.active === 0 ? ' is-zero' : ''}`}
          aria-label={`${loading ? 'Loading' : groupCounts.active} active orders`}
        >
          {loading ? '…' : groupCounts.active}
        </span>
        <ChevronRight size={16} className="team-landing-chevron" />
      </button>

      <button type="button" className="team-landing-row" onClick={() => setListKind('received')}>
        <span className="team-landing-icon"><PackageCheck size={16} /></span>
        <span className="team-landing-copy">
          <strong>Received</strong>
          <em>Consolidate from detail</em>
        </span>
        <span
          className={`team-landing-badge${groupCounts.received === 0 ? ' is-zero' : ''}`}
          aria-label={`${loading ? 'Loading' : groupCounts.received} received`}
        >
          {loading ? '…' : groupCounts.received}
        </span>
        <ChevronRight size={16} className="team-landing-chevron" />
      </button>

      <button type="button" className="team-landing-row" onClick={() => setListKind('consolidated')}>
        <span className="team-landing-icon"><Layers size={16} /></span>
        <span className="team-landing-copy">
          <strong>Consolidated</strong>
          <em>View reconciled orders</em>
        </span>
        <span
          className={`team-landing-badge${groupCounts.consolidated === 0 ? ' is-zero' : ''}`}
          aria-label={`${loading ? 'Loading' : groupCounts.consolidated} consolidated`}
        >
          {loading ? '…' : groupCounts.consolidated}
        </span>
        <ChevronRight size={16} className="team-landing-chevron" />
      </button>
    </section>
  );
}
