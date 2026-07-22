import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  devConsoleApi,
  type SalesModuleCalendarSyncSettings,
} from '../../data/devConsoleApi';

type Props = {
  isRoot: boolean;
};

export function SalesModuleOffice365SyncPanel({ isRoot }: Props) {
  const [settings, setSettings] = useState<SalesModuleCalendarSyncSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [mailbox, setMailbox] = useState('');
  const [displayName, setDisplayName] = useState('Cubevalue');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await devConsoleApi.salesModuleCalendarSync();
      setSettings(data);
      setEnabled(data.enabled);
      setTenantId(data.graphTenantId || '');
      setClientId(data.graphClientId || '');
      setMailbox(data.calendarMailbox || '');
      setDisplayName(data.calendarDisplayName || 'Cubevalue');
      setClientSecret('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Office 365 calendar settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!isRoot) {
      setError('Only the root Dev Console account can change Office 365 calendar sync.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await devConsoleApi.updateSalesModuleCalendarSync({
        enabled,
        graphTenantId: tenantId,
        graphClientId: clientId,
        graphClientSecret: clientSecret.trim() || undefined,
        calendarMailbox: mailbox,
        calendarDisplayName: displayName,
      });
      setSettings(saved);
      setClientSecret('');
      setMessage(saved.configured
        ? 'Saved. New appointments will sync to the Cubevalue Office 365 calendar.'
        : 'Saved. Enable sync and complete Graph credentials + mailbox to activate.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!isRoot) {
      setError('Only the root Dev Console account can test Office 365 calendar sync.');
      return;
    }
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await devConsoleApi.testSalesModuleCalendarSync();
      setSettings(result.settings);
      if (result.ok) setMessage(result.message);
      else setError(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  }

  const statusLabel = settings?.configured
    ? `Syncing to ${settings.calendarDisplayName || 'Cubevalue'} Office 365`
    : settings?.enabled
      ? 'Enabled but incomplete — finish Graph credentials and mailbox'
      : 'Not syncing — configure Cubevalue Office 365 below';

  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Office 365 · Cubevalue calendar</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Appointments created here are pushed to the Cubevalue Microsoft 365 calendar via Graph
            (application permission <span className="font-mono">Calendars.ReadWrite</span>).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          title="Refresh"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      <p className={`text-xs font-medium ${settings?.configured ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-300'}`}>
        {loading ? 'Loading sync status…' : statusLabel}
      </p>

      {settings?.lastTestResult ? (
        <p className="text-[11px] text-muted-foreground font-sans">
          Last test{settings.lastTestAt ? ` · ${settings.lastTestAt}` : ''}: {settings.lastTestResult}
        </p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-xs sm:col-span-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            disabled={!isRoot || loading}
          />
          <span>Enable sync to Cubevalue Office 365 calendar</span>
        </label>
        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground uppercase tracking-wide">Calendar display name</span>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            disabled={!isRoot || loading}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            placeholder="Cubevalue"
          />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground uppercase tracking-wide">Calendar mailbox (UPN)</span>
          <input
            value={mailbox}
            onChange={e => setMailbox(e.target.value)}
            disabled={!isRoot || loading}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            placeholder="sales@cubevalue.com"
          />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground uppercase tracking-wide">Directory (tenant) ID</span>
          <input
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            disabled={!isRoot || loading}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
          />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground uppercase tracking-wide">Application (client) ID</span>
          <input
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            disabled={!isRoot || loading}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
          />
        </label>
        <label className="block space-y-1 text-xs sm:col-span-2">
          <span className="text-muted-foreground uppercase tracking-wide">
            Client secret{settings?.graphClientSecretSet ? ' (leave blank to keep current)' : ''}
          </span>
          <input
            type="password"
            value={clientSecret}
            onChange={e => setClientSecret(e.target.value)}
            disabled={!isRoot || loading}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[11px]"
            autoComplete="new-password"
            placeholder={settings?.graphClientSecretSet ? '••••••••' : ''}
          />
        </label>
      </div>

      {!isRoot ? (
        <p className="text-[11px] text-muted-foreground">View only — ask the root Dev Console account to configure sync.</p>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
          {message}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={!isRoot || testing || loading}
          onClick={() => void handleTest()}
          className="px-3 py-1.5 text-xs rounded-md border border-border disabled:opacity-50"
        >
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        <button
          type="button"
          disabled={!isRoot || saving || loading}
          onClick={() => void handleSave()}
          className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
