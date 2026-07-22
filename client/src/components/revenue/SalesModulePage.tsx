import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Users, X } from 'lucide-react';
import {
  api,
  type SalesModuleAppointment,
  type SalesModuleCompany,
  type SalesModuleCustomer,
  type SalesModuleTeamCalendarEvent,
  type SalesModuleTeamMember,
  type UpsertSalesModuleCustomerPayload,
} from '../../api';
import { pageShellClass } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { TableLoadingRow } from '../shared/MillstoneLoader';
import {
  blankSalesBrand,
  blankSalesContact,
  formatBrandCountsCell,
  formatBrandsCell,
  formatContactsEmails,
  formatContactsMobiles,
  formatContactsNames,
  formatContactsPositions,
  SALES_MODULE_STATUSES,
  toCustomerPayload,
} from '../../data/salesModule';
import { SalesModuleOffice365SyncPanel } from '../dev/SalesModuleOffice365SyncPanel';
import { SalesModuleTeamPanel } from '../dev/SalesModuleTeamPanel';

type TabId = 'customers' | 'calendar';

type CalendarItem =
  | { kind: 'local'; key: string; startsAt: string; endsAt: string; title: string; appointment: SalesModuleAppointment }
  | { kind: 'o365'; key: string; startsAt: string; endsAt: string; title: string; event: SalesModuleTeamCalendarEvent };

const TABS = [
  { id: 'customers' as const, label: 'Customers' },
  { id: 'calendar' as const, label: 'Appointment Calendar' },
];

type Props = {
  /** Dev Console session identity used when creating engaged records. */
  sessionEmail?: string;
  sessionName?: string;
  isRoot?: boolean;
};

function toDateInput(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function SalesModulePage({ sessionEmail = '', sessionName = '', isRoot = false }: Props) {
  const [tab, setTab] = useState<TabId>('customers');
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<number | null>(null);
  const [companies, setCompanies] = useState<SalesModuleCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [companyDraft, setCompanyDraft] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);

  const [customers, setCustomers] = useState<SalesModuleCustomer[]>([]);
  const [appointments, setAppointments] = useState<SalesModuleAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<SalesModuleCustomer | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [apptFormOpen, setApptFormOpen] = useState(false);
  const [apptTitle, setApptTitle] = useState('');
  const [apptNotes, setApptNotes] = useState('');
  const [apptLocation, setApptLocation] = useState('');
  const [apptCustomerId, setApptCustomerId] = useState<number | ''>('');
  const [apptStart, setApptStart] = useState('');
  const [apptEnd, setApptEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<SalesModuleTeamMember[]>([]);
  const [teamEvents, setTeamEvents] = useState<SalesModuleTeamCalendarEvent[]>([]);
  const [teamSyncMessage, setTeamSyncMessage] = useState<string | null>(null);
  const [apptTeamMemberId, setApptTeamMemberId] = useState<number | ''>('');

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const engagedUserEmail = sessionEmail.trim();
  const engagedUserName = sessionName.trim() || engagedUserEmail || 'Dev Console';

  const activeTeamMembers = useMemo(
    () => teamMembers.filter(m => m.active).sort((a, b) => a.name.localeCompare(b.name)),
    [teamMembers],
  );

  const loadTeamMembers = useCallback(async () => {
    const rows = await api.salesModuleTeam();
    setTeamMembers(rows);
    setSelectedTeamMemberId(prev => {
      if (prev && rows.some(m => m.id === prev && m.active)) return prev;
      return rows.find(m => m.active)?.id ?? null;
    });
  }, []);

  const loadSalesCompanies = useCallback(async (memberId: number | null) => {
    if (!memberId) {
      setCompanies([]);
      setSelectedCompanyId(null);
      return;
    }
    const rows = await api.salesModuleCompanies({ salesTeamMemberId: memberId });
    setCompanies(rows);
    setSelectedCompanyId(prev => {
      if (prev && rows.some(c => c.id === prev)) return prev;
      return rows[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadTeamMembers()
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load sales team');
      });
    return () => { cancelled = true; };
  }, [loadTeamMembers]);

  useEffect(() => {
    let cancelled = false;
    loadSalesCompanies(selectedTeamMemberId)
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load sales companies');
      });
    return () => { cancelled = true; };
  }, [selectedTeamMemberId, loadSalesCompanies]);

  const loadCustomers = useCallback(async () => {
    if (!selectedCompanyId) {
      setCustomers([]);
      return;
    }
    const rows = await api.salesModuleCustomers(selectedCompanyId);
    setCustomers(rows);
  }, [selectedCompanyId]);

  const loadAppointments = useCallback(async () => {
    if (!selectedCompanyId) {
      setAppointments([]);
      return;
    }
    const from = startOfMonth(monthCursor);
    const to = new Date(from.getFullYear(), from.getMonth() + 2, 1);
    const rows = await api.salesModuleAppointments(selectedCompanyId, {
      from: from.toISOString(),
      to: to.toISOString(),
    });
    setAppointments(rows);
  }, [selectedCompanyId, monthCursor]);

  const loadTeamCalendars = useCallback(async () => {
    const from = startOfMonth(monthCursor);
    const to = new Date(from.getFullYear(), from.getMonth() + 2, 1);
    try {
      const result = await api.salesModuleTeamCalendars({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      setTeamEvents(result.events ?? []);
      if (result.members?.length) setTeamMembers(result.members);
      setTeamSyncMessage(result.message || null);
    } catch (err) {
      setTeamEvents([]);
      setTeamSyncMessage(err instanceof Error ? err.message : 'Failed to sync sales team calendars');
    }
  }, [monthCursor]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([loadCustomers(), loadAppointments(), loadTeamCalendars()])
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Sales Module');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [loadCustomers, loadAppointments, loadTeamCalendars]);

  async function handleCreateCompany() {
    if (!selectedTeamMemberId || !companyDraft.trim()) return;
    setCreatingCompany(true);
    setError(null);
    try {
      const created = await api.createSalesModuleCompany({
        name: companyDraft.trim(),
        salesTeamMemberIds: [selectedTeamMemberId],
      });
      setCompanyDraft('');
      setCompanies(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCompanyId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setCreatingCompany(false);
    }
  }

  const calendarItemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const push = (item: CalendarItem) => {
      const d = new Date(item.startsAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    };
    for (const appt of appointments) {
      push({
        kind: 'local',
        key: `local-${appt.id}`,
        startsAt: appt.startsAt,
        endsAt: appt.endsAt,
        title: appt.title,
        appointment: appt,
      });
    }
    const localOutlookIds = new Set(
      appointments.map(a => a.outlookEventId).filter((id): id is string => Boolean(id)),
    );
    for (const ev of teamEvents) {
      if (ev.outlookEventId && localOutlookIds.has(ev.outlookEventId)) continue;
      push({
        kind: 'o365',
        key: ev.id,
        startsAt: ev.startsAt,
        endsAt: ev.endsAt,
        title: ev.title,
        event: ev,
      });
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return map;
  }, [appointments, teamEvents]);

  const selectedDayItems = useMemo(() => {
    if (!selectedDay) return [];
    const key = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}`;
    return calendarItemsByDay.get(key) ?? [];
  }, [calendarItemsByDay, selectedDay]);

  function openCreateCustomer() {
    setEditing(null);
    setPanelOpen(true);
  }

  function openEditCustomer(row: SalesModuleCustomer) {
    setEditing(row);
    setPanelOpen(true);
  }

  const selectedSalesCompany = companies.find(c => c.id === selectedCompanyId) ?? null;
  const selectedTeamMember = activeTeamMembers.find(m => m.id === selectedTeamMemberId) ?? null;

  async function handleSavedCustomer(row: SalesModuleCustomer) {
    setCustomers(prev => {
      const idx = prev.findIndex(c => c.id === row.id);
      if (idx < 0) return [row, ...prev];
      const next = [...prev];
      next[idx] = row;
      return next;
    });
    setPanelOpen(false);
    setEditing(null);
  }

  function openNewAppointment(day?: Date) {
    const base = day ?? selectedDay ?? new Date();
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 0);
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 11, 0);
    setApptTitle('');
    setApptNotes('');
    setApptLocation('');
    setApptCustomerId(customers[0]?.id ?? '');
    setApptTeamMemberId(selectedTeamMemberId ?? teamMembers.find(m => m.active)?.id ?? '');
    setApptStart(toLocalInputValue(start.toISOString()));
    setApptEnd(toLocalInputValue(end.toISOString()));
    setApptFormOpen(true);
  }

  async function saveAppointment() {
    if (!selectedCompanyId || !apptCustomerId || !apptTitle.trim()) {
      setError('Customer and title are required for an appointment.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const member = typeof apptTeamMemberId === 'number'
        ? teamMembers.find(m => m.id === apptTeamMemberId)
        : undefined;
      const created = await api.createSalesModuleAppointment({
        companyId: selectedCompanyId,
        salesModuleCustomerId: Number(apptCustomerId),
        title: apptTitle.trim(),
        notes: apptNotes.trim(),
        location: apptLocation.trim(),
        startsAt: new Date(apptStart).toISOString(),
        endsAt: new Date(apptEnd).toISOString(),
        engagedUserId: 0,
        engagedUserEmail: member?.email || engagedUserEmail,
        salesTeamMemberId: member?.id ?? null,
      });
      setAppointments(prev => [...prev, created].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      setApptFormOpen(false);
      void loadTeamCalendars();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save appointment');
    } finally {
      setSaving(false);
    }
  }

  async function removeAppointment(id: number) {
    try {
      await api.deleteSalesModuleAppointment(id);
      setAppointments(prev => prev.filter(a => a.id !== id));
      void loadTeamCalendars();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete appointment');
    }
  }

  if (!selectedTeamMemberId) {
    return (
      <div className={pageShellClass({ spacing: 'loose' })}>
        <SalesModuleOffice365SyncPanel isRoot={isRoot} />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTeamOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-muted"
          >
            <Users size={12} />
            Sales Team
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {activeTeamMembers.length === 0
            ? 'Create a Sales Team member first, then tag companies to them.'
            : 'Select a Sales Team member to continue.'}
        </p>
        <SalesModuleTeamPanel
          open={teamOpen}
          onClose={() => {
            setTeamOpen(false);
            void loadTeamMembers().then(() => loadTeamCalendars());
          }}
          onChanged={setTeamMembers}
        />
      </div>
    );
  }

  if (!selectedCompanyId) {
    return (
      <div className={pageShellClass({ spacing: 'loose' })}>
        <SalesModuleOffice365SyncPanel isRoot={isRoot} />
        <PageStickyFilters opaque className="space-y-2 pb-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="inline-flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Sales Team</span>
              <select
                value={selectedTeamMemberId}
                onChange={e => setSelectedTeamMemberId(Number(e.target.value) || null)}
                className="rounded-md border border-border bg-background px-2 py-1.5 min-w-[12rem]"
              >
                {activeTeamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setTeamOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-muted"
            >
              <Users size={12} />
              Manage team
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="inline-flex flex-col gap-1 text-xs min-w-[12rem] flex-1">
              <span className="text-muted-foreground uppercase tracking-wide">Company</span>
              <input
                value={companyDraft}
                onChange={e => setCompanyDraft(e.target.value)}
                placeholder="Create company for this sales person…"
                className="rounded-md border border-border bg-background px-2 py-1.5"
              />
            </label>
            <button
              type="button"
              disabled={creatingCompany || !companyDraft.trim()}
              onClick={() => void handleCreateCompany()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Plus size={12} />
              {creatingCompany ? 'Saving…' : 'Add company'}
            </button>
          </div>
        </PageStickyFilters>
        <p className="text-sm text-muted-foreground">
          No companies tagged to this sales team member yet. Add a company above (Sales Module list — not a Bisync tenant).
        </p>
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
        <SalesModuleTeamPanel
          open={teamOpen}
          onClose={() => {
            setTeamOpen(false);
            void loadTeamMembers().then(() => loadTeamCalendars());
          }}
          onChanged={setTeamMembers}
        />
      </div>
    );
  }

  const monthLabel = monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstWeekday = startOfMonth(monthCursor).getDay();
  const totalDays = daysInMonth(monthCursor);
  const cells: Array<Date | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => new Date(monthCursor.getFullYear(), monthCursor.getMonth(), i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className={pageShellClass({ spacing: 'loose' })}>
      <SalesModuleOffice365SyncPanel isRoot={isRoot} />
      <PageStickyFilters opaque className="space-y-2 pb-2">
        <div className="flex flex-wrap items-end gap-2">
          <label className="inline-flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground uppercase tracking-wide">Sales Team</span>
            <select
              value={selectedTeamMemberId}
              onChange={e => setSelectedTeamMemberId(Number(e.target.value) || null)}
              className="rounded-md border border-border bg-background px-2 py-1.5 min-w-[12rem]"
            >
              {activeTeamMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
          <label className="inline-flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground uppercase tracking-wide">Company</span>
            <select
              value={selectedCompanyId}
              onChange={e => setSelectedCompanyId(Number(e.target.value) || null)}
              className="rounded-md border border-border bg-background px-2 py-1.5 min-w-[12rem]"
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setTeamOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-muted"
          >
            <Users size={12} />
            Sales Team
            {teamMembers.length > 0 ? (
              <span className="text-[10px] text-muted-foreground">({teamMembers.length})</span>
            ) : null}
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="inline-flex flex-col gap-1 text-xs min-w-[12rem] flex-1">
            <span className="text-muted-foreground uppercase tracking-wide">Add company for this member</span>
            <input
              value={companyDraft}
              onChange={e => setCompanyDraft(e.target.value)}
              placeholder="Company name…"
              className="rounded-md border border-border bg-background px-2 py-1.5"
            />
          </label>
          <button
            type="button"
            disabled={creatingCompany || !companyDraft.trim()}
            onClick={() => void handleCreateCompany()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-muted disabled:opacity-50"
          >
            <Plus size={12} />
            {creatingCompany ? 'Saving…' : 'Add company'}
          </button>
        </div>
        <HrConfigTabBar tabs={TABS} active={tab} onChange={setTab} />
        {tab === 'customers' ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Sales customers for this company · {customers.length} record{customers.length === 1 ? '' : 's'}
            </p>
            <button
              type="button"
              onClick={openCreateCustomer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground"
            >
              <Plus size={12} />
              Create new customer
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                className="p-1.5 rounded-md border border-border hover:bg-muted"
                onClick={() => setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft size={14} />
              </button>
              <p className="text-sm font-semibold min-w-[10rem] text-center">{monthLabel}</p>
              <button
                type="button"
                className="p-1.5 rounded-md border border-border hover:bg-muted"
                onClick={() => setMonthCursor(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                aria-label="Next month"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => openNewAppointment()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground"
            >
              <Plus size={12} />
              New appointment
            </button>
          </div>
        )}
        {tab === 'calendar' && teamSyncMessage ? (
          <p className="text-[11px] text-muted-foreground">{teamSyncMessage}</p>
        ) : null}
      </PageStickyFilters>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {tab === 'customers' ? (
        <TableScrollContainer ref={scrollRootRef}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-1.5 text-left">Company</th>
                <th className="px-2 py-1.5 text-left">Brand</th>
                <th className="px-2 py-1.5 text-left">No of Each brand</th>
                <th className="px-2 py-1.5 text-left">Contact Person</th>
                <th className="px-2 py-1.5 text-left">Position</th>
                <th className="px-2 py-1.5 text-left">Email</th>
                <th className="px-2 py-1.5 text-left">Mobile Number</th>
                <th className="px-2 py-1.5 text-left">Date created</th>
                <th className="px-2 py-1.5 text-left">Current Status</th>
                <th className="px-2 py-1.5 text-left">Last Contact Date</th>
                <th className="px-2 py-1.5 text-left">Short Brief on last discussion</th>
                <th className="px-2 py-1.5 text-left">Engaged by</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableLoadingRow colSpan={12} label="Loading customers…" />
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                    No sales customers yet. Create a customer to start.
                  </td>
                </tr>
              ) : (
                customers.map(row => (
                  <tr
                    key={row.id}
                    className="border-b border-border/60 hover:bg-muted/30 cursor-pointer"
                    onClick={() => openEditCustomer(row)}
                  >
                    <td className="px-2 py-1.5 font-medium">{row.companyName}</td>
                    <td className="px-2 py-1.5">{formatBrandsCell(row.brands)}</td>
                    <td className="px-2 py-1.5">{formatBrandCountsCell(row.brands)}</td>
                    <td className="px-2 py-1.5">{formatContactsNames(row.contacts)}</td>
                    <td className="px-2 py-1.5">{formatContactsPositions(row.contacts)}</td>
                    <td className="px-2 py-1.5">{formatContactsEmails(row.contacts)}</td>
                    <td className="px-2 py-1.5">{formatContactsMobiles(row.contacts)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-1.5">{row.status}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {row.lastContactDate ? new Date(row.lastContactDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-2 py-1.5 max-w-[16rem] truncate" title={row.lastDiscussionBrief}>
                      {row.lastDiscussionBrief || '—'}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap" title={row.engagedUserEmail}>
                      {row.engagedUserName || row.engagedUserEmail || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScrollContainer>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-4">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="px-2 py-2 text-center font-semibold">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="min-h-[5.5rem] border-b border-r border-border/50 bg-muted/10" />;
                const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                const dayItems = calendarItemsByDay.get(key) ?? [];
                const selected = selectedDay ? sameDay(day, selectedDay) : false;
                const isToday = sameDay(day, new Date());
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`min-h-[5.5rem] border-b border-r border-border/50 p-1.5 text-left align-top hover:bg-muted/40 ${
                      selected ? 'bg-primary/10' : ''
                    }`}
                  >
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday ? 'bg-primary text-primary-foreground font-bold' : 'text-foreground'
                    }`}>
                      {day.getDate()}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayItems.slice(0, 3).map(item => (
                        <p
                          key={item.key}
                          className={`text-[10px] truncate rounded px-1 py-0.5 ${
                            item.kind === 'o365' ? 'bg-sky-500/15 text-sky-900 dark:text-sky-200' : 'bg-muted'
                          }`}
                          title={item.kind === 'o365'
                            ? `${item.title} · ${item.event.salesTeamMemberName}`
                            : item.title}
                        >
                          {item.title}
                        </p>
                      ))}
                      {dayItems.length > 3 ? (
                        <p className="text-[10px] text-muted-foreground">+{dayItems.length - 3} more</p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {selectedDay
                  ? selectedDay.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                  : 'Select a day'}
              </h3>
              {selectedDay ? (
                <button
                  type="button"
                  onClick={() => openNewAppointment(selectedDay)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
                >
                  <Plus size={12} /> Add
                </button>
              ) : null}
            </div>
            {selectedDayItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No appointments.</p>
            ) : (
              <ul className="space-y-2">
                {selectedDayItems.map(item => (
                  <li key={item.key} className="rounded-md border border-border px-2 py-2 space-y-1">
                    {item.kind === 'local' ? (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold">{item.appointment.title}</p>
                          <button
                            type="button"
                            onClick={() => void removeAppointment(item.appointment.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Delete appointment"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{item.appointment.customerName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(item.appointment.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(item.appointment.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {item.appointment.location ? (
                          <p className="text-[11px] text-muted-foreground">{item.appointment.location}</p>
                        ) : null}
                        {item.appointment.outlookSynced ? (
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                            Synced to Office 365
                            {item.appointment.outlookWebLink ? (
                              <>
                                {' · '}
                                <a href={item.appointment.outlookWebLink} target="_blank" rel="noreferrer" className="underline">
                                  Open
                                </a>
                              </>
                            ) : null}
                          </p>
                        ) : item.appointment.outlookSyncError ? (
                          <p className="text-[10px] text-destructive" title={item.appointment.outlookSyncError}>
                            Office 365 sync failed
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold">{item.event.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.event.salesTeamMemberName} · Office 365
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.event.isAllDay
                            ? 'All day'
                            : `${new Date(item.event.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(item.event.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                        {item.event.location ? (
                          <p className="text-[11px] text-muted-foreground">{item.event.location}</p>
                        ) : null}
                        {item.event.outlookWebLink ? (
                          <a
                            href={item.event.outlookWebLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-sky-700 dark:text-sky-300 underline"
                          >
                            Open in Outlook
                          </a>
                        ) : null}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <SalesModuleTeamPanel
        open={teamOpen}
        onClose={() => {
          setTeamOpen(false);
          void loadTeamMembers()
            .then(() => loadSalesCompanies(selectedTeamMemberId))
            .then(() => loadTeamCalendars());
        }}
        onChanged={setTeamMembers}
      />

      {panelOpen ? (
        <SalesCustomerPanel
          companyId={selectedCompanyId}
          defaultCompanyName={selectedSalesCompany?.name ?? ''}
          customer={editing}
          engagedUserId={0}
          engagedUserEmail={selectedTeamMember?.email || engagedUserEmail}
          engagedUserName={selectedTeamMember?.name || engagedUserName}
          onClose={() => { setPanelOpen(false); setEditing(null); }}
          onSaved={handleSavedCustomer}
        />
      ) : null}

      {apptFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">New appointment</h3>
              <button type="button" onClick={() => setApptFormOpen(false)} className="p-1 rounded hover:bg-muted">
                <X size={14} />
              </button>
            </div>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Customer</span>
              <select
                value={apptCustomerId}
                onChange={e => setApptCustomerId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
              >
                <option value="">Select customer…</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Sales person</span>
              <select
                value={apptTeamMemberId}
                onChange={e => setApptTeamMemberId(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
              >
                <option value="">Unassigned</option>
                {teamMembers.filter(m => m.active).map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Title</span>
              <input value={apptTitle} onChange={e => setApptTitle(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground uppercase tracking-wide">Starts</span>
                <input type="datetime-local" value={apptStart} onChange={e => setApptStart(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5" />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground uppercase tracking-wide">Ends</span>
                <input type="datetime-local" value={apptEnd} onChange={e => setApptEnd(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5" />
              </label>
            </div>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Location</span>
              <input value={apptLocation} onChange={e => setApptLocation(e.target.value)} className="w-full rounded-md border border-border bg-background px-2 py-1.5" />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Notes</span>
              <textarea value={apptNotes} onChange={e => setApptNotes(e.target.value)} rows={3} className="w-full rounded-md border border-border bg-background px-2 py-1.5" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setApptFormOpen(false)} className="px-3 py-1.5 text-xs rounded-md border border-border">Cancel</button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveAppointment()}
                className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SalesCustomerPanel({
  companyId,
  defaultCompanyName,
  customer,
  engagedUserId,
  engagedUserEmail,
  engagedUserName,
  onClose,
  onSaved,
}: {
  companyId: number;
  defaultCompanyName?: string;
  customer: SalesModuleCustomer | null;
  engagedUserId: number;
  engagedUserEmail: string;
  engagedUserName: string;
  onClose: () => void;
  onSaved: (row: SalesModuleCustomer) => void;
}) {
  const [form, setForm] = useState<UpsertSalesModuleCustomerPayload>(() => ({
    companyId,
    externalId: customer?.externalId,
    companyName: customer?.companyName || defaultCompanyName || '',
    brands: customer?.brands?.length ? customer.brands.map(b => ({ ...b })) : [blankSalesBrand()],
    contacts: customer?.contacts?.length ? customer.contacts.map(c => ({ ...c })) : [blankSalesContact()],
    status: customer?.status ?? 'Prospect',
    lastContactDate: toDateInput(customer?.lastContactDate),
    lastDiscussionBrief: customer?.lastDiscussionBrief ?? '',
    engagedUserId: customer?.engagedUserId ?? engagedUserId,
    engagedUserEmail: customer?.engagedUserEmail || engagedUserEmail,
    engagedUserName: customer?.engagedUserName || engagedUserName,
    active: customer?.active ?? true,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = toCustomerPayload({
        ...form,
        lastContactDate: form.lastContactDate ? new Date(form.lastContactDate).toISOString() : null,
        engagedUserId: customer?.engagedUserId ?? engagedUserId,
        engagedUserEmail: customer?.engagedUserEmail || engagedUserEmail,
        engagedUserName: customer?.engagedUserName || engagedUserName,
      });
      const saved = customer
        ? await api.updateSalesModuleCustomer(customer.externalId, payload)
        : await api.createSalesModuleCustomer(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40">
      <div className="w-full max-w-lg h-full bg-card border-l border-border shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{customer ? 'Edit customer' : 'Create new customer'}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted"><X size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground uppercase tracking-wide">Company</span>
            <input
              value={form.companyName}
              onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Brands</p>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, brands: [...f.brands, blankSalesBrand()] }))}
                className="text-[11px] font-semibold text-primary inline-flex items-center gap-1"
              >
                <Plus size={11} /> Add brand
              </button>
            </div>
            {form.brands.map((brand, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_5rem_auto] gap-2">
                <input
                  value={brand.name}
                  placeholder="Brand name"
                  onChange={e => setForm(f => {
                    const brands = [...f.brands];
                    brands[idx] = { ...brands[idx], name: e.target.value };
                    return { ...f, brands };
                  })}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={brand.count}
                  onChange={e => setForm(f => {
                    const brands = [...f.brands];
                    brands[idx] = { ...brands[idx], count: Number(e.target.value) || 0 };
                    return { ...f, brands };
                  })}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  title="No of each brand"
                />
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, brands: f.brands.filter((_, i) => i !== idx) }))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contact persons</p>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, contacts: [...f.contacts, blankSalesContact()] }))}
                className="text-[11px] font-semibold text-primary inline-flex items-center gap-1"
              >
                <Plus size={11} /> Add contact
              </button>
            </div>
            {form.contacts.map((contact, idx) => (
              <div key={contact.id || idx} className="rounded-md border border-border p-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={contact.name}
                    placeholder="Name"
                    onChange={e => setForm(f => {
                      const contacts = [...f.contacts];
                      contacts[idx] = { ...contacts[idx], name: e.target.value };
                      return { ...f, contacts };
                    })}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  />
                  <input
                    value={contact.position}
                    placeholder="Position"
                    onChange={e => setForm(f => {
                      const contacts = [...f.contacts];
                      contacts[idx] = { ...contacts[idx], position: e.target.value };
                      return { ...f, contacts };
                    })}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  />
                  <input
                    value={contact.email}
                    placeholder="Email"
                    onChange={e => setForm(f => {
                      const contacts = [...f.contacts];
                      contacts[idx] = { ...contacts[idx], email: e.target.value };
                      return { ...f, contacts };
                    })}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  />
                  <input
                    value={contact.mobile}
                    placeholder="Mobile"
                    onChange={e => setForm(f => {
                      const contacts = [...f.contacts];
                      contacts[idx] = { ...contacts[idx], mobile: e.target.value };
                      return { ...f, contacts };
                    })}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                  />
                </div>
                {form.contacts.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, contacts: f.contacts.filter((_, i) => i !== idx) }))}
                    className="text-[11px] text-destructive"
                  >
                    Remove contact
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Current Status</span>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
              >
                {SALES_MODULE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Last Contact Date</span>
              <input
                type="date"
                value={form.lastContactDate ?? ''}
                onChange={e => setForm(f => ({ ...f, lastContactDate: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
              />
            </label>
          </div>

          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground uppercase tracking-wide">Short Brief on last discussion</span>
            <textarea
              value={form.lastDiscussionBrief}
              onChange={e => setForm(f => ({ ...f, lastDiscussionBrief: e.target.value }))}
              rows={4}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            />
          </label>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </div>
        <div className="border-t border-border px-4 py-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border">Cancel</button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
