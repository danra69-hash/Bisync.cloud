import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Calculator,
  Factory,
  FileText,
  Home,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Store,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import {
  BISYNC101_MODULES,
  bisync101Hash,
  findBisync101Task,
  parseBisync101Hash,
} from '../../data/bisync101/catalog';
import type { Bisync101Module } from '../../data/bisync101/types';
import { Bisync101ScreenLesson } from './Bisync101ScreenLesson';

type Props = {
  open: boolean;
  onClose: () => void;
  initialModuleId?: string;
  initialTaskId?: string;
};

const ICONS: Record<Bisync101Module['icon'], typeof Home> = {
  home: Home,
  settings: Settings,
  'shopping-cart': ShoppingCart,
  package: Package,
  factory: Factory,
  warehouse: Warehouse,
  users: Users,
  store: Store,
  calculator: Calculator,
  'file-text': FileText,
};

export function Bisync101Workspace({
  open,
  onClose,
  initialModuleId,
  initialTaskId,
}: Props) {
  const [moduleId, setModuleId] = useState(
    initialModuleId ?? BISYNC101_MODULES[0]?.id ?? 'getting-started',
  );
  const [taskId, setTaskId] = useState(initialTaskId ?? '');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const fromHash = parseBisync101Hash(window.location.hash);
    const nextModule = initialModuleId
      || fromHash?.moduleId
      || BISYNC101_MODULES[0]?.id
      || 'getting-started';
    const module = BISYNC101_MODULES.find(m => m.id === nextModule) ?? BISYNC101_MODULES[0];
    const nextTask = initialTaskId
      || fromHash?.taskId
      || module?.tasks[0]?.id
      || '';
    setModuleId(module?.id ?? nextModule);
    setTaskId(nextTask);
    setQuery('');
  }, [open, initialModuleId, initialTaskId]);

  useEffect(() => {
    if (!open) return;
    const hash = bisync101Hash(moduleId, taskId || undefined);
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    }
  }, [open, moduleId, taskId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const module = BISYNC101_MODULES.find(m => m.id === moduleId) ?? BISYNC101_MODULES[0];
  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tasks = module?.tasks ?? [];
    if (!q) return tasks;
    return tasks.filter(t =>
      t.title.toLowerCase().includes(q)
      || t.summary.toLowerCase().includes(q)
      || t.steps.some(s => s.title.toLowerCase().includes(q) || s.detail.toLowerCase().includes(q)));
  }, [module, query]);

  const activeTask = useMemo(() => {
    if (!module) return null;
    return module.tasks.find(t => t.id === taskId) ?? filteredTasks[0] ?? module.tasks[0] ?? null;
  }, [module, taskId, filteredTasks]);

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as { moduleId: string; moduleTitle: string; taskId: string; title: string }[];
    const hits: { moduleId: string; moduleTitle: string; taskId: string; title: string }[] = [];
    for (const m of BISYNC101_MODULES) {
      for (const t of m.tasks) {
        if (
          t.title.toLowerCase().includes(q)
          || t.summary.toLowerCase().includes(q)
          || m.title.toLowerCase().includes(q)
        ) {
          hits.push({ moduleId: m.id, moduleTitle: m.title, taskId: t.id, title: t.title });
        }
      }
    }
    return hits.slice(0, 12);
  }, [query]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex flex-col"
      style={{ background: '#1a1410' }}
      aria-modal="true"
      role="dialog"
      aria-label="Bisync101 user guide"
    >
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10" style={{ background: '#2A2118' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-md bg-[#F37021] text-white flex items-center justify-center shrink-0">
            <BookOpen size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 font-semibold">Wiki and user guide</p>
            <h2 className="text-sm font-bold text-white leading-none">Bisync101</h2>
          </div>
        </div>

        <div className="flex-1 max-w-xl mx-auto relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks across all modules…"
            className="w-full rounded-md pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#F37021]"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          />
          {searchHits.length > 0 && query.trim() && (
            <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-md border border-border bg-card shadow-xl max-h-64 overflow-auto">
              {searchHits.map(hit => (
                <button
                  key={`${hit.moduleId}-${hit.taskId}`}
                  type="button"
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 border-b border-border/60 last:border-0"
                  onClick={() => {
                    setModuleId(hit.moduleId);
                    setTaskId(hit.taskId);
                    setQuery('');
                  }}
                >
                  <span className="block font-medium text-foreground">{hit.title}</span>
                  <span className="block text-[10px] text-muted-foreground">{hit.moduleTitle}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-md hover:bg-white/10 text-white/80"
          aria-label="Close Bisync101"
        >
          <X size={16} />
        </button>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[220px_240px_minmax(0,1fr)]">
        <nav className="border-r border-white/10 overflow-y-auto bg-[#221a14] p-2 space-y-0.5">
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">Modules</p>
          {BISYNC101_MODULES.map(m => {
            const Icon = ICONS[m.icon];
            const active = m.id === module?.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setModuleId(m.id);
                  setTaskId(m.tasks[0]?.id ?? '');
                }}
                className={`w-full flex items-start gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                  active ? 'bg-[#F37021] text-white' : 'text-white/75 hover:bg-white/8'
                }`}
              >
                <Icon size={14} className="mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-semibold leading-snug">{m.title}</span>
                  <span className={`block text-[10px] mt-0.5 ${active ? 'text-white/80' : 'text-white/40'}`}>
                    {m.tasks.length} tasks
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <aside className="border-r border-white/10 overflow-y-auto bg-[#1e1712] p-2 space-y-0.5">
          <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            {module?.title ?? 'Tasks'}
          </p>
          {filteredTasks.map(t => {
            const active = t.id === activeTask?.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTaskId(t.id)}
                className={`w-full rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                  active ? 'bg-white/12 text-white ring-1 ring-[#F37021]/60' : 'text-white/70 hover:bg-white/6'
                }`}
              >
                <span className="block font-medium leading-snug">{t.title}</span>
                <span className="block text-[10px] text-white/40 mt-0.5">{t.durationLabel}</span>
              </button>
            );
          })}
          {filteredTasks.length === 0 && (
            <p className="px-2 py-3 text-xs text-white/40">No tasks match this filter.</p>
          )}
        </aside>

        <main className="overflow-y-auto bg-[#f7f4ef] text-[#2A2118]">
          {activeTask && module ? (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8a7c6e]">
                  {module.title}
                  {activeTask.whereInApp ? ` · ${activeTask.whereInApp}` : ''}
                </p>
                <h3 className="text-xl font-bold mt-1 tracking-tight">{activeTask.title}</h3>
                <p className="text-sm text-[#5c534a] mt-1.5 leading-relaxed">{activeTask.summary}</p>
              </div>

              <Bisync101ScreenLesson task={activeTask} />

              <section className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8a7c6e]">How to do it</h4>
                  <p className="text-[10px] text-[#8a7c6e]">Voice-over plays with each screenshot step</p>
                </div>
                <ol className="space-y-3">
                  {activeTask.steps.map((step, index) => (
                    <li
                      key={`${activeTask.id}-${index}`}
                      className="flex gap-3 rounded-lg border border-[#e4ddd3] bg-white px-3 py-3"
                    >
                      <span className="shrink-0 h-6 w-6 rounded-full bg-[#F37021] text-white text-[11px] font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{step.title}</p>
                        <p className="text-xs text-[#5c534a] mt-1 leading-relaxed">{step.detail}</p>
                        {step.voiceover ? (
                          <p className="text-[10px] text-[#8a7c6e] mt-1.5 leading-snug italic">
                            Voice: {step.voiceover}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              {activeTask.tips && activeTask.tips.length > 0 && (
                <section className="rounded-lg border border-[#e4ddd3] bg-[#fff8f0] px-4 py-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#F37021]">Tips</h4>
                  <ul className="mt-2 space-y-1.5">
                    {activeTask.tips.map(tip => (
                      <li key={tip} className="text-xs text-[#5c534a] leading-relaxed pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:h-1 before:w-1 before:rounded-full before:bg-[#F37021]">
                        {tip}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="pt-2 border-t border-[#e4ddd3]">
                <p className="text-[11px] text-[#8a7c6e]">
                  Next task in this module:{' '}
                  {(() => {
                    const idx = module.tasks.findIndex(t => t.id === activeTask.id);
                    const next = module.tasks[idx + 1];
                    if (!next) return <span>end of module — pick another on the left.</span>;
                    return (
                      <button
                        type="button"
                        className="font-semibold text-[#F37021] hover:underline"
                        onClick={() => setTaskId(next.id)}
                      >
                        {next.title}
                      </button>
                    );
                  })()}
                </p>
              </section>
            </div>
          ) : (
            <div className="p-8 text-sm text-[#8a7c6e]">Select a task to begin.</div>
          )}
        </main>
      </div>
    </div>,
    document.body,
  );
}

/** Open helper used when deep-linking via hash while already mounted. */
export function resolveBisync101Selection(moduleId?: string, taskId?: string) {
  if (moduleId && taskId) {
    const found = findBisync101Task(moduleId, taskId);
    if (found) return found;
  }
  const module = BISYNC101_MODULES.find(m => m.id === moduleId) ?? BISYNC101_MODULES[0];
  const task = module?.tasks[0] ?? null;
  return module && task ? { module, task } : null;
}
