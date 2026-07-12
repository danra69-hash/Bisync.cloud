import type { CSSProperties, ReactNode } from 'react';
import type { SortDirection } from '../../utils/tableSort';
import {
  tableHeaderCls,
  tableHeaderSortBtnCls,
  tableHeaderSortLabelCls,
  TABLE_HEADER_LABEL_CLS,
} from './tableHeaderStyles';

export type SortableColumnDef<T extends string> = {
  key: T;
  label: string;
  /** Optional rich header content; falls back to `label` text. */
  header?: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  style?: CSSProperties;
  sortable?: boolean;
};

type SortableTableHeadProps<T extends string> = {
  label: string;
  header?: ReactNode;
  column: T;
  sortColumn: T | null;
  sortDirection: SortDirection;
  onSort: (column: T) => void;
  className?: string;
  style?: CSSProperties;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  rowSpan?: number;
  colSpan?: number;
};

export function SortableTableHead<T extends string>({
  label,
  header,
  column,
  sortColumn,
  sortDirection,
  onSort,
  className = '',
  style,
  align = 'center',
  sortable = true,
  rowSpan,
  colSpan,
}: SortableTableHeadProps<T>) {
  const active = sortColumn === column;
  const ariaSort = !sortable ? undefined : active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
  const content = header ?? <span className={TABLE_HEADER_LABEL_CLS}>{label}</span>;

  if (!sortable) {
    return (
      <th
        rowSpan={rowSpan}
        colSpan={colSpan}
        style={style}
        className={tableHeaderCls('center', className)}
      >
        {content}
      </th>
    );
  }

  return (
    <th
      rowSpan={rowSpan}
      colSpan={colSpan}
      aria-sort={ariaSort}
      style={style}
      className={tableHeaderCls('center', className)}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        title={active ? (sortDirection === 'asc' ? 'Sorted ascending — click for descending' : 'Sorted descending — click for ascending') : 'Sort ascending'}
        className={`${tableHeaderSortBtnCls} ${
          active ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        {header ? (
          <span className="min-w-0 flex-1 text-center">{header}</span>
        ) : (
          <span className={tableHeaderSortLabelCls}>{label}</span>
        )}
        {active ? <span aria-hidden="true" className="shrink-0 leading-none">{sortDirection === 'asc' ? '↑' : '↓'}</span> : null}
      </button>
    </th>
  );
}

type SortableTableHeaderRowProps<T extends string> = {
  columns: readonly SortableColumnDef<T>[];
  sortColumn: T | null;
  sortDirection: SortDirection;
  onSort: (column: T) => void;
  className?: string;
};

export function SortableTableHeaderRow<T extends string>({
  columns,
  sortColumn,
  sortDirection,
  onSort,
  className = 'text-center border-b border-border',
}: SortableTableHeaderRowProps<T>) {
  return (
    <tr className={className}>
      {columns.map(column => (
        <SortableTableHead
          key={column.key}
          label={column.label}
          header={column.header}
          column={column.key}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={onSort}
          align={column.align}
          className={column.className}
          style={column.style}
          sortable={column.sortable !== false}
        />
      ))}
    </tr>
  );
}
