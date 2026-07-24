/** High-contrast shell for text inputs, selects, and number fields. */
export const fieldCls =
  'bg-card border-2 border-border rounded-md px-2 py-1 min-h-8 text-sm font-semibold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary w-full';

export const inputCls = fieldCls;

export const selectCls = `${fieldCls} cursor-pointer`;

/** Standalone number fields sized for 9999.9999 (4 digits + 4 decimals). */
export const numberCls = 'bisync-number-field';

/** Toolbar / filter dropdowns — slightly smaller but still readable. */
export const filterSelectCls = 'bisync-filter-select';

export const filterInputCls = 'bisync-filter-input';

/** Inline numeric cells (order qty, prices, etc.) — min width fits 9999.9999. */
export const inlineNumberCls = 'bisync-inline-number';
