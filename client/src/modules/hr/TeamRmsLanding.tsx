import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ClipboardList, PackageCheck, Layers, BadgeCheck } from 'lucide-react';
import { api, type PurchaseOrder } from '../../api';
import { resolvePurchaseOrderStatusLabel } from '../../data/purchaseOrderStatus';
import { dateKeyInRange, formatTeamDate, rmsListDateWindow } from './teamRmsDates';

type ListKind = 'to-approve' | 'active' | 'received' | 'consolidated';

type Props = {
  onBackToTeam?: () => void;
  showBack?: boolean;
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

export function TeamRmsLanding({ onBackToTeam, showBack = true }: Props) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listKind, setListKind] = useState<ListKind | null>(null);

  const window = useMemo(() => rmsListDateWindow(), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        let list: PurchaseOrder[] = [];
        try {
          list = await api.purchaseOrders();
        } catch {
          list = await api.activePurchaseOrders();
        }
        if (!cancelled) setOrders(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load orders.');
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  if (listKind) {
    const title = listTitle(listKind);
    return (
      <section className="team-card">
        <div className="team-panel-head">
          <button type="button" className="team-back-btn" onClick={() => setListKind(null)}>
            <ChevronRight style={{ transform: 'rotate(180deg)' }} size={16} />
            RMS home
          </button>
          <h3>{title}</h3>
        </div>
        <p className="team-muted" style={{ margin: '0 0 8px', fontSize: 11 }}>
          {formatTeamDate(window.from)} – {formatTeamDate(window.to)}
          {' · '}
          {listKind === 'active' || listKind === 'to-approve' ? 'Oldest first' : 'Newest first'}
        </p>
        {loading ? <p className="team-muted">Loading…</p> : null}
        {error ? <p className="team-inline-error">{error}</p> : null}
        {!loading && !error && listed.length === 0 ? (
          <p className="team-muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>
            No {title.toLowerCase()} documents in this period.
          </p>
        ) : null}
        <ul className="team-rm-list">
          {listed.map(order => (
            <li key={order.id} className="team-rm-list-item">
              <div>
                <strong>{order.poNumber || `PO-${order.id}`}</strong>
                <span className="team-muted">
                  {order.vendorName || 'Vendor'}
                  {' · '}
                  {formatTeamDate(orderSortDate(order, listKind))}
                </span>
              </div>
              <span className={`team-rm-status ${statusTone(order.status)}`}>
                {resolvePurchaseOrderStatusLabel(order)}
              </span>
            </li>
          ))}
        </ul>
      </section>
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

      <button type="button" className="team-landing-row" onClick={() => setListKind('to-approve')}>
        <span className="team-landing-icon"><BadgeCheck size={16} /></span>
        <span className="team-landing-copy">
          <strong>To Approve</strong>
          <em>Pending approval · oldest first</em>
        </span>
        <ChevronRight size={16} className="team-landing-chevron" />
      </button>

      <button type="button" className="team-landing-row" onClick={() => setListKind('active')}>
        <span className="team-landing-icon"><ClipboardList size={16} /></span>
        <span className="team-landing-copy">
          <strong>Active Order</strong>
          <em>Open orders · oldest first</em>
        </span>
        <ChevronRight size={16} className="team-landing-chevron" />
      </button>

      <button type="button" className="team-landing-row" onClick={() => setListKind('received')}>
        <span className="team-landing-icon"><PackageCheck size={16} /></span>
        <span className="team-landing-copy">
          <strong>Received</strong>
          <em>Received deliveries · newest first</em>
        </span>
        <ChevronRight size={16} className="team-landing-chevron" />
      </button>

      <button type="button" className="team-landing-row" onClick={() => setListKind('consolidated')}>
        <span className="team-landing-icon"><Layers size={16} /></span>
        <span className="team-landing-copy">
          <strong>Consolidated</strong>
          <em>Reconciled orders · newest first</em>
        </span>
        <ChevronRight size={16} className="team-landing-chevron" />
      </button>
    </section>
  );
}
