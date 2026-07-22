import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, type SalesModuleTeamMember } from '../../api';

type GraphSettings = {
  enabled: boolean;
  graphTenantId: string;
  graphClientId: string;
  graphClientSecretSet: boolean;
  configured: boolean;
  lastTestResult?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged: (members: SalesModuleTeamMember[]) => void;
};

export function SalesModuleTeamPanel({ open, onClose, onChanged }: Props) {
  const [members, setMembers] = useState<SalesModuleTeamMember[]>([]);
  const [graphSettings, setGraphSettings] = useState<GraphSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(true);
  const [graphTenantId, setGraphTenantId] = useState('');
  const [graphClientId, setGraphClientId] = useState('');
  const [graphClientSecret, setGraphClientSecret] = useState('');
  const [editing, setEditing] = useState<SalesModuleTeamMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, graph] = await Promise.all([
        api.salesModuleTeam(),
        api.salesModuleTeamGraphSettings(),
      ]);
      setMembers(rows);
      onChanged(rows);
      setGraphSettings(graph);
      setGraphTenantId(graph.graphTenantId || '');
      setGraphClientId(graph.graphClientId || '');
      setGraphClientSecret('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales team');
    } finally {
      setLoading(false);
    }
  }, [onChanged]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  function resetForm() {
    setEditing(null);
    setName('');
    setEmail('');
    setCalendarSyncEnabled(true);
    setGraphTenantId(graphSettings?.graphTenantId || '');
    setGraphClientId(graphSettings?.graphClientId || '');
    setGraphClientSecret('');
  }

  function startEdit(row: SalesModuleTeamMember) {
    setEditing(row);
    setName(row.name);
    setEmail(row.email);
    setCalendarSyncEnabled(row.calendarSyncEnabled);
    setGraphTenantId(graphSettings?.graphTenantId || '');
    setGraphClientId(graphSettings?.graphClientId || '');
    setGraphClientSecret('');
    setMessage(null);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const graphPayload = {
        graphTenantId: graphTenantId.trim() || undefined,
        graphClientId: graphClientId.trim() || undefined,
        graphClientSecret: graphClientSecret.trim() || undefined,
      };
      if (editing) {
        const saved = await api.updateSalesModuleTeamMember(editing.id, {
          name: name.trim(),
          email: email.trim(),
          active: editing.active,
          calendarSyncEnabled,
          ...graphPayload,
        });
        setMembers(prev => {
          const next = prev.map(m => (m.id === saved.id ? saved : m));
          onChanged(next);
          return next;
        });
        setMessage(
          saved.calendarWired
            ? `Updated ${saved.name} — Office 365 calendar wired.`
            : `Updated ${saved.name}. ${saved.lastSyncError || 'Calendar not wired yet.'}`,
        );
      } else {
        const created = await api.createSalesModuleTeamMember({
          name: name.trim(),
          email: email.trim(),
          calendarSyncEnabled,
          ...graphPayload,
        });
        setMembers(prev => {
          const next = [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
          onChanged(next);
          return next;
        });
        setMessage(
          created.calendarWired
            ? `${created.name} added — Office 365 calendar wired.`
            : `${created.name} added. ${created.lastSyncError || 'Add Graph credentials above to wire calendar.'}`,
        );
      }
      const graph = await api.salesModuleTeamGraphSettings();
      setGraphSettings(graph);
      resetForm();
      setGraphTenantId(graph.graphTenantId || '');
      setGraphClientId(graph.graphClientId || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sales team member');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: SalesModuleTeamMember) {
    if (!window.confirm(`Remove ${row.name} from the sales team?`)) return;
    try {
      await api.deleteSalesModuleTeamMember(row.id);
      setMembers(prev => {
        const next = prev.filter(m => m.id !== row.id);
        onChanged(next);
        return next;
      });
      if (editing?.id === row.id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function handleToggleSync(row: SalesModuleTeamMember) {
    try {
      const saved = await api.updateSalesModuleTeamMember(row.id, {
        name: row.name,
        email: row.email,
        active: row.active,
        calendarSyncEnabled: !row.calendarSyncEnabled,
      });
      setMembers(prev => {
        const next = prev.map(m => (m.id === saved.id ? saved : m));
        onChanged(next);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sync');
    }
  }

  async function handleTest(row: SalesModuleTeamMember) {
    setTestingId(row.id);
    setError(null);
    setMessage(null);
    try {
      const result = await api.testSalesModuleTeamMemberCalendar(row.id);
      if (result.member) {
        setMembers(prev => {
          const next = prev.map(m => (m.id === result.member!.id ? result.member! : m));
          onChanged(next);
          return next;
        });
      }
      if (result.ok) setMessage(result.message);
      else setError(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calendar test failed');
    } finally {
      setTestingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40">
      <div className="w-full max-w-lg h-full bg-card border-l border-border shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold">Sales Team</h3>
            <p className="text-[11px] text-muted-foreground">
              Create each sales person with their Microsoft 365 email (UPN) and Graph app credentials so their Outlook calendar syncs here.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted"><X size={14} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-md border border-border p-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {editing ? `Edit · ${editing.name}` : 'Create sales person'}
            </p>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground">Name</span>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                placeholder="Full name"
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground">Email / UPN (Office 365 mailbox)</span>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                placeholder="name@cubevalue.com"
              />
            </label>

            <div className="rounded-md border border-dashed border-border/80 bg-muted/20 p-2 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Office 365 Graph (shared app)
              </p>
              <p className="text-[10px] text-muted-foreground">
                From Entra → App registrations. Needs Application permission Calendars.ReadWrite + admin consent.
                {graphSettings?.graphClientSecretSet ? ' Secret already saved — leave blank to keep it.' : ''}
              </p>
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">Directory (tenant) ID</span>
                <input
                  value={graphTenantId}
                  onChange={e => setGraphTenantId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">Application (client) ID</span>
                <input
                  value={graphClientId}
                  onChange={e => setGraphClientId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">
                  Client secret{graphSettings?.graphClientSecretSet ? ' (leave blank to keep)' : ''}
                </span>
                <input
                  type="password"
                  value={graphClientSecret}
                  onChange={e => setGraphClientSecret(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
                  autoComplete="new-password"
                  placeholder={graphSettings?.graphClientSecretSet ? '••••••••' : ''}
                />
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={calendarSyncEnabled}
                  onChange={e => setCalendarSyncEnabled(e.target.checked)}
                />
                Sync this person’s Outlook calendar into Appointment Calendar
              </label>
            </div>

            <div className="flex justify-end gap-2">
              {editing ? (
                <button type="button" onClick={resetForm} className="px-3 py-1.5 text-xs rounded-md border border-border">
                  Cancel edit
                </button>
              ) : null}
              <button
                type="button"
                disabled={saving || !name.trim() || !email.trim()}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Plus size={12} />
                {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
          ) : null}
          {message ? (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">{message}</div>
          ) : null}

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Team · {loading ? '…' : `${members.length} member${members.length === 1 ? '' : 's'}`}
            </p>
            {members.length === 0 && !loading ? (
              <p className="text-xs text-muted-foreground">No sales team members yet.</p>
            ) : (
              <ul className="space-y-2">
                {members.map(row => (
                  <li key={row.id} className="rounded-md border border-border px-3 py-2 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{row.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{row.email}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => startEdit(row)} className="p-1 text-muted-foreground hover:text-foreground" title="Edit">
                          <Pencil size={12} />
                        </button>
                        <button type="button" onClick={() => void handleDelete(row)} className="p-1 text-muted-foreground hover:text-destructive" title="Remove">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={row.calendarSyncEnabled}
                          onChange={() => void handleToggleSync(row)}
                        />
                        Sync calendar here
                      </label>
                      <span className={row.calendarWired ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300'}>
                        {row.calendarWired ? 'Wired to Office 365' : row.lastSyncError || 'Not wired yet'}
                      </span>
                      <button
                        type="button"
                        disabled={testingId === row.id}
                        onClick={() => void handleTest(row)}
                        className="underline text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        {testingId === row.id ? 'Testing…' : 'Test'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
