import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import {
  api,
  type SalesModuleAppointment,
  type SalesModuleClientUpdate,
  type SalesModuleCompany,
  type SalesModuleCustomer,
  type SalesModuleOverview,
  type SalesModuleOverviewHunterRow,
  type SalesModuleOverviewPeriods,
  type SalesModuleTeamCalendarEvent,
  type SalesModuleTeamMember,
} from '../../api';
import { pageShellClass, TABLE_COL_ACTION } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { HrConfigTabBar } from '../admin/HrConfigTabBar';
import { ColGroup } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { TableLoadingRow } from '../shared/MillstoneLoader';
import { SalesDiaryPanel } from './SalesDiaryPanel';
import { ClientUpdateFollowupPanel } from './ClientUpdateFollowupPanel';

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

/** True when activity date falls in the selected Client Update week/month (UTC date). */
function isInClientUpdatePeriod(
  iso: string,
  view: OverviewView,
  weekStart: string,
  monthValue: string,
): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const dayUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

  if (view === 'week') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return false;
    const [y, m, day] = weekStart.split('-').map(Number);
    const start = Date.UTC(y, m - 1, day);
    const endExclusive = start + 7 * 86400000;
    return dayUtc >= start && dayUtc < endExclusive;
  }

  if (!/^\d{4}-\d{2}$/.test(monthValue)) return false;
  const [year, month] = monthValue.split('-').map(Number);
  const start = Date.UTC(year, month - 1, 1);
  const endExclusive = Date.UTC(year, month, 1);
  return dayUtc >= start && dayUtc < endExclusive;
}

function isBlankText(value?: string | null): boolean {
  return !value || !value.trim();
}

/** Sort key for Overview hunter detail — interaction date, else created date. */
function overviewDetailSortMs(row: Pick<SalesModuleClientUpdate, 'lastContactDate' | 'dateCreated'>): number {
  const raw = row.lastContactDate || row.dateCreated;
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function overviewClientKey(row: SalesModuleClientUpdate): string | null {
  const company = row.company?.trim().toLowerCase();
  if (company) return company;
  const brand = row.brand?.trim().toLowerCase();
  return brand || null;
}

function normalizeOverviewToken(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function isOverviewStatusChange(row: SalesModuleClientUpdate): boolean {
  const status = normalizeOverviewToken(row.status);
  const contact = normalizeOverviewToken(row.contactType);
  return status === 'UPDATED' || contact === 'STATUS UPDATE' || contact.includes('STATUS UPDATE');
}

function isOverviewInteraction(row: SalesModuleClientUpdate): boolean {
  return Boolean(row.contactType?.trim());
}

function isOverviewNewLead(row: SalesModuleClientUpdate): boolean {
  return normalizeOverviewToken(row.status) === 'LEAD';
}

/** 0 = status change, 1 = interaction, 2 = new lead, 3 = other. */
function overviewDetailSortPriority(row: SalesModuleClientUpdate): number {
  if (isOverviewStatusChange(row)) return 0;
  if (isOverviewInteraction(row)) return 1;
  if (isOverviewNewLead(row)) return 2;
  return 3;
}

/**
 * Full Overview client list: one row per client.
 * Sorted by latest status change → latest interaction → new leads → other (then date desc).
 */
function sortOverviewClientDetails(rows: SalesModuleClientUpdate[]): SalesModuleClientUpdate[] {
  const best = new Map<string, SalesModuleClientUpdate>();
  const orphans: SalesModuleClientUpdate[] = [];
  for (const row of rows) {
    const key = overviewClientKey(row);
    if (!key) {
      orphans.push(row);
      continue;
    }
    const prev = best.get(key);
    if (!prev) {
      best.set(key, row);
      continue;
    }
    const pri = overviewDetailSortPriority(row) - overviewDetailSortPriority(prev);
    if (pri < 0
      || (pri === 0 && overviewDetailSortMs(row) > overviewDetailSortMs(prev))
      || (pri === 0 && overviewDetailSortMs(row) === overviewDetailSortMs(prev) && row.id > prev.id)) {
      best.set(key, row);
    }
  }
  return [...best.values(), ...orphans].sort(
    (a, b) =>
      overviewDetailSortPriority(a) - overviewDetailSortPriority(b)
      || overviewDetailSortMs(b) - overviewDetailSortMs(a)
      || b.id - a.id,
  );
}

type OverviewHunterDetail = {
  hunter: string;
  salesTeamMemberId?: number | null;
};

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
  const [overviewHasSearched, setOverviewHasSearched] = useState(false);
  const [overviewDetailHunter, setOverviewDetailHunter] = useState<OverviewHunterDetail | null>(null);
  const [overviewDetailRows, setOverviewDetailRows] = useState<SalesModuleClientUpdate[]>([]);
  const [overviewDetailLoading, setOverviewDetailLoading] = useState(false);
  const [clientUpdateView, setClientUpdateView] = useState<OverviewView>('week');
  const [clientUpdateWeekStart, setClientUpdateWeekStart] = useState('');
  const [clientUpdateMonthValue, setClientUpdateMonthValue] = useState('');
  const [clientUpdatePeriods, setClientUpdatePeriods] = useState<SalesModuleOverviewPeriods | null>(null);
  const [clientUpdates, setClientUpdates] = useState<SalesModuleClientUpdate[]>([]);
  const [clientUpdatesLoading, setClientUpdatesLoading] = useState(false);
  const [clientUpdateMessage, setClientUpdateMessage] = useState<string | null>(null);
  const [clientUpdateImporting, setClientUpdateImporting] = useState(false);
  const clientUpdateFileRef = useRef<HTMLInputElement>(null);
  const [followupRow, setFollowupRow] = useState<SalesModuleClientUpdate | null>(null);
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
  const activeHunters = useMemo(
    () => activeTeamMembers.filter(m => m.isHunter !== false),
    [activeTeamMembers],
  );

  const loadTeamMembers = useCallback(async () => {
    const rows = await api.salesModuleTeam();
    setTeamMembers(rows);
    setSelectedTeamMemberId(prev => {
      const hunters = rows.filter(m => m.active && m.isHunter !== false);
      // Keep a still-valid hunter selection; otherwise default to All (null).
      if (prev && hunters.some(m => m.id === prev)) return prev;
      return null;
    });
  }, []);

  const loadSalesCompanies = useCallback(async (memberId: number | null) => {
    const rows = memberId
      ? await api.salesModuleCompanies({ salesTeamMemberId: memberId })
      : await api.salesModuleCompanies({});
    setCompanies(rows);
    // Keep "All companies" unless the current selection is still valid for this hunter.
    setSelectedCompanyId(prev => {
      if (prev && rows.some(c => c.id === prev)) return prev;
      return null;
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

  const loadClientUpdatePeriods = useCallback(async () => {
    const periods = await api.salesModuleOverviewPeriods();
    setClientUpdatePeriods(periods);
    setClientUpdateWeekStart(prev => {
      if (prev && periods.weeks.some(w => w.value === prev)) return prev;
      return periods.weeks[0]?.value ?? '';
    });
    setClientUpdateMonthValue(prev => {
      if (prev && periods.months.some(m => m.value === prev)) return prev;
      return periods.months[0]?.value ?? '';
    });
  }, []);

  const loadClientUpdates = useCallback(async () => {
    const companyName = selectedCompanyId
      ? companies.find(c => c.id === selectedCompanyId)?.name.trim().toLowerCase() ?? ''
      : '';

    function applyCompanyFilter(rows: SalesModuleClientUpdate[]) {
      if (!companyName) return rows;
      return rows.filter(r =>
        r.company.trim().toLowerCase() === companyName
        || r.brand.trim().toLowerCase() === companyName);
    }

    // Member selected → all attached clients (no week/month filter).
    if (selectedTeamMemberId) {
      setClientUpdatesLoading(true);
      try {
        await api.rematchSalesModuleClientUpdateHunters().catch(() => undefined);
        // Sync company tags from rematched Client Update rows before listing attached clients.
        await api.salesModuleCompanies({ salesTeamMemberId: selectedTeamMemberId }).catch(() => undefined);
        const rows = await api.salesModuleClientUpdates({
          salesTeamMemberId: selectedTeamMemberId,
        });
        setClientUpdates(applyCompanyFilter(rows));
      } finally {
        setClientUpdatesLoading(false);
      }
      return;
    }

    if (clientUpdateView === 'week' && !clientUpdateWeekStart) return;
    if (clientUpdateView === 'month' && !clientUpdateMonthValue) return;

    setClientUpdatesLoading(true);
    try {
      // Rematch uploaded Hunter free-text to Sales Team list, then load period rows with changes.
      await api.rematchSalesModuleClientUpdateHunters().catch(() => undefined);
      if (clientUpdateView === 'week') {
        const rows = await api.salesModuleClientUpdates({
          view: 'week',
          weekStart: clientUpdateWeekStart,
        });
        setClientUpdates(applyCompanyFilter(rows));
        return;
      }
      const month = clientUpdatePeriods?.months.find(m => m.value === clientUpdateMonthValue);
      if (!month) {
        setClientUpdates([]);
        return;
      }
      const rows = await api.salesModuleClientUpdates({
        view: 'month',
        year: month.year,
        month: month.month,
      });
      setClientUpdates(applyCompanyFilter(rows));
    } finally {
      setClientUpdatesLoading(false);
    }
  }, [
    selectedTeamMemberId,
    selectedCompanyId,
    companies,
    clientUpdateView,
    clientUpdateWeekStart,
    clientUpdateMonthValue,
    clientUpdatePeriods,
  ]);

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
    setOverviewDetailHunter(null);
    setOverviewDetailRows([]);
    try {
      const scope = {
        salesTeamMemberId: overviewSalesTeamId || undefined,
      };
      if (overviewView === 'week') {
        const data = await api.salesModuleOverview({
          view: 'week',
          weekStart: overviewWeekStart,
          ...scope,
        });
        setOverview(data);
      } else {
        const [yearStr, monthStr] = overviewMonthValue.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        const data = await api.salesModuleOverview({
          view: 'month',
          year,
          month,
          ...scope,
        });
        setOverview(data);
      }
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
  ]);

  const openOverviewHunterDetail = useCallback(async (row: SalesModuleOverviewHunterRow) => {
    const isUnassigned = !row.hunter.trim()
      || row.hunter.trim().toLowerCase() === '(unassigned)'
      || row.hunter.trim().toLowerCase() === 'unassigned';
    const memberId = isUnassigned
      ? undefined
      : (row.salesTeamMemberId
        || activeHunters.find(m => m.name.trim().toLowerCase() === row.hunter.trim().toLowerCase())?.id
        || undefined);
    setOverviewDetailHunter({ hunter: row.hunter, salesTeamMemberId: memberId ?? null });
    setOverviewDetailLoading(true);
    setError(null);
    try {
      // Full attached client book for this team member (not week/month period filter).
      if (!isUnassigned) {
        await api.rematchSalesModuleClientUpdateHunters().catch(() => undefined);
        if (memberId) {
          await api.salesModuleCompanies({ salesTeamMemberId: memberId }).catch(() => undefined);
        }
      }
      const rows = await api.salesModuleClientUpdates(
        memberId ? { salesTeamMemberId: memberId } : { hunter: isUnassigned ? '(Unassigned)' : row.hunter },
      );
      setOverviewDetailRows(sortOverviewClientDetails(rows));
    } catch (err) {
      setOverviewDetailRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load team member clients');
    } finally {
      setOverviewDetailLoading(false);
    }
  }, [activeHunters]);

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

  // Overview periods when Overview tab is open; auto-load results when period is ready.
  useEffect(() => {
    if (tab !== 'overview') return;
    let cancelled = false;
    void loadOverviewPeriods().catch(err => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Overview periods');
    });
    return () => { cancelled = true; };
  }, [tab, loadOverviewPeriods]);

  // Auto-load Overview when week/month selection is available.
  useEffect(() => {
    if (tab !== 'overview') return;
    if (overviewView === 'week' && !overviewWeekStart) return;
    if (overviewView === 'month' && !overviewMonthValue) return;
    if (overviewView === 'month' && !overviewPeriods) return;
    void runOverviewSearch();
  }, [
    tab,
    overviewView,
    overviewWeekStart,
    overviewMonthValue,
    overviewPeriods,
    runOverviewSearch,
  ]);

  // Calendar sync is only needed on the Appointment Calendar tab (and can be slow via Graph).
  useEffect(() => {
    if (tab !== 'calendar') return;
    let cancelled = false;
    void loadTeamCalendars().catch(err => {
      if (!cancelled) setTeamSyncMessage(err instanceof Error ? err.message : 'Failed to sync calendars');
    });
    return () => { cancelled = true; };
  }, [tab, loadTeamCalendars]);

  // Load Client Update week/month period options when that tab is open.
  useEffect(() => {
    if (tab !== 'client-update') return;
    let cancelled = false;
    void loadClientUpdatePeriods().catch(err => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Client Update periods');
    });
    return () => { cancelled = true; };
  }, [tab, loadClientUpdatePeriods]);

  // Lazy-load Client Update when tab, hunter, or week/month selection changes.
  useEffect(() => {
    if (tab !== 'client-update') return;
    // Member scope lists all attached clients — period selectors are not required.
    if (!selectedTeamMemberId) {
      if (clientUpdateView === 'week' && !clientUpdateWeekStart) return;
      if (clientUpdateView === 'month' && !clientUpdateMonthValue) return;
      if (clientUpdateView === 'month' && !clientUpdatePeriods) return;
    }
    let cancelled = false;
    void loadClientUpdates().catch(err => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Client Update');
    });
    return () => { cancelled = true; };
  }, [
    tab,
    loadClientUpdates,
    selectedTeamMemberId,
    clientUpdateView,
    clientUpdateWeekStart,
    clientUpdateMonthValue,
    clientUpdatePeriods,
  ]);

  async function handleImportClientUpdates(file: File | null) {
    if (!file) return;
    setClientUpdateImporting(true);
    setClientUpdateMessage(null);
    setError(null);
    try {
      const result = await api.importSalesModuleClientUpdates(file);
      const lines = [
        ...(result.messages ?? []),
        result.clientDbWired != null
          ? `Client DB wired: ${result.clientDbWired}`
          : null,
        result.hunterRematch
          ? `Hunter rematch tagged ${result.hunterRematch.matched ?? 0} / unmatched ${result.hunterRematch.unmatched ?? 0}`
          : null,
      ].filter(Boolean);
      setClientUpdateMessage(lines.join('\n'));
      await loadClientUpdates();
      if (selectedTeamMemberId) {
        await loadSalesCompanies(selectedTeamMemberId).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import Instant Sales Update workbook');
    } finally {
      setClientUpdateImporting(false);
      if (clientUpdateFileRef.current) clientUpdateFileRef.current.value = '';
    }
  }

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
      if (tab === 'client-update') {
        await loadClientUpdates().catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setCreatingCompany(false);
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
        if (
          activity
          && !isInClientUpdatePeriod(
            activity,
            clientUpdateView,
            clientUpdateWeekStart,
            clientUpdateMonthValue,
          )
        ) {
          return prev.filter(r => r.id !== id);
        }
        // When scoped to a hunter, drop rows tagged to someone else after save.
        if (
          selectedTeamMemberId
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

  const selectedTeamMember = activeHunters.find(m => m.id === selectedTeamMemberId)
    ?? activeTeamMembers.find(m => m.id === selectedTeamMemberId)
    ?? null;

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

  if (activeTeamMembers.length === 0) {
    return (
      <div className={pageShellClass({ spacing: 'loose' })}>
        <p className="text-sm text-muted-foreground">
          Add Sales Module team members under Control Panel → Team (include Office 365 Graph credentials), then return here.
        </p>
        <button
          type="button"
          onClick={() => void loadTeamMembers().then(() => loadTeamCalendars())}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-muted w-fit"
        >
          Refresh team list
        </button>
      </div>
    );
  }

  if (!selectedTeamMemberId && tab !== 'client-update' && tab !== 'overview') {
    return (
      <div className={pageShellClass({ spacing: 'loose' })}>
        <p className="text-sm text-muted-foreground">
          Select a team member from the filters above to continue. Manage team members under Control Panel → Team.
        </p>
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
                <option value="">All team</option>
                {activeHunters.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
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
            {overviewHasSearched && overview?.periodLabel ? (
              <p className="text-xs text-muted-foreground self-center">
                Summary by Team · {overview.periodLabel}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              {tab === 'client-update' ? (
                <>
                  {!selectedTeamMemberId ? (
                    <>
                      <div className="inline-flex rounded-md border border-border overflow-hidden text-xs self-end">
                        <button
                          type="button"
                          onClick={() => setClientUpdateView('week')}
                          className={`px-3 py-1.5 font-semibold ${clientUpdateView === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        >
                          Week
                        </button>
                        <button
                          type="button"
                          onClick={() => setClientUpdateView('month')}
                          className={`px-3 py-1.5 font-semibold border-l border-border ${clientUpdateView === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                        >
                          Month
                        </button>
                      </div>
                      {clientUpdateView === 'week' ? (
                        <label className="inline-flex flex-col gap-1 text-xs min-w-[14rem]">
                          <span className="text-muted-foreground uppercase tracking-wide">Week</span>
                          <select
                            required
                            value={clientUpdateWeekStart}
                            onChange={e => setClientUpdateWeekStart(e.target.value)}
                            className="rounded-md border border-border bg-background px-2 py-1.5"
                          >
                            <option value="" disabled>
                              Select week…
                            </option>
                            {(clientUpdatePeriods?.weeks ?? []).map(w => (
                              <option key={w.value} value={w.value}>{w.label}</option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <label className="inline-flex flex-col gap-1 text-xs min-w-[12rem]">
                          <span className="text-muted-foreground uppercase tracking-wide">Month</span>
                          <select
                            required
                            value={clientUpdateMonthValue}
                            onChange={e => setClientUpdateMonthValue(e.target.value)}
                            className="rounded-md border border-border bg-background px-2 py-1.5"
                          >
                            <option value="" disabled>
                              Select month…
                            </option>
                            {(clientUpdatePeriods?.months ?? []).map(m => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </>
                  ) : null}
                  <button
                    type="button"
                    disabled={clientUpdatesLoading}
                    onClick={() => void loadClientUpdates()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50"
                  >
                    <Search size={12} />
                    {clientUpdatesLoading ? 'Loading…' : 'Refresh'}
                  </button>
                  <input
                    ref={clientUpdateFileRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={e => void handleImportClientUpdates(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    disabled={clientUpdateImporting}
                    onClick={() => clientUpdateFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-muted disabled:opacity-50"
                    title="Import Instant Sales Update.xlsx (Weekly Update + Client DB)"
                  >
                    <Upload size={12} />
                    {clientUpdateImporting ? 'Importing…' : 'Import Excel'}
                  </button>
                </>
              ) : null}
              <label className="inline-flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground uppercase tracking-wide">Sales Team</span>
                <select
                  value={selectedTeamMemberId ?? ''}
                  onChange={e => setSelectedTeamMemberId(e.target.value ? Number(e.target.value) : null)}
                  className="rounded-md border border-border bg-background px-2 py-1.5 min-w-[12rem]"
                >
                  {tab === 'client-update' ? (
                    <option value="">All</option>
                  ) : null}
                  {activeHunters.map(m => (
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
            </div>
            {tab === 'client-update' && !selectedTeamMemberId ? null : (
              <div className="flex flex-wrap items-end gap-2">
                <label className="inline-flex flex-col gap-1 text-xs min-w-[12rem] flex-1">
                  <span className="text-muted-foreground uppercase tracking-wide">Add company for this member</span>
                  <input
                    value={companyDraft}
                    onChange={e => setCompanyDraft(e.target.value)}
                    placeholder="Company name…"
                    className="rounded-md border border-border bg-background px-2 py-1.5"
                    disabled={!selectedTeamMemberId}
                  />
                </label>
                <button
                  type="button"
                  disabled={creatingCompany || !companyDraft.trim() || !selectedTeamMemberId}
                  onClick={() => void handleCreateCompany()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-muted disabled:opacity-50"
                >
                  <Plus size={12} />
                  {creatingCompany ? 'Saving…' : 'Add company'}
                </button>
              </div>
            )}
          </>
        )}
        <HrConfigTabBar
          tabs={TABS}
          active={tab}
          onChange={next => {
            setTab(next);
            if (next !== 'overview') {
              setOverviewDetailHunter(null);
              setOverviewDetailRows([]);
            }
            if (next !== 'client-update' && next !== 'overview' && !selectedTeamMemberId) {
              setSelectedTeamMemberId(activeTeamMembers[0]?.id ?? null);
            }
          }}
        />
        {tab === 'overview' ? null : tab === 'client-update' ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Client Update ·{' '}
              {selectedTeamMember ? (
                <>
                  all clients attached to {selectedTeamMember.name}
                  {' · '}
                  {clientUpdatesLoading ? '…' : `${clientUpdates.length} client${clientUpdates.length === 1 ? '' : 's'}`}
                </>
              ) : (
                <>
                  {clientUpdateView === 'week'
                    ? (clientUpdatePeriods?.weeks.find(w => w.value === clientUpdateWeekStart)?.label
                      ?? 'select week')
                    : (clientUpdatePeriods?.months.find(m => m.value === clientUpdateMonthValue)?.label
                      ?? 'select month')}
                  {' · changes only · '}
                  {clientUpdatesLoading ? '…' : `${clientUpdates.length} record${clientUpdates.length === 1 ? '' : 's'}`}
                  {' · all hunters'}
                </>
              )}
              {' · '}use Followup on each row to send appointments or change status
              {' · '}Import Excel wires Instant Sales Update (Weekly Update + Client DB) to Sales Team members
            </p>
            {clientUpdateMessage ? (
              <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{clientUpdateMessage}</p>
            ) : null}
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
        <div className="space-y-4">
          <TableScrollContainer ref={scrollRootRef}>
            <table className="w-full text-xs">
              <ColGroup widths={['18%', '12%', '22%', '28%', '20%']} />
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-1.5 text-left">Team</th>
                  <th className="px-2 py-1.5 text-right">Total Client</th>
                  <th className="px-2 py-1.5 text-right">Client status change</th>
                  <th className="px-2 py-1.5 text-right">Client interaction (contact)</th>
                  <th className="px-2 py-1.5 text-right">New Lead</th>
                </tr>
              </thead>
              <tbody>
                {overviewLoading ? (
                  <TableLoadingRow colSpan={5} label="Loading overview…" />
                ) : !overviewHasSearched ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      Select a week or month to view Sales Team activity.
                    </td>
                  </tr>
                ) : (overviewView === 'week' && !overviewWeekStart) || (overviewView === 'month' && !overviewMonthValue) ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      {overviewView === 'week'
                        ? 'Select a week to view Sales Team activity.'
                        : 'Select a month to view Sales Team activity.'}
                    </td>
                  </tr>
                ) : !overview || overview.hunters.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No team members yet. Add them under Control Panel → Team.
                    </td>
                  </tr>
                ) : (
                  <>
                    {overview.hunters.map(row => {
                      const selected = overviewDetailHunter?.hunter === row.hunter;
                      return (
                        <tr
                          key={row.hunter}
                          className={`border-b border-border/60 hover:bg-muted/30${selected ? ' bg-muted/40' : ''}`}
                        >
                          <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                            <button
                              type="button"
                              className="text-left font-medium text-primary underline-offset-2 hover:underline"
                              onClick={() => void openOverviewHunterDetail(row)}
                            >
                              {row.hunter}
                            </button>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{row.totalClients ?? 0}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{row.statusChanges}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{row.interactions}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{row.newLeads}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-border bg-muted/20 font-semibold">
                      <td className="px-2 py-1.5">Total</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{overview.totals.totalClients ?? 0}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{overview.totals.statusChanges}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{overview.totals.interactions}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{overview.totals.newLeads}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </TableScrollContainer>

          {overviewDetailHunter ? (
            <div className="rounded-md border border-border overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/20">
                <div>
                  <p className="text-sm font-semibold">{overviewDetailHunter.hunter}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Full client list
                    {' · '}
                    {overviewDetailLoading
                      ? '…'
                      : `${overviewDetailRows.length} client${overviewDetailRows.length === 1 ? '' : 's'}`}
                    {' · '}status change → interaction → new leads
                    {' · '}click client name to update
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-border hover:bg-muted"
                  onClick={() => {
                    setOverviewDetailHunter(null);
                    setOverviewDetailRows([]);
                  }}
                >
                  <X size={12} />
                  Close
                </button>
              </div>
              <TableScrollContainer>
                <table className="w-full text-xs">
                  <ColGroup widths={['14%', '10%', '12%', '8%', '10%', '10%', '12%', '24%']} />
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-1.5 text-left">Client name</th>
                      <th className="px-2 py-1.5 text-left">Created Date</th>
                      <th className="px-2 py-1.5 text-left">Brand</th>
                      <th className="px-2 py-1.5 text-right">Number of Location</th>
                      <th className="px-2 py-1.5 text-left">Current Status</th>
                      <th className="px-2 py-1.5 text-left">Interaction Date</th>
                      <th className="px-2 py-1.5 text-left">Interaction Type</th>
                      <th className="px-2 py-1.5 text-left">Interaction Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewDetailLoading ? (
                      <TableLoadingRow colSpan={8} label="Loading clients…" />
                    ) : overviewDetailRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                          {overviewDetailHunter.hunter.trim().toLowerCase() === '(unassigned)'
                            || overviewDetailHunter.hunter.trim().toLowerCase() === 'unassigned'
                            ? 'No unassigned clients found. They may have been tagged to a team member.'
                            : 'No clients attached to this team member yet. Import Excel on Client Update or tag a company.'}
                        </td>
                      </tr>
                    ) : (
                      overviewDetailRows.map(row => (
                        <tr key={row.id} className="border-b border-border/60 hover:bg-muted/30">
                          <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                            <button
                              type="button"
                              className="text-left font-medium text-primary underline-offset-2 hover:underline"
                              title="Open Client Update followup"
                              onClick={() => setFollowupRow(row)}
                            >
                              {row.company?.trim() || row.brand?.trim() || '—'}
                            </button>
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{formatOptionalDate(row.dateCreated)}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{row.brand?.trim() || '—'}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {row.locationCount != null ? row.locationCount : '—'}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{row.status?.trim() || '—'}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{formatOptionalDate(row.lastContactDate)}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{row.contactType?.trim() || '—'}</td>
                          <td className="px-2 py-1.5 max-w-[18rem] truncate" title={row.note || undefined}>
                            {row.note?.trim() || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </TableScrollContainer>
            </div>
          ) : null}
        </div>
      ) : tab === 'client-update' ? (
        <TableScrollContainer ref={scrollRootRef}>
          <table className="w-full text-xs">
            <ColGroup widths={['8%', '8%', '10%', '8%', '7%', '7%', '8%', '8%', '7%', '10%', '8%', '8%', TABLE_COL_ACTION.style.width]} />
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
                <th className="px-2 py-1.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {clientUpdatesLoading ? (
                <TableLoadingRow colSpan={13} label="Loading client updates…" />
              ) : clientUpdates.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                    {selectedTeamMemberId
                      ? 'No clients attached to this Sales Team member yet. Add a company above or import Client Update rows.'
                      : `No Client Update rows with changes for the selected ${clientUpdateView === 'week' ? 'week' : 'month'}.`}
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
                          teamMembers={activeHunters}
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
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setFollowupRow(row)}
                        className="px-2 py-1 rounded-md text-[11px] font-semibold border border-border hover:bg-muted"
                      >
                        Followup
                      </button>
                    </td>
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
          onCompanyCreated={created => {
            setCompanies(prev => {
              if (prev.some(c => c.id === created.id)) return prev;
              return [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
            });
            setSelectedCompanyId(created.id);
          }}
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

      {followupRow ? (
        <ClientUpdateFollowupPanel
          row={followupRow}
          createdByEmail={engagedUserEmail}
          onClose={() => setFollowupRow(null)}
          onSaved={result => {
            const saved = result.clientUpdate;
            setClientUpdates(prev => {
              const activity = saved.lastContactDate || saved.dateCreated;
              if (
                activity
                && !isInClientUpdatePeriod(
                  activity,
                  clientUpdateView,
                  clientUpdateWeekStart,
                  clientUpdateMonthValue,
                )
              ) {
                return prev.filter(r => r.id !== saved.id);
              }
              return prev.map(r => (r.id === saved.id ? saved : r));
            });
            setOverviewDetailRows(prev => {
              const next = prev.map(r => (r.id === saved.id ? saved : r));
              return sortOverviewClientDetails(next);
            });
            setClientUpdateMessage(
              result.outlookSynced
                ? 'Followup saved · Outlook appointment synced.'
                : result.appointment
                  ? 'Followup saved · appointment created.'
                  : 'Followup saved.',
            );
            setFollowupRow(null);
            if (tab === 'client-update') void loadClientUpdates();
          }}
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
