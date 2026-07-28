import { useEffect, useMemo, useState } from 'react';
import { Ghost, LogIn } from 'lucide-react';
import {
  api,
  setApiTenantCompanyId,
  type Company,
  type Location,
} from '../../api';
import { isSuperAdmin, parseUserAccess } from '../../data/userAccess';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { devConsoleAuthApi } from '../../data/devConsoleAuthApi';
import {
  defaultGhostReturnPath,
  setGhostSupportSession,
} from '../../data/ghostSupportSession';

type GhostSupportTabProps = {
  allowDevConsoleAccess?: boolean;
  isDevConsoleRoot?: boolean;
  devConsoleEmail?: string;
};

export function GhostSupportTab({
  allowDevConsoleAccess = false,
  isDevConsoleRoot = false,
  devConsoleEmail,
}: GhostSupportTabProps) {
  const { currentUser, applyAuthenticatedUser } = useCurrentUser();
  const access = useMemo(
    () => (currentUser ? parseUserAccess(currentUser.accessJson) : parseUserAccess('{}')),
    [currentUser],
  );
  const role = currentUser?.role ?? '';
  const canView = allowDevConsoleAccess
    || isSuperAdmin(access)
    || /system admin|super admin/i.test(role);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [companyId, setCompanyId] = useState<number | ''>('');
  const [locationId, setLocationId] = useState<number | ''>('');
  const [entering, setEntering] = useState(false);
  const [enterError, setEnterError] = useState<string | null>(null);

  const filtersReady = companyId !== '' && locationId !== '';

  const companyLocations = useMemo(
    () => (companyId === ''
      ? []
      : locations.filter(l => l.companyId === companyId).sort((a, b) => a.name.localeCompare(b.name))),
    [locations, companyId],
  );

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
    if (companyId === '') {
      setLocationId('');
      return;
    }
    const forCompany = locations
      .filter(l => l.companyId === companyId)
      .sort((a, b) => a.name.localeCompare(b.name));
    setLocationId(forCompany.length === 1 ? forCompany[0].id : '');
  }, [companyId, locations]);

  async function handleEnterGhost(e: React.FormEvent) {
    e.preventDefault();
    if (typeof companyId !== 'number' || typeof locationId !== 'number') return;
    setEntering(true);
    setEnterError(null);
    try {
      const result = await devConsoleAuthApi.ghostEnter({ companyId, locationId });

      setGhostSupportSession({
        companyId: result.company.id,
        companyName: result.company.name,
        locationId: result.location.id,
        locationExternalId: result.location.externalId,
        locationName: result.location.name,
        actorEmail: result.actorEmail || devConsoleEmail || currentUser?.email || '',
        returnPath: defaultGhostReturnPath(),
        enteredAt: new Date().toISOString(),
      });
      setApiTenantCompanyId(result.company.id);
      applyAuthenticatedUser(result.user);
      window.location.assign('/');
    } catch (err) {
      setEnterError(err instanceof Error ? err.message : 'Failed to enter Ghost Support');
      setEntering(false);
    }
  }

  if (!canView) {
    return (
      <div className="rounded-lg border border-border bg-card px-5 py-10 text-center space-y-2">
        <Ghost size={22} className="mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Super User / System Admin only</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Ghost Support is limited to Super User or System Admin accounts.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold inline-flex items-center gap-2">
          <Ghost size={14} className="text-muted-foreground" />
          Ghost Support
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">
          Select a company and location, then enter the app as Super User for that tenant.
          {devConsoleEmail ? (
            <> Signed in as <span className="font-sans">{devConsoleEmail}</span>.</>
          ) : null}
          {isDevConsoleRoot ? (
            <> Manage Dev Console operators from Overview → Team.</>
          ) : null}
        </p>
      </div>

      <form onSubmit={e => void handleEnterGhost(e)} className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Company <span className="text-destructive">*</span>
            </span>
            <select
              required
              value={companyId}
              onChange={e => setCompanyId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select company…</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Location <span className="text-destructive">*</span>
            </span>
            <select
              required
              value={locationId}
              disabled={companyId === ''}
              onChange={e => setLocationId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="">
                {companyId === '' ? 'Select company first…' : 'Select location…'}
              </option>
              {companyLocations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
        </div>

        {!filtersReady && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Company and Location are required before entering Ghost Support.
          </p>
        )}

        {enterError && (
          <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {enterError}
          </div>
        )}

        <button
          type="submit"
          disabled={!filtersReady || entering}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground text-sm font-medium px-4 py-2 disabled:opacity-50"
        >
          {!entering && <LogIn size={14} />}
          {entering ? 'Entering…' : 'Enter as Super User'}
        </button>
      </form>
    </section>
  );
}
