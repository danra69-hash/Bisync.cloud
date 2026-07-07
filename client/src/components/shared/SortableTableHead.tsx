import type { SortDirection } from '../../utils/tableSort';

export type SortableColumnDef<T extends string> = {
  key: T;
  label: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
  sortable?: boolean;
};

type SortableTableHeadProps<T extends string> = {
  label: string;
  column: T;
  sortColumn: T | null;
  sortDirection: SortDirection;
  onSort: (column: T) => void;
  className?: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  rowSpan?: number;
  colSpan?: number;
};

export function SortableTableHead<T extends string>({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
  className = '',
  align = 'left',
  sortable = true,
  rowSpan,
  colSpan,
}: SortableTableHeadProps<T>) {
  const active = sortColumn === column;
  const alignCls =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const ariaSort = !sortable ? undefined : active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';

  if (!sortable) {
    return (
      <th
        rowSpan={rowSpan}
        colSpan={colSpan}
        className={`px-3 py-2 font-medium text-xs uppercase tracking-wider text-muted-foreground ${alignCls} ${className}`}
      >
        {label}
      </th>
    );
  }

  return (
    <th
      rowSpan={rowSpan}
      colSpan={colSpan}
      aria-sort={ariaSort}
      className={`px-3 py-2 font-medium ${alignCls} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        title={active ? (sortDirection === 'asc' ? 'Sorted ascending — click for descending' : 'Sorted descending — click for ascending') : 'Sort ascending'}
        className={`inline-flex items-center gap-1 uppercase tracking-wider text-xs hover:text-foreground transition-colors ${
          active ? 'text-foreground' : 'text-muted-foreground'
        } ${align === 'right' ? 'ml-auto' : ''}`}
      >
        {label}
        {active ? <span aria-hidden="true">{sortDirection === 'asc' ? '↑' : '↓'}</span> : null}
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
          column={column.key}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={onSort}
          align={column.align}
          className={column.className}
          sortable={column.sortable !== false}
        />
      ))}
    </tr>
  );
}
