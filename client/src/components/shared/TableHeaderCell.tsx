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
};

export function TableHeaderCell({
  children,
  headerAlign = 'left',
  compact = false,
  className = '',
  ...rest
}: Props) {
  const cls = compact
    ? tableHeaderCompactCls(headerAlign, className)
    : tableHeaderCls(headerAlign, className);

  return (
    <th {...rest} className={cls}>
      <span className={TABLE_HEADER_LABEL_CLS}>{children}</span>
    </th>
  );
}
