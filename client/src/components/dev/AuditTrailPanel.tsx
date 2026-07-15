import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, ChevronRight, Circle, ClipboardList, History, RefreshCw, X, XCircle } from 'lucide-react';
import { devConsoleApi, type DevQaHistoryRow } from '../../data/devConsoleApi';
import {
  parseQaAuditPayload,
  type QaAuditEnvelope,
} from '../../data/qaAuditTrail';
import type { QaStatus, QaTaskResult } from '../../data/devQaRunner';
import { MillstoneLoader, TableLoadingRow } from '../shared/MillstoneLoader';

const STATUS_DOT: Record<QaStatus, string> = {
  pending: 'bg-muted-foreground/40',
  running: 'bg-amber-400 animate-pulse',
  pass: 'bg-emerald-500',
  fail: 'bg-red-500',
  warn: 'bg-amber-500',
};

function StatusIcon({ status }: { status: QaStatus }) {
  if (status === 'pass') return <CheckCircle2 size={14} className="text-emerald-600" />;
  if (status === 'fail') return <XCircle size={14} className="text-red-600" />;
  if (status === 'warn') return <AlertTriangle size={14} className="text-amber-600" />;
  if (status === 'running') return <MillstoneLoader size="xs" layout="inline" label="" />;
  return <Circle size={14} className="text-muted-foreground" />;
}

function historyStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'passed') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  if (s === 'failed') return 'bg-red-500/15 text-red-700 dark:text-red-300';
  if (s === 'warning') return 'bg-amber-500/15 text-amber-800 dark:text-amber-200';
  if (s === 'running') return 'bg-sky-500/15 text-sky-800 dark:text-sky-200';
  return 'bg-muted text-muted-foreground';
}

function auditLifecycleLabel(row: DevQaHistoryRow): { label: string; className: string } {
  const { audit } = parseQaAuditPayload(row.resultsJson);
  if (audit?.dataLifecycle === 'disappeared') {
    return { label: 'Disappeared', className: 'bg-muted text-muted-foreground' };
  }
  if (audit?.dataLifecycle === 'active') {
    return { label: 'Active data', className: 'bg-sky-500/15 text-sky-800 dark:text-sky-200' };
  }
  return { label: 'Legacy', className: 'bg-muted text-muted-foreground' };
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

type SelectedTrail = {
  row: DevQaHistoryRow;
  tasks: QaTaskResult[];
  audit: QaAuditEnvelope | null;
};

function TrailDetailPanel({
  selected,
  onClose,
}: {
  selected: SelectedTrail;
  onClose: () => void;
}) {
  const { row, tasks, audit } = selected;
  const ctx = audit?.context;
  const counts = audit?.artifactCounts;
  const passCount = tasks.filter(t => t.status === 'pass').length;
  const failCount = tasks.filter(t => t.status === 'fail').length;
  const warnCount = tasks.filter(t => t.status === 'warn').length;

  const metaRows: { label: string; value: string }[] = [
    { label: 'Run ID', value: String(row.id) },
    { label: 'Started', value: formatWhen(row.startedAt) },
    { label: 'Finished', value: formatWhen(row.finishedAt) },
    { label: 'Triggered by', value: row.triggeredBy || '—' },
    { label: 'Sealed at', value: formatWhen(audit?.sealedAt) },
    { label: 'Confirmed no issues', value: formatWhen(audit?.confirmedNoIssuesAt) },
    { label: 'Data disposed', value: formatWhen(audit?.disposedAt) },
    { label: 'Company', value: ctx?.companyName || (ctx?.companyId != null ? `#${ctx.companyId}` : '—') },
    { label: 'Owner', value: ctx?.ownerName || ctx?.ownerEmail || '—' },
    { label: 'Admin', value: ctx?.adminName || ctx?.adminEmail || '—' },
    { label: 'HR staff', value: ctx?.hrStaffName || ctx?.hrStaffEmail || '—' },
    { label: 'Provisioned DB', value: ctx?.provisionedDatabaseName || '—' },
    { label: 'Restaurant', value: ctx?.restaurantExternalId || '—' },
    { label: 'Kitchen', value: ctx?.kitchenExternalId || '—' },
    {
      label: 'Artifacts',
      value: counts
        ? `${counts.components} components · ${counts.purchaseOrders} POs`
          + (counts.hasSubProduct ? ' · sub-product' : '')
          + (counts.hasFinishedProduct ? ' · finished product' : '')
          + (counts.hasCashPurchase ? ' · cash purchase' : '')
        : '—',
    },
  ];

  return createPortal(
    <>
      <div className="fixed inset-0 z-[120] bg-black/40" onClick={onClose} />
      <div className="fixed top-0 right-0 z-[121] h-full w-full max-w-lg bg-card border-l border-border shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans">
              QA run detail
            </p>
            <h3 className="text-sm font-semibold mt-0.5 truncate">Run #{row.id}</h3>
            <p className="text-[11px] text-muted-foreground mt-1 break-words">{row.summary || '—'}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted" aria-label="Close">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4 space-y-5">
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className={`px-1.5 py-0.5 rounded font-medium ${historyStatusClass(row.status)}`}>
              {row.status}
            </span>
            <span className={`px-1.5 py-0.5 rounded font-medium ${auditLifecycleLabel(row).className}`}>
              {auditLifecycleLabel(row).label}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              {passCount} pass · {failCount} fail · {warnCount} warn
            </span>
          </div>

          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Context</h4>
            <dl className="rounded-md border border-border divide-y divide-border text-xs">
              {metaRows.map(item => (
                <div key={item.label} className="grid grid-cols-[7.5rem_1fr] gap-2 px-3 py-2">
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd className="break-words font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Task results ({tasks.length})
            </h4>
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sealed task results on this row.</p>
            ) : (
              <ol className="rounded-md border border-border divide-y divide-border">
                {tasks.map(task => (
                  <li key={task.id} className="px-3 py-2.5 flex items-start gap-2">
                    <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[task.status]}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusIcon status={task.status} />
                        <p className="text-xs font-medium">{task.label}</p>
                        {task.durationMs != null && (
                          <span className="text-[10px] font-sans text-muted-foreground">{task.durationMs}ms</span>
                        )}
                      </div>
                      {task.detail && (
                        <p className="text-[11px] text-muted-foreground mt-1 break-words">{task.detail}</p>
                      )}
                      {(task.irregularities?.length ?? 0) > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {task.irregularities!.map((item, index) => (
                            <li key={`${task.id}-irr-${index}`} className="text-[11px] text-red-700 dark:text-red-300">
                              · {item.label}: {item.actual}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function AuditTrailPanel() {
  const [history, setHistory] = useState<DevQaHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedTrail | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setHistory(await devConsoleApi.qaHistory(100));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load QA History');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const stats = useMemo(() => {
    let sealed = 0;
    let disappeared = 0;
    let active = 0;
    for (const row of history) {
      const { audit } = parseQaAuditPayload(row.resultsJson);
      if (audit) sealed += 1;
      if (audit?.dataLifecycle === 'disappeared') disappeared += 1;
      if (audit?.dataLifecycle === 'active') active += 1;
    }
    return { sealed, disappeared, active, total: history.length };
  }, [history]);

  function openRow(row: DevQaHistoryRow) {
    const { tasks, audit } = parseQaAuditPayload(row.resultsJson);
    setSelected({ row, tasks, audit });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <ClipboardList size={14} className="text-muted-foreground" />
            QA History
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">
            History and results of Power-user Automated QA runs as they happen — task outcomes, seals,
            and whether temporary QA operational data is still active or has disappeared.
            This is separate from platform Audit Trail (login / DB / computation).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadHistory()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-medium border border-border rounded-md px-3 py-2 hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-muted/20">
          <History size={12} /> {stats.total} runs
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-muted/20">
          {stats.sealed} sealed v2
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-muted/20">
          {stats.active} active data
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-muted/20">
          {stats.disappeared} disappeared
        </span>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs">{error}</div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Triggered by</th>
              <th className="px-3 py-2 font-medium">Company / run</th>
              <th className="px-3 py-2 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {history.map(row => {
              const { tasks, audit } = parseQaAuditPayload(row.resultsJson);
              const lifecycle = auditLifecycleLabel(row);
              const company = audit?.context.companyName
                || (audit?.context.companyId != null ? `Company #${audit.context.companyId}` : '—');
              const taskHint = tasks.length > 0
                ? `${tasks.filter(t => t.status === 'pass').length}/${tasks.length} pass`
                : '—';
              return (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                  onClick={() => openRow(row)}
                >
                  <td className="px-3 py-2 font-sans whitespace-nowrap">{formatWhen(row.startedAt)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${historyStatusClass(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${lifecycle.className}`}>
                      {lifecycle.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.triggeredBy || '—'}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{company}</p>
                    <p className="text-[10px] text-muted-foreground font-sans">#{row.id} · {taskHint}</p>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="line-clamp-2">{row.summary || '—'}</span>
                      <ChevronRight size={12} className="shrink-0" />
                    </span>
                  </td>
                </tr>
              );
            })}
            {!loading && history.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No QA History yet. Complete a Power-user Automated QA run to add results here.
                </td>
              </tr>
            )}
            {loading && history.length === 0 && (
              <TableLoadingRow colSpan={6} label="Loading QA History…" />
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <TrailDetailPanel selected={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
