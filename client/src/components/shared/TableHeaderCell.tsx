import type { ReactNode, ThHTMLAttributes } from 'react';
import {
  TABLE_HEADER_LABEL_CLS,
  tableHeaderCls,
  tableHeaderCompactCls,
} from './tableHeaderStyles';

type Props = Omit<ThHTMLAttributes<HTMLTableCellElement>, 'align'> & {
  children: ReactNode;
  headerAlign?: 'left' | 'center' | 'right';
  compact?: boolean;
  /** Stable key for persisted column width when used inside TableScrollContainer. */
  columnKey?: string;
};

export function TableHeaderCell({
  children,
  headerAlign = 'left',
  compact = false,
  className = '',
  columnKey,
  ...rest
}: Props) {
  const cls = compact
    ? tableHeaderCompactCls(headerAlign, className)
    : tableHeaderCls(headerAlign, className);

  return (
    <th {...rest} {...(columnKey ? { 'data-col-key': columnKey } : null)} className={cls}>
      <span className={TABLE_HEADER_LABEL_CLS}>{children}</span>
    </th>
  );
}
