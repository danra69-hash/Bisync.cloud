import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Monitor,
  Play,
  X,
  XCircle,
} from 'lucide-react';
import type { PowerQaContext, QaStatus, QaTaskResult } from '../../data/devQaRunner';
import { buildIssueView } from '../../data/devQaIssueGuide';
import { getQaScene, qaActorLabel } from '../../data/devQaScenes';
import { MillstoneLoader } from '../shared/MillstoneLoader';

type Props = {
  open: boolean;
  running: boolean;
  fixing?: boolean;
  tasks: QaTaskResult[];
  runSummary: string | null;
  runStatus: 'passed' | 'failed' | 'warning' | null;
  context: PowerQaContext | null;
  onClose: () => void;
  onOpenFullIssue: (task: QaTaskResult) => void;
  /** Continue Automated QA from the failed/warned step after a fix is deployed. */
  onRerunFromFailure: (task: QaTaskResult) => void;
};

const DOT: Record<QaStatus, string> = {
  pending: 'bg-white/25',
  running: 'bg-amber-400 animate-pulse',
  pass: 'bg-emerald-400',
  fail: 'bg-red-400',
  warn: 'bg-amber-300',
};

function formatFactValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function QaLiveMonitorOverlay({
  open,
  running,
  fixing = false,
  tasks,
  runSummary,
  runStatus,
  context,
  onClose,
  onOpenFullIssue,
  onRerunFromFailure,
}: Props) {
  const [showDiagnosis, setShowDiagnosis] = useState(false);

  const current = useMemo(
    () => tasks.find(t => t.status === 'running')
      ?? tasks.find(t => t.status === 'fail')
      ?? tasks.find(t => t.status === 'warn')
      ?? tasks.filter(t => t.status === 'pass').at(-1)
      ?? tasks[0],
    [tasks],
  );

  const problem = useMemo(
    () => tasks.find(t => t.status === 'fail') ?? tasks.find(t => t.status === 'warn') ?? null,
    [tasks],
  );

  const completed = tasks.filter(t => t.status === 'pass' || t.status === 'fail' || t.status === 'warn').length;
  const total = tasks.length || 1;
  const currentIndex = current ? Math.max(0, tasks.findIndex(t => t.id === current.id)) : 0;
  const scene = getQaScene(current?.id ?? '', current?.label);
  const issue = problem ? buildIssueView(problem, context, runSummary) : null;
  const facts = Object.entries(current?.facts ?? {});
  const progressPct = Math.round((completed / total) * 100);

  useEffect(() => {
    if (problem) setShowDiagnosis(true);
  }, [problem?.id, problem?.status, problem?.finishedAt]);

  useEffect(() => {
    if (!open) setShowDiagnosis(false);
  }, [open]);

  if (!open || !current) return null;

  const stageTone = current.status === 'fail'
    ? 'border-red-500/40 bg-red-950/80'
    : current.status === 'warn'
      ? 'border-amber-500/40 bg-amber-950/70'
      : 'border-white/10 bg-[#141820]/95';

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />

      <div className="relative flex h-full max-h-[920px] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b0d12] shadow-2xl text-white">
        {/* Title bar */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Monitor size={14} className="text-sky-300 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-white/50 font-sans">
                Live QA monitor
              </p>
              <p className="text-xs font-medium truncate">
                {running ? 'Watching Automated QA on the platform…' : runSummary ?? 'QA monitor'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {running && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
                Live
              </span>
            )}
            {!running && runStatus === 'passed' && (
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-200">
                Passed
              </span>
            )}
            {!running && runStatus === 'failed' && (
              <span className="rounded-full bg-red-400/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-red-200">
                Failed
              </span>
            )}
            {!running && problem && (runStatus === 'failed' || runStatus === 'warning' || problem.status === 'fail' || problem.status === 'warn') && (
              <button
                type="button"
                disabled={fixing || running}
                onClick={() => onRerunFromFailure(problem)}
                title="Continue Automated QA from the failed step"
                className="inline-flex items-center gap-1 rounded-md bg-sky-500/25 border border-sky-400/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-sky-100 hover:bg-sky-500/35 disabled:opacity-50"
              >
                <Play size={11} />
                QA Rerun
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="Close monitor"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body: screen + optional diagnosis */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Simulated platform screen */}
          <div className="relative flex min-h-0 flex-1 flex-col p-3 sm:p-4">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#f4f5f7] text-[#1f2430] shadow-inner">
              {/* Fake browser chrome */}
              <div className="flex items-center gap-2 border-b border-black/5 bg-white px-3 py-2">
                <div className="flex gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <div className="min-w-0 flex-1 rounded-md bg-[#f0f1f4] px-3 py-1 text-[11px] font-sans text-[#5b6270] truncate">
                  bisync.cloud{scene.routeHint.startsWith('/') ? scene.routeHint : ` · ${scene.routeHint}`}
                </div>
              </div>

              {/* Fake app shell */}
              <div className="grid min-h-0 flex-1 grid-cols-[7.5rem_1fr] sm:grid-cols-[9rem_1fr]">
                <aside className="border-r border-black/5 bg-[#1f2430] text-white/80 p-2.5 space-y-2">
                  <p className="text-[9px] uppercase tracking-widest text-white/40 px-1">Bisync</p>
                  {['Home', 'Revenue', 'Inventory', 'HR', 'Config'].map(item => (
                    <div
                      key={item}
                      className={`rounded px-2 py-1.5 text-[10px] ${
                        scene.screenTitle.toLowerCase().includes(item.toLowerCase())
                          || (item === 'Revenue' && /component|product|purchase|vendor|produce|cogs|rrp/i.test(scene.screenTitle + scene.routeHint))
                          || (item === 'Inventory' && /stock|inventory|cogs/i.test(scene.screenTitle + scene.routeHint))
                          || (item === 'Config' && /access|location|onboarding|provision/i.test(scene.routeHint))
                          || (item === 'Home' && /register|login|sign/i.test(scene.screenTitle))
                          ? 'bg-[#F37021]/25 text-white'
                          : 'text-white/55'
                      }`}
                    >
                      {item}
                    </div>
                  ))}
                </aside>

                <div className="min-h-0 overflow-y-auto bg-gradient-to-br from-white via-[#fafafa] to-[#f2f4f7] p-3 sm:p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-[#8a91a0]">
                        {qaActorLabel(scene.actor)} · live session
                      </p>
                      <h3 className="text-base sm:text-lg font-semibold tracking-tight mt-0.5">
                        {scene.screenTitle}
                      </h3>
                      <p className="text-xs text-[#5b6270] mt-1 max-w-[40rem]">
                        {scene.activity}
                      </p>
                    </div>
                    {running && current.status === 'running' && (
                      <MillstoneLoader size="sm" layout="inline" label="" />
                    )}
                    {current.status === 'pass' && <CheckCircle2 size={18} className="text-emerald-600" />}
                    {current.status === 'fail' && <XCircle size={18} className="text-red-600" />}
                    {current.status === 'warn' && <AlertTriangle size={18} className="text-amber-600" />}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {scene.panels.map((panel, idx) => {
                      const active = current.status === 'running' && idx === (completed + currentIndex) % Math.max(scene.panels.length, 1);
                      return (
                        <div
                          key={panel}
                          className={`rounded-md border px-3 py-2.5 text-xs transition-all ${
                            active
                              ? 'border-[#F37021]/50 bg-[#F37021]/8 shadow-sm scale-[1.01]'
                              : 'border-black/8 bg-white/80'
                          }`}
                        >
                          <p className="text-[10px] uppercase tracking-wider text-[#8a91a0]">Panel</p>
                          <p className="font-medium mt-0.5">{panel}</p>
                          {active && (
                            <p className="text-[10px] text-[#F37021] mt-1 animate-pulse">Working here…</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {current.detail && (
                    <div className="rounded-md border border-black/8 bg-white px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-[#8a91a0]">Current action</p>
                      <p className="text-xs mt-1 leading-relaxed text-[#1f2430]">{current.detail}</p>
                    </div>
                  )}

                  {facts.length > 0 && (
                    <div className="rounded-md border border-black/8 bg-white overflow-hidden">
                      <div className="px-3 py-2 border-b border-black/5 text-[10px] uppercase tracking-wider text-[#8a91a0]">
                        Live verification facts
                      </div>
                      <dl className="divide-y divide-black/5">
                        {facts.slice(0, 8).map(([key, value]) => (
                          <div key={key} className="grid grid-cols-[7rem_1fr] gap-2 px-3 py-1.5 text-[11px]">
                            <dt className="text-[#8a91a0] truncate">{key}</dt>
                            <dd className="font-sans text-[#1f2430] break-all">{formatFactValue(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {context?.companyName && (
                    <p className="text-[10px] text-[#8a91a0]">
                      Tenant: <span className="font-sans text-[#5b6270]">{context.companyName}</span>
                      {context.restaurantExternalId ? ` · restaurant ${context.restaurantExternalId}` : ''}
                      {context.kitchenExternalId ? ` · kitchen ${context.kitchenExternalId}` : ''}
                      {context.adminEmail ? ` · ${context.adminEmail}` : context.ownerEmail ? ` · ${context.ownerEmail}` : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* In-depth diagnosis drawer */}
          {showDiagnosis && issue && (
            <aside className="w-full lg:w-[22rem] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#12151c] overflow-y-auto">
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-red-300/80">
                    {issue.task.status === 'fail' ? 'In-depth error check' : 'Warning review'}
                  </p>
                  <h4 className="text-sm font-semibold mt-0.5">{issue.task.label}</h4>
                  <p className="text-[11px] text-white/50 mt-0.5">{issue.guide.area}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={fixing || running}
                    onClick={() => onRerunFromFailure(issue.task)}
                    title="Continue Automated QA from this step"
                    className="inline-flex items-center gap-1 rounded-md bg-sky-500/25 border border-sky-400/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-sky-100 hover:bg-sky-500/35 disabled:opacity-50"
                  >
                    <Play size={11} />
                    QA Rerun
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDiagnosis(false)}
                    className="p-1 rounded text-white/40 hover:text-white"
                    aria-label="Hide diagnosis"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              <div className="px-4 py-3 space-y-4 text-xs">
                {issue.task.detail && (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-100">
                    <p className="text-[10px] uppercase tracking-wider text-red-300/80 mb-1">Why it failed</p>
                    <p className="leading-relaxed">{issue.task.detail}</p>
                  </div>
                )}

                {(issue.task.irregularities?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-white/45">Irregularities</p>
                    {issue.task.irregularities!.map(row => (
                      <div key={row.id} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 space-y-1">
                        <p className="font-medium text-white/90">{row.label}</p>
                        <p className="text-white/55">Expected: {row.expected}</p>
                        <p className="text-red-200">Actual: {row.actual}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/45 mb-1">Expected behavior</p>
                  <p className="text-white/75 leading-relaxed">{issue.guide.expected}</p>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/45 mb-1.5">Where to fix</p>
                  <ol className="space-y-1.5">
                    {issue.guide.whereToFix.map((item, i) => (
                      <li key={item} className="flex gap-2 text-white/75 leading-snug">
                        <span className="text-sky-300 shrink-0">{i + 1}.</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/45 mb-1.5">Checklist</p>
                  <ul className="space-y-1">
                    {issue.guide.checks.map(check => (
                      <li key={check} className="flex items-start gap-2 text-white/70">
                        <Circle size={10} className="mt-0.5 shrink-0 text-white/35" />
                        <span>{check}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={fixing || running}
                    onClick={() => onRerunFromFailure(issue.task)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-sky-500 text-[#0b0d12] px-3 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    <Play size={12} />
                    QA Rerun from this step
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenFullIssue(issue.task)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-white/10 border border-white/15 px-3 py-2 text-white/90 hover:bg-white/15"
                  >
                    Open full fix panel
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>

        {/* Bottom stage bar */}
        <div className={`shrink-0 border-t px-4 py-3 ${stageTone}`}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-white/45">
                Stage {currentIndex + 1} of {total}
              </p>
              <p className="text-sm font-semibold truncate">
                {current.label}
                {current.status === 'running' ? '…' : ''}
              </p>
              <p className="text-[11px] text-white/55 truncate mt-0.5">
                {current.detail || scene.activity}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-sans text-white/70">{progressPct}%</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">
                {current.status}
              </p>
            </div>
          </div>

          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2.5">
            <div
              className={`h-full transition-all duration-500 ${
                current.status === 'fail' ? 'bg-red-400' : current.status === 'warn' ? 'bg-amber-300' : 'bg-sky-400'
              }`}
              style={{ width: `${Math.max(progressPct, current.status === 'running' ? ((currentIndex) / total) * 100 : progressPct)}%` }}
            />
          </div>

          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {tasks.map((task, idx) => (
              <button
                key={task.id}
                type="button"
                title={task.label}
                onClick={() => {
                  if (task.status === 'fail' || task.status === 'warn') {
                    setShowDiagnosis(true);
                    onOpenFullIssue(task);
                  }
                }}
                className={`h-2 w-2 rounded-full shrink-0 ${DOT[task.status]} ${
                  idx === currentIndex ? 'ring-2 ring-white/40 ring-offset-1 ring-offset-[#0b0d12]' : ''
                }`}
              />
            ))}
          </div>

          {problem && !showDiagnosis && (
            <button
              type="button"
              onClick={() => setShowDiagnosis(true)}
              className="mt-2 text-[11px] text-red-200 hover:underline"
            >
              Show in-depth error diagnosis
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
