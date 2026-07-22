import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, Trash2, Upload, Users, X } from 'lucide-react';
import {
  api,
  type SalesModuleAppointment,
  type SalesModuleClientUpdate,
  type SalesModuleCompany,
  type SalesModuleCustomer,
  type SalesModuleOverview,
  type SalesModuleOverviewPeriods,
  type SalesModuleTeamCalendarEvent,
  type SalesModuleTeamMember,
} from '../../api';
import { pageShellClass } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { TableLoadingRow } from '../shared/MillstoneLoader';
import { SalesModuleTeamPanel } from '../dev/SalesModuleTeamPanel';
import { SalesDiaryPanel } from './SalesDiaryPanel';

type TabId = 'overview' | 'client-update' | 'sales-diary' | 'calendar';
type OverviewView = 'week' | 'month';

type CalendarItem =
  | { kind: 'local'; key: string; startsAt: string; endsAt: string; title: string; appointment: SalesModuleAppointment }
  | { kind: 'o365'; key: string; startsAt: string; endsAt: string; title: string; event: SalesModuleTeamCalendarEvent };

const TABS = [
  { id: 'overview' as const, label: 'Overview' },
  { id: 'client-update' as const, label: 'Client Update' },
  { id: 'sales-diary' as const, label: 'Sales Diary' },
  { id: 'calendar' as const, label: 'Appointment Calendar' },
];

function formatOptionalDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

/** Monday-start week window matching API: last week + week-to-date (UTC date). */
function isInClientUpdateListWindow(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = day.getUTCDay(); // 0 Sun … 6 Sat
  const mondayOffset = (dow + 6) % 7;
  const thisWeekStart = utcToday - mondayOffset * 86400000;
  const lastWeekStart = thisWeekStart - 7 * 86400000;
  const t = day.getTime();
  return t >= lastWeekStart && t <= utcToday;
}

function isBlankText(value?: string | null): boolean {
  return !value || !value.trim();
}

type Props = {
  /** Dev Console session identity used when creating engaged records. */
  sessionEmail?: string;
  sessionName?: string;
};

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

export function SalesModulePage({ sessionEmail = '' }: Props) {
  const [tab, setTab] = useState<TabId>('overview');
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<number | null>(null);
  const [companies, setCompanies] = useState<SalesModuleCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [companyDraft, setCompanyDraft] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);

  const [customers, setCustomers] = useState<SalesModuleCustomer[]>([]);
  const [overviewView, setOverviewView] = useState<OverviewView>('week');
  const [overviewWeekStart, setOverviewWeekStart] = useState('');
  const [overviewMonthValue, setOverviewMonthValue] = useState('');
  const [overviewPeriods, setOverviewPeriods] = useState<SalesModuleOverviewPeriods | null>(null);
  const [overview, setOverview] = useState<SalesModuleOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewSalesTeamId, setOverviewSalesTeamId] = useState<number | ''>('');
  const [overviewCompanyId, setOverviewCompanyId] = useState<number | ''>('');
  const [overviewCompanies, setOverviewCompanies] = useState<SalesModuleCompany[]>([]);
  const [overviewHasSearched, setOverviewHasSearched] = useState(false);
  const [clientUpdates, setClientUpdates] = useState<SalesModuleClientUpdate[]>([]);
  const [clientUpdatesLoading, setClientUpdatesLoading] = useState(false);
  const [clientUpdateMessage, setClientUpdateMessage] = useState<string | null>(null);
  const [importingClientUpdates, setImportingClientUpdates] = useState(false);
  const [filterClientUpdatesByHunter, setFilterClientUpdatesByHunter] = useState(true);
  const clientUpdateFileRef = useRef<HTMLInputElement | null>(null);
  const [appointments, setAppointments] = useState<SalesModuleAppointment[]>([]);
  const [error, setError] = useState<string | null>(null);
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
    if (!selectedTeamMemberId) {
      setCustomers([]);
      return;
    }
    const rows = await api.salesModuleCustomers({
      salesTeamMemberId: selectedTeamMemberId,
      companyId: selectedCompanyId ?? undefined,
    });
    setCustomers(rows);
  }, [selectedTeamMemberId, selectedCompanyId]);

  const loadClientUpdates = useCallback(async () => {
    setClientUpdatesLoading(true);
    try {
      // Rematch uploaded Hunter free-text to Sales Team list, then load windowed rows.
      await api.rematchSalesModuleClientUpdateHunters().catch(() => undefined);
      const rows = await api.salesModuleClientUpdates(
        filterClientUpdatesByHunter && selectedTeamMemberId
          ? { salesTeamMemberId: selectedTeamMemberId }
          : undefined,
      );
      setClientUpdates(rows);
    } finally {
      setClientUpdatesLoading(false);
    }
  }, [filterClientUpdatesByHunter, selectedTeamMemberId]);

  const loadOverviewPeriods = useCallback(async () => {
    const periods = await api.salesModuleOverviewPeriods();
    setOverviewPeriods(periods);
    setOverviewWeekStart(prev => {
      if (prev && periods.weeks.some(w => w.value === prev)) return prev;
      return periods.weeks[0]?.value ?? '';
    });
    setOverviewMonthValue(prev => {
      if (prev && periods.months.some(m => m.value === prev)) return prev;
      return periods.months[0]?.value ?? '';
    });
  }, []);

  const loadOverviewCompanies = useCallback(async (memberId: number | '') => {
    const rows = await api.salesModuleCompanies(
      memberId ? { salesTeamMemberId: memberId } : {},
    );
    setOverviewCompanies(rows);
    setOverviewCompanyId(prev => {
      if (prev && rows.some(c => c.id === prev)) return prev;
      return '';
    });
  }, []);

  const runOverviewSearch = useCallback(async () => {
    if (overviewView === 'week' && !overviewWeekStart) {
      setError('Select a week to search.');
      return;
    }
    if (overviewView === 'month' && !overviewMonthValue) {
      setError('Select a month to search.');
      return;
    }

    setOverviewLoading(true);
    setError(null);
    setOverviewHasSearched(true);
    try {
      if (overviewView === 'week') {
        const data = await api.salesModuleOverview({
          view: 'week',
          weekStart: overviewWeekStart,
          salesTeamMemberId: overviewSalesTeamId || undefined,
          companyId: overviewCompanyId || undefined,
        });
        setOverview(data);
        return;
      }
      const month = overviewPeriods?.months.find(m => m.value === overviewMonthValue);
      if (!month) {
        setOverview(null);
        return;
      }
      const data = await api.salesModuleOverview({
        view: 'month',
        year: month.year,
        month: month.month,
        salesTeamMemberId: overviewSalesTeamId || undefined,
        companyId: overviewCompanyId || undefined,
      });
      setOverview(data);
    } catch (err) {
      setOverview(null);
      setError(err instanceof Error ? err.message : 'Failed to load Overview');
    } finally {
      setOverviewLoading(false);
    }
  }, [
    overviewView,
    overviewWeekStart,
    overviewMonthValue,
    overviewPeriods,
    overviewSalesTeamId,
    overviewCompanyId,
  ]);

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

  // Core Sales Module data for appointments (customers still needed for calendar form).
  useEffect(() => {
    let cancelled = false;
    setError(null);
    Promise.all([loadCustomers(), loadAppointments()])
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Sales Module');
      });
    return () => { cancelled = true; };
  }, [loadCustomers, loadAppointments]);

  // Overview periods + company options when Overview tab is open (results load via Search).
  useEffect(() => {
    if (tab !== 'overview') return;
    let cancelled = false;
    setOverviewSalesTeamId(prev => {
      if (prev !== '' && activeTeamMembers.some(m => m.id === prev)) return prev;
      return selectedTeamMemberId ?? '';
    });
    void loadOverviewPeriods().catch(err => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Overview periods');
    });
    return () => { cancelled = true; };
  }, [tab, loadOverviewPeriods, selectedTeamMemberId, activeTeamMembers]);

  useEffect(() => {
    if (tab !== 'overview') return;
    let cancelled = false;
    void loadOverviewCompanies(overviewSalesTeamId).catch(err => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Overview companies');
    });
    return () => { cancelled = true; };
  }, [tab, overviewSalesTeamId, loadOverviewCompanies]);

  // Calendar sync is only needed on the Appointment Calendar tab (and can be slow via Graph).
  useEffect(() => {
    if (tab !== 'calendar') return;
    let cancelled = false;
    void loadTeamCalendars().catch(err => {
      if (!cancelled) setTeamSyncMessage(err instanceof Error ? err.message : 'Failed to sync calendars');
    });
    return () => { cancelled = true; };
  }, [tab, loadTeamCalendars]);

  // Lazy-load Client Update only when that tab is open (and when hunter filter changes).
  useEffect(() => {
    if (tab !== 'client-update') return;
    let cancelled = false;
    void loadClientUpdates().catch(err => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Client Update');
    });
    return () => { cancelled = true; };
  }, [tab, loadClientUpdates]);

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

  async function handleImportClientUpdates(file: File) {
    setImportingClientUpdates(true);
    setClientUpdateMessage(null);
    setError(null);
    try {
      const result = await api.importSalesModuleClientUpdates(file);
      setClientUpdateMessage(
        (result.messages?.length ? result.messages.join('\n') : null)
          || `Imported ${result.imported} Weekly Update row(s).`,
      );
      await loadClientUpdates();
    } catch (err) {
      setClientUpdateMessage(err instanceof Error ? err.message : 'Client Update import failed.');
    } finally {
      setImportingClientUpdates(false);
      if (clientUpdateFileRef.current) clientUpdateFileRef.current.value = '';
    }
  }

  async function saveClientUpdateBlankField(
    id: number,
    patch: {
      dateCreated?: string | null;
      hunter?: string | null;
      salesTeamMemberId?: number | null;
      company?: string | null;
      brand?: string | null;
      locationCount?: number | null;
    },
  ) {
    setError(null);
    try {
      const saved = await api.patchSalesModuleClientUpdate(id, patch);
      setClientUpdates(prev => {
        const activity = saved.lastContactDate || saved.dateCreated;
        if (activity && !isInClientUpdateListWindow(activity)) {
          return prev.filter(r => r.id !== id);
        }
        // When scoped to a hunter, drop rows tagged to someone else after save.
        if (
          filterClientUpdatesByHunter
          && selectedTeamMemberId
          && saved.salesTeamMemberId
          && saved.salesTeamMemberId !== selectedTeamMemberId
        ) {
          return prev.filter(r => r.id !== id);
        }
        return prev.map(r => (r.id === id ? saved : r));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Client Update field');
      throw err;
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

  const selectedTeamMember = activeTeamMembers.find(m => m.id === selectedTeamMemberId) ?? null;

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
            ? 'Create a Sales Team member first (include Office 365 Graph credentials), then add companies.'
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
      <PageStickyFilters opaque className="space-y-2 pb-2">
        {tab === 'overview' ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="inline-flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Sales Team</span>
              <select
                value={overviewSalesTeamId}
                onChange={e => {
                  setOverviewSalesTeamId(e.target.value ? Number(e.target.value) : '');
                  setOverviewHasSearched(false);
                  setOverview(null);
                }}
                className="rounded-md border border-border bg-background px-2 py-1.5 min-w-[12rem]"
              >
                <option value="">All hunters</option>
                {activeTeamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <label className="inline-flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground uppercase tracking-wide">Company</span>
              <select
                value={overviewCompanyId}
                onChange={e => {
                  setOverviewCompanyId(e.target.value ? Number(e.target.value) : '');
                  setOverviewHasSearched(false);
                  setOverview(null);
                }}
                className="rounded-md border border-border bg-background px-2 py-1.5 min-w-[12rem]"
              >
                <option value="">All companies</option>
                {overviewCompanies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <div className="inline-flex rounded-md border border-border overflow-hidden text-xs self-end">
              <button
                type="button"
                onClick={() => {
                  setOverviewView('week');
                  setOverviewHasSearched(false);
                  setOverview(null);
                }}
                className={`px-3 py-1.5 font-semibold ${overviewView === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => {
                  setOverviewView('month');
                  setOverviewHasSearched(false);
                  setOverview(null);
                }}
                className={`px-3 py-1.5 font-semibold border-l border-border ${overviewView === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                Month
              </button>
            </div>
            {overviewView === 'week' ? (
              <label className="inline-flex flex-col gap-1 text-xs min-w-[14rem]">
                <span className="text-muted-foreground uppercase tracking-wide">Week</span>
                <select
                  required
                  value={overviewWeekStart}
                  onChange={e => {
                    setOverviewWeekStart(e.target.value);
                    setOverviewHasSearched(false);
                    setOverview(null);
                  }}
                  className="rounded-md border border-border bg-background px-2 py-1.5"
                >
                  <option value="" disabled>
                    Select week…
                  </option>
                  {(overviewPeriods?.weeks ?? []).map(w => (
                    <option key={w.value} value={w.value}>{w.label}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="inline-flex flex-col gap-1 text-xs min-w-[12rem]">
                <span className="text-muted-foreground uppercase tracking-wide">Month</span>
                <select
                  required
                  value={overviewMonthValue}
                  onChange={e => {
                    setOverviewMonthValue(e.target.value);
                    setOverviewHasSearched(false);
                    setOverview(null);
                  }}
                  className="rounded-md border border-border bg-background px-2 py-1.5"
                >
                  <option value="" disabled>
                    Select month…
                  </option>
                  {(overviewPeriods?.months ?? []).map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              disabled={overviewLoading}
              onClick={() => void runOverviewSearch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Search size={12} />
              {overviewLoading ? 'Searching…' : 'Search'}
            </button>
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
            {overviewHasSearched && overview?.periodLabel ? (
              <p className="text-xs text-muted-foreground self-center">
                Summary by Hunter · {overview.periodLabel}
                {overview.companyName ? ` · ${overview.companyName}` : ''}
              </p>
            ) : null}
          </div>
        ) : (
          <>
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
                  value={selectedCompanyId ?? ''}
                  onChange={e => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 min-w-[12rem]"
                >
                  <option value="">All companies</option>
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
          </>
        )}
        <HrConfigTabBar tabs={TABS} active={tab} onChange={setTab} />
        {tab === 'overview' ? null : tab === 'client-update' ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Weekly Update · last week + week-to-date ·{' '}
                {clientUpdatesLoading ? '…' : `${clientUpdates.length} record${clientUpdates.length === 1 ? '' : 's'}`}
                {filterClientUpdatesByHunter && selectedTeamMember
                  ? ` · hunter ${selectedTeamMember.name}`
                  : ' · all hunters'}
                {' · '}hunters tagged to Sales Team · blank Date Created / Hunter / Company / Brand / No. of Location can be filled in
              </p>
              <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={filterClientUpdatesByHunter}
                  onChange={e => setFilterClientUpdatesByHunter(e.target.checked)}
                />
                Only selected Sales Team member (Hunter)
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={clientUpdateFileRef}
                type="file"
                accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportClientUpdates(file);
                }}
              />
              <button
                type="button"
                disabled={importingClientUpdates}
                onClick={() => clientUpdateFileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-muted disabled:opacity-50"
                title="Import Instant Sales Update.xlsx — Weekly Update sheet only"
              >
                <Upload size={12} />
                {importingClientUpdates ? 'Importing…' : 'Import Weekly Update'}
              </button>
            </div>
          </div>
        ) : tab === 'sales-diary' ? (
          <p className="text-xs text-muted-foreground">
            Log Status Change and Sales Call activity for hunter{' '}
            {selectedTeamMember?.name ?? '—'}. Company list is limited to accounts tagged to this hunter.
          </p>
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
              disabled={!selectedCompanyId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Plus size={12} />
              New appointment
            </button>
          </div>
        )}
        {tab === 'client-update' && clientUpdateMessage ? (
          <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{clientUpdateMessage}</p>
        ) : null}
        {tab === 'calendar' && teamSyncMessage ? (
          <p className="text-[11px] text-muted-foreground">{teamSyncMessage}</p>
        ) : null}
      </PageStickyFilters>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {tab === 'overview' ? (
        <TableScrollContainer ref={scrollRootRef}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-1.5 text-left">Hunter</th>
                <th className="px-2 py-1.5 text-right">Client status change</th>
                <th className="px-2 py-1.5 text-right">Client interaction (contact)</th>
                <th className="px-2 py-1.5 text-right">New Lead</th>
              </tr>
            </thead>
            <tbody>
              {overviewLoading ? (
                <TableLoadingRow colSpan={4} label="Loading overview…" />
              ) : !overviewHasSearched ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    Choose Sales Team, Company, and Week or Month, then click Search.
                  </td>
                </tr>
              ) : (overviewView === 'week' && !overviewWeekStart) || (overviewView === 'month' && !overviewMonthValue) ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    {overviewView === 'week'
                      ? 'Select a week to view the hunter summary.'
                      : 'Select a month to view the hunter summary.'}
                  </td>
                </tr>
              ) : !overview || overview.hunters.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    No Client Update activity for this filter.
                  </td>
                </tr>
              ) : (
                <>
                  {overview.hunters.map(row => (
                    <tr key={row.hunter} className="border-b border-border/60 hover:bg-muted/30">
                      <td className="px-2 py-1.5 font-medium whitespace-nowrap">{row.hunter}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{row.statusChanges}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{row.interactions}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{row.newLeads}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border bg-muted/20 font-semibold">
                    <td className="px-2 py-1.5">Total</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{overview.totals.statusChanges}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{overview.totals.interactions}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{overview.totals.newLeads}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </TableScrollContainer>
      ) : tab === 'client-update' ? (
        <TableScrollContainer ref={scrollRootRef}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-1.5 text-left">Date Created</th>
                <th className="px-2 py-1.5 text-left">Hunter</th>
                <th className="px-2 py-1.5 text-left">Company</th>
                <th className="px-2 py-1.5 text-left">Brand</th>
                <th className="px-2 py-1.5 text-left">No. of Location</th>
                <th className="px-2 py-1.5 text-left">Status</th>
                <th className="px-2 py-1.5 text-left">Last Contact Date</th>
                <th className="px-2 py-1.5 text-left">Contact Person</th>
                <th className="px-2 py-1.5 text-left">Contact Type</th>
                <th className="px-2 py-1.5 text-left">Note</th>
                <th className="px-2 py-1.5 text-left">Follow Up Reminder</th>
                <th className="px-2 py-1.5 text-left">Appointment</th>
              </tr>
            </thead>
            <tbody>
              {clientUpdatesLoading ? (
                <TableLoadingRow colSpan={12} label="Loading client updates…" />
              ) : clientUpdates.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">
                    No Weekly Update rows for last week or week-to-date. Import Instant Sales Update.xlsx or check Overview for older periods.
                  </td>
                </tr>
              ) : (
                clientUpdates.map(row => (
                  <tr key={row.id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {row.dateCreated ? (
                        formatOptionalDate(row.dateCreated)
                      ) : (
                        <ClientUpdateBlankDateInput
                          onSave={value => saveClientUpdateBlankField(row.id, { dateCreated: value })}
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {!isBlankText(row.hunter) ? (
                        row.hunter
                      ) : (
                        <ClientUpdateBlankHunterSelect
                          teamMembers={activeTeamMembers}
                          preferredMemberId={selectedTeamMemberId}
                          onSave={memberId => saveClientUpdateBlankField(row.id, { salesTeamMemberId: memberId })}
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {!isBlankText(row.company) ? (
                        row.company
                      ) : (
                        <ClientUpdateBlankTextInput
                          placeholder="Company…"
                          onSave={value => saveClientUpdateBlankField(row.id, { company: value })}
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5 font-medium">
                      {!isBlankText(row.brand) ? (
                        row.brand
                      ) : (
                        <ClientUpdateBlankTextInput
                          placeholder="Brand…"
                          onSave={value => saveClientUpdateBlankField(row.id, { brand: value })}
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {row.locationCount != null ? (
                        row.locationCount
                      ) : (
                        <ClientUpdateBlankNumberInput
                          placeholder="Locations…"
                          onSave={value => saveClientUpdateBlankField(row.id, { locationCount: value })}
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5">{row.status || '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{formatOptionalDate(row.lastContactDate)}</td>
                    <td className="px-2 py-1.5">{row.contactPerson || '—'}</td>
                    <td className="px-2 py-1.5">{row.contactType || '—'}</td>
                    <td className="px-2 py-1.5 max-w-[18rem] truncate" title={row.note}>{row.note || '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{formatOptionalDate(row.followUpReminder)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{row.appointment || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScrollContainer>
      ) : tab === 'sales-diary' && selectedTeamMemberId ? (
        <SalesDiaryPanel
          salesTeamMemberId={selectedTeamMemberId}
          hunterName={selectedTeamMember?.name ?? ''}
          companies={companies}
          createdByEmail={engagedUserEmail}
        />
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

function ClientUpdateBlankTextInput({
  placeholder,
  listId,
  onSave,
}: {
  placeholder: string;
  listId?: string;
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function commit() {
    const trimmed = value.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSave(trimmed);
    } catch {
      /* parent surfaces error */
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      value={value}
      list={listId}
      disabled={saving}
      placeholder={placeholder}
      onChange={e => setValue(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void commit();
        }
      }}
      className="w-full min-w-[6rem] max-w-[10rem] rounded border border-dashed border-border bg-background px-1.5 py-1 text-xs disabled:opacity-50"
    />
  );
}

function ClientUpdateBlankHunterSelect({
  teamMembers,
  preferredMemberId,
  onSave,
}: {
  teamMembers: SalesModuleTeamMember[];
  preferredMemberId: number | null;
  onSave: (memberId: number) => Promise<void>;
}) {
  const [value, setValue] = useState<number | ''>(() => preferredMemberId ?? teamMembers[0]?.id ?? '');
  const [saving, setSaving] = useState(false);

  async function commit(next: number) {
    if (!next || saving) return;
    setSaving(true);
    try {
      await onSave(next);
    } catch {
      /* parent surfaces error */
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={value === '' ? '' : String(value)}
      disabled={saving || teamMembers.length === 0}
      onChange={e => {
        const id = Number(e.target.value) || 0;
        setValue(id > 0 ? id : '');
        if (id > 0) void commit(id);
      }}
      className="w-full min-w-[7rem] max-w-[11rem] rounded border border-dashed border-border bg-background px-1.5 py-1 text-xs disabled:opacity-50"
      title="Tag hunter from Sales Team"
    >
      <option value="">Select hunter…</option>
      {teamMembers.map(m => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  );
}

function ClientUpdateBlankDateInput({
  onSave,
}: {
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function commit(next: string) {
    if (!next || saving) return;
    setSaving(true);
    try {
      await onSave(`${next}T00:00:00.000Z`);
    } catch {
      /* parent surfaces error */
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      type="date"
      value={value}
      disabled={saving}
      onChange={e => {
        setValue(e.target.value);
        void commit(e.target.value);
      }}
      className="w-full min-w-[8rem] rounded border border-dashed border-border bg-background px-1.5 py-1 text-xs disabled:opacity-50"
      title="Enter Date Created"
    />
  );
}

function ClientUpdateBlankNumberInput({
  placeholder,
  onSave,
}: {
  placeholder: string;
  onSave: (value: number) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function commit() {
    const trimmed = value.trim();
    if (!trimmed || saving) return;
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n < 0) return;
    setSaving(true);
    try {
      await onSave(n);
    } catch {
      /* parent surfaces error */
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      type="number"
      min={0}
      step={1}
      value={value}
      disabled={saving}
      placeholder={placeholder}
      onChange={e => setValue(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void commit();
        }
      }}
      className="w-full min-w-[4.5rem] max-w-[6rem] rounded border border-dashed border-border bg-background px-1.5 py-1 text-xs disabled:opacity-50"
    />
  );
}
