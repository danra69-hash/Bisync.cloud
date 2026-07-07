import { useCallback, useState } from 'react';
import type { SortDirection } from '../utils/tableSort';

type SortState<T extends string> = {
  column: T | null;
  direction: SortDirection;
};

/**
 * Table sort state shared across the platform.
 * First header click: ascending. Second click on same header: descending. Alternates thereafter.
 * Switching to a different column always starts at ascending.
 */
export function useTableSort<T extends string>(initialColumn: T | null = null, initialDirection: SortDirection = 'asc') {
  const [sort, setSort] = useState<SortState<T>>({
    column: initialColumn,
    direction: initialDirection,
  });

  const toggleSort = useCallback((column: T) => {
    setSort(prev => {
      if (prev.column === column) {
        return {
          column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { column, direction: 'asc' };
    });
  }, []);

  const resetSort = useCallback(() => {
    setSort({ column: initialColumn, direction: initialDirection });
  }, [initialColumn, initialDirection]);

  return {
    sortColumn: sort.column,
    sortDirection: sort.direction,
    toggleSort,
    resetSort,
    setSortColumn: (column: T | null) => setSort(prev => ({ ...prev, column })),
    setSortDirection: (direction: SortDirection) => setSort(prev => ({ ...prev, direction })),
  };
}
