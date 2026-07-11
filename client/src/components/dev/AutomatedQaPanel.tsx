import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  Eraser,
  History,
  Loader2,
  Play,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import {
  createPendingTasks,
  executeQaFix,
  runAutomatedQa,
  type PowerQaContext,
  type QaStatus,
  type QaTaskResult,
} from '../../data/devQaRunner';
import { buildIssueView, type QaIssueViewModel } from '../../data/devQaIssueGuide';
import { devConsoleApi, type DevQaHistoryRow } from '../../data/devConsoleApi';

type QaPanelTab = 'run' | 'history';

const STATUS_STYLES: Record<QaStatus, string> = {
  pending: 'border-border bg-muted/30 text-muted-foreground',
  running: 'border-amber-400/50 bg-amber-400/10 text-amber-700 dark:text-amber-300',
  pass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  fail: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  warn: 'border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200',
};

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
  if (status === 'running') return <Loader2 size={14} className="animate-spin text-amber-600" />;
  return <Circle size={14} className="text-muted-foreground" />;
}

function historyStatusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'passed') return 'bg-emerald-500/15 text-emerald-700';
  if (s === 'failed') return 'bg-red-500/15 text-red-700';
  if (s === 'warning') return 'bg-amber-500/15 text-amber-800';
  return 'bg-muted text-muted-foreground';
}

function parseHistoryTasks(resultsJson: string): QaTaskResult[] {
  try {
    const parsed = JSON.parse(resultsJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is QaTaskResult =>
      !!t && typeof t === 'object' && typeof (t as QaTaskResult).id === 'string' && typeof (t as QaTaskResult).status === 'string',
    );
  } catch {
    return [];
  }
}

function StepDetailPanel({
  issue,
  fixing,
  fixMessage,
  onClose,
  onFix,
}: {
  issue: QaIssueViewModel;
  fixing: boolean;
  fixMessage: string | null;
  onClose: () => void;
  onFix: (actionId: string) => void;
}) {
  const { task, guide, context, runSummary } = issue;
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const isProblem = task.status === 'fail' || task.status === 'warn';
  const irregularities = task.irregularities ?? [];

  useEffect(() => {
    setChecked({});
  }, [task.id, task.finishedAt]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[120] bg-black/40" onClick={onClose} />
      <div className="fixed top-0 right-0 z-[121] h-full w-full max-w-lg bg-card border-l border-border shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans">
              {task.status === 'fail' ? 'Failed step · investigate & fix' : task.status === 'warn' ? 'Warning · review' : 'Step detail · verify'}
            </p>
            <h3 className="text-sm font-semibold mt-0.5">{task.label}</h3>
            <p className="text-[11px] text-muted-foreground mt-1">{guide.area}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted" aria-label="Close">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {task.detail && (
            <div className={`rounded-lg border px-3 py-3 text-xs ${
              task.status === 'fail'
                ? 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200'
                : task.status === 'warn'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100'
                  : 'border-border bg-muted/20'
            }`}>
              <p className="font-medium mb-1">{isProblem ? 'Issue' : 'Result'}</p>
              <p className="break-words whitespace-pre-wrap">{task.detail}</p>
            </div>
          )}

          {irregularities.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-sans mb-2">Irregular numbers</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 text-left text-muted-foreground border-b border-border">
                      <th className="px-3 py-2 font-medium">Check</th>
                      <th className="px-3 py-2 font-medium">Expected</th>
                      <th className="px-3 py-2 font-medium">Actual</th>
                      <th className="px-3 py-2 font-medium">Sev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {irregularities.map(row => (
                      <tr key={row.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2 font-sans">{String(row.expected)}</td>
                        <td className="px-3 py-2 font-sans font-medium text-red-700 dark:text-red-300">{String(row.actual)}</td>
                        <td className="px-3 py-2 uppercase text-[10px]">{row.severity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {task.facts && Object.keys(task.facts).length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-sans mb-2">Verification facts</p>
              <dl className="rounded-lg border border-border divide-y divide-border">
                {Object.entries(task.facts).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[8rem_1fr] gap-2 px-3 py-2 text-xs">
                    <dt className="text-muted-foreground font-sans truncate" title={key}>{key}</dt>
                    <dd className="break-words">{value === null || value === undefined ? '—' : String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-sans mb-1.5">Expected</p>
            <p className="text-xs leading-relaxed">{guide.expected}</p>
          </div>

          {context && (context.companyName || context.adminEmail || context.finishedProduct) && (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-3 space-y-1.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-sans">Run context</p>
              {context.companyName && <p className="text-xs">Company: {context.companyName}{context.companyId != null ? ` (#${context.companyId})` : ''}</p>}
              {context.restaurantExternalId && <p className="text-xs">Restaurant: {context.restaurantExternalId}</p>}
              {context.kitchenExternalId && <p className="text-xs">Kitchen: {context.kitchenExternalId}</p>}
              {context.adminEmail && <p className="text-xs">Admin: {context.adminEmail}</p>}
              {context.finishedProduct && <p className="text-xs">Product: {context.finishedProduct.name} (RRP {context.finishedProduct.rrp})</p>}
              {context.components.length > 0 && <p className="text-xs">Components: {context.components.length}</p>}
              {context.purchaseOrders.length > 0 && <p className="text-xs">POs: {context.purchaseOrders.length}</p>}
            </div>
          )}

          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-sans mb-2">Where to fix (manual)</p>
            <ol className="space-y-2">
              {guide.whereToFix.map((step, i) => (
                <li key={step} className="flex gap-2 text-xs leading-relaxed">
                  <span className="font-sans text-muted-foreground shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-sans mb-2 flex items-center gap-1.5">
              <ClipboardList size={12} /> Checklist
            </p>
            <ul className="space-y-2">
              {guide.checks.map(check => (
                <li key={check}>
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!checked[check]}
                      onChange={e => setChecked(prev => ({ ...prev, [check]: e.target.checked }))}
                      className="mt-0.5 rounded border-border"
                    />
                    <span className={checked[check] ? 'line-through text-muted-foreground' : ''}>{check}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {isProblem && (task.fixActions?.length ?? 0) > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-sans mb-2 flex items-center gap-1.5">
                <Wrench size={12} /> Execute fix
              </p>
              <div className="space-y-2">
                {task.fixActions!.map(action => (
                  <button
                    key={action.id}
                    type="button"
                    disabled={fixing}
                    onClick={() => onFix(action.id)}
                    className="w-full text-left rounded-lg border border-border px-3 py-2.5 hover:border-primary/40 hover:bg-muted/30 disabled:opacity-50"
                  >
                    <p className="text-xs font-medium">{action.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{action.description}</p>
                  </button>
                ))}
              </div>
              {fixMessage && (
                <p className="text-[11px] mt-2 text-muted-foreground">{fixMessage}</p>
              )}
              {fixing && (
                <p className="text-[11px] mt-2 inline-flex items-center gap-1.5 text-amber-700">
                  <Loader2 size={12} className="animate-spin" /> Running fix…
                </p>
              )}
            </div>
          )}

          {runSummary && (
            <p className="text-[11px] text-muted-foreground border-t border-border pt-3">{runSummary}</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full text-xs font-medium border border-border rounded-md px-3 py-2 hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function AutomatedQaPanel({ triggeredBy }: { triggeredBy: string }) {
  const [tab, setTab] = useState<QaPanelTab>('run');
  const [tasks, setTasks] = useState<QaTaskResult[]>(() => createPendingTasks());
  const [runContext, setRunContext] = useState<PowerQaContext | null>(null);
  const [running, setRunning] = useState(false);
  const [runSummary, setRunSummary] = useState<string | null>(null);
  const [history, setHistory] = useState<DevQaHistoryRow[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [issue, setIssue] = useState<QaIssueViewModel | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixMessage, setFixMessage] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistoryError(null);
      setHistory(await devConsoleApi.qaHistory(40));
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to load QA history');
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const runFinished = !running && tasks.some(t => t.status === 'pass' || t.status === 'fail' || t.status === 'warn');
  const hasOpenIssues = tasks.some(t => t.status === 'fail' || t.status === 'warn');
  const canShowPurge = runFinished || history.length > 0;

  function openStep(task: QaTaskResult, summary?: string | null, context?: PowerQaContext | null) {
    setFixMessage(null);
    setIssue(buildIssueView(task, context ?? runContext, summary ?? runSummary));
  }

  function openHistoryRow(row: DevQaHistoryRow) {
    const parsed = parseHistoryTasks(row.resultsJson);
    if (parsed.length === 0) return;
    const problem = parsed.find(t => t.status === 'fail') ?? parsed.find(t => t.status === 'warn') ?? parsed[parsed.length - 1];
    setTasks(parsed);
    setRunSummary(row.summary);
    setTab('run');
    openStep(problem, row.summary, null);
  }

  async function persistAndFinish(
    runId: number,
    result: Awaited<ReturnType<typeof runAutomatedQa>>,
  ) {
    setRunSummary(result.summary);
    setRunContext(result.context);
    setTasks(result.tasks);
    await devConsoleApi.completeQaRun(runId, {
      status: result.status,
      summary: result.summary,
      resultsJson: JSON.stringify(result.tasks),
    });
    await loadHistory();
    const firstProblem = result.tasks.find(t => t.status === 'fail') ?? result.tasks.find(t => t.status === 'warn');
    if (firstProblem) openStep(firstProblem, result.summary, result.context);
  }

  async function startRun() {
    if (running) return;
    setTab('run');
    setRunning(true);
    setRunSummary('Starting power-user QA…');
    setPurgeMessage(null);
    setRunContext(null);
    setIssue(null);
    setFixMessage(null);
    setTasks(createPendingTasks());

    let runId: number | null = null;
    try {
      const started = await devConsoleApi.startQaRun({
        triggeredBy,
        status: 'running',
        summary: 'Power-user QA in progress…',
        resultsJson: '[]',
      });
      runId = started.id;
      setRunSummary('Power-user QA in progress…');
      const result = await runAutomatedQa(triggeredBy, setTasks);
      await persistAndFinish(runId, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'QA run failed to start';
      setRunSummary(message);
      if (runId != null) {
        try {
          await devConsoleApi.completeQaRun(runId, {
            status: 'failed',
            summary: message,
            resultsJson: JSON.stringify(tasks),
          });
          await loadHistory();
        } catch {
          // ignore
        }
      }
    } finally {
      setRunning(false);
    }
  }

  async function handlePurgeQaData() {
    setPurging(true);
    setPurgeMessage(null);
    try {
      const result = await devConsoleApi.purgeQaData({
        companyIds: runContext?.companyId != null ? [runContext.companyId] : undefined,
        purgeAllQaPower: true,
      });
      setTasks(createPendingTasks());
      setRunContext(null);
      setIssue(null);
      setRunSummary(null);
      setPurgeMessage(
        `Kept ${result.historyRowsKept} history row(s). Deleted ${result.companiesDeleted} QA compan${result.companiesDeleted === 1 ? 'y' : 'ies'}`
          + (result.companyNames.length ? `: ${result.companyNames.join(', ')}` : '.')
          + ` ${result.note}`,
      );
      setTab('history');
      await loadHistory();
    } catch (err) {
      setPurgeMessage(err instanceof Error ? err.message : 'Failed to purge QA data');
    } finally {
      setPurging(false);
    }
  }

  async function handleFix(actionId: string) {
    if (!runContext && actionId !== 'rerun-full') {
      setFixMessage('No run context yet — start a full QA run first, or choose Re-run full QA.');
      return;
    }
    setFixing(true);
    setFixMessage(null);
    try {
      if (actionId === 'rerun-full') {
        setIssue(null);
        await startRun();
        return;
      }
      if (actionId === 'cleanup') {
        const outcome = await executeQaFix(actionId, runContext ?? { runKey: 'fix', components: [], purchaseOrders: [] }, setTasks);
        setFixMessage('message' in outcome ? outcome.message : outcome.summary);
        setTasks(createPendingTasks());
        setRunContext(null);
        setIssue(null);
        setTab('history');
        await loadHistory();
        return;
      }
      const started = await devConsoleApi.startQaRun({
        triggeredBy: `${triggeredBy} (fix)`,
        status: 'running',
        summary: `Fix action ${actionId}`,
        resultsJson: '[]',
      });
      const outcome = await executeQaFix(actionId, runContext ?? { runKey: 'fix', components: [], purchaseOrders: [] }, setTasks);
      if ('tasks' in outcome) {
        await persistAndFinish(started.id, outcome);
        setFixMessage(outcome.summary);
      } else {
        await devConsoleApi.completeQaRun(started.id, {
          status: 'passed',
          summary: outcome.message,
          resultsJson: JSON.stringify(tasks),
        });
        setFixMessage(outcome.message);
        await loadHistory();
      }
    } catch (err) {
      setFixMessage(err instanceof Error ? err.message : 'Fix failed');
    } finally {
      setFixing(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">Power-user Automated QA</h2>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">
            End-to-end user journey: company → locations → System Admin login → components/vendors → sub-product & product →
            RRP/COGS → 25 POs → accept/receive → stock cards → cash purchase → produce + POS FIFO → final audit.
            Every step is clickable. Red/yellow steps include irregular numbers and executable fixes.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canShowPurge && (
            <button
              type="button"
              onClick={() => void handlePurgeQaData()}
              disabled={purging || running || fixing}
              title="Delete QA operational DB records; keep History"
              className="inline-flex items-center gap-1.5 text-xs font-medium border border-border rounded-md px-3 py-2 hover:bg-muted disabled:opacity-50"
            >
              {purging ? <Loader2 size={13} className="animate-spin" /> : <Eraser size={13} />}
              Keep history & delete QA records
            </button>
          )}
          <button
            type="button"
            onClick={() => void startRun()}
            disabled={running || fixing || purging}
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md px-3 py-2 disabled:opacity-50"
          >
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {running ? 'Running power QA…' : 'Run Power-user QA'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('run')}
          className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${tab === 'run' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Run
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px ${tab === 'history' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <History size={12} /> History
        </button>
      </div>

      {runSummary && tab === 'run' && (
        <div className="px-3 py-2 rounded-md border border-border bg-muted/20 text-xs">{runSummary}</div>
      )}
      {purgeMessage && (
        <div className="px-3 py-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-200">
          {purgeMessage}
        </div>
      )}
      {hasOpenIssues && runFinished && tab === 'run' && (
        <div className="px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-100">
          Resolve open issues (or re-run) before purging if you still need the QA company for investigation. History is always kept.
        </div>
      )}

      {tab === 'run' && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-2 border-b border-border flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Pass</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Fail — click for issues + fixes</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Warn — click to review</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted-foreground/40" /> Click any step for detail</span>
          </div>
          <ol className="divide-y divide-border">
            {tasks.map((task, index) => {
              const isProblem = task.status === 'fail' || task.status === 'warn';
              const irregularCount = task.irregularities?.length ?? 0;
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    className={`px-4 py-3 flex items-start gap-3 w-full text-left cursor-pointer hover:brightness-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${STATUS_STYLES[task.status]}`}
                    onClick={() => openStep(task)}
                  >
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[task.status]}`} />
                      {index < tasks.length - 1 && <span className="w-px flex-1 min-h-4 bg-border" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusIcon status={task.status} />
                        <p className="text-xs font-medium">{task.label}</p>
                        {task.durationMs != null && (
                          <span className="text-[10px] font-sans text-muted-foreground">{task.durationMs}ms</span>
                        )}
                        {irregularCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-700">
                            {irregularCount} irregular
                          </span>
                        )}
                        <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-medium shrink-0">
                          {isProblem ? 'View issue' : 'View detail'} <ChevronRight size={12} />
                        </span>
                      </div>
                      {task.status === 'pass' && task.detail && (
                        <p className="text-[11px] mt-1 opacity-90 break-words line-clamp-2">{task.detail}</p>
                      )}
                      {isProblem && (
                        <p className="text-[11px] mt-1 opacity-80">
                          {task.status === 'fail'
                            ? 'Failed — click to inspect irregular numbers and run fixes.'
                            : 'Needs review — click for details.'}
                        </p>
                      )}
                      {task.status === 'pending' && (
                        <p className="text-[11px] mt-1 opacity-70">Waiting — click for expected process.</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">QA history</h3>
            <button type="button" onClick={() => void loadHistory()} className="text-[11px] text-primary hover:underline">Refresh</button>
          </div>
          {historyError && (
            <div className="px-3 py-2 rounded-md bg-destructive/10 text-destructive text-xs">{historyError}</div>
          )}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Triggered by</th>
                  <th className="px-3 py-2 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody>
                {history.map(row => {
                  const parsed = parseHistoryTasks(row.resultsJson);
                  const clickable = parsed.length > 0;
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-border last:border-0 ${clickable ? 'cursor-pointer hover:bg-muted/30' : ''}`}
                      onClick={() => { if (clickable) openHistoryRow(row); }}
                    >
                      <td className="px-3 py-2 font-sans whitespace-nowrap">{new Date(row.startedAt).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${historyStatusClass(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">{row.triggeredBy || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          {row.summary || '—'}
                          {clickable && <ChevronRight size={12} className="shrink-0" />}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No QA runs yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {issue && (
        <StepDetailPanel
          issue={issue}
          fixing={fixing}
          fixMessage={fixMessage}
          onClose={() => setIssue(null)}
          onFix={actionId => void handleFix(actionId)}
        />
      )}
    </section>
  );
}
