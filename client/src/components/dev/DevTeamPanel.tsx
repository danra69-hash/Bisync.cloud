import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import {
  DEV_CONSOLE_TAB_IDS,
  DEV_CONSOLE_TAB_LABELS,
  DEV_CONSOLE_TEAM_TYPES,
  devConsoleAuthApi,
  type DevConsoleTabId,
  type DevConsoleTeamType,
  type DevTeamUserRow,
} from '../../data/devConsoleAuthApi';
import { TableLoadingRow } from '../shared/MillstoneLoader';

type Props = {
  open: boolean;
  onClose: () => void;
};

type FormState = {
  id: number | null;
  fullName: string;
  position: string;
  teamType: DevConsoleTeamType;
  email: string;
  accessTabs: DevConsoleTabId[];
};

const EMPTY_FORM: FormState = {
  id: null,
  fullName: '',
  position: '',
  teamType: 'Management',
  email: '',
  accessTabs: ['overview'],
};

function toForm(row: DevTeamUserRow): FormState {
  const tabs = (row.accessTabs ?? []).filter((t): t is DevConsoleTabId =>
    (DEV_CONSOLE_TAB_IDS as readonly string[]).includes(t),
  );
  return {
    id: row.id,
    fullName: row.fullName,
    position: row.position ?? '',
    teamType: (DEV_CONSOLE_TEAM_TYPES as readonly string[]).includes(row.teamType)
      ? (row.teamType as DevConsoleTeamType)
      : 'Management',
    email: row.email,
    accessTabs: tabs.length > 0 ? tabs : ['overview'],
  };
}

export function DevTeamPanel({ open, onClose }: Props) {
  const [users, setUsers] = useState<DevTeamUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await devConsoleAuthApi.listTeam();
      setUsers(result.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        if (formOpen) setFormOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, formOpen, saving, onClose]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setInfo(null);
    setError(null);
  }

  function openEdit(row: DevTeamUserRow) {
    if (row.isRoot) {
      setError('Root Super User access is fixed and cannot be edited here.');
      return;
    }
    setForm(toForm(row));
    setFormOpen(true);
    setInfo(null);
    setError(null);
  }

  function toggleTab(tab: DevConsoleTabId) {
    setForm(prev => {
      const has = prev.accessTabs.includes(tab);
      if (has) {
        const next = prev.accessTabs.filter(t => t !== tab);
        return { ...prev, accessTabs: next.length > 0 ? next : ['overview'] };
      }
      return { ...prev, accessTabs: [...prev.accessTabs, tab] };
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      if (form.id == null) {
        const created = await devConsoleAuthApi.createTeamUser({
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          position: form.position.trim(),
          teamType: form.teamType,
          accessTabs: form.accessTabs,
        });
        setInfo(
          created.inviteUrl
            ? `Invitation sent to ${created.email}. They must set a password before signing in.`
            : `Created ${created.email}.`,
        );
      } else {
        await devConsoleAuthApi.updateTeamUser(form.id, {
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          position: form.position.trim(),
          teamType: form.teamType,
          accessTabs: form.accessTabs,
        });
        setInfo('Team member updated.');
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function resendInvite(row: DevTeamUserRow) {
    setError(null);
    setInfo(null);
    try {
      const result = await devConsoleAuthApi.resendInvite(row.id);
      setInfo(result.message || `Invitation resent to ${row.email}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invite');
    }
  }

  async function toggleActive(row: DevTeamUserRow) {
    if (row.isRoot) return;
    setError(null);
    try {
      await devConsoleAuthApi.updateTeamUser(row.id, { active: !row.active });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function removeUser(row: DevTeamUserRow) {
    if (row.isRoot) return;
    if (!window.confirm(`Remove ${row.email} from Dev Console team?`)) return;
    setError(null);
    try {
      await devConsoleAuthApi.deleteTeamUser(row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && onClose()} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dev-team-title"
        className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl border border-border bg-card shadow-xl flex flex-col"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h2 id="dev-team-title" className="text-sm font-semibold inline-flex items-center gap-2">
              <UserPlus size={14} className="text-muted-foreground" />
              Dev Console Team
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Platform operators for Dev Console only — separate from main app users and Sales Module hunters/farmers.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {error}
            </div>
          )}
          {info && (
            <div className="px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-xs">
              {info}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Super User only. New members receive an email invitation to set their password.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5"
            >
              <Plus size={12} />
              Add member
            </button>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <TableLoadingRow colSpan={5} />}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No team members yet.
                    </td>
                  </tr>
                )}
                {!loading && users.map(row => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <p className="text-xs font-medium">{row.fullName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.position || '—'}</p>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.teamType}
                      {row.isRoot && (
                        <span className="ml-1 text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          Super
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs font-sans">{row.email}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.isRoot
                        ? 'Active'
                        : row.invitePending
                          ? 'Invite pending'
                          : row.active
                            ? 'Active'
                            : 'Inactive'}
                    </td>
                    <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                      {!row.isRoot && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Pencil size={11} />
                            Edit
                          </button>
                          {row.invitePending && (
                            <button
                              type="button"
                              onClick={() => void resendInvite(row)}
                              className="text-xs text-primary hover:underline"
                            >
                              Resend invite
                            </button>
                          )}
                          {row.hasPassword && (
                            <button
                              type="button"
                              onClick={() => void toggleActive(row)}
                              className="text-xs text-primary hover:underline"
                            >
                              {row.active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void removeUser(row)}
                            className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                          >
                            <Trash2 size={11} />
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

        {formOpen && (
          <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-black/30 p-4">
            <form
              onSubmit={e => void handleSave(e)}
              className="w-full max-w-lg rounded-xl border border-border bg-card p-5 space-y-4 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {form.id == null ? 'Add team member' : 'Edit team member'}
                </h3>
                <button type="button" onClick={() => setFormOpen(false)} className="text-muted-foreground" aria-label="Close form">
                  <X size={14} />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Name</span>
                  <input
                    required
                    value={form.fullName}
                    onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Position</span>
                  <input
                    value={form.position}
                    onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    placeholder="e.g. Sales Lead"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Type</span>
                  <select
                    value={form.teamType}
                    onChange={e => setForm(f => ({ ...f, teamType: e.target.value as DevConsoleTeamType }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    {DEV_CONSOLE_TEAM_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Email address for user login
                  </span>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    placeholder="name@cubevalue.com"
                  />
                </label>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-[11px] uppercase tracking-wider text-muted-foreground">Access</legend>
                <div className="grid grid-cols-2 gap-2">
                  {DEV_CONSOLE_TAB_IDS.map(tab => (
                    <label key={tab} className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={form.accessTabs.includes(tab)}
                        onChange={() => toggleTab(tab)}
                      />
                      {DEV_CONSOLE_TAB_LABELS[tab]}
                    </label>
                  ))}
                </div>
              </fieldset>

              {form.id == null && (
                <p className="text-[11px] text-muted-foreground">
                  An invitation email will be sent. Access is enabled only after they set a password.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving…' : form.id == null ? 'Create & invite' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
