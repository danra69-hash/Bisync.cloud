import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, MapPin, RefreshCw, X } from 'lucide-react';
import {
  api,
  setApiTenantCompanyId,
  type Company,
  type Location,
  type PosLocationTodayRow,
} from '../../api';
import { formatCountryCurrency } from '../../utils/numberFormat';

const MANY_LOCATIONS_THRESHOLD = 3;
const TEAM_LOC_STORAGE_KEY = 'bisync.team.selectedLocationIds';

type Props = {
  /** Preferred company from the signed-in employee when available. */
  preferredCompanyId?: number | null;
};

function formatAsOf(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function readStoredLocationIds(companyId: number): string[] {
  try {
    const raw = localStorage.getItem(`${TEAM_LOC_STORAGE_KEY}.${companyId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredLocationIds(companyId: number, ids: string[]) {
  try {
    localStorage.setItem(`${TEAM_LOC_STORAGE_KEY}.${companyId}`, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/** Live POS Sales / Covers / Check for Team app Home (`/TEAM`). */
export function TeamLocationPosList({ preferredCompanyId = null }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rows, setRows] = useState<PosLocationTodayRow[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [businessDate, setBusinessDate] = useState<string | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyLocations = useMemo(
    () =>
      locations
        .filter(l => l.active !== false && (l.companyId == null || l.companyId === companyId))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [locations, companyId],
  );

  const selectedCompany = companies.find(c => c.id === companyId) ?? null;
  const countryCode = selectedCompany?.countryCode || 'MY';
  const showLocationsButton = companyLocations.length >= MANY_LOCATIONS_THRESHOLD;

  useEffect(() => {
    let cancelled = false;
    setBootLoading(true);
    void (async () => {
      try {
        const [cos, locs] = await Promise.all([api.companies(), api.locations()]);
        if (cancelled) return;
        const companyList = Array.isArray(cos) ? cos.filter(c => c.active !== false) : [];
        const locationList = Array.isArray(locs) ? locs : [];
        setCompanies(companyList);
        setLocations(locationList);

        const storedCompany = Number(localStorage.getItem('bisync.selectedCompanyId') || 0);
        const pick =
          (preferredCompanyId != null
            ? companyList.find(c => c.id === preferredCompanyId)
            : undefined)
          ?? companyList.find(c => c.id === storedCompany)
          ?? companyList[0]
          ?? null;

        if (!pick) {
          setCompanyId(null);
          setSelectedIds([]);
          return;
        }

        setCompanyId(pick.id);
        setApiTenantCompanyId(pick.id);
        localStorage.setItem('bisync.selectedCompanyId', String(pick.id));

        const forCo = locationList.filter(
          l => l.active !== false && (l.companyId == null || l.companyId === pick.id),
        );
        const allIds = forCo.map(l => l.externalId).filter(Boolean);
        const stored = readStoredLocationIds(pick.id).filter(id => allIds.includes(id));
        setSelectedIds(stored.length > 0 ? stored : allIds);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load locations.');
        }
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preferredCompanyId]);

  useEffect(() => {
    if (!companyId) return;
    writeStoredLocationIds(companyId, selectedIds);
  }, [companyId, selectedIds]);

  const refresh = useCallback(async () => {
    if (!companyId || selectedIds.length === 0) {
      setRows([]);
      setAsOf(null);
      setBusinessDate(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setApiTenantCompanyId(companyId);
      const data = await api.posLocationsToday(companyId, selectedIds);
      setRows(data.locations ?? []);
      setAsOf(data.asOf ?? null);
      setBusinessDate(data.businessDate ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load POS location figures.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedIds]);

  const selectedKey = selectedIds.join(',');
  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh, selectedKey]);

  const views = useMemo(() => {
    const byId = new Map(rows.map(r => [r.locationExternalId, r]));
    return companyLocations
      .filter(loc => selectedIds.includes(loc.externalId))
      .map(loc => {
        const row = byId.get(loc.externalId);
        const salesCents = row?.salesCents ?? 0;
        const covers = row?.covers ?? 0;
        const checks = row?.checks ?? 0;
        const sales = salesCents / 100;
        const avgCheck = covers > 0 ? sales / covers : checks > 0 ? sales / checks : 0;
        return {
          externalId: loc.externalId,
          name: loc.name,
          salesCents,
          covers,
          checks,
          openChecks: row?.openChecks ?? 0,
          lastPaidAt: row?.lastPaidAt ?? null,
          avgCheck,
        };
      });
  }, [companyLocations, rows, selectedIds]);

  const listAsOf = useMemo(() => {
    const paid = views.map(v => v.lastPaidAt).filter(Boolean) as string[];
    if (paid.length === 0) return asOf;
    return paid.reduce((latest, iso) =>
      new Date(iso).getTime() > new Date(latest).getTime() ? iso : latest,
    );
  }, [views, asOf]);

  const allSelected =
    companyLocations.length > 0
    && companyLocations.every(l => selectedIds.includes(l.externalId));

  function toggleAll() {
    setSelectedIds(allSelected ? [] : companyLocations.map(l => l.externalId));
  }

  function toggleLocation(externalId: string) {
    setSelectedIds(prev =>
      prev.includes(externalId)
        ? prev.filter(id => id !== externalId)
        : [...prev, externalId],
    );
  }

  const pickerLabel = allSelected
    ? 'All locations'
    : selectedIds.length === 0
      ? 'Select locations'
      : selectedIds.length === 1
        ? companyLocations.find(l => l.externalId === selectedIds[0])?.name ?? '1 location'
        : `${selectedIds.length} locations`;

  return (
    <section className="team-card team-landing-box team-location-pos">
      <header className="team-landing-box-head">
        <div className="team-location-pos-title">
          <MapPin size={14} />
          <h3>Locations today</h3>
        </div>
        <div className="team-location-pos-actions">
          {showLocationsButton ? (
            <div className="team-location-pos-picker">
              <button
                type="button"
                className="team-location-pos-picker-btn"
                onClick={() => setPickerOpen(v => !v)}
                aria-expanded={pickerOpen}
              >
                <MapPin size={12} />
                <span>{pickerLabel}</span>
                <ChevronDown size={12} className={pickerOpen ? 'is-open' : ''} />
              </button>
              {pickerOpen ? (
                <div className="team-location-pos-picker-menu">
                  <button type="button" className="team-location-pos-picker-row" onClick={toggleAll}>
                    <span className={`team-location-pos-check${allSelected ? ' is-on' : ''}`}>
                      {allSelected ? <Check size={10} /> : null}
                    </span>
                    All locations
                  </button>
                  {companyLocations.map(loc => {
                    const on = selectedIds.includes(loc.externalId);
                    return (
                      <button
                        key={loc.externalId}
                        type="button"
                        className="team-location-pos-picker-row"
                        onClick={() => toggleLocation(loc.externalId)}
                      >
                        <span className={`team-location-pos-check${on ? ' is-on' : ''}`}>
                          {on ? <Check size={10} /> : null}
                        </span>
                        {loc.name}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="team-location-pos-picker-close"
                    onClick={() => setPickerOpen(false)}
                  >
                    <X size={12} />
                    Done
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className="team-location-pos-refresh"
            onClick={() => void refresh()}
            disabled={loading || bootLoading}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw size={12} className={loading ? 'is-spin' : ''} />
          </button>
        </div>
      </header>

      <p className="team-muted team-location-pos-asof">
        {businessDate
          ? `Business day ${businessDate} · Data as of ${formatAsOf(listAsOf)}`
          : 'Live POS sales, covers, and check average'}
      </p>

      {bootLoading ? <p className="team-muted">Loading locations…</p> : null}
      {error ? <p className="team-inline-error">{error}</p> : null}

      {!bootLoading && !error && selectedIds.length === 0 ? (
        <p className="team-muted">Select locations to see today’s POS figures.</p>
      ) : null}

      {!bootLoading && !error && views.length > 0 ? (
        <ul className="team-location-pos-list">
          {views.map(row => (
            <li key={row.externalId} className="team-location-pos-row">
              <div className="team-location-pos-row-head">
                <strong>{row.name}</strong>
                <span className="team-muted">{formatAsOf(row.lastPaidAt ?? asOf)}</span>
              </div>
              <dl className="team-kv team-kv-compact team-location-pos-metrics">
                <div>
                  <dt>Sales</dt>
                  <dd>{formatCountryCurrency(row.salesCents / 100, countryCode)}</dd>
                </div>
                <div>
                  <dt>Covers</dt>
                  <dd>{row.covers}</dd>
                </div>
                <div>
                  <dt>Check</dt>
                  <dd>
                    {formatCountryCurrency(row.avgCheck, countryCode)}
                    <em className="team-muted"> · {row.checks} checks</em>
                  </dd>
                </div>
              </dl>
              {row.openChecks > 0 ? (
                <p className="team-muted team-location-pos-open">{row.openChecks} open</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
