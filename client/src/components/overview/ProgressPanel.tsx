import type { ProgressData } from '../../api';

export function ProgressPanel({ progress }: { progress: ProgressData | null }) {
  if (!progress) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-2.5 py-2">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">Development Progress</h2>
          <p className="text-[11px] text-muted-foreground leading-snug">Auto-tracked from Bisync.cloud API</p>
        </div>
        <span className="text-xl font-bold text-primary leading-none shrink-0">{progress.overallPercent}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 mb-2">
        <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${progress.overallPercent}%` }} />
      </div>
      <div className="space-y-2 max-h-40 overflow-y-auto pr-0.5">
        {progress.milestones.map(phase => (
          <div key={phase.phase}>
            <p className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground mb-1 leading-none">{phase.phase}</p>
            <div className="space-y-1">
              {phase.items.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-xs leading-tight">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    item.status === 'completed' ? 'bg-[#5A7A2A]' :
                    item.status === 'in_progress' ? 'bg-primary' : 'bg-muted-foreground/40'
                  }`} />
                  <span className="flex-1 min-w-0 truncate">{item.title}</span>
                  <span className="font-sans text-muted-foreground shrink-0">{item.progressPercent}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
