import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { api, type NutritionLibraryStatus } from '../../api';
import { CURRENT_DPA_VERSION, DPA_TITLE } from '../../data/dpa';
import { CURRENT_EULA_VERSION, EULA_TITLE } from '../../data/eula';
import { LEGAL_EFFECTIVE_DATE, LEGAL_PROVIDER } from '../../data/legalShared';
import { CURRENT_PRIVACY_POLICY_VERSION, PRIVACY_POLICY_TITLE } from '../../data/privacyPolicy';
import { MillstoneLoader } from '../shared/MillstoneLoader';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

const LEGAL_DOCUMENTS = [
  {
    id: 'eula',
    title: EULA_TITLE,
    path: '/legal/eula',
    version: CURRENT_EULA_VERSION,
  },
  {
    id: 'privacy',
    title: PRIVACY_POLICY_TITLE,
    path: '/legal/privacy',
    version: CURRENT_PRIVACY_POLICY_VERSION,
  },
  {
    id: 'dpa',
    title: DPA_TITLE,
    path: '/legal/dpa',
    version: CURRENT_DPA_VERSION,
  },
] as const;

export function RefLibraryTab() {
  const [status, setStatus] = useState<NutritionLibraryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await api.nutritionLibraryStatus());
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : 'Failed to load nutrition library status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSync(force: boolean) {
    setSyncing(true);
    setError(null);
    try {
      setStatus(await api.nutritionLibrarySync(force));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync nutrition library.');
    } finally {
      setSyncing(false);
    }
  }

  const portalUrl = status?.portalUrl || 'https://fdc.nal.usda.gov/';
  const lastUpdated = status?.lastSyncedAt ?? status?.lastCheckedAt;

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen size={14} className="text-muted-foreground" />
            Ref &amp; Library
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reference data libraries and platform legal documents used by Bisync.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loading || syncing}
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading || syncing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            disabled={loading || syncing}
            onClick={() => void handleSync(true)}
            className="inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 hover:bg-muted disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>

      <div className="rounded-md border border-border/70 bg-muted/10 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <FileText size={12} />
              Legal documents
            </p>
            <p className="text-sm font-medium">EULA, Privacy Policy, and Data Processing Addendum</p>
            <p className="text-[11px] text-muted-foreground">
              {LEGAL_PROVIDER} · Effective {LEGAL_EFFECTIVE_DATE}
            </p>
          </div>
        </div>
        <ul className="space-y-2 pt-1 border-t border-border/60">
          {LEGAL_DOCUMENTS.map(doc => (
            <li key={doc.id} className="flex items-center justify-between gap-3 flex-wrap">
              <a
                href={doc.path}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline min-w-0"
              >
                <span className="truncate">{doc.title}</span>
                <ExternalLink size={12} className="shrink-0" />
              </a>
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                v{doc.version}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}

      {loading && !status ? (
        <MillstoneLoader size="sm" layout="block" label="Loading library status…" />
      ) : (
        <div className="rounded-md border border-border/70 bg-muted/10 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nutrition library
              </p>
              <p className="text-sm font-medium">
                {status?.sourceLabel || 'USDA FoodData Central (Foundation Foods + SR Legacy)'}
              </p>
              <a
                href={portalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline break-all"
              >
                {portalUrl}
                <ExternalLink size={12} className="shrink-0" />
              </a>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                Last updated
              </p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">
                {formatDateTime(lastUpdated)}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-border/60">
            <div>
              <dt className="text-muted-foreground">Entries</dt>
              <dd className="font-medium tabular-nums mt-0.5">
                {status?.entryCount?.toLocaleString() ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Version</dt>
              <dd className="font-medium font-sans mt-0.5 break-all">
                {status?.version || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium mt-0.5 capitalize">
                {status?.lastSyncStatus || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last checked</dt>
              <dd className="font-medium tabular-nums mt-0.5">
                {formatDateTime(status?.lastCheckedAt)}
              </dd>
            </div>
          </dl>

          {status?.citation ? (
            <p className="text-[11px] text-muted-foreground leading-relaxed">{status.citation}</p>
          ) : null}

          {(status?.foundationZipUrl || status?.srLegacyZipUrl) ? (
            <div className="space-y-1.5 pt-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                Dataset downloads
              </p>
              {status.foundationZipUrl ? (
                <a
                  href={status.foundationZipUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-primary hover:underline break-all"
                >
                  Foundation Foods CSV
                  <ExternalLink size={11} className="shrink-0" />
                </a>
              ) : null}
              {status.srLegacyZipUrl ? (
                <a
                  href={status.srLegacyZipUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-primary hover:underline break-all"
                >
                  SR Legacy CSV
                  <ExternalLink size={11} className="shrink-0" />
                </a>
              ) : null}
            </div>
          ) : null}

          {status?.lastSyncError ? (
            <p className="text-[11px] text-destructive">Last sync error: {status.lastSyncError}</p>
          ) : null}

          {status?.checkIntervalHours ? (
            <p className="text-[11px] text-muted-foreground">
              Automatic update check every {status.checkIntervalHours} hours
              {status.checkIntervalHours === 168 ? ' (weekly)' : ''}.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
