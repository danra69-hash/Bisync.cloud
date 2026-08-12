import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, RefreshCw, Shield } from 'lucide-react';
import {
  api,
  type Company,
  type Location,
  type SystemAuditEventRow,
  type SystemAuditMonthBucket,
} from '../../api';
import { isSuperAdmin, parseUserAccess } from '../../data/userAccess';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { TableHeaderCell } from '../shared/TableHeaderCell';
import { TableLoadingRow } from '../shared/MillstoneLoader';
import { ColGroup } from '../shared/SortableTableHead';

/** Display titles for Audit Trail activity types. */
function activityTypeLabel(category: string): string {
  switch (category) {
    case 'Login':
      return 'Login';
    case 'Logout':
      return 'Logout';
    case 'DbUpdate':
    case 'DB update':
      return 'Database change';
    case 'Computation':
      return 'Computation';
    case 'PR issue / approval':
    case 'PO adjustment / issue':
    case 'Received / Consolidation / adjustment':
    case 'Stock issue / receive':
    case 'Wastage / Transfer':
    case 'Credit note':
    case 'Cash purchase':
    case 'Inventory count / adjustment':
    case 'Database change':
      return category;
    default:
      return category || 'Database change';
  }
}

function activityTypeClass(category: string): string {
  const type = activityTypeLabel(category);
  switch (type) {
    case 'Login':
      return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200';
    case 'Logout':
      return 'bg-slate-500/15 text-slate-700 dark:text-slate-200';
    case 'PR issue / approval':
      return 'bg-violet-500/15 text-violet-800 dark:text-violet-200';
    case 'PO adjustment / issue':
      return 'bg-orange-500/15 text-orange-900 dark:text-orange-200';
    case 'Received / Consolidation / adjustment':
      return 'bg-teal-500/15 text-teal-800 dark:text-teal-200';
    case 'Stock issue / receive':
      return 'bg-sky-500/15 text-sky-800 dark:text-sky-200';
    case 'Wastage / Transfer':
      return 'bg-rose-500/15 text-rose-800 dark:text-rose-200';
    case 'Credit note':
      return 'bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-200';
    case 'Cash purchase':
      return 'bg-lime-500/15 text-lime-900 dark:text-lime-200';
    case 'Inventory count / adjustment':
      return 'bg-cyan-500/15 text-cyan-900 dark:text-cyan-200';
    case 'Computation':
      return 'bg-amber-500/15 text-amber-900 dark:text-amber-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function formatLocal(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  if (match) return `${match[1]} ${match[2]}`;
  return value;
}

function loginName(row: SystemAuditEventRow): string {
  const email = (row.userEmail ?? '').trim();
  if (email) return email;
  const name = (row.userName ?? '').trim();
  return name || '—';
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

type SystemAuditTrailTabProps = {
  /** Dev Console session can view platform usage audit without customer app login. */
  allowDevConsoleAccess?: boolean;
};

export function SystemAuditTrailTab({ allowDevConsoleAccess = false }: SystemAuditTrailTabProps) {
  const { currentUser } = useCurrentUser();
  const access = useMemo(
    () => (currentUser ? parseUserAccess(currentUser.accessJson) : parseUserAccess('{}')),
    [currentUser],
  );
  const role = currentUser?.role ?? '';
  const canView = allowDevConsoleAccess
    || isSuperAdmin(access)
    || /system admin|super admin/i.test(role);

  const now = new Date();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [companyId, setCompanyId] = useState<number | ''>('');
  const [locationId, setLocationId] = useState<number | ''>('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [months, setMonths] = useState<SystemAuditMonthBucket[]>([]);
  const [rows, setRows] = useState<SystemAuditEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [retentionNote, setRetentionNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SystemAuditEventRow | null>(null);

  const filtersReady = companyId !== '' && locationId !== '' && year > 0 && month >= 1 && month <= 12;

  const companyLocations = useMemo(
    () => (companyId === ''
      ? []
      : locations.filter(l => l.companyId === companyId).sort((a, b) => a.name.localeCompare(b.name))),
    [locations, companyId],
  );

  const monthOptions = useMemo(() => {
    const map = new Map<string, SystemAuditMonthBucket>();
    for (const m of months) map.set(`${m.year}-${m.month}`, m);
    const key = `${year}-${month}`;
    if (!map.has(key)) map.set(key, { year, month, count: 0 });
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const k = `${y}-${m}`;
      if (!map.has(k)) map.set(k, { year: y, month: m, count: 0 });
    }
    return [...map.values()].sort((a, b) => b.year - a.year || b.month - a.month);
  }, [months, year, month, now]);

  useEffect(() => {
    if (!canView) return;
    Promise.all([api.companies(), api.locations()])
      .then(([companyRows, locationRows]) => {
        setCompanies(companyRows.filter(c => c.active !== false).sort((a, b) => a.name.localeCompare(b.name)));
        setLocations(locationRows);
      })
      .catch(() => {
        setCompanies([]);
        setLocations([]);
      });
  }, [canView]);

  useEffect(() => {
    setLocationId('');
    setRows([]);
    setTotal(0);
    setSelected(null);
  }, [companyId]);

  const loadMonths = useCallback(async () => {
    if (companyId === '') {
      setMonths([]);
      return;
    }
    try {
      setMonths(await api.systemAuditMonths({
        companyId,
        locationId: locationId === '' ? undefined : locationId,
      }));
    } catch {
      setMonths([]);
    }
  }, [companyId, locationId]);

  const loadRows = useCallback(async () => {
    if (typeof companyId !== 'number' || typeof locationId !== 'number') {
      setRows([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.systemAuditEvents({
        companyId,
        locationId,
        year,
        month,
        take: 400,
      });
      setRows(result.rows);
      setTotal(result.total);
      setRetentionNote(result.retentionNote);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : 'Failed to load Audit Trail');
    } finally {
      setLoading(false);
    }
  }, [filtersReady, companyId, locationId, year, month]);

  useEffect(() => {
    if (!canView) return;
    void loadMonths();
  }, [canView, loadMonths]);

  useEffect(() => {
    if (!canView) return;
    void loadRows();
  }, [canView, loadRows]);

  if (!canView) {
    return (
      <div className="rounded-lg border border-border bg-card px-5 py-10 text-center space-y-2">
        <Shield size={22} className="mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Super User / System Admin only</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Platform Audit Trail is stored in the separate <span className="font-sans">bisync_audit</span> database
          and is only visible to Super User or System Admin accounts.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold inline-flex items-center gap-2">
            <History size={14} className="text-muted-foreground" />
            Audit Trail
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">
            Continuous 24/7 log of platform changes: login/logout, PR/PO workflow, receive &amp; consolidation,
            stock issue/receive, wastage/transfer, credit notes, cash purchases, and other database updates.
            Viewing is not recorded. Times follow the company&apos;s registered country local time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void loadMonths(); void loadRows(); }}
          disabled={loading || !filtersReady}
          className="inline-flex items-center gap-1.5 text-xs font-medium border border-border rounded-md px-3 py-2 hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Company</span>
          <select
            value={companyId === '' ? '' : String(companyId)}
            onChange={e => setCompanyId(e.target.value ? Number(e.target.value) : '')}
            className="block rounded-md border border-border bg-background px-2.5 py-1.5 text-xs min-w-[14rem]"
          >
            <option value="">Select company…</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Location</span>
          <select
            value={locationId === '' ? '' : String(locationId)}
            onChange={e => setLocationId(e.target.value ? Number(e.target.value) : '')}
            disabled={companyId === ''}
            className="block rounded-md border border-border bg-background px-2.5 py-1.5 text-xs min-w-[14rem] disabled:opacity-50"
          >
            <option value="">Select location…</option>
            {companyLocations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Month / Year</span>
          <select
            value={`${year}-${month}`}
            onChange={e => {
              const [y, m] = e.target.value.split('-').map(Number);
              setYear(y);
              setMonth(m);
            }}
            className="block rounded-md border border-border bg-background px-2.5 py-1.5 text-xs min-w-[12rem]"
          >
            {monthOptions.map(item => (
              <option key={`${item.year}-${item.month}`} value={`${item.year}-${item.month}`}>
                {monthLabel(item.year, item.month)}{item.count ? ` (${item.count})` : ''}
              </option>
            ))}
          </select>
        </label>

        {filtersReady && (
          <p className="text-[11px] text-muted-foreground pb-1.5">
            {total} event{total === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {retentionNote && filtersReady && (
        <p className="text-[11px] text-muted-foreground">{retentionNote}</p>
      )}
      {error && (
        <div className="px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs">{error}</div>
      )}

      {!filtersReady ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
          <p className="text-xs text-muted-foreground">
            Select company, location, and month/year to view Audit Trail.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden overflow-x-auto">
          <table className="w-full text-xs min-w-[56rem]">
            <ColGroup widths={['16%', '18%', '16%', '32%', '18%']} />
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <TableHeaderCell>Date / Time</TableHeaderCell>
                <TableHeaderCell>Login name (email)</TableHeaderCell>
                <TableHeaderCell>Activity type</TableHeaderCell>
                <TableHeaderCell>Activity Detail</TableHeaderCell>
                <TableHeaderCell>Effected DB bucket</TableHeaderCell>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const type = activityTypeLabel(row.activityType || row.category);
                const detail = row.activityDetail || row.summary;
                const bucket = row.effectedDbBucket || row.databaseBucket || '—';
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelected(row)}
                  >
                    <td className="px-3 py-2 font-sans whitespace-nowrap">
                      <p>{formatLocal(row.occurredAtLocal)}</p>
                      <p className="text-[10px] text-muted-foreground">{row.timeZoneId}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium break-all">{loginName(row)}</p>
                      {row.userName && row.userEmail ? (
                        <p className="text-[10px] text-muted-foreground truncate">{row.userName}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium leading-snug ${activityTypeClass(type)}`}>
                        {type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <span className="line-clamp-2">{detail}</span>
                    </td>
                    <td className="px-3 py-2 font-sans whitespace-nowrap">{bucket}</td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No audit events for this company, location, and month.
                  </td>
                </tr>
              )}
              {loading && rows.length === 0 && (
                <TableLoadingRow colSpan={5} />
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-2 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Event detail</p>
              <p className="font-medium mt-0.5">
                {activityTypeLabel(selected.activityType || selected.category)}
                {selected.action ? ` · ${selected.action}` : ''}
              </p>
            </div>
            <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <p>{selected.activityDetail || selected.summary}</p>
          <dl className="grid grid-cols-[9rem_1fr] gap-x-2 gap-y-1">
            <dt className="text-muted-foreground">Date / Time</dt>
            <dd>{formatLocal(selected.occurredAtLocal)} ({selected.timeZoneId})</dd>
            <dt className="text-muted-foreground">Login name (email)</dt>
            <dd>{loginName(selected)}</dd>
            <dt className="text-muted-foreground">Activity type</dt>
            <dd>{activityTypeLabel(selected.activityType || selected.category)}</dd>
            <dt className="text-muted-foreground">Company</dt>
            <dd>{selected.companyName || '—'}</dd>
            <dt className="text-muted-foreground">Location</dt>
            <dd>{selected.locationName || 'Company-wide / not tagged'}</dd>
            <dt className="text-muted-foreground">Effected DB bucket</dt>
            <dd className="font-sans">{selected.effectedDbBucket || selected.databaseBucket || '—'}</dd>
          </dl>
        </div>
      )}
    </section>
  );
}
