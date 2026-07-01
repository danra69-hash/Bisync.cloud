import type { ProgressData } from '../../api';

export function ProgressPanel({ progress }: { progress: ProgressData | null }) {
  if (!progress) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold">Development Progress</h2>
          <p className="text-xs text-muted-foreground">Auto-tracked from Bisync.cloud API</p>
        </div>
        <span className="text-2xl font-bold text-primary">{progress.overallPercent}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2 mb-4">
        <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress.overallPercent}%` }} />
      </div>
      <div className="space-y-4">
        {progress.milestones.map(phase => (
          <div key={phase.phase}>
            <p className="text-xs font-sans uppercase tracking-wider text-muted-foreground mb-2">{phase.phase}</p>
            <div className="space-y-2">
              {phase.items.map(item => (
                <div key={item.id} className="flex items-center gap-3 text-xs">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    item.status === 'completed' ? 'bg-[#5A7A2A]' :
                    item.status === 'in_progress' ? 'bg-primary' : 'bg-muted-foreground/40'
                  }`} />
                  <span className="flex-1">{item.title}</span>
                  <span className="font-sans text-muted-foreground">{item.progressPercent}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
