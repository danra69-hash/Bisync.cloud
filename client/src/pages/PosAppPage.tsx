import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { api, type Company, type LocationConfig } from '../api';
import { parseCompanyModules } from '../data/companyModules';
import { configLocationToDropdown } from '../utils/orgFilters';
import { MillstoneLoader } from '../components/shared/MillstoneLoader';
import { PosEmbedErrorBoundary } from '../components/shared/PosEmbedErrorBoundary';
import './PosAppPage.css';

const BisyncPosEmbed = lazy(() =>
  import('../bisync-pos/embed').then(m => ({ default: m.BisyncPosEmbed })),
);

const STORAGE_COMPANY = 'bisync-pos-standalone-company';
const STORAGE_LOCATION = 'bisync-pos-standalone-location';

export type PosStandaloneEntry = 'pos' | 'kds' | 'bds' | 'cds'

const ENTRY_PATH: Record<PosStandaloneEntry, string> = {
  pos: '/order/floor',
  kds: '/boh/kds',
  bds: '/boh/bds',
  cds: '/boh/cds',
}

const ENTRY_LABEL: Record<PosStandaloneEntry, string> = {
  pos: 'POS',
  kds: 'KDS',
  bds: 'BDS',
  cds: 'CDS',
}

function readStoredInt(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function readStoredString(key: string): string {
  try {
    return localStorage.getItem(key)?.trim() || '';
  } catch {
    return '';
  }
}

function companyHasPos(company: Company) {
  return parseCompanyModules(company.modulesJson).includes('POS');
}

type PosAppPageProps = {
  /** Which standalone screen to open (/POS, /KDS, /BDS, /CDS). */
  entry?: PosStandaloneEntry
}

/** Standalone POS shell at /POS — full-screen for phone / tablet / station testing. */
export function PosAppPage({ entry = 'pos' }: PosAppPageProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [locationId, setLocationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const entryLabel = ENTRY_LABEL[entry];
  const initialEntry = ENTRY_PATH[entry];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const [companyRows, locationRows] = await Promise.all([
          api.companies(),
          api.locationsConfig(),
        ]);
        if (cancelled) return;

        const posCompanies = companyRows.filter(c => c.active !== false && companyHasPos(c));
        const pool = posCompanies.length > 0 ? posCompanies : companyRows.filter(c => c.active !== false);
        setCompanies(pool);
        setLocations(locationRows);

        const storedCompany = readStoredInt(STORAGE_COMPANY);
        const preferredCompany =
          pool.find(c => c.id === storedCompany)
          ?? pool.find(c => /weissbrau/i.test(c.name))
          ?? pool[0]
          ?? null;

        if (!preferredCompany) {
          setError('No company with Point-of-Sales is available.');
          return;
        }

        setCompanyId(preferredCompany.id);

        const activeLocs = locationRows
          .filter(l => l.companyId === preferredCompany.id && l.active !== false)
          .map(configLocationToDropdown)
          .sort((a, b) => a.name.localeCompare(b.name));

        const storedLoc = readStoredString(STORAGE_LOCATION);
        const preferredLoc =
          activeLocs.find(l => l.externalId === storedLoc)?.externalId
          ?? activeLocs[0]?.externalId
          ?? '';

        setLocationId(preferredLoc);
        if (!preferredLoc) {
          setError('No active location found for this company.');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load POS.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (companyId == null) return;
    try {
      localStorage.setItem(STORAGE_COMPANY, String(companyId));
    } catch {
      /* ignore */
    }
  }, [companyId]);

  useEffect(() => {
    if (!locationId) return;
    try {
      localStorage.setItem(STORAGE_LOCATION, locationId);
    } catch {
      /* ignore */
    }
  }, [locationId]);

  const locationOptions = useMemo(() => {
    if (companyId == null) return [];
    return locations
      .filter(l => l.companyId === companyId && l.active !== false)
      .map(configLocationToDropdown)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locations, companyId]);

  const onCompanyChange = (nextId: number) => {
    setCompanyId(nextId);
    const nextLocs = locations
      .filter(l => l.companyId === nextId && l.active !== false)
      .map(configLocationToDropdown)
      .sort((a, b) => a.name.localeCompare(b.name));
    setLocationId(nextLocs[0]?.externalId ?? '');
  };

  if (loading) {
    return <MillstoneLoader layout="screen" size="lg" label={`Loading ${entryLabel}…`} />;
  }

  if (error || companyId == null || !locationId) {
    return (
      <div className="pos-standalone pos-standalone-error">
        <p>{error || `Select a company and location to open ${entryLabel}.`}</p>
        {companies.length > 0 ? (
          <label className="pos-standalone-field">
            <span>Company</span>
            <select
              value={companyId ?? ''}
              onChange={e => onCompanyChange(Number(e.target.value))}
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {locationOptions.length > 0 ? (
          <label className="pos-standalone-field">
            <span>Location</span>
            <select value={locationId} onChange={e => setLocationId(e.target.value)}>
              {locationOptions.map(l => (
                <option key={l.externalId} value={l.externalId}>{l.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="button" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="pos-standalone">
      {companies.length > 1 || locationOptions.length > 1 ? (
        <div className="pos-standalone-chrome">
          {companies.length > 1 ? (
            <label>
              <span>Company</span>
              <select
                value={companyId}
                onChange={e => onCompanyChange(Number(e.target.value))}
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          {locationOptions.length > 1 ? (
            <label>
              <span>Location</span>
              <select value={locationId} onChange={e => setLocationId(e.target.value)}>
                {locationOptions.map(l => (
                  <option key={l.externalId} value={l.externalId}>{l.name}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="pos-standalone-frame">
        <PosEmbedErrorBoundary title={`${entryLabel} crashed`}>
          <Suspense
            fallback={
              <div className="pos-standalone-loading">
                <MillstoneLoader label="Loading Bisync POS…" />
              </div>
            }
          >
            <BisyncPosEmbed
              companyId={companyId}
              locationId={locationId}
              locations={locationOptions}
              onLocationChange={setLocationId}
              initialEntry={initialEntry}
            />
          </Suspense>
        </PosEmbedErrorBoundary>
      </div>
    </div>
  );
}

/** Standalone Kitchen Display at /KDS. */
export function KdsAppPage() {
  return <PosAppPage entry="kds" />;
}

/** Standalone Bar Display at /BDS. */
export function BdsAppPage() {
  return <PosAppPage entry="bds" />;
}

/** Standalone Customer Display at /CDS. */
export function CdsAppPage() {
  return <PosAppPage entry="cds" />;
}
