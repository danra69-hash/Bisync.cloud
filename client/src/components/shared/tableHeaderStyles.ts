/** Table `<th>` shell — no line-clamp here (breaks table layout). */
export const TABLE_HEADER_CELL_CLS =
  'text-xs font-sans font-normal text-muted-foreground align-top whitespace-normal min-w-0';

/** Inner label — wraps at words, up to 2 lines, tight leading. */
export const TABLE_HEADER_LABEL_CLS =
  'block w-full leading-[1.15] break-words [overflow-wrap:anywhere] line-clamp-2';

export function tableHeaderCls(
  align: 'left' | 'center' | 'right' = 'left',
  extra = '',
): string {
  const alignCls =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return `px-3 py-1.5 ${TABLE_HEADER_CELL_CLS} ${alignCls} ${extra}`.trim().replace(/\s+/g, ' ');
}

export function tableHeaderCompactCls(
  align: 'left' | 'center' | 'right' = 'left',
  extra = '',
): string {
  const alignCls =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return `px-2 py-1.5 ${TABLE_HEADER_CELL_CLS} ${alignCls} ${extra}`.trim().replace(/\s+/g, ' ');
}

export const tableHeaderSortBtnCls =
  'max-w-full w-full text-left hover:text-foreground transition-colors inline-flex items-start gap-1';

export const tableHeaderSortLabelCls = `${TABLE_HEADER_LABEL_CLS} text-xs font-normal`;
