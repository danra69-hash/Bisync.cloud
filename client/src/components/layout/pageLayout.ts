/** Full-width shell — expands with the browser; no max-width cap. */
export const PAGE_SHELL_CLS = 'w-full min-w-0 max-w-none';

export const PAGE_PADDING_CLS = 'p-2 sm:p-3';

/**
 * Shared content frame for app shells (Dev Console, portals, payroll).
 * Always stretch to the browser width; only horizontal padding is fixed.
 */
export const CONTENT_FRAME_CLS = 'w-full max-w-none min-w-0 px-4 sm:px-6';

/**
 * Vertical (and when needed horizontal) scroll region for data tables.
 * Height leaves room for sticky app header + module bar + page filters.
 */
export const TABLE_SCROLL_CLS =
  'overflow-x-auto rounded-lg border border-border bg-card max-h-[calc(100dvh-var(--app-chrome-offset))] overflow-y-auto w-full min-w-0';

/** Sticky module nav (Rev Mgmt / POS) — use with data-module-bar. */
export const MODULE_BAR_STICKY_CLS =
  'sticky top-0 z-20 bg-card border-b border-border';

/**
 * Fit tables to container width. Prefer pairing with `<TableColGroup />` so
 * `table-layout: fixed` is activated by CSS `:has(colgroup)`.
 */
export const DATA_TABLE_CLS = 'w-full border-collapse';

/** Compact table header / cell helpers (override with CSS when inside data-table-scroll). */
export const TABLE_TH_CLS =
  'text-left px-2 py-1 text-[11px] font-sans uppercase tracking-wide text-muted-foreground font-semibold break-words';

export const TABLE_TD_CLS = 'px-2 py-1 align-top text-xs min-w-0 break-words [overflow-wrap:anywhere]';

/** Narrow action / toggle / photo columns that should not flex. */
export const TABLE_COL_PHOTO = { style: { width: '72px' }, className: 'w-[72px]' } as const;
export const TABLE_COL_ACTION = { style: { width: '88px' }, className: 'w-[88px]' } as const;
export const TABLE_COL_TOGGLE = { style: { width: '72px' }, className: 'w-[72px]' } as const;
export const TABLE_COL_CHECK = { style: { width: '48px' }, className: 'w-12' } as const;

type ShellOptions = {
  embedded?: boolean;
  spacing?: 'tight' | 'default' | 'loose' | 'wide';
};

const SPACING_CLS: Record<NonNullable<ShellOptions['spacing']>, string> = {
  tight: 'space-y-1.5',
  default: 'space-y-2.5',
  loose: 'space-y-3',
  wide: 'space-y-4',
};

export function pageShellClass({ embedded = false, spacing = 'default' }: ShellOptions = {}): string {
  const spaceCls = SPACING_CLS[spacing];
  return embedded
    ? `${PAGE_SHELL_CLS} ${spaceCls}`
    : `${PAGE_SHELL_CLS} ${PAGE_PADDING_CLS} ${spaceCls}`;
}

/** Full-bleed content frame with optional extra classes. */
export function contentFrameClass(...extra: Array<string | false | null | undefined>): string {
  return [CONTENT_FRAME_CLS, ...extra.filter(Boolean)].join(' ');
}

