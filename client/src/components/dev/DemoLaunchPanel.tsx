import { useEffect, useState } from 'react';
import { Rocket } from 'lucide-react';
import { devConsoleApi, type DevLaunchSettings } from '../../data/devConsoleApi';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  isRoot: boolean;
};

export function DemoLaunchPanel({ isRoot }: Props) {
  const [data, setData] = useState<DevLaunchSettings | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [goLive, setGoLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    devConsoleApi.launchSettings()
      .then(row => {
        if (cancelled) return;
        setData(row);
        setDemoMode(row.demoMode);
        setGoLive(row.goLive);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load launch settings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const dirty = data != null && (demoMode !== data.demoMode || goLive !== data.goLive);
  const domains = (data?.allowedEmailDomains ?? ['cubevalue.com', 'pasar.ai'])
    .map(d => `@${d}`)
    .join(' / ');

  async function handleSave() {
    if (!isRoot) {
      setError('Only the root Dev Console account can change Demo / Go live.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await devConsoleApi.updateLaunchSettings({ demoMode, goLive });
      setData(updated);
      setDemoMode(updated.demoMode);
      setGoLive(updated.goLive);
      setSuccess(updated.goLive
        ? 'Go live enabled — registration accepts any email domain.'
        : 'Demo mode enabled — registration limited to allowed demo domains.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save launch settings');
    } finally {
      setSaving(false);
    }
  }

  function selectDemo() {
    setDemoMode(true);
    setGoLive(false);
    setSuccess(null);
  }

  function selectGoLive() {
    setDemoMode(false);
    setGoLive(true);
    setSuccess(null);
  }

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Rocket size={14} className="text-muted-foreground" />
            Site launch mode
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Demo keeps public registration limited to {domains}. Tick Go live to open registration.
          </p>
        </div>
        {isRoot && (
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 hover:bg-muted disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      {loading && !data ? (
        <MillstoneLoader size="sm" layout="block" label="Loading launch settings…" />
      ) : (
        <>
          <div className="flex flex-wrap gap-6">
            <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={demoMode}
                disabled={!isRoot || saving}
                onChange={e => {
                  if (e.target.checked) selectDemo();
                  else selectGoLive();
                }}
                className="rounded border-border"
              />
              <span className="font-medium text-foreground">Demo mode</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={goLive}
                disabled={!isRoot || saving}
                onChange={e => {
                  if (e.target.checked) selectGoLive();
                  else selectDemo();
                }}
                className="rounded border-border"
              />
              <span className="font-medium text-foreground">Go live</span>
            </label>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {goLive
              ? 'Registration is open to any email address.'
              : `Registration accepts only ${domains} until Go live is ticked.`}
            {!isRoot ? ' Root account required to change.' : null}
          </p>

          {data?.updatedAt && (
            <p className="text-[11px] text-muted-foreground">
              Last updated {new Date(data.updatedAt).toLocaleString()}
              {data.updatedByEmail ? ` · ${data.updatedByEmail}` : ''}
            </p>
          )}
        </>
      )}

      {error && (
        <div className="px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
          {error}
        </div>
      )}
      {success && (
        <div className="px-3 py-2 rounded-md bg-[#5A7A2A]/10 border border-[#5A7A2A]/20 text-[#5A7A2A] text-xs">
          {success}
        </div>
      )}
    </section>
  );
}
