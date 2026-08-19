import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { api, type NutritionLibraryStatus } from '../../api';
import { CURRENT_DPA_VERSION, DPA_INTRO, DPA_TITLE } from '../../data/dpa';
import { CURRENT_EULA_VERSION, EULA_INTRO, EULA_TITLE } from '../../data/eula';
import {
  FIFO_GUIDE_REVISED_DATE,
  FIFO_GUIDE_STEPS,
  FIFO_GUIDE_SUMMARY,
  FIFO_GUIDE_TITLE,
  FIFO_ISSUE_STOCK_SQL,
  FIFO_RUNTIME_NOTE,
} from '../../data/fifoStockGuide';
import { LEGAL_EFFECTIVE_DATE, LEGAL_PROVIDER } from '../../data/legalShared';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  PRIVACY_POLICY_INTRO,
  PRIVACY_POLICY_TITLE,
} from '../../data/privacyPolicy';
import {
  DANTSU_PRINTER_SDK_DOWNLOAD_PATH,
  DANTSU_PRINTER_SDK_JITPACK,
  DANTSU_PRINTER_SDK_REVISED_DATE,
  DANTSU_PRINTER_SDK_STEPS,
  DANTSU_PRINTER_SDK_SUMMARY,
  DANTSU_PRINTER_SDK_TITLE,
  DANTSU_PRINTER_SDK_UPSTREAM,
  DANTSU_PRINTER_SDK_VERSION,
} from '../../data/dantsuPrinterSdk';
import {
  WINDOWS_ESCPOS_SDK_DOWNLOAD_PATH,
  WINDOWS_ESCPOS_SDK_REVISED_DATE,
  WINDOWS_ESCPOS_SDK_STEPS,
  WINDOWS_ESCPOS_SDK_SUMMARY,
  WINDOWS_ESCPOS_SDK_TITLE,
  WINDOWS_ESCPOS_SDK_VERSION,
} from '../../data/windowsEscposSdk';
import {
  PLATFORM_GLOSSARY_MODULES,
  PLATFORM_GLOSSARY_REVISED_DATE,
  PLATFORM_GLOSSARY_SUMMARY,
  PLATFORM_GLOSSARY_TITLE,
  type GlossaryModule,
} from '../../data/platformGlossary';
import {
  ACCOUNTING_PACKS_LIBRARY_TITLE,
  ACCOUNTING_PACKS_REVISED_DATE,
  ACCOUNTING_PACK_REFS,
} from '../../data/accountingPackLibrary';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type LibraryEntryId =
  | 'eula'
  | 'privacy'
  | 'dpa'
  | 'platform-glossary'
  | 'fifo'
  | 'nutrition'
  | 'dantsu-printer'
  | 'windows-escpos'
  | 'accounting-packs';

type LibraryEntry = {
  id: LibraryEntryId;
  title: string;
  /** Created or revised date shown in the compact list. */
  revisedLabel: string;
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function LegalDetails({
  intro,
  version,
  path,
}: {
  intro: string[];
  version: string;
  path: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        {LEGAL_PROVIDER} · Effective {LEGAL_EFFECTIVE_DATE} · v{version}
      </p>
      <div className="space-y-2">
        {intro.map(paragraph => (
          <p key={paragraph.slice(0, 48)} className="text-xs text-muted-foreground leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
      <a
        href={path}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        Open full document
        <ExternalLink size={12} />
      </a>
    </div>
  );
}

function FifoDetails({
  sqlCopied,
  onCopySql,
}: {
  sqlCopied: boolean;
  onCopySql: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">{FIFO_GUIDE_SUMMARY}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{FIFO_RUNTIME_NOTE}</p>

      <ol className="space-y-3 border-t border-border/60 pt-3">
        {FIFO_GUIDE_STEPS.map(step => (
          <li key={step.id} className="grid gap-1 sm:grid-cols-[2.5rem_1fr]">
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {step.number}.
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-semibold">{step.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="space-y-2 border-t border-border/60 pt-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            Canonical SQL · issue_fifo_stock
          </p>
          <button
            type="button"
            onClick={onCopySql}
            className="inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-2.5 py-1 hover:bg-muted"
          >
            {sqlCopied ? <Check size={12} /> : <Copy size={12} />}
            {sqlCopied ? 'Copied' : 'Copy SQL'}
          </button>
        </div>
        <pre className="max-h-80 overflow-auto rounded-md border border-border/60 bg-background/80 p-3 text-[10px] leading-relaxed font-mono whitespace-pre">
          {FIFO_ISSUE_STOCK_SQL}
        </pre>
      </div>
    </div>
  );
}

function AccountingPacksLibraryDetails() {
  const [openId, setOpenId] = useState<string | null>('acc-my');
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Upstream Accounting package localisation packs. <strong>Malaysia is active in Books</strong>;
        SG / AU / ID / TH / US remain reference here until wired.
      </p>
      <ul className="space-y-2">
        {ACCOUNTING_PACK_REFS.map(pack => {
          const open = openId === pack.id;
          return (
            <li key={pack.id} className="border border-border/60 rounded-md overflow-hidden">
              <button
                type="button"
                className="w-full flex items-start justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40"
                onClick={() => setOpenId(open ? null : pack.id)}
              >
                <span className="min-w-0">
                  <span className="text-xs font-semibold block">{pack.title}</span>
                  <span className="text-[11px] text-muted-foreground">{pack.summary}</span>
                </span>
                <span className={`shrink-0 text-[10px] uppercase tracking-wide font-semibold ${
                  pack.status === 'active' ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {pack.status}
                </span>
              </button>
              {open && (
                <pre className="max-h-96 overflow-auto border-t border-border/60 bg-background/80 p-3 text-[10px] leading-relaxed font-mono whitespace-pre-wrap">
                  {pack.markdown}
                </pre>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DantsuPrinterSdkDetails({
  downloading,
  onDownload,
}: {
  downloading: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">{DANTSU_PRINTER_SDK_SUMMARY}</p>
      <p className="text-[11px] text-muted-foreground">
        Version {DANTSU_PRINTER_SDK_VERSION} · Android POS printer SDK · Bluetooth / TCP / USB
      </p>

      <ol className="space-y-3 border-t border-border/60 pt-3">
        {DANTSU_PRINTER_SDK_STEPS.map(step => (
          <li key={step.id} className="grid gap-1 sm:grid-cols-[2.5rem_1fr]">
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {step.number}.
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-semibold">{step.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        <button
          type="button"
          disabled={downloading}
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 hover:bg-muted disabled:opacity-50"
        >
          {downloading ? 'Downloading…' : 'Download Android SDK package'}
        </button>
        <a
          href={DANTSU_PRINTER_SDK_UPSTREAM}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          Upstream on GitHub
          <ExternalLink size={12} />
        </a>
      </div>

      <p className="text-[10px] font-mono text-muted-foreground break-all">
        JitPack · {DANTSU_PRINTER_SDK_JITPACK}
      </p>
      <p className="text-[10px] font-mono text-muted-foreground break-all">
        API · {DANTSU_PRINTER_SDK_DOWNLOAD_PATH}
      </p>
    </div>
  );
}

function WindowsEscposSdkDetails({
  downloading,
  onDownload,
}: {
  downloading: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">{WINDOWS_ESCPOS_SDK_SUMMARY}</p>
      <p className="text-[11px] text-muted-foreground">
        Version {WINDOWS_ESCPOS_SDK_VERSION} · Windows LAN test · ESC/POS TCP 9100
      </p>

      <ol className="space-y-3 border-t border-border/60 pt-3">
        {WINDOWS_ESCPOS_SDK_STEPS.map(step => (
          <li key={step.id} className="grid gap-1 sm:grid-cols-[2.5rem_1fr]">
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {step.number}.
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-semibold">{step.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        <button
          type="button"
          disabled={downloading}
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 text-xs border border-border rounded-md px-3 py-1.5 hover:bg-muted disabled:opacity-50"
        >
          {downloading ? 'Downloading…' : 'Download Windows LAN test package'}
        </button>
      </div>

      <p className="text-[10px] font-mono text-muted-foreground break-all">
        API · {WINDOWS_ESCPOS_SDK_DOWNLOAD_PATH}
      </p>
    </div>
  );
}

function PlatformGlossaryDetails() {
  const [query, setQuery] = useState('');

  const filteredModules = useMemo((): GlossaryModule[] => {
    const q = query.trim().toLowerCase();
    if (!q) return PLATFORM_GLOSSARY_MODULES;
    return PLATFORM_GLOSSARY_MODULES
      .map(mod => ({
        ...mod,
        entries: mod.entries.filter(entry =>
          [entry.term, entry.meaning, entry.dbName, mod.module]
            .join(' ')
            .toLowerCase()
            .includes(q),
        ),
      }))
      .filter(mod => mod.entries.length > 0);
  }, [query]);

  const matchCount = filteredModules.reduce((n, mod) => n + mod.entries.length, 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">{PLATFORM_GLOSSARY_SUMMARY}</p>
      <p className="text-[11px] text-muted-foreground">
        Columns: Term (business name) · Meaning · DB / API name
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search terms, meanings, or DB names…"
          className="min-w-[12rem] flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
          aria-label="Search platform definitions"
        />
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {matchCount} term{matchCount === 1 ? '' : 's'}
        </span>
      </div>

      {filteredModules.length === 0 ? (
        <p className="text-xs text-muted-foreground">No definitions match “{query.trim()}”.</p>
      ) : (
        <div className="space-y-5">
          {filteredModules.map(mod => (
            <section key={mod.id} className="space-y-2">
              <h3 className="text-xs font-semibold border-b border-border/60 pb-1.5">
                {mod.module}
                <span className="ml-2 text-[10px] font-normal text-muted-foreground tabular-nums">
                  {mod.entries.length}
                </span>
              </h3>
              <div className="overflow-x-auto rounded-md border border-border/50">
                <table className="w-full min-w-[36rem] text-left text-[11px]">
                  <thead>
                    <tr className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-2.5 py-1.5 font-semibold w-[22%]">Term</th>
                      <th className="px-2.5 py-1.5 font-semibold w-[48%]">Meaning</th>
                      <th className="px-2.5 py-1.5 font-semibold w-[30%]">DB / API</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {mod.entries.map(entry => (
                      <tr key={`${mod.id}:${entry.term}`} className="align-top">
                        <td className="px-2.5 py-2 font-medium text-foreground">{entry.term}</td>
                        <td className="px-2.5 py-2 text-muted-foreground leading-relaxed">
                          {entry.meaning}
                        </td>
                        <td className="px-2.5 py-2 font-mono text-[10px] text-foreground/90 break-all">
                          {entry.dbName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function NutritionDetails({
  status,
  loading,
  portalUrl,
}: {
  status: NutritionLibraryStatus | null;
  loading: boolean;
  portalUrl: string;
}) {
  if (loading && !status) {
    return <MillstoneLoader size="sm" layout="block" label="Loading library status…" />;
  }

  return (
    <div className="space-y-3">
      <a
        href={portalUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline break-all"
      >
        {portalUrl}
        <ExternalLink size={12} className="shrink-0" />
      </a>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
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
        <div className="space-y-1.5">
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
  );
}

export function RefLibraryTab() {
  const [status, setStatus] = useState<NutritionLibraryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [sdkDownloading, setSdkDownloading] = useState(false);
  const [windowsSdkDownloading, setWindowsSdkDownloading] = useState(false);
  const [expandedId, setExpandedId] = useState<LibraryEntryId | null>(null);

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

  async function handleDownloadDantsuSdk() {
    setSdkDownloading(true);
    setError(null);
    try {
      const pack = await api.downloadPosPrinterSdkPackage('dantsu-escpos-android');
      const url = URL.createObjectURL(pack.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pack.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download printer SDK package.');
    } finally {
      setSdkDownloading(false);
    }
  }

  async function handleDownloadWindowsSdk() {
    setWindowsSdkDownloading(true);
    setError(null);
    try {
      const pack = await api.downloadPosPrinterSdkPackage('escpos-lan-windows');
      const url = URL.createObjectURL(pack.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pack.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download Windows printer test package.');
    } finally {
      setWindowsSdkDownloading(false);
    }
  }

  const portalUrl = status?.portalUrl || 'https://fdc.nal.usda.gov/';
  const nutritionRevised = status?.lastSyncedAt ?? status?.lastCheckedAt;

  const entries: LibraryEntry[] = useMemo(
    () => [
      {
        id: 'eula',
        title: EULA_TITLE,
        revisedLabel: LEGAL_EFFECTIVE_DATE,
      },
      {
        id: 'privacy',
        title: PRIVACY_POLICY_TITLE,
        revisedLabel: LEGAL_EFFECTIVE_DATE,
      },
      {
        id: 'dpa',
        title: DPA_TITLE,
        revisedLabel: LEGAL_EFFECTIVE_DATE,
      },
      {
        id: 'platform-glossary',
        title: PLATFORM_GLOSSARY_TITLE,
        revisedLabel: PLATFORM_GLOSSARY_REVISED_DATE,
      },
      {
        id: 'fifo',
        title: FIFO_GUIDE_TITLE,
        revisedLabel: FIFO_GUIDE_REVISED_DATE,
      },
      {
        id: 'dantsu-printer',
        title: DANTSU_PRINTER_SDK_TITLE,
        revisedLabel: DANTSU_PRINTER_SDK_REVISED_DATE,
      },
      {
        id: 'windows-escpos',
        title: WINDOWS_ESCPOS_SDK_TITLE,
        revisedLabel: WINDOWS_ESCPOS_SDK_REVISED_DATE,
      },
      {
        id: 'accounting-packs',
        title: ACCOUNTING_PACKS_LIBRARY_TITLE,
        revisedLabel: ACCOUNTING_PACKS_REVISED_DATE,
      },
      {
        id: 'nutrition',
        title: status?.sourceLabel || 'USDA FoodData Central (Foundation Foods + SR Legacy)',
        revisedLabel: formatDisplayDate(nutritionRevised),
      },
    ],
    [nutritionRevised, status?.sourceLabel],
  );

  function toggleEntry(id: LibraryEntryId) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  function renderDetails(id: LibraryEntryId): ReactNode {
    switch (id) {
      case 'eula':
        return (
          <LegalDetails intro={EULA_INTRO} version={CURRENT_EULA_VERSION} path="/eula" />
        );
      case 'privacy':
        return (
          <LegalDetails
            intro={PRIVACY_POLICY_INTRO}
            version={CURRENT_PRIVACY_POLICY_VERSION}
            path="/privacy"
          />
        );
      case 'dpa':
        return (
          <LegalDetails intro={DPA_INTRO} version={CURRENT_DPA_VERSION} path="/dpa" />
        );
      case 'platform-glossary':
        return <PlatformGlossaryDetails />;
      case 'fifo':
        return (
          <FifoDetails
            sqlCopied={sqlCopied}
            onCopySql={() => {
              void navigator.clipboard.writeText(FIFO_ISSUE_STOCK_SQL)
                .then(() => {
                  setSqlCopied(true);
                  window.setTimeout(() => setSqlCopied(false), 1600);
                })
                .catch(() => setSqlCopied(false));
            }}
          />
        );
      case 'dantsu-printer':
        return (
          <DantsuPrinterSdkDetails
            downloading={sdkDownloading}
            onDownload={() => void handleDownloadDantsuSdk()}
          />
        );
      case 'windows-escpos':
        return (
          <WindowsEscposSdkDetails
            downloading={windowsSdkDownloading}
            onDownload={() => void handleDownloadWindowsSdk()}
          />
        );
      case 'accounting-packs':
        return <AccountingPacksLibraryDetails />;
      case 'nutrition':
        return (
          <NutritionDetails status={status} loading={loading} portalUrl={portalUrl} />
        );
      default:
        return null;
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen size={14} className="text-muted-foreground" />
            Ref &amp; Library
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click a title to expand details. Includes platform definitions by module, legal docs, FIFO guide, DantSu Android + Windows ESC/POS printer packages, and nutrition library.
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

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}

      <div className="rounded-md border border-border/70 overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-3 px-3 py-2 bg-muted/30 border-b border-border/60">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Title
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground text-right">
            Created / Revised
          </p>
        </div>

        <ul className="divide-y divide-border/60">
          {entries.map(entry => {
            const open = expandedId === entry.id;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => toggleEntry(entry.id)}
                  aria-expanded={open}
                  className="w-full grid grid-cols-[minmax(0,1fr)_9rem] gap-3 items-center px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                >
                  <span className="min-w-0 flex items-center gap-2">
                    <ChevronDown
                      size={14}
                      className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
                    />
                    <span className="text-sm font-medium text-foreground truncate">
                      {entry.title}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums text-right shrink-0">
                    {entry.revisedLabel}
                  </span>
                </button>

                {open ? (
                  <div className="px-3 pb-3 pl-9 border-t border-border/40 bg-muted/10">
                    <div className="pt-3">
                      {renderDetails(entry.id)}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
