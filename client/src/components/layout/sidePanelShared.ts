/** Right slide-in panels — 30% wider than original 480px / 560px / max-w-3xl layouts. */
export const SIDE_PANEL_OVERLAY_CLS = 'fixed inset-0 z-40 bg-foreground/10';

export const SIDE_PANEL_SHELL_CLS =
  'fixed top-0 right-0 h-full w-[624px] max-w-full bg-card border-l border-border z-50 flex flex-col shadow-2xl';

export const SIDE_PANEL_SHELL_WIDE_CLS =
  'fixed top-0 right-0 h-full w-[728px] max-w-full bg-card border-l border-border z-50 flex flex-col shadow-2xl';

export const SIDE_PANEL_SHELL_OVERFLOW_CLS = `${SIDE_PANEL_SHELL_CLS} overflow-hidden`;

export const SIDE_PANEL_ROOT_CLS = 'fixed inset-0 z-50 flex items-stretch justify-end';

export const SIDE_PANEL_DETAIL_SHELL_CLS =
  'relative w-full max-w-[998px] bg-card border-l border-border shadow-2xl flex flex-col max-h-full';
