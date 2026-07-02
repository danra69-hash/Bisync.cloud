/** Right slide-in panels — 30% wider than original 480px / 560px / max-w-3xl layouts. */
export const SIDE_PANEL_OVERLAY_CLS = 'fixed inset-0 z-40 bg-foreground/10';

export const SIDE_PANEL_SHELL_CLS =
  'fixed top-0 right-0 h-full w-[624px] max-w-full bg-card border-l border-border z-50 flex flex-col shadow-2xl';

export const SIDE_PANEL_SHELL_WIDE_CLS =
  'fixed top-0 right-0 h-full w-[728px] max-w-full bg-card border-l border-border z-50 flex flex-col shadow-2xl';

/** Vendor product catalog — 50% wider than SIDE_PANEL_SHELL_WIDE_CLS (728px → 1092px). */
export const SIDE_PANEL_SHELL_VENDOR_PRODUCTS_CLS =
  'fixed top-0 right-0 h-full w-[1092px] max-w-full bg-card border-l border-border z-50 flex flex-col shadow-2xl';

/** Create vendor panel — ~70% wider than SIDE_PANEL_SHELL_CLS (624px → 1060px). */
export const SIDE_PANEL_SHELL_CREATE_VENDOR_CLS =
  'fixed top-0 right-0 h-full w-[1060px] max-w-full bg-card border-l border-border z-50 flex flex-col shadow-2xl';

export const SIDE_PANEL_SHELL_OVERFLOW_CLS = `${SIDE_PANEL_SHELL_CLS} overflow-hidden`;

/** Product detail from list — 70% wider than SIDE_PANEL_SHELL_DETAIL_CLS (70vw → 119vw, capped). */
export const SIDE_PANEL_SHELL_PRODUCT_DETAIL_CLS =
  'fixed top-0 right-0 z-50 h-full w-[min(119vw,96vw)] max-w-[min(119vw,96vw)] bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden';

/** Large fixed right panel — 70% viewport width, full height, scrollable body. */
export const SIDE_PANEL_SHELL_DETAIL_CLS =
  'fixed top-0 right-0 z-50 h-full w-[70vw] max-w-[70vw] bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden';

export const SIDE_PANEL_ROOT_CLS = 'fixed inset-0 z-50 flex items-stretch justify-end';

export const SIDE_PANEL_DETAIL_SHELL_CLS =
  'relative w-full max-w-[998px] bg-card border-l border-border shadow-2xl flex flex-col max-h-full';

/** Platform access / user panel above employee detail (z-50). */
export const NESTED_PANEL_OVERLAY_CLS = 'fixed inset-0 z-[60] bg-foreground/20';
export const NESTED_PANEL_SHELL_WIDE_CLS =
  'fixed top-0 right-0 h-full w-[728px] max-w-full bg-card border-l border-border z-[61] flex flex-col shadow-2xl';

/** Modal overlays rendered via portal — above side panels and photo lightbox. */
export const MODAL_OVERLAY_CLS = 'fixed inset-0 bg-black/50 z-[120]';
export const MODAL_SHELL_CLS = 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[121]';

/** Photo preview — below engage/tag modals. */
export const LIGHTBOX_OVERLAY_CLS = 'fixed inset-0 bg-black/50 z-[108]';
export const LIGHTBOX_SHELL_CLS = 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[109]';

/** Detail panel above vendor product panel and modals. */
export const DETAIL_PANEL_OVERLAY_ELEVATED_CLS = 'fixed inset-0 z-[104] bg-foreground/10';
export const DETAIL_PANEL_SHELL_ELEVATED_CLS =
  'fixed top-0 right-0 z-[105] h-full w-[70vw] max-w-[70vw] bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden';
