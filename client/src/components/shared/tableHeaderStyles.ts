/** Table `<th>` shell — no line-clamp here (breaks table layout). */
export const TABLE_HEADER_CELL_CLS =
  'text-xs font-sans font-normal text-muted-foreground align-top whitespace-normal min-w-0 text-center';

/** Inner label — wraps at words, up to 2 lines, tight leading, centered. */
export const TABLE_HEADER_LABEL_CLS =
  'block w-full leading-[1.15] break-words [overflow-wrap:anywhere] line-clamp-2 text-center';

export function tableHeaderCls(
  _align: 'left' | 'center' | 'right' = 'center',
  extra = '',
): string {
  // Column titles are centered system-wide (align arg kept for API compatibility).
  return `px-3 py-1.5 ${TABLE_HEADER_CELL_CLS} text-center ${extra}`.trim().replace(/\s+/g, ' ');
}

export function tableHeaderCompactCls(
  _align: 'left' | 'center' | 'right' = 'center',
  extra = '',
): string {
  return `px-2 py-1.5 ${TABLE_HEADER_CELL_CLS} text-center ${extra}`.trim().replace(/\s+/g, ' ');
}

export const tableHeaderSortBtnCls =
  'max-w-full w-full text-center hover:text-foreground transition-colors inline-flex items-start justify-center gap-1';

export const tableHeaderSortLabelCls = `${TABLE_HEADER_LABEL_CLS} text-xs font-normal`;
