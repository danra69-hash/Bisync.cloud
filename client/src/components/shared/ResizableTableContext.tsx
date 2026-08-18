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
  clearTableColumnWidths,
  clampTableColumnWidth,
  loadTableColumnWidths,
  saveTableColumnWidths,
  type TableColumnWidthMap,
} from '../../data/tableColumnPrefs';

type ResizableTableContextValue = {
  tableId: string | null;
  widths: TableColumnWidthMap;
  /** When true, header edges can be dragged to resize. */
  adjustMode: boolean;
  /** Bind an auto-resolved or explicit table id and load its saved widths. */
  bindTableId: (id: string) => void;
  /**
   * Update a column width in the working draft.
   * Pass `persist: true` to write through to localStorage immediately
   * (used outside adjust mode). In adjust mode, widths stay draft until Save.
   */
  setColumnWidth: (columnKey: string, widthPx: number, options?: { persist?: boolean }) => void;
  setAdjustMode: (on: boolean) => void;
  /** Seed the draft from a DOM snapshot and enter adjust mode. */
  beginAdjustments: (snapshot?: TableColumnWidthMap) => void;
  /** Persist the current draft widths (optionally merged with a DOM snapshot) and leave adjust mode. */
  saveAdjustments: (snapshot?: TableColumnWidthMap) => void;
  /** Discard draft widths, reload saved prefs, leave adjust mode. */
  cancelAdjustments: () => void;
  /** Clear saved widths for this table and leave adjust mode. */
  resetColumnWidths: () => void;
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
  const [adjustMode, setAdjustModeState] = useState(false);

  useEffect(() => {
    if (!explicitTableId) return;
    setTableId(explicitTableId);
    setWidths(loadTableColumnWidths(explicitTableId));
    setAdjustModeState(false);
  }, [explicitTableId]);

  const bindTableId = useCallback((id: string) => {
    if (!id) return;
    setTableId(prev => {
      if (prev === id) return prev;
      setWidths(loadTableColumnWidths(id));
      setAdjustModeState(false);
      return id;
    });
  }, []);

  const setColumnWidth = useCallback(
    (columnKey: string, widthPx: number, options?: { persist?: boolean }) => {
      if (!tableId || !columnKey) return;
      const clamped = clampTableColumnWidth(widthPx);
      setWidths(prev => {
        const next = { ...prev, [columnKey]: clamped };
        if (options?.persist) {
          saveTableColumnWidths(tableId, next);
        }
        return next;
      });
    },
    [tableId],
  );

  const setAdjustMode = useCallback((on: boolean) => {
    setAdjustModeState(on);
  }, []);

  const beginAdjustments = useCallback((snapshot?: TableColumnWidthMap) => {
    if (snapshot && Object.keys(snapshot).length > 0) {
      setWidths(prev => ({ ...prev, ...snapshot }));
    }
    setAdjustModeState(true);
  }, []);

  const saveAdjustments = useCallback((snapshot?: TableColumnWidthMap) => {
    if (!tableId) {
      setAdjustModeState(false);
      return;
    }
    setWidths(prev => {
      const next = snapshot && Object.keys(snapshot).length > 0
        ? { ...prev, ...snapshot }
        : { ...prev };
      saveTableColumnWidths(tableId, next);
      return next;
    });
    setAdjustModeState(false);
  }, [tableId]);

  const cancelAdjustments = useCallback(() => {
    if (tableId) {
      setWidths(loadTableColumnWidths(tableId));
    } else {
      setWidths({});
    }
    setAdjustModeState(false);
  }, [tableId]);

  const resetColumnWidths = useCallback(() => {
    if (tableId) {
      clearTableColumnWidths(tableId);
    }
    setWidths({});
    setAdjustModeState(false);
  }, [tableId]);

  const value = useMemo(
    () => ({
      tableId,
      widths,
      adjustMode,
      bindTableId,
      setColumnWidth,
      setAdjustMode,
      beginAdjustments,
      saveAdjustments,
      cancelAdjustments,
      resetColumnWidths,
    }),
    [
      tableId,
      widths,
      adjustMode,
      bindTableId,
      setColumnWidth,
      setAdjustMode,
      beginAdjustments,
      saveAdjustments,
      cancelAdjustments,
      resetColumnWidths,
    ],
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
