import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api, getCompanyId, type ModuleId, type Role, type User } from '../lib/api';

const ROLES: { id: Role; label: string; companyWide: boolean }[] = [
  { id: 'management', label: 'Management', companyWide: true },
  { id: 'admin', label: 'Admin', companyWide: true },
  { id: 'accounting', label: 'Accounting', companyWide: true },
  { id: 'fitness_coach', label: 'Fitness Coach', companyWide: false },
  { id: 'sales', label: 'Sales', companyWide: false },
];

const ROLE_MODULES: Record<string, ModuleId[]> = {
  management: [
    'dashboard',
    'members',
    'products',
    'system_config',
    'payments',
    'invoices',
    'promotions',
    'appointments',
    'equipment',
    'training',
    'team',
  ],
  admin: [
    'dashboard',
    'members',
    'products',
    'system_config',
    'payments',
    'invoices',
    'promotions',
    'appointments',
    'equipment',
    'training',
    'team',
  ],
  accounting: ['dashboard', 'members', 'products', 'payments', 'invoices', 'promotions'],
  fitness_coach: ['dashboard', 'appointments', 'equipment', 'training', 'members'],
  sales: ['dashboard', 'members', 'products', 'promotions', 'appointments'],
  superuser: [
    'dashboard',
    'members',
    'products',
    'system_config',
    'payments',
    'invoices',
    'promotions',
    'appointments',
    'equipment',
    'training',
    'team',
  ],
};

interface TeamLocation {
  id: string;
  code: string;
  name: string;
  address?: string;
  active?: boolean;
}

interface Teammate extends User {
  locationIds: string[];
  locations?: TeamLocation[];
  companyWide: boolean;
}

interface TeamResponse {
  teammates: Teammate[];
  locations: TeamLocation[];
}

const emptyInvite = {
  name: '',
  email: '',
  role: 'sales' as Role,
  password: 'pulse123',
  locationIds: [] as string[],
  active: true,
};

function roleMeta(role: string) {
  return ROLES.find((r) => r.id === role) || { id: role as Role, label: role, companyWide: false };
}

function AccessConfig({
  role,
  locationIds,
  locations,
  onRoleChange,
  onLocationsChange,
  disabled,
}: {
  role: string;
  locationIds: string[];
  locations: TeamLocation[];
  onRoleChange: (role: Role) => void;
  onLocationsChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const meta = roleMeta(role);
  const modules = ROLE_MODULES[role] || [];
  const companyWide = meta.companyWide || role === 'superuser';

  function toggleLoc(id: string) {
    if (disabled || companyWide) return;
    if (locationIds.includes(id)) {
      onLocationsChange(locationIds.filter((x) => x !== id));
    } else {
      onLocationsChange([...locationIds, id]);
    }
  }

  return (
    <div className="access-config">
      <label className="field">
        <span>Role</span>
        <select
          value={role}
          disabled={disabled || role === 'superuser'}
          onChange={(e) => onRoleChange(e.target.value as Role)}
        >
          {role === 'superuser' ? <option value="superuser">Superuser</option> : null}
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span>Module access</span>
        <div className="access-modules">
          {modules.length === 0 ? (
            <span className="muted">None</span>
          ) : (
            modules.map((m) => (
              <span key={m} className="chip access-chip">
                {m.replace(/_/g, ' ')}
              </span>
            ))
          )}
        </div>
        <p className="muted access-hint">Modules follow the role and cannot be mixed ad hoc.</p>
      </div>

      <div className="field">
        <span>Location access</span>
        {companyWide ? (
          <p className="muted access-hint" style={{ margin: 0 }}>
            Company-wide role — all locations in this company.
          </p>
        ) : (
          <div className="access-locations">
            {locations.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No locations yet. Add them in System Config.
              </p>
            ) : (
              locations.map((l) => (
                <label key={l.id} className="access-check">
                  <input
                    type="checkbox"
                    checked={locationIds.includes(l.id)}
                    disabled={disabled}
                    onChange={() => toggleLoc(l.id)}
                  />
                  <span>
                    <strong>{l.name}</strong>
                    <span className="muted"> · {l.code}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TeamPage() {
  const [rows, setRows] = useState<Teammate[]>([]);
  const [locations, setLocations] = useState<TeamLocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [invite, setInvite] = useState(emptyInvite);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{
    name: string;
    email: string;
    role: Role;
    password: string;
    locationIds: string[];
    active: boolean;
  } | null>(null);
  const companyId = getCompanyId();

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId],
  );

  async function load() {
    const data = await api<TeamResponse>('/api/team');
    setRows(data.teammates || []);
    setLocations(data.locations || []);
  }

  useEffect(() => {
    setError(null);
    load().catch((e) => setError(e.message));
  }, [companyId]);

  function openDetail(u: Teammate) {
    setSelectedId(u.id);
    setNotice(null);
    setEdit({
      name: u.name,
      email: u.email,
      role: u.role,
      password: '',
      locationIds: [...(u.locationIds || [])],
      active: u.active !== false,
    });
  }

  function closeDetail() {
    setSelectedId(null);
    setEdit(null);
  }

  async function submitInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const meta = roleMeta(invite.role);
    if (!meta.companyWide && invite.locationIds.length === 0) {
      setError('Select at least one location for coach/sales access');
      return;
    }
    try {
      await api('/api/team', {
        method: 'POST',
        body: JSON.stringify({
          name: invite.name,
          email: invite.email,
          role: invite.role,
          password: invite.password,
          locationIds: meta.companyWide ? undefined : invite.locationIds,
        }),
      });
      setInvite({ ...emptyInvite, locationIds: [] });
      setNotice('Teammate invited');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !edit) return;
    setError(null);
    setNotice(null);
    const meta = roleMeta(edit.role);
    if (!meta.companyWide && edit.role !== 'superuser' && edit.locationIds.length === 0) {
      setError('Select at least one location for this role');
      return;
    }
    try {
      await api(`/api/team/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: edit.name,
          email: edit.email,
          role: edit.role,
          active: edit.active,
          password: edit.password.trim() || undefined,
          locationIds: meta.companyWide || edit.role === 'superuser' ? [] : edit.locationIds,
        }),
      });
      setNotice('Teammate updated');
      await load();
      const refreshed = (await api<TeamResponse>('/api/team')).teammates.find((t) => t.id === selectedId);
      if (refreshed) openDetail(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="stack reveal is-in">
      <div className="page-head">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Team</h1>
          <p>
            Click a teammate to edit details and access. Invite sets role, modules, and location
            scope. Superuser is platform-seeded.
          </p>
        </div>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
      {notice ? (
        <div className="badge ok" style={{ width: 'fit-content' }}>
          {notice}
        </div>
      ) : null}

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Directory</h2>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3}>
                      <div className="empty">No teammates yet.</div>
                    </td>
                  </tr>
                ) : (
                  rows.map((u) => (
                    <tr
                      key={u.id}
                      className={`row-click${selectedId === u.id ? ' is-selected' : ''}`}
                      onClick={() => openDetail(u)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openDetail(u);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Edit ${u.name}`}
                    >
                      <td>
                        {u.name}
                        <div className="muted" style={{ fontSize: '0.8rem' }}>
                          {u.email}
                        </div>
                      </td>
                      <td>
                        <span className="badge accent">{u.roleLabel}</span>
                        {u.active === false ? (
                          <span className="badge warn" style={{ marginLeft: '0.35rem' }}>
                            inactive
                          </span>
                        ) : null}
                      </td>
                      <td className="mono" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.72rem' }}>
                        {u.companyWide
                          ? 'All locations'
                          : (u.locations || []).map((l) => l.code).join(' · ') || 'No locations'}
                        <div className="muted" style={{ marginTop: '0.2rem' }}>
                          {(u.modules || []).slice(0, 4).join(' · ')}
                          {(u.modules || []).length > 4 ? '…' : ''}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>{selected && edit ? 'Edit teammate' : 'Invite teammate'}</h2>
            {selected && edit ? (
              <button type="button" className="btn btn-ghost" onClick={closeDetail}>
                Close
              </button>
            ) : null}
          </div>

          {selected && edit ? (
            <form className="panel-body form-grid" onSubmit={submitEdit}>
              <p className="muted" style={{ margin: 0 }}>
                Editing <strong>{selected.email}</strong>
              </p>
              <label className="field">
                <span>Name</span>
                <input
                  required
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  required
                  type="email"
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                />
              </label>
              <AccessConfig
                role={edit.role}
                locationIds={edit.locationIds}
                locations={locations}
                onRoleChange={(role) => {
                  const meta = roleMeta(role);
                  setEdit({
                    ...edit,
                    role,
                    locationIds: meta.companyWide ? locations.map((l) => l.id) : edit.locationIds,
                  });
                }}
                onLocationsChange={(locationIds) => setEdit({ ...edit, locationIds })}
                disabled={edit.role === 'superuser'}
              />
              <label className="field">
                <span>New password (optional)</span>
                <input
                  value={edit.password}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                  placeholder="Leave blank to keep"
                />
              </label>
              <label className="access-check">
                <input
                  type="checkbox"
                  checked={edit.active}
                  onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
                  disabled={edit.role === 'superuser'}
                />
                <span>Active account</span>
              </label>
              <button type="submit" className="btn btn-primary">
                Save changes
              </button>
            </form>
          ) : (
            <form className="panel-body form-grid" onSubmit={submitInvite}>
              <label className="field">
                <span>Name</span>
                <input
                  required
                  value={invite.name}
                  onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  required
                  type="email"
                  value={invite.email}
                  onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                />
              </label>
              <AccessConfig
                role={invite.role}
                locationIds={invite.locationIds}
                locations={locations}
                onRoleChange={(role) => {
                  const meta = roleMeta(role);
                  setInvite({
                    ...invite,
                    role,
                    locationIds: meta.companyWide ? locations.map((l) => l.id) : invite.locationIds,
                  });
                }}
                onLocationsChange={(locationIds) => setInvite({ ...invite, locationIds })}
              />
              <label className="field">
                <span>Temp password</span>
                <input
                  required
                  value={invite.password}
                  onChange={(e) => setInvite({ ...invite, password: e.target.value })}
                />
              </label>
              <button type="submit" className="btn btn-primary">
                Add teammate
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
