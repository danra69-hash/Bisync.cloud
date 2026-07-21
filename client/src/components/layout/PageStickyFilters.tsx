import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  /** Optional solid background override (defaults to blurred page background). */
  opaque?: boolean;
};

/**
 * Sticky strip for page-level filters / toolbars under the app header (and module bar when present).
 * Pair with `data-app-main` on `<main>` — CSS sets the correct `top` offset.
 */
export function PageStickyFilters({ children, className = '', opaque = false }: Props) {
  return (
    <div
      data-page-filters
      className={[
        opaque ? 'bg-background' : 'bg-background/95 backdrop-blur-sm',
        'border-b border-border/60',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
