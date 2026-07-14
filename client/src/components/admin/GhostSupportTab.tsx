import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ghost, Loader2, LogIn, Plus, Trash2, UserCog } from 'lucide-react';
import {
  api,
  setApiTenantCompanyId,
  type Company,
  type Location,
} from '../../api';
import { isSuperAdmin, parseUserAccess } from '../../data/userAccess';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { devConsoleAuthApi, type DevTeamUserRow } from '../../data/devConsoleAuthApi';
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

  const [users, setUsers] = useState<DevTeamUserRow[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

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
    setLocationId('');
  }, [companyId]);

  const loadTeam = useCallback(async () => {
    if (!isDevConsoleRoot) return;
    setLoadingTeam(true);
    setTeamError(null);
    try {
      const result = await devConsoleAuthApi.listTeam();
      setUsers(result.users);
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Failed to load Dev Team');
    } finally {
      setLoadingTeam(false);
    }
  }, [isDevConsoleRoot]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTeamError(null);
    try {
      await devConsoleAuthApi.createTeamUser({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
      });
      setEmail('');
      setFullName('');
      setPassword('');
      await loadTeam();
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: DevTeamUserRow) {
    if (user.isRoot) return;
    setTeamError(null);
    try {
      await devConsoleAuthApi.updateTeamUser(user.id, { active: !user.active });
      await loadTeam();
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function removeUser(user: DevTeamUserRow) {
    if (user.isRoot) return;
    if (!window.confirm(`Remove ${user.email} from Dev Team?`)) return;
    setTeamError(null);
    try {
      await devConsoleAuthApi.deleteTeamUser(user.id);
      await loadTeam();
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : 'Delete failed');
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
        </p>
      </div>

      <form onSubmit={handleEnterGhost} className="space-y-4 rounded-lg border border-border bg-card p-4">
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
          {entering ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
          {entering ? 'Entering…' : 'Enter as Super User'}
        </button>
      </form>

      {isDevConsoleRoot ? (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold inline-flex items-center gap-2">
              <UserCog size={14} className="text-muted-foreground" />
              Dev Team users
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Root-managed allowlist for Dev Console. Only @cubevalue.com and @pasar.ai emails.
            </p>
          </div>

          {teamError && (
            <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {teamError}
            </div>
          )}

          <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="dev@cubevalue.com"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Full name</span>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Password</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border text-sm font-medium py-2 px-3 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add user
            </button>
          </form>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Google</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingTeam && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      <Loader2 size={14} className="inline animate-spin mr-2" />
                      Loading…
                    </td>
                  </tr>
                )}
                {!loadingTeam && users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No Dev Team users yet.
                    </td>
                  </tr>
                )}
                {!loadingTeam && users.map(user => (
                  <tr key={user.id} className="border-t border-border">
                    <td className="px-3 py-2 font-sans text-xs">
                      {user.email}
                      {user.isRoot && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          Root
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{user.fullName}</td>
                    <td className="px-3 py-2 text-xs">{user.active ? 'Active' : 'Inactive'}</td>
                    <td className="px-3 py-2 text-xs">{user.hasGoogle ? 'Linked' : '—'}</td>
                    <td className="px-3 py-2 text-right space-x-2">
                      {!user.isRoot && (
                        <>
                          <button
                            type="button"
                            onClick={() => void toggleActive(user)}
                            className="text-xs text-primary hover:underline"
                          >
                            {user.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeUser(user)}
                            className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                          >
                            <Trash2 size={12} />
                            Remove
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : allowDevConsoleAccess ? (
        <p className="text-xs text-muted-foreground">
          Dev Team user management is limited to the root account.
        </p>
      ) : null}
    </section>
  );
}
