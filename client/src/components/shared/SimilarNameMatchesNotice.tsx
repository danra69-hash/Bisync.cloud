import type { SimilarNameMatch } from '../../utils/catalogNameMatch';

type Props = {
  matches: SimilarNameMatch[];
  entityLabel: 'product' | 'component';
  className?: string;
};

/**
 * Inline notice listing exact/similar catalog names with Active/Inactive status.
 */
export function SimilarNameMatchesNotice({ matches, entityLabel, className = '' }: Props) {
  if (matches.length === 0) return null;

  const hasExact = matches.some(match => match.kind === 'exact');
  const title = hasExact
    ? `Matching ${entityLabel}${matches.length > 1 ? 's' : ''} already exist — use an existing one or rename.`
    : `Similar ${entityLabel}${matches.length > 1 ? 's' : ''} found — check before creating a duplicate.`;

  return (
    <div
      className={`mt-1.5 rounded-md border px-2.5 py-2 text-xs ${
        hasExact
          ? 'border-destructive/40 bg-destructive/5 text-destructive'
          : 'border-amber-500/40 bg-amber-500/5 text-foreground'
      } ${className}`}
      role="status"
    >
      <p className={`font-medium ${hasExact ? 'text-destructive' : 'text-amber-800 dark:text-amber-200'}`}>
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {matches.map(match => (
          <li
            key={`${match.id ?? match.code ?? match.name}-${match.name}-${match.kind}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
          >
            <span className="font-medium text-foreground">{match.name}</span>
            {match.code ? (
              <span className="text-muted-foreground tabular-nums">{match.code}</span>
            ) : null}
            {match.kindLabel ? (
              <span className="text-muted-foreground">{match.kindLabel}</span>
            ) : null}
            <span
              className={
                match.active
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-muted-foreground'
              }
            >
              {match.active ? 'Active' : 'Inactive'}
            </span>
            {match.kind === 'exact' ? (
              <span className="text-[10px] uppercase tracking-wide text-destructive">Exact</span>
            ) : (
              <span className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">Similar</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
