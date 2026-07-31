import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  clampTableColumnWidth,
  loadTableColumnWidths,
  saveTableColumnWidths,
  type TableColumnWidthMap,
} from '../../data/tableColumnPrefs';

type ResizableTableContextValue = {
  tableId: string | null;
  widths: TableColumnWidthMap;
  /** Bind an auto-resolved or explicit table id and load its saved widths. */
  bindTableId: (id: string) => void;
  setColumnWidth: (columnKey: string, widthPx: number) => void;
};

const ResizableTableContext = createContext<ResizableTableContextValue | null>(null);

export function ResizableTableProvider({
  tableId: explicitTableId,
  children,
}: {
  tableId?: string;
  children: ReactNode;
}) {
  const [tableId, setTableId] = useState<string | null>(explicitTableId ?? null);
  const [widths, setWidths] = useState<TableColumnWidthMap>(() =>
    explicitTableId ? loadTableColumnWidths(explicitTableId) : {},
  );

  useEffect(() => {
    if (!explicitTableId) return;
    setTableId(explicitTableId);
    setWidths(loadTableColumnWidths(explicitTableId));
  }, [explicitTableId]);

  const bindTableId = useCallback((id: string) => {
    if (!id) return;
    setTableId(prev => {
      if (prev === id) return prev;
      setWidths(loadTableColumnWidths(id));
      return id;
    });
  }, []);

  const setColumnWidth = useCallback(
    (columnKey: string, widthPx: number) => {
      if (!tableId || !columnKey) return;
      const next = {
        ...loadTableColumnWidths(tableId),
        [columnKey]: clampTableColumnWidth(widthPx),
      };
      saveTableColumnWidths(tableId, next);
      setWidths(next);
    },
    [tableId],
  );

  const value = useMemo(
    () => ({ tableId, widths, bindTableId, setColumnWidth }),
    [tableId, widths, bindTableId, setColumnWidth],
  );

  return (
    <ResizableTableContext.Provider value={value}>{children}</ResizableTableContext.Provider>
  );
}

export function useResizableTable(): ResizableTableContextValue | null {
  return useContext(ResizableTableContext);
}

/** Prefer persisted px width when present. */
export function resolveColumnWidthStyle(
  columnKey: string | undefined,
  baseStyle: CSSProperties | undefined,
  widths: TableColumnWidthMap | undefined,
): CSSProperties | undefined {
  if (!columnKey || !widths) return baseStyle;
  const px = widths[columnKey];
  if (px == null) return baseStyle;
  const width = `${clampTableColumnWidth(px)}px`;
  return { ...baseStyle, width, minWidth: width };
}
