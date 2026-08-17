import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api, getCompanyId, type ModuleId, type Role, type User } from '../lib/api';

interface TeamLocation {
  id: string;
  code: string;
  name: string;
  address?: string;
  active?: boolean;
}

interface RoleOption {
  id?: string;
  code: string;
  label: string;
  modules: ModuleId[];
  companyWide: boolean;
  builtin: boolean;
}

interface Teammate extends User {
  locationIds: string[];
  locations?: TeamLocation[];
  companyWide: boolean;
}

interface TeamResponse {
  teammates: Teammate[];
  locations: TeamLocation[];
  roles: RoleOption[];
  allModules: ModuleId[];
}

const emptyInvite = {
  name: '',
  email: '',
  role: 'sales' as Role,
  password: 'pulse123',
  locationIds: [] as string[],
  active: true,
};

function AccessConfig({
  role,
  locationIds,
  locations,
  roles,
  allModules,
  onRoleChange,
  onLocationsChange,
  onRolesUpdated,
  disabled,
}: {
  role: string;
  locationIds: string[];
  locations: TeamLocation[];
  roles: RoleOption[];
  allModules: ModuleId[];
  onRoleChange: (role: Role) => void;
  onLocationsChange: (ids: string[]) => void;
  onRolesUpdated: (roles: RoleOption[], selectCode?: string) => void;
  disabled?: boolean;
}) {
  const selected = roles.find((r) => r.code === role);
  const modules = selected?.modules || [];
  const companyWide = Boolean(selected?.companyWide || role === 'superuser');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newRole, setNewRole] = useState({
    label: '',
    companyWide: false,
    modules: ['dashboard', 'members'] as ModuleId[],
  });

  function toggleLoc(id: string) {
    if (disabled || companyWide) return;
    if (locationIds.includes(id)) {
      onLocationsChange(locationIds.filter((x) => x !== id));
    } else {
      onLocationsChange([...locationIds, id]);
    }
  }

  function toggleModule(id: ModuleId) {
    setNewRole((prev) => ({
      ...prev,
      modules: prev.modules.includes(id)
        ? prev.modules.filter((m) => m !== id)
        : [...prev.modules, id],
    }));
  }

  async function createRole() {
    setFormError(null);
    setBusy(true);
    try {
      const created = await api<RoleOption>('/api/roles', {
        method: 'POST',
        body: JSON.stringify({
          label: newRole.label,
          modules: newRole.modules,
          companyWide: newRole.companyWide,
        }),
      });
      const next = [...roles.filter((r) => r.code !== created.code), created];
      onRolesUpdated(next, created.code);
      onRoleChange(created.code);
      if (created.companyWide) {
        onLocationsChange(locations.map((l) => l.id));
      }
      setAdding(false);
      setNewRole({ label: '', companyWide: false, modules: ['dashboard', 'members'] });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create role');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="access-config">
      <div className="field">
        <div className="access-role-head">
          <span>Role</span>
          {!disabled ? (
            <button
              type="button"
              className="btn btn-ghost access-add-role"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAdding((v) => !v);
                setFormError(null);
              }}
            >
              {adding ? 'Cancel' : '+ Add Role'}
            </button>
          ) : null}
        </div>
        <select
          value={role}
          disabled={disabled || role === 'superuser'}
          onChange={(e) => {
            const next = e.target.value as Role;
            onRoleChange(next);
            const meta = roles.find((r) => r.code === next);
            if (meta?.companyWide) onLocationsChange(locations.map((l) => l.id));
          }}
        >
          {role === 'superuser' && !roles.some((r) => r.code === 'superuser') ? (
            <option value="superuser">Superuser</option>
          ) : null}
          {roles.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
              {r.builtin ? '' : ' (custom)'}
            </option>
          ))}
        </select>
      </div>

      {adding ? (
        <form className="add-role-form" onSubmit={createRole}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Create new role
          </p>
          {formError ? <div className="error-banner">{formError}</div> : null}
          <label className="field">
            <span>Role name</span>
            <input
              required
              value={newRole.label}
              onChange={(e) => setNewRole({ ...newRole, label: e.target.value })}
              placeholder="Front desk"
            />
          </label>
          <label className="access-check">
            <input
              type="checkbox"
              checked={newRole.companyWide}
              onChange={(e) => setNewRole({ ...newRole, companyWide: e.target.checked })}
            />
            <span>Company-wide location access</span>
          </label>
          <div className="field">
            <span>Modules</span>
            <div className="access-locations">
              {allModules.map((m) => (
                <label key={m} className="access-check">
                  <input
                    type="checkbox"
                    checked={newRole.modules.includes(m)}
                    onChange={() => toggleModule(m)}
                  />
                  <span>{m.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save role'}
          </button>
        </form>
      ) : null}

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
        <p className="muted access-hint">
          {selected?.builtin
            ? 'Built-in role modules are fixed. Create a custom role to choose modules.'
            : 'Modules come from this custom role definition.'}
        </p>
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
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [allModules, setAllModules] = useState<ModuleId[]>([]);
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
    setRoles(data.roles || []);
    setAllModules(data.allModules || []);
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

  function roleIsCompanyWide(code: string) {
    return Boolean(roles.find((r) => r.code === code)?.companyWide || code === 'superuser');
  }

  async function submitInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!roleIsCompanyWide(invite.role) && invite.locationIds.length === 0) {
      setError('Select at least one location for this role');
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
          locationIds: roleIsCompanyWide(invite.role) ? undefined : invite.locationIds,
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
    if (!roleIsCompanyWide(edit.role) && edit.locationIds.length === 0) {
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
          locationIds: roleIsCompanyWide(edit.role) ? [] : edit.locationIds,
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
            Click a teammate to edit details and access. Use <strong>+ Add Role</strong> under Access
            to create custom roles with chosen modules.
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
                roles={roles}
                allModules={allModules}
                onRoleChange={(role) => setEdit({ ...edit, role })}
                onLocationsChange={(locationIds) => setEdit({ ...edit, locationIds })}
                onRolesUpdated={(next, selectCode) => {
                  setRoles(next);
                  if (selectCode) setEdit((e) => (e ? { ...e, role: selectCode } : e));
                }}
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
                roles={roles}
                allModules={allModules}
                onRoleChange={(role) => setInvite({ ...invite, role })}
                onLocationsChange={(locationIds) => setInvite({ ...invite, locationIds })}
                onRolesUpdated={(next, selectCode) => {
                  setRoles(next);
                  if (selectCode) setInvite((i) => ({ ...i, role: selectCode }));
                }}
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
