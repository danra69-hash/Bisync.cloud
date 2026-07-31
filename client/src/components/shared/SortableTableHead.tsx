import type { CSSProperties, ReactNode } from 'react';
import type { SortDirection } from '../../utils/tableSort';
import {
  resolveColumnWidthStyle,
  useResizableTable,
} from './ResizableTableContext';
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

/** Build style for a column width (px number or CSS length / %). */
export function tableColWidth(width: string | number): Pick<SortableColumnDef<string>, 'style'> {
  const value = typeof width === 'number' ? `${width}px` : width;
  return { style: { width: value } };
}

/** Renders `<colgroup>` so scroll tables opt into balanced `table-layout: fixed`. */
export function TableColGroup<T extends string>({
  columns,
}: {
  columns: readonly SortableColumnDef<T>[];
}) {
  const resize = useResizableTable();
  return (
    <colgroup>
      {columns.map(column => (
        <col
          key={column.key}
          data-col-key={column.key}
          style={resolveColumnWidthStyle(column.key, column.style, resize?.widths)}
          className={column.className}
        />
      ))}
    </colgroup>
  );
}

/** Simple `<colgroup>` from width list (%, px number, or CSS length). Use for non-sortable tables. */
export function ColGroup({
  widths,
  columnKeys,
}: {
  widths: readonly (string | number | undefined | null)[];
  /** Optional stable keys for persisted column widths (defaults to c0, c1, …). */
  columnKeys?: readonly string[];
}) {
  const resize = useResizableTable();
  return (
    <colgroup>
      {widths.map((width, index) => {
        const key = columnKeys?.[index] || `c${index}`;
        const baseStyle =
          width == null || width === ''
            ? undefined
            : { width: typeof width === 'number' ? `${width}px` : width };
        return (
          <col
            key={key}
            data-col-key={key}
            style={resolveColumnWidthStyle(key, baseStyle, resize?.widths)}
          />
        );
      })}
    </colgroup>
  );
}

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
  align = 'left',
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
        data-col-key={column}
        style={style}
        className={tableHeaderCls(align, className)}
      >
        {content}
      </th>
    );
  }

  return (
    <th
      rowSpan={rowSpan}
      colSpan={colSpan}
      data-col-key={column}
      aria-sort={ariaSort}
      style={style}
      className={tableHeaderCls(align, className)}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        title={active ? (sortDirection === 'asc' ? 'Sorted ascending — click for descending' : 'Sorted descending — click for ascending') : 'Sort ascending'}
        className={`${tableHeaderSortBtnCls} ${
          active ? 'text-foreground' : 'text-muted-foreground'
        } ${align === 'right' ? 'ml-auto text-right' : align === 'center' ? 'mx-auto text-center' : 'text-left'}`}
      >
        {header ? (
          <span className="min-w-0 flex-1">{header}</span>
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
  className = 'text-left border-b border-border',
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
