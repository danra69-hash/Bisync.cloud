/** High-contrast shell for text inputs, selects, and number fields. */
export const fieldCls =
  'bg-card border-2 border-border rounded-md px-2 py-1 min-h-8 text-sm font-semibold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary w-full';

export const inputCls = fieldCls;

export const selectCls = `${fieldCls} cursor-pointer`;

export const numberCls = `${fieldCls} tabular-nums`;

/** Toolbar / filter dropdowns — slightly smaller but still readable. */
export const filterSelectCls = 'bisync-filter-select';

export const filterInputCls = 'bisync-filter-input';

/** Inline qty cells — sized for at least 5 digits + 2 decimals (99999.99). */
export const inlineNumberCls = 'bisync-inline-number';

/** Inline price cells — same width budget as qty. */
export const inlinePriceCls = 'bisync-inline-price';

/**
 * Width-only utility for ad-hoc qty/price inputs that keep their own border styles.
 * Ensures 99999.99 remains fully visible.
 */
export const qtyPriceWidthCls = 'min-w-[8.5rem] w-[8.5rem] max-w-[10rem] tabular-nums text-right';
