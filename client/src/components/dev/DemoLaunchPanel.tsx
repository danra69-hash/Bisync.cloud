import { useEffect, useState } from 'react';
import { Rocket } from 'lucide-react';
import { devConsoleApi, type DevLaunchSettings, type ModulesGoLiveMap } from '../../data/devConsoleApi';
import { PLATFORM_GO_LIVE_MODULES, type PlatformGoLiveModuleId } from '../../data/platformGoLiveModules';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  isRoot: boolean;
};

function emptyModules(value = false): ModulesGoLiveMap {
  return PLATFORM_GO_LIVE_MODULES.reduce<ModulesGoLiveMap>((acc, mod) => {
    acc[mod.id] = value;
    return acc;
  }, {});
}

function normalizeModules(row?: ModulesGoLiveMap | null, fallback = false): ModulesGoLiveMap {
  const base = emptyModules(fallback);
  if (!row) return base;
  for (const mod of PLATFORM_GO_LIVE_MODULES) {
    if (typeof row[mod.id] === 'boolean') base[mod.id] = row[mod.id];
  }
  return base;
}

export function DemoLaunchPanel({ isRoot }: Props) {
  const [data, setData] = useState<DevLaunchSettings | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [modulesGoLive, setModulesGoLive] = useState<ModulesGoLiveMap>(() => emptyModules(false));
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
        setModulesGoLive(normalizeModules(row.modulesGoLive, row.goLive));
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

  const modulesDirty = data != null && PLATFORM_GO_LIVE_MODULES.some(
    mod => modulesGoLive[mod.id] !== normalizeModules(data.modulesGoLive, data.goLive)[mod.id],
  );
  const dirty = data != null && (demoMode !== data.demoMode || modulesDirty);
  const domains = (data?.allowedEmailDomains ?? ['cubevalue.com', 'pasar.ai'])
    .map(d => `@${d}`)
    .join(' / ');
  const liveCount = PLATFORM_GO_LIVE_MODULES.filter(mod => modulesGoLive[mod.id]).length;

  async function handleSave() {
    if (!isRoot) {
      setError('Only the root Dev Console account can change Demo / Go live.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await devConsoleApi.updateLaunchSettings({ demoMode, modulesGoLive });
      setData(updated);
      setDemoMode(updated.demoMode);
      setModulesGoLive(normalizeModules(updated.modulesGoLive, updated.goLive));
      const enabled = PLATFORM_GO_LIVE_MODULES.filter(mod => updated.modulesGoLive?.[mod.id]).map(m => m.label);
      setSuccess(
        updated.demoMode
          ? `Demo mode on — registration limited to allowed domains. Live modules: ${enabled.length ? enabled.join(', ') : 'none'}.`
          : `Registration open. Live modules: ${enabled.length ? enabled.join(', ') : 'none'}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save launch settings');
    } finally {
      setSaving(false);
    }
  }

  function toggleModule(id: PlatformGoLiveModuleId, checked: boolean) {
    setModulesGoLive(prev => ({ ...prev, [id]: checked }));
    setSuccess(null);
  }

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Rocket size={14} className="text-muted-foreground" />
            Site launch mode
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Demo keeps public registration limited to {domains}. Take modules Go live below to enable them for customers.
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
          <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={demoMode}
              disabled={!isRoot || saving}
              onChange={e => {
                setDemoMode(e.target.checked);
                setSuccess(null);
              }}
              className="rounded border-border"
            />
            <span className="font-medium text-foreground">Demo mode</span>
            <span className="text-muted-foreground">
              {demoMode
                ? `— registration accepts only ${domains}`
                : '— registration is open to any email address'}
            </span>
          </label>

          <div className="rounded-md border border-border bg-muted/20 px-3 py-3 space-y-2">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modules</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Tick Go live on each module to make it available in the product.
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {liveCount}/{PLATFORM_GO_LIVE_MODULES.length} live
              </p>
            </div>

            <ul className="divide-y divide-border/60">
              {PLATFORM_GO_LIVE_MODULES.map(mod => (
                <li key={mod.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-xs font-medium text-foreground">{mod.label}</span>
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none shrink-0">
                    <input
                      type="checkbox"
                      checked={Boolean(modulesGoLive[mod.id])}
                      disabled={!isRoot || saving}
                      onChange={e => toggleModule(mod.id, e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="font-medium text-foreground">Go live</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {!isRoot ? 'Root account required to change.' : null}
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
