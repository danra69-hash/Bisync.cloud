import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  Camera,
  ChevronRight,
  ClipboardList,
  Package,
  ShoppingCart,
  Trash2,
  ArrowLeftRight,
  Boxes,
} from 'lucide-react';
import { api, type PurchaseOrder, type TransferEntry, type WastageEntry } from '../../api';
import type { AttendanceRecord, Employee, LeaveBalanceRow, LeaveRequest } from './types';

export type TeamHomePanel =
  | 'landing'
  | 'rm-active'
  | 'rm-order'
  | 'rm-receive'
  | 'rm-consolidate'
  | 'rm-transfer'
  | 'rm-wastage'
  | 'rm-inventory';

type DayInfo = { type: string; label: string };

type Announcement = {
  id: string;
  from: string;
  body: string;
  at: string;
  read: boolean;
};

type Props = {
  employee: Employee;
  todayLabel: string;
  todayInfo: DayInfo;
  todayAttendance: AttendanceRecord | null;
  nowLabel: string;
  checkLabel: string;
  checkBusy: boolean;
  onStartScanner: () => void;
  leaveBalance: LeaveBalanceRow | null | undefined;
  carryForward: number;
  leaveRequests: LeaveRequest[];
  announcements: Announcement[];
  onOpenSchedule: () => void;
  onOpenMessages: () => void;
  onOpenLeave: () => void;
  onMarkAnnouncementRead: (id: string) => void;
  panel: TeamHomePanel;
  onPanelChange: (panel: TeamHomePanel) => void;
};

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('pending') || s.includes('approval')) return 'is-warn';
  if (s.includes('receiv') || s.includes('partial')) return 'is-info';
  if (s.includes('reconcil') || s.includes('consolidat') || s.includes('closed')) return 'is-ok';
  return '';
}

function PoList({
  title,
  empty,
  orders,
  loading,
  error,
  onBack,
}: {
  title: string;
  empty: string;
  orders: PurchaseOrder[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  return (
    <section className="team-card">
      <div className="team-panel-head">
        <button type="button" className="team-back-btn" onClick={onBack} aria-label="Back">
          <ChevronRight style={{ transform: 'rotate(180deg)' }} size={16} />
          Home
        </button>
        <h3>{title}</h3>
      </div>
      {loading ? <p className="team-muted">Loading…</p> : null}
      {error ? <p className="team-inline-error">{error}</p> : null}
      {!loading && !error && orders.length === 0 ? (
        <p className="team-muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>{empty}</p>
      ) : null}
      <ul className="team-rm-list">
        {orders.map(order => (
          <li key={order.id} className="team-rm-list-item">
            <div>
              <strong>{order.poNumber || `PO-${order.id}`}</strong>
              <span className="team-muted">{order.vendorName || 'Vendor'}</span>
            </div>
            <span className={`team-rm-status ${statusTone(order.status)}`}>{order.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TeamHomeLanding({
  employee,
  todayLabel,
  todayInfo,
  todayAttendance,
  nowLabel,
  checkLabel,
  checkBusy,
  onStartScanner,
  leaveBalance,
  carryForward,
  leaveRequests,
  announcements,
  onOpenSchedule,
  onOpenMessages,
  onOpenLeave,
  onMarkAnnouncementRead,
  panel,
  onPanelChange,
}: Props) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [wastage, setWastage] = useState<WastageEntry[]>([]);
  const [transfers, setTransfers] = useState<TransferEntry[]>([]);
  const [rmLoading, setRmLoading] = useState(false);
  const [rmError, setRmError] = useState<string | null>(null);

  const checkedIn = Boolean(todayAttendance?.actualIn);
  const checkedOut = Boolean(todayAttendance?.actualOut);

  const myPendingLeave = useMemo(
    () => leaveRequests.filter(r => r.employeeId === employee.id && r.status === 'Pending'),
    [leaveRequests, employee.id],
  );

  const teamPendingApprovals = useMemo(
    () => leaveRequests.filter(r => r.status === 'Pending' && r.employeeId !== employee.id),
    [leaveRequests, employee.id],
  );

  const unreadAnnouncements = announcements.filter(a => !a.read);
  const latestAnnouncements = (unreadAnnouncements.length > 0 ? unreadAnnouncements : announcements).slice(0, 3);

  const approvalCount = myPendingLeave.length + teamPendingApprovals.length;

  useEffect(() => {
    if (panel === 'landing') return;
    let cancelled = false;
    setRmLoading(true);
    setRmError(null);

    void (async () => {
      try {
        if (
          panel === 'rm-active'
          || panel === 'rm-order'
          || panel === 'rm-receive'
          || panel === 'rm-consolidate'
        ) {
          const list = await api.activePurchaseOrders();
          if (!cancelled) setOrders(Array.isArray(list) ? list : []);
        } else if (panel === 'rm-wastage') {
          const list = await api.wastageEntries(undefined, []);
          if (!cancelled) setWastage(Array.isArray(list) ? list : []);
        } else if (panel === 'rm-transfer') {
          const list = await api.transfers(undefined, []);
          if (!cancelled) setTransfers(Array.isArray(list) ? list : []);
        } else if (panel === 'rm-inventory') {
          if (!cancelled) setOrders([]);
        }
      } catch (err) {
        if (!cancelled) {
          setRmError(err instanceof Error ? err.message : 'Unable to load data.');
          setOrders([]);
          setWastage([]);
          setTransfers([]);
        }
      } finally {
        if (!cancelled) setRmLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [panel]);

  const filteredOrders = useMemo(() => {
    if (panel === 'rm-order') {
      return orders.filter(o =>
        o.documentType === 'PR'
        || o.status === 'Pending Approval'
        || o.canApprove === true,
      );
    }
    if (panel === 'rm-receive') {
      return orders.filter(o => o.canReceive === true || /receiv|partial/i.test(o.status));
    }
    if (panel === 'rm-consolidate') {
      return orders.filter(o => o.canReconcile === true || /reconcil|consolidat/i.test(o.status));
    }
    return orders;
  }, [orders, panel]);

  if (panel === 'rm-active') {
    return (
      <PoList
        title="Active Purchase"
        empty="No active purchase orders."
        orders={filteredOrders}
        loading={rmLoading}
        error={rmError}
        onBack={() => onPanelChange('landing')}
      />
    );
  }
  if (panel === 'rm-order') {
    return (
      <PoList
        title="My Order · Order"
        empty="No orders waiting for approval."
        orders={filteredOrders}
        loading={rmLoading}
        error={rmError}
        onBack={() => onPanelChange('landing')}
      />
    );
  }
  if (panel === 'rm-receive') {
    return (
      <PoList
        title="My Order · Receive"
        empty="No orders ready to receive."
        orders={filteredOrders}
        loading={rmLoading}
        error={rmError}
        onBack={() => onPanelChange('landing')}
      />
    );
  }
  if (panel === 'rm-consolidate') {
    return (
      <PoList
        title="My Order · Consolidate"
        empty="No orders ready to consolidate."
        orders={filteredOrders}
        loading={rmLoading}
        error={rmError}
        onBack={() => onPanelChange('landing')}
      />
    );
  }

  if (panel === 'rm-wastage') {
    return (
      <section className="team-card">
        <div className="team-panel-head">
          <button type="button" className="team-back-btn" onClick={() => onPanelChange('landing')}>
            <ChevronRight style={{ transform: 'rotate(180deg)' }} size={16} />
            Home
          </button>
          <h3>Stock · Wastage</h3>
        </div>
        {rmLoading ? <p className="team-muted">Loading…</p> : null}
        {rmError ? <p className="team-inline-error">{rmError}</p> : null}
        {!rmLoading && !rmError && wastage.length === 0 ? (
          <p className="team-muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>No wastage entries.</p>
        ) : null}
        <ul className="team-rm-list">
          {wastage.slice(0, 40).map(entry => (
            <li key={entry.id} className="team-rm-list-item">
              <div>
                <strong>{entry.itemName || entry.reason || `Wastage #${entry.id}`}</strong>
                <span className="team-muted">{entry.wastedDate || entry.createdAt || '—'}</span>
              </div>
              <span className="team-rm-status">
                {entry.quantity} {entry.uom}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (panel === 'rm-transfer') {
    return (
      <section className="team-card">
        <div className="team-panel-head">
          <button type="button" className="team-back-btn" onClick={() => onPanelChange('landing')}>
            <ChevronRight style={{ transform: 'rotate(180deg)' }} size={16} />
            Home
          </button>
          <h3>Stock · Transfer</h3>
        </div>
        {rmLoading ? <p className="team-muted">Loading…</p> : null}
        {rmError ? <p className="team-inline-error">{rmError}</p> : null}
        {!rmLoading && !rmError && transfers.length === 0 ? (
          <p className="team-muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>No transfers.</p>
        ) : null}
        <ul className="team-rm-list">
          {transfers.slice(0, 40).map(entry => (
            <li key={entry.id} className="team-rm-list-item">
              <div>
                <strong>{entry.itemName || `TR-${entry.id}`}</strong>
                <span className="team-muted">
                  {(entry.fromLocationExternalId || 'From')}
                  {' → '}
                  {(entry.toLocationExternalId || 'To')}
                </span>
              </div>
              <span className={`team-rm-status ${statusTone(entry.status || '')}`}>
                {entry.status || '—'} · {entry.quantity} {entry.uom}
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (panel === 'rm-inventory') {
    return (
      <section className="team-card">
        <div className="team-panel-head">
          <button type="button" className="team-back-btn" onClick={() => onPanelChange('landing')}>
            <ChevronRight style={{ transform: 'rotate(180deg)' }} size={16} />
            Home
          </button>
          <h3>Stock · Inventory</h3>
        </div>
        <p className="team-muted" style={{ margin: 0 }}>
          Open Inventory counts from Revenue Management on desktop for full post and confirmation.
          Team inventory shortcuts will expand here as mobile count flows are enabled.
        </p>
        <button
          type="button"
          className="team-btn team-btn-primary"
          style={{ marginTop: 12 }}
          onClick={() => onPanelChange('landing')}
        >
          Back to home
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="team-card team-landing-box">
        <header className="team-landing-box-head">
          <h3>Activity today</h3>
          <span className="team-muted">{todayLabel}</span>
        </header>

        <button type="button" className="team-landing-row" onClick={onOpenSchedule}>
          <span className="team-landing-icon"><CalendarDays size={16} /></span>
          <span className="team-landing-copy">
            <strong>Duty schedule</strong>
            <em>{todayInfo.label}</em>
          </span>
          <ChevronRight size={16} className="team-landing-chevron" />
        </button>

        <div className="team-landing-block">
          <div className="team-landing-block-title">
            <Bell size={14} />
            <span>Company announcement</span>
            {unreadAnnouncements.length > 0 ? (
              <span className="team-landing-badge">{unreadAnnouncements.length}</span>
            ) : null}
          </div>
          {latestAnnouncements.length === 0 ? (
            <p className="team-muted" style={{ margin: '6px 0 0' }}>No announcements.</p>
          ) : (
            latestAnnouncements.map(item => (
              <button
                key={item.id}
                type="button"
                className={`team-announcement-row${item.read ? '' : ' is-unread'}`}
                onClick={() => {
                  onMarkAnnouncementRead(item.id);
                  onOpenMessages();
                }}
              >
                <strong>{item.from}</strong>
                <span>{item.body}</span>
              </button>
            ))
          )}
        </div>

        <button type="button" className="team-landing-row" onClick={onOpenLeave}>
          <span className="team-landing-icon"><ClipboardList size={16} /></span>
          <span className="team-landing-copy">
            <strong>Any approval waiting</strong>
            <em>
              {approvalCount === 0
                ? 'Nothing waiting'
                : [
                    myPendingLeave.length > 0 ? `${myPendingLeave.length} your leave` : null,
                    teamPendingApprovals.length > 0 ? `${teamPendingApprovals.length} team leave` : null,
                  ].filter(Boolean).join(' · ')}
            </em>
          </span>
          {approvalCount > 0 ? <span className="team-landing-badge">{approvalCount}</span> : null}
          <ChevronRight size={16} className="team-landing-chevron" />
        </button>
      </section>

      <section className="team-card team-landing-box">
        <header className="team-landing-box-head">
          <h3>HR</h3>
        </header>

        <div className="team-landing-block">
          <div className="team-landing-block-title">
            <span>Current build</span>
          </div>
          <dl className="team-kv team-kv-compact">
            <div>
              <dt>Role</dt>
              <dd>{employee.position || '—'}</dd>
            </div>
            <div>
              <dt>Dept</dt>
              <dd>{employee.department || '—'}</dd>
            </div>
            <div>
              <dt>AL</dt>
              <dd>
                {leaveBalance?.alBalance ?? 0}
                {carryForward > 0 ? ` (${carryForward})` : ''}
              </dd>
            </div>
            <div>
              <dt>RDO</dt>
              <dd>{leaveBalance?.rdoBalance ?? 0}</dd>
            </div>
            <div>
              <dt>RPH</dt>
              <dd>{leaveBalance?.rphBalance ?? 0}</dd>
            </div>
            <div>
              <dt>Duty</dt>
              <dd>{todayInfo.label}</dd>
            </div>
          </dl>
          <button type="button" className="team-btn team-btn-ghost-wide" onClick={onOpenLeave}>
            Open leave &amp; balances
          </button>
        </div>

        <div className="team-landing-block team-landing-clock">
          <div className="team-landing-block-title" style={{ justifyContent: 'space-between' }}>
            <span>Clock</span>
            <span className={`team-status-pill ${checkedIn && !checkedOut ? 'is-in' : 'is-out'}`}>
              {!checkedIn ? 'Not checked in' : checkedOut ? 'Away / on break' : 'On duty'}
            </span>
          </div>
          <p className="team-hero-time" style={{ margin: '4px 0 8px' }}>{nowLabel}</p>
          <button
            type="button"
            className="team-punch-btn"
            disabled={checkBusy}
            onClick={() => void onStartScanner()}
          >
            <Camera size={16} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 6 }} />
            {checkLabel}
          </button>
          <dl className="team-kv team-kv-compact" style={{ marginTop: 10 }}>
            <div>
              <dt>Actual in</dt>
              <dd>{todayAttendance?.actualIn?.slice(0, 5) || '—'}</dd>
            </div>
            <div>
              <dt>Actual out</dt>
              <dd>{todayAttendance?.actualOut?.slice(0, 5) || '—'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="team-card team-landing-box">
        <header className="team-landing-box-head">
          <h3>Revenue Management</h3>
        </header>

        <button type="button" className="team-landing-row" onClick={() => onPanelChange('rm-active')}>
          <span className="team-landing-icon"><ShoppingCart size={16} /></span>
          <span className="team-landing-copy">
            <strong>Active Purchase</strong>
            <em>Open purchase orders in progress</em>
          </span>
          <ChevronRight size={16} className="team-landing-chevron" />
        </button>

        <div className="team-landing-block">
          <div className="team-landing-block-title">
            <Package size={14} />
            <span>My Order</span>
          </div>
          <div className="team-landing-tiles">
            <button type="button" onClick={() => onPanelChange('rm-order')}>
              <ClipboardList size={15} />
              Order
            </button>
            <button type="button" onClick={() => onPanelChange('rm-receive')}>
              <Package size={15} />
              Receive
            </button>
            <button type="button" onClick={() => onPanelChange('rm-consolidate')}>
              <Boxes size={15} />
              Consolidate
            </button>
          </div>
        </div>

        <div className="team-landing-block">
          <div className="team-landing-block-title">
            <Boxes size={14} />
            <span>Stock</span>
          </div>
          <div className="team-landing-tiles">
            <button type="button" onClick={() => onPanelChange('rm-transfer')}>
              <ArrowLeftRight size={15} />
              Transfer
            </button>
            <button type="button" onClick={() => onPanelChange('rm-wastage')}>
              <Trash2 size={15} />
              Wastage
            </button>
            <button type="button" onClick={() => onPanelChange('rm-inventory')}>
              <Boxes size={15} />
              Inventory
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
