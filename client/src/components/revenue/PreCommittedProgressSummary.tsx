import type { PurchaseOrder } from '../../api';
import {
  formatCommitmentDate,
  resolveCommitmentProgress,
  type CommitmentExpiryTone,
} from '../../data/preCommittedProgress';
import { useCountryFormatters } from '../../hooks/useCountryFormatters';

type Props = {
  order: PurchaseOrder;
  /** Compact single-row for lists; default is a panel block. */
  compact?: boolean;
  className?: string;
};

function expiryClass(tone: CommitmentExpiryTone): string {
  if (tone === 'expired') return 'text-red-700 dark:text-red-400';
  if (tone === 'soon') return 'text-amber-700 dark:text-amber-400';
  return 'text-foreground';
}

function ProgressTrack({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
  return (
    <div className="mt-1.5" title={`${label}: ${pct.toFixed(0)}%`}>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-teal-600/80 dark:bg-teal-400/80 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function PreCommittedProgressSummary({ order, compact = false, className = '' }: Props) {
  const { number } = useCountryFormatters();
  const progress = resolveCommitmentProgress(order);
  const period = [
    formatCommitmentDate(progress.commitmentStartDate),
    formatCommitmentDate(progress.commitmentEndDate),
  ].join(' → ');

  if (compact) {
    return (
      <div className={`text-[11px] leading-relaxed text-muted-foreground ${className}`.trim()}>
        <span className="text-foreground font-medium tabular-nums">
          Issued {number(progress.issued)}
        </span>
        <span className="mx-1.5 text-border">·</span>
        <span className="text-foreground font-medium tabular-nums">
          Received {number(progress.received)} / {number(progress.committed)} committed
        </span>
        <span className="mx-1.5 text-border">·</span>
        <span className={expiryClass(progress.expiryTone)}>{progress.expiryLabel}</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-3 space-y-3 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-teal-900 dark:text-teal-200">
            Commitment progress
          </p>
          <p className="text-[11px] text-teal-800/80 dark:text-teal-300/80 mt-0.5 font-sans">
            Period {period}
          </p>
        </div>
        <p className={`text-[11px] font-medium shrink-0 ${expiryClass(progress.expiryTone)}`}>
          {progress.expiryLabel}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-md border border-teal-500/20 bg-background/60 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Already issued (drawn)
          </p>
          <p className="text-sm font-semibold tabular-nums mt-0.5 font-sans">
            {number(progress.issued)}
            <span className="text-[11px] font-normal text-muted-foreground">
              {' '}/ {number(progress.committed)}
            </span>
          </p>
          <ProgressTrack value={progress.issued} total={progress.committed} label="Issued" />
          <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
            Remaining to issue {number(progress.remainingToIssue)}
          </p>
        </div>

        <div className="rounded-md border border-teal-500/20 bg-background/60 px-3 py-2 sm:col-span-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Received versus total committed
          </p>
          <p className="text-sm font-semibold tabular-nums mt-0.5 font-sans">
            {number(progress.received)}
            <span className="text-[11px] font-normal text-muted-foreground">
              {' '}received of {number(progress.committed)} committed
            </span>
          </p>
          <ProgressTrack value={progress.received} total={progress.committed} label="Received" />
          <p className="text-[10px] text-muted-foreground mt-1">
            Received = qty stocked from drawdown POs (receive / consolidate). Issued = qty already
            drawn onto release POs.
          </p>
        </div>
      </div>
    </div>
  );
}
