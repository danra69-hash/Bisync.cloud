/** Right slide-in panels — standard width matches product detail (96vw cap). */
export const SIDE_PANEL_OVERLAY_CLS = 'fixed inset-0 z-40 bg-foreground/10';

/** Platform-standard right panel shell (product detail width). */
export const SIDE_PANEL_SHELL_STANDARD_CLS =
  'fixed top-0 right-0 z-50 h-full w-[min(119vw,96vw)] max-w-[min(119vw,96vw)] bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden';

export const SIDE_PANEL_SHELL_CLS = SIDE_PANEL_SHELL_STANDARD_CLS;

export const SIDE_PANEL_SHELL_WIDE_CLS = SIDE_PANEL_SHELL_STANDARD_CLS;

export const SIDE_PANEL_SHELL_VENDOR_PRODUCTS_CLS = SIDE_PANEL_SHELL_STANDARD_CLS;

export const SIDE_PANEL_SHELL_CREATE_VENDOR_CLS = SIDE_PANEL_SHELL_STANDARD_CLS;

export const SIDE_PANEL_SHELL_OVERFLOW_CLS = SIDE_PANEL_SHELL_STANDARD_CLS;

export const SIDE_PANEL_SHELL_PRODUCT_DETAIL_CLS = SIDE_PANEL_SHELL_STANDARD_CLS;

export const SIDE_PANEL_SHELL_DETAIL_CLS = SIDE_PANEL_SHELL_STANDARD_CLS;

export const SIDE_PANEL_ROOT_CLS = 'fixed inset-0 z-50 flex items-stretch justify-end';

export const SIDE_PANEL_DETAIL_SHELL_CLS = SIDE_PANEL_SHELL_STANDARD_CLS;

/** Platform access / user panel above employee detail (z-50). */
export const NESTED_PANEL_OVERLAY_CLS = 'fixed inset-0 z-[60] bg-foreground/20';
export const NESTED_PANEL_SHELL_WIDE_CLS =
  'fixed top-0 right-0 z-[61] h-full w-[min(119vw,96vw)] max-w-[min(119vw,96vw)] bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden';

/** Modal overlays rendered via portal — above side panels and photo lightbox. */
export const MODAL_OVERLAY_CLS = 'fixed inset-0 bg-black/50 z-[120]';
export const MODAL_SHELL_CLS = 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[121]';

/** Photo preview — below engage/tag modals. */
export const LIGHTBOX_OVERLAY_CLS = 'fixed inset-0 bg-black/50 z-[108]';
export const LIGHTBOX_SHELL_CLS = 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[109]';

/** Detail panel above vendor product panel and modals. */
export const DETAIL_PANEL_OVERLAY_ELEVATED_CLS = 'fixed inset-0 z-[104] bg-foreground/10';
export const DETAIL_PANEL_SHELL_ELEVATED_CLS =
  'fixed top-0 right-0 z-[105] h-full w-[min(119vw,96vw)] max-w-[min(119vw,96vw)] bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden';
