import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { compareSortValues, sortTableRows } from '../../utils/tableSort';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { api, type AppUser, type AvailableEmployee, type Company, type LocationConfig, type UserUpsert } from '../../api';
import { inputCls, selectCls } from '../../data/countries';
import {
  ACCESS_MODULES,
  RMS_TASK_GROUPS,
  defaultUserAccess,
  hasModule,
  parseUserAccess,
  rmsGroupAllEnabled,
  rmsGroupSomeEnabled,
  setAccessControlType,
  setRmsEnabled,
  setRmsGroup,
  setRmsTask,
  toggleModule,
  type AccessModule,
  type UserAccess,
} from '../../data/userAccess';
import { AccessControlLevelField } from './AccessControlLevelField';
import { ToggleSwitch } from './ToggleSwitch';
import { CountryPhoneInput } from '../shared/CountryPhoneInput';
import { SIDE_PANEL_OVERLAY_CLS, SIDE_PANEL_SHELL_WIDE_CLS, NESTED_PANEL_OVERLAY_CLS, NESTED_PANEL_SHELL_WIDE_CLS } from '../layout/sidePanelShared';

type UserSortColumn = 'employeeId' | 'name' | 'company' | 'locations' | 'email' | 'role' | 'access' | 'status';

const USER_TABLE_COLUMNS: SortableColumnDef<UserSortColumn>[] = [
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'name', label: 'Name' },
  { key: 'company', label: 'Company' },
  { key: 'locations', label: 'Locations' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'access', label: 'Access' },
  { key: 'status', label: 'Status' },
];

const blankUser = (): UserUpsert => ({
  employeeId: null,
  fullName: '',
  email: '',
  role: '',
  phone: '',
  active: true,
  accessJson: JSON.stringify(defaultUserAccess()),
  companyId: null,
  locationIdsJson: '[]',
});

function parseLocationIds(json: string | undefined): number[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : [];
  } catch {
    return [];
  }
}

function UserLocationMultiSelect({
  locations,
  selectedIds,
  onChange,
  disabled,
}: {
  locations: LocationConfig[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const label = selectedIds.length === 0
    ? 'Select locations'
    : selectedIds.length === 1
      ? locations.find(l => l.id === selectedIds[0])?.name ?? '1 location'
      : `${selectedIds.length} locations`;

  function toggleLocation(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled || locations.length === 0}
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-2 text-xs rounded-md px-3 py-2 border border-border bg-card hover:border-primary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className={selectedIds.length === 0 ? 'text-muted-foreground' : ''}>{label}</span>
        <ChevronDown size={12} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && locations.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 max-h-52 overflow-y-auto">
          {locations.map(loc => {
            const checked = selectedIds.includes(loc.id);
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => toggleLocation(loc.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 text-left border-b border-border last:border-0"
              >
                <div className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-border'}`}>
                  {checked && <Check size={10} className="text-primary-foreground" />}
                </div>
                <span className="text-xs">{loc.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {locations.length === 0 && !disabled && (
        <p className="text-xs text-muted-foreground mt-1">No locations for this company yet.</p>
      )}
    </div>
  );
}

function RmsAccessPanel({
  access, onChange, disabled,
}: {
  access: UserAccess;
  onChange: (access: UserAccess) => void;
  disabled?: boolean;
}) {
  const rms = access.rms ?? defaultUserAccess().rms!;
  const tasksDisabled = disabled || !rms.enabled;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
        <div>
          <p className="text-xs font-semibold">RMS</p>
          <p className="text-xs text-muted-foreground">Revenue Management permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-sans text-muted-foreground uppercase">Enable</span>
          <ToggleSwitch
            checked={rms.enabled}
            disabled={disabled}
            label="Enable RMS access"
            onChange={v => onChange(setRmsEnabled(access, v))}
          />
        </div>
      </div>

      <div className={`p-4 space-y-4 ${tasksDisabled ? 'opacity-50' : ''}`}>
        {RMS_TASK_GROUPS.map(group => {
          const allOn = rmsGroupAllEnabled(access, group.id);
          const someOn = rmsGroupSomeEnabled(access, group.id);
          return (
            <div key={group.id}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground">{group.label}</p>
                <button
                  type="button"
                  disabled={tasksDisabled}
                  onClick={() => onChange(setRmsGroup(access, group.id, !allOn))}
                  className="text-xs font-sans text-primary hover:underline disabled:pointer-events-none"
                >
                  {allOn ? 'Clear all' : someOn ? 'Select all' : 'Select all'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {group.tasks.map(task => (
                  <label
                    key={task.id}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border/60 hover:bg-muted/20 ${
                      tasksDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={tasksDisabled}
                      checked={!!rms.tasks[task.id]}
                      onChange={e => onChange(setRmsTask(access, task.id, e.target.checked))}
                      className="rounded border-border text-primary focus:ring-primary/30"
                    />
                    <span className="text-xs">{task.label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModulePlaceholder({ module }: { module: AccessModule }) {
  const meta = ACCESS_MODULES.find(m => m.id === module)!;
  return (
    <div className="border border-dashed border-border rounded-lg px-4 py-6 text-center">
      <p className="text-xs font-semibold">{meta.label}</p>
      <p className="text-xs text-muted-foreground mt-1">{meta.description} permissions — coming soon</p>
    </div>
  );
}

export function userUpsertForEmployee(
  employee: { id: number; name: string; email: string; position: string; mobile: string },
  existing?: AppUser | null,
): AppUser | UserUpsert {
  if (existing) return existing;
  return {
    ...blankUser(),
    employeeId: employee.id,
    fullName: employee.name,
    email: employee.email,
    role: employee.position,
    phone: employee.mobile,
  };
}

export { blankUser };

function UserPanel({
  user, isNew, availableEmployees, lockEmployee = false, elevated = false, onClose, onSave,
}: {
  user: AppUser | UserUpsert;
  isNew: boolean;
  availableEmployees: AvailableEmployee[];
  lockEmployee?: boolean;
  elevated?: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState(user);
  const [access, setAccess] = useState<UserAccess>(() =>
    parseUserAccess('accessJson' in user ? user.accessJson : undefined),
  );
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allLocations, setAllLocations] = useState<LocationConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overlayCls = elevated ? NESTED_PANEL_OVERLAY_CLS : SIDE_PANEL_OVERLAY_CLS;
  const shellCls = elevated ? NESTED_PANEL_SHELL_WIDE_CLS : SIDE_PANEL_SHELL_WIDE_CLS;

  useEffect(() => {
    Promise.all([api.companies(), api.locationsConfig()])
      .then(([c, l]) => { setCompanies(c); setAllLocations(l); })
      .catch(() => { setCompanies([]); setAllLocations([]); });
  }, []);

  useEffect(() => {
    setForm(user);
    setAccess(parseUserAccess('accessJson' in user ? user.accessJson : undefined));
  }, [user]);

  const companyLocations = allLocations.filter(l => l.companyId === form.companyId);
  const selectedLocationIds = parseLocationIds(form.locationIdsJson);
  const profileLocked = isNew ? !!form.employeeId : ('employeeId' in user && !!user.employeeId);
  const countryCode = companies.find(c => c.id === form.companyId)?.countryCode ?? 'MY';

  function selectEmployee(employeeId: number) {
    const employee = availableEmployees.find(e => e.id === employeeId);
    if (!employee) return;
    setForm(f => ({
      ...f,
      employeeId,
      fullName: employee.name,
      email: employee.email,
      role: employee.position,
      phone: employee.mobile,
    }));
  }

  function set<K extends keyof UserUpsert>(key: K, val: UserUpsert[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function setCompany(companyId: number | null) {
    const validIds = companyId
      ? parseLocationIds(form.locationIdsJson).filter(id =>
          allLocations.some(l => l.id === id && l.companyId === companyId),
        )
      : [];
    setForm(f => ({
      ...f,
      companyId,
      locationIdsJson: JSON.stringify(validIds),
    }));
  }

  function setLocationIds(ids: number[]) {
    set('locationIdsJson', JSON.stringify(ids));
  }

  function buildPayload(): UserUpsert {
    return {
      employeeId: form.employeeId ?? null,
      fullName: form.fullName,
      email: form.email,
      role: form.role,
      phone: form.phone,
      active: form.active,
      accessJson: JSON.stringify(access),
      companyId: form.companyId,
      locationIdsJson: form.locationIdsJson,
    };
  }

  async function save() {
    if (isNew && !form.employeeId) {
      setError('Select an employee before granting access.');
      return;
    }
    if (!form.companyId) {
      setError('Company is required.');
      return;
    }
    if (!isNew && !('id' in form)) {
      setError('Cannot update access — user record is missing an id.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      if (isNew) {
        await api.createUser(payload);
      } else if ('id' in form) {
        await api.updateUser(form.id, payload);
      }
      onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save platform access.');
    } finally {
      setSaving(false);
    }
  }

  const canSave = (isNew ? !!form.employeeId : true) && form.companyId;

  return (
    <>
      <div className={overlayCls} onClick={() => !saving && onClose()} />
      <div className={shellCls}>
        <div className="px-5 py-4 border-b border-border flex items-start justify-between shrink-0">
          <div>
            <p className="text-xs font-sans text-muted-foreground uppercase tracking-widest mb-0.5">User</p>
            <h3 className="text-sm font-semibold">{isNew ? 'Grant Platform Access' : form.fullName}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted"><X size={14} className="text-muted-foreground" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {!lockEmployee && (
            <div className="rounded-md bg-muted/30 border border-border px-3 py-2">
              <p className="text-xs font-sans text-muted-foreground">
                Employees are created in Human Resources first. Select an employee below, then assign company, locations, and module access.
              </p>
            </div>
          )}

          {isNew && !lockEmployee && (
            <div className="space-y-2">
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Employee *</label>
              <select
                className={selectCls}
                value={form.employeeId ?? ''}
                onChange={e => selectEmployee(Number(e.target.value))}
              >
                <option value="">— Select employee from directory —</option>
                {availableEmployees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.employeeCode} · {e.name} · {e.position}
                  </option>
                ))}
              </select>
              {availableEmployees.length === 0 && (
                <p className="text-xs text-muted-foreground">All employees already have access, or none exist yet. Add employees in Human Resources.</p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Full Name</label>
            <input className={inputCls} value={form.fullName} readOnly={profileLocked} onChange={e => set('fullName', e.target.value)} placeholder="From employee record" />

            <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Email</label>
            <input type="email" className={inputCls} value={form.email} readOnly={profileLocked} onChange={e => set('email', e.target.value)} placeholder="From employee record" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Role</label>
                <input className={inputCls} value={form.role} readOnly={profileLocked} onChange={e => set('role', e.target.value)} placeholder="From employee record" />
              </div>
              <CountryPhoneInput
                countryCode={countryCode}
                value={form.phone}
                onChange={phone => set('phone', phone)}
                label="Phone"
                showError={false}
                readOnly={profileLocked}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} className="rounded border-border text-primary" />
              <span className="text-xs">Active user</span>
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Company *</label>
              <p className="text-xs text-muted-foreground mt-0.5">Each user belongs to exactly one company.</p>
            </div>
            <select
              className={selectCls}
              value={form.companyId ?? ''}
              onChange={e => setCompany(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— Select company —</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Locations</label>
              <p className="text-xs text-muted-foreground mt-0.5">Select one or more locations within the company.</p>
            </div>
            <UserLocationMultiSelect
              locations={companyLocations}
              selectedIds={selectedLocationIds}
              onChange={setLocationIds}
              disabled={!form.companyId}
            />
            {selectedLocationIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedLocationIds.map(id => {
                  const loc = companyLocations.find(l => l.id === id);
                  if (!loc) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1 text-xs font-sans px-2 py-0.5 rounded bg-muted border border-border">
                      {loc.name}
                      <button type="button" onClick={() => setLocationIds(selectedLocationIds.filter(x => x !== id))} className="text-muted-foreground hover:text-foreground">
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <AccessControlLevelField
            value={access.accessControlTypeId}
            onChange={typeId => setAccess(setAccessControlType(access, typeId))}
          />

          <div className="space-y-3">
            <div>
              <label className="text-xs font-sans text-muted-foreground uppercase tracking-wider">Access</label>
              <p className="text-xs text-muted-foreground mt-0.5">Select one or more modules. Permission panels appear below.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ACCESS_MODULES.map(m => {
                const selected = hasModule(access, m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setAccess(toggleModule(access, m.id))}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                      selected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {hasModule(access, 'RMS') && (
            <RmsAccessPanel access={access} onChange={setAccess} />
          )}
          {hasModule(access, 'POS') && <ModulePlaceholder module="POS" />}
          {hasModule(access, 'HRM') && <ModulePlaceholder module="HRM" />}
          {hasModule(access, 'Accounting') && <ModulePlaceholder module="Accounting" />}

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} disabled={saving} className="text-xs font-sans border border-border rounded-md px-4 py-2 text-muted-foreground hover:text-foreground disabled:opacity-50">Cancel</button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave || saving}
            className="text-xs font-sans bg-primary text-primary-foreground rounded-md px-4 py-2 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isNew ? 'Grant Access' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}

export const PlatformAccessPanel = UserPanel;

function accessBadges(accessJson: string): string[] {
  const access = parseUserAccess(accessJson);
  return access.modules;
}

export function UsersTab({ onDataChanged }: { onDataChanged?: () => void }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<AvailableEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<AppUser | UserUpsert | null>(null);
  const [isNew, setIsNew] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.users(), api.availableEmployees()])
      .then(([usrs, emps]) => {
        setUsers(usrs);
        setAvailableEmployees(emps);
      })
      .catch(() => {
        setUsers([]);
        setAvailableEmployees([]);
      })
      .finally(() => setLoading(false));
  }

  function handleSave() {
    load();
    onDataChanged?.();
  }

  useEffect(() => { load(); }, []);

  const { sortColumn, sortDirection, toggleSort, resetSort } = useTableSort<UserSortColumn>();

  useEffect(() => { resetSort(); }, [users, resetSort]);

  const sortedUsers = useMemo(
    () =>
      sortTableRows(
        users,
        sortColumn,
        sortDirection,
        {
          employeeId: u => u.employeeCode || '',
          name: u => u.fullName,
          company: u => u.companyName || '',
          locations: u => (u.locationNames ?? []).join(', '),
          email: u => u.email,
          role: u => u.role || '',
          access: u => accessBadges(u.accessJson).join(', '),
          status: u => u.active,
        },
        { tieBreaker: (a, b) => compareSortValues(a.fullName, b.fullName) },
      ),
    [users, sortColumn, sortDirection],
  );

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const {
    visibleItems: pagedUsers,
    hasMore,
    sentinelRef,
    totalCount,
    visibleCount,
  } = useInfiniteScrollSlice(sortedUsers, { scrollRootRef });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {users.length} users with platform access · sourced from Employee Directory · assign company, locations, and modules
        </p>
        <button
          onClick={() => { setIsNew(true); setEditUser(blankUser()); }}
          disabled={availableEmployees.length === 0}
          className="flex items-center gap-1.5 text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-md disabled:opacity-50"
        >
          <Plus size={12} /> Grant Access
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-xs text-muted-foreground">Loading users…</p>
        ) : (
          <TableScrollContainer ref={scrollRootRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          <table className="w-full table-fixed text-xs">
            <thead>
              <SortableTableHeaderRow
                columns={USER_TABLE_COLUMNS}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={toggleSort}
                className="border-b border-border bg-muted/30"
              />
            </thead>
            <tbody>
              {pagedUsers.map(u => (
                <tr
                  key={u.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer"
                  onClick={() => { setIsNew(false); setEditUser(u); }}
                >
                  <td className="px-4 py-3 font-sans text-muted-foreground">{u.employeeCode || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                        {u.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="font-medium">{u.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.companyName || '—'}</td>
                  <td className="px-4 py-3">
                    {u.locationNames && u.locationNames.length > 0 ? (
                      <span className="text-muted-foreground">
                        {u.locationNames.length <= 2
                          ? u.locationNames.join(', ')
                          : `${u.locationNames.slice(0, 2).join(', ')} +${u.locationNames.length - 2}`}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">{u.role || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {accessBadges(u.accessJson).length > 0 ? (
                        accessBadges(u.accessJson).map(m => (
                          <span key={m} className="text-xs font-sans px-1.5 py-0.5 rounded bg-primary/10 text-primary">{m}</span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-sans px-1.5 py-0.5 rounded ${u.active ? 'bg-[#5A7A2A]/15 text-[#5A7A2A]' : 'bg-muted text-muted-foreground'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No platform access granted yet. Create employees in Human Resources, then grant access here.</td></tr>
              )}
              <InfiniteScrollTableSentinel colSpan={8} hasMore={hasMore} sentinelRef={sentinelRef} totalCount={totalCount} visibleCount={visibleCount} />
            </tbody>
          </table>
          </TableScrollContainer>
        )}
      </div>

      {editUser && (
        <UserPanel
          user={editUser}
          isNew={isNew}
          availableEmployees={availableEmployees}
          onClose={() => { setEditUser(null); setIsNew(false); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
