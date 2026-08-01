import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bell,
  Briefcase,
  CalendarDays,
  Camera,
  ChevronRight,
  ClipboardList,
  Package,
  ShoppingCart,
  Trash2,
  ArrowLeftRight,
  Boxes,
  Store,
} from 'lucide-react';
import { api, type PurchaseOrder, type TransferEntry, type WastageEntry } from '../../api';
import type { AttendanceRecord, Employee, LeaveBalanceRow, LeaveRequest } from './types';

export type TeamAppMode = 'landing' | 'hr' | 'rms';
export type HrTab = 'home' | 'schedule' | 'leave' | 'messages';
export type RmsTab = 'home' | 'order' | 'stock';
export type RmsOrderView = 'menu' | 'active' | 'order' | 'receive' | 'consolidate';
export type RmsStockView = 'menu' | 'transfer' | 'wastage' | 'inventory';

type DayInfo = { type: string; label: string };

type Announcement = {
  id: string;
  from: string;
  body: string;
  at: string;
  read: boolean;
};

type Props = {
  mode: TeamAppMode;
  onModeChange: (mode: TeamAppMode) => void;
  hrTab: HrTab;
  onHrTabChange: (tab: HrTab) => void;
  rmsTab: RmsTab;
  onRmsTabChange: (tab: RmsTab) => void;
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
  scheduleSlot?: ReactNode;
  leaveSlot?: ReactNode;
  messagesSlot?: ReactNode;
};

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('pending') || s.includes('approval')) return 'is-warn';
  if (s.includes('receiv') || s.includes('partial')) return 'is-info';
  if (s.includes('reconcil') || s.includes('consolidat') || s.includes('closed')) return 'is-ok';
  return '';
}

function BackHome({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="team-panel-head">
      <button type="button" className="team-back-btn" onClick={onBack} aria-label="Back">
        <ChevronRight style={{ transform: 'rotate(180deg)' }} size={16} />
        {label}
      </button>
    </div>
  );
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
      <BackHome label="Order" onBack={onBack} />
      <h3 style={{ margin: '0 0 8px' }}>{title}</h3>
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

function HrHomeContent({
  employee,
  todayInfo,
  todayAttendance,
  nowLabel,
  checkLabel,
  checkBusy,
  onStartScanner,
  leaveBalance,
  carryForward,
  onOpenLeave,
  onBackToTeam,
}: {
  employee: Employee;
  todayInfo: DayInfo;
  todayAttendance: AttendanceRecord | null;
  nowLabel: string;
  checkLabel: string;
  checkBusy: boolean;
  onStartScanner: () => void;
  leaveBalance: LeaveBalanceRow | null | undefined;
  carryForward: number;
  onOpenLeave: () => void;
  onBackToTeam: () => void;
}) {
  const checkedIn = Boolean(todayAttendance?.actualIn);
  const checkedOut = Boolean(todayAttendance?.actualOut);

  return (
    <section className="team-card team-landing-box">
      <BackHome label="Team home" onBack={onBackToTeam} />
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
  );
}

export function TeamHomeLanding({
  mode,
  onModeChange,
  hrTab,
  rmsTab,
  onRmsTabChange,
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
  scheduleSlot,
  leaveSlot,
  messagesSlot,
}: Props) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [wastage, setWastage] = useState<WastageEntry[]>([]);
  const [transfers, setTransfers] = useState<TransferEntry[]>([]);
  const [rmLoading, setRmLoading] = useState(false);
  const [rmError, setRmError] = useState<string | null>(null);
  const [orderView, setOrderView] = useState<RmsOrderView>('menu');
  const [stockView, setStockView] = useState<RmsStockView>('menu');

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
    if (mode !== 'rms') return;
    setOrderView('menu');
    setStockView('menu');
  }, [mode, rmsTab]);

  useEffect(() => {
    if (mode !== 'rms') return;
    const needOrders = rmsTab === 'home' || rmsTab === 'order';
    const needWastage = rmsTab === 'stock' && stockView === 'wastage';
    const needTransfers = rmsTab === 'stock' && stockView === 'transfer';
    if (!needOrders && !needWastage && !needTransfers) return;

    let cancelled = false;
    setRmLoading(true);
    setRmError(null);

    void (async () => {
      try {
        if (needOrders) {
          const list = await api.activePurchaseOrders();
          if (!cancelled) setOrders(Array.isArray(list) ? list : []);
        } else if (needWastage) {
          const list = await api.wastageEntries(undefined, []);
          if (!cancelled) setWastage(Array.isArray(list) ? list : []);
        } else if (needTransfers) {
          const list = await api.transfers(undefined, []);
          if (!cancelled) setTransfers(Array.isArray(list) ? list : []);
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
  }, [mode, rmsTab, stockView, orderView]);

  const filteredOrders = useMemo(() => {
    if (orderView === 'order') {
      return orders.filter(o =>
        o.documentType === 'PR'
        || o.status === 'Pending Approval'
        || o.canApprove === true,
      );
    }
    if (orderView === 'receive') {
      return orders.filter(o => o.canReceive === true || /receiv|partial/i.test(o.status));
    }
    if (orderView === 'consolidate') {
      return orders.filter(o => o.canReconcile === true || /reconcil|consolidat/i.test(o.status));
    }
    return orders;
  }, [orders, orderView]);

  if (mode === 'hr') {
    if (hrTab === 'schedule') return <>{scheduleSlot}</>;
    if (hrTab === 'leave') return <>{leaveSlot}</>;
    if (hrTab === 'messages') return <>{messagesSlot}</>;
    return (
      <HrHomeContent
        employee={employee}
        todayInfo={todayInfo}
        todayAttendance={todayAttendance}
        nowLabel={nowLabel}
        checkLabel={checkLabel}
        checkBusy={checkBusy}
        onStartScanner={onStartScanner}
        leaveBalance={leaveBalance}
        carryForward={carryForward}
        onOpenLeave={onOpenLeave}
        onBackToTeam={() => onModeChange('landing')}
      />
    );
  }

  if (mode === 'rms') {
    if (rmsTab === 'order') {
      if (orderView === 'active') {
        return (
          <PoList
            title="Active Purchase"
            empty="No active purchase orders."
            orders={filteredOrders}
            loading={rmLoading}
            error={rmError}
            onBack={() => setOrderView('menu')}
          />
        );
      }
      if (orderView === 'order') {
        return (
          <PoList
            title="My Order · Order"
            empty="No orders waiting for approval."
            orders={filteredOrders}
            loading={rmLoading}
            error={rmError}
            onBack={() => setOrderView('menu')}
          />
        );
      }
      if (orderView === 'receive') {
        return (
          <PoList
            title="My Order · Receive"
            empty="No orders ready to receive."
            orders={filteredOrders}
            loading={rmLoading}
            error={rmError}
            onBack={() => setOrderView('menu')}
          />
        );
      }
      if (orderView === 'consolidate') {
        return (
          <PoList
            title="My Order · Consolidate"
            empty="No orders ready to consolidate."
            orders={filteredOrders}
            loading={rmLoading}
            error={rmError}
            onBack={() => setOrderView('menu')}
          />
        );
      }

      return (
        <section className="team-card team-landing-box">
          <header className="team-landing-box-head">
            <h3>Order</h3>
          </header>
          <button type="button" className="team-landing-row" onClick={() => setOrderView('active')}>
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
              <button type="button" onClick={() => setOrderView('order')}>
                <ClipboardList size={15} />
                Order
              </button>
              <button type="button" onClick={() => setOrderView('receive')}>
                <Package size={15} />
                Receive
              </button>
              <button type="button" onClick={() => setOrderView('consolidate')}>
                <Boxes size={15} />
                Consolidate
              </button>
            </div>
          </div>
        </section>
      );
    }

    if (rmsTab === 'stock') {
      if (stockView === 'wastage') {
        return (
          <section className="team-card">
            <BackHome label="Stock" onBack={() => setStockView('menu')} />
            <h3 style={{ margin: '0 0 8px' }}>Stock · Wastage</h3>
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
      if (stockView === 'transfer') {
        return (
          <section className="team-card">
            <BackHome label="Stock" onBack={() => setStockView('menu')} />
            <h3 style={{ margin: '0 0 8px' }}>Stock · Transfer</h3>
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
      if (stockView === 'inventory') {
        return (
          <section className="team-card">
            <BackHome label="Stock" onBack={() => setStockView('menu')} />
            <h3 style={{ margin: '0 0 8px' }}>Stock · Inventory</h3>
            <p className="team-muted" style={{ margin: 0 }}>
              Open Inventory counts from Revenue Management on desktop for full post and confirmation.
              Team inventory shortcuts will expand here as mobile count flows are enabled.
            </p>
          </section>
        );
      }

      return (
        <section className="team-card team-landing-box">
          <header className="team-landing-box-head">
            <h3>Stock</h3>
          </header>
          <div className="team-landing-tiles team-landing-tiles-stack">
            <button type="button" onClick={() => setStockView('transfer')}>
              <ArrowLeftRight size={15} />
              Transfer
            </button>
            <button type="button" onClick={() => setStockView('wastage')}>
              <Trash2 size={15} />
              Wastage
            </button>
            <button type="button" onClick={() => setStockView('inventory')}>
              <Boxes size={15} />
              Inventory
            </button>
          </div>
        </section>
      );
    }

    // RMS New Home
    return (
      <section className="team-card team-landing-box">
        <BackHome label="Team home" onBack={() => onModeChange('landing')} />
        <header className="team-landing-box-head">
          <h3>Revenue Management</h3>
        </header>
        <p className="team-muted" style={{ margin: 0 }}>
          Orders, receiving, and stock tools for this location.
        </p>
        <button
          type="button"
          className="team-landing-row"
          onClick={() => onRmsTabChange('order')}
        >
          <span className="team-landing-icon"><ShoppingCart size={16} /></span>
          <span className="team-landing-copy">
            <strong>Go to Order</strong>
            <em>Active purchase, receive, consolidate</em>
          </span>
          <ChevronRight size={16} className="team-landing-chevron" />
        </button>
        <button
          type="button"
          className="team-landing-row"
          onClick={() => onRmsTabChange('stock')}
        >
          <span className="team-landing-icon"><Boxes size={16} /></span>
          <span className="team-landing-copy">
            <strong>Go to Stock</strong>
            <em>Transfer, wastage, inventory</em>
          </span>
          <ChevronRight size={16} className="team-landing-chevron" />
        </button>
      </section>
    );
  }

  // Landing
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

      <button
        type="button"
        className="team-card team-app-box"
        onClick={() => onModeChange('hr')}
      >
        <span className="team-app-box-icon"><Briefcase size={22} /></span>
        <span className="team-app-box-copy">
          <strong>HR</strong>
          <em>Clock, schedule, leave</em>
        </span>
        <ChevronRight size={18} className="team-landing-chevron" />
      </button>

      <button
        type="button"
        className="team-card team-app-box"
        onClick={() => onModeChange('rms')}
      >
        <span className="team-app-box-icon"><Store size={22} /></span>
        <span className="team-app-box-copy">
          <strong>Revenue Management</strong>
          <em>Orders and stock</em>
        </span>
        <ChevronRight size={18} className="team-landing-chevron" />
      </button>
    </>
  );
}
