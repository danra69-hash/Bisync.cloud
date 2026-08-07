import {
  forwardRef,
  useRef,
  type ForwardedRef,
  type ReactNode,
  type UIEventHandler,
} from 'react';
import { TABLE_SCROLL_CLS } from '../layout/pageLayout';
import { snapshotTableColumnWidths, useTableColumnResize } from '../../hooks/useTableColumnResize';
import { ResizableTableProvider, useResizableTable } from './ResizableTableContext';
import { TableColumnAdjustControls } from './TableColumnAdjustControls';

type Props = {
  children: ReactNode;
  className?: string;
  onScroll?: UIEventHandler<HTMLDivElement>;
  /**
   * Stable id for persisted column widths. When omitted, widths are keyed by
   * route path + table order + header labels.
   */
  tableId?: string;
  /**
   * When false, hide Adjust column controls and disable resize entirely.
   * Default true.
   */
  columnResize?: boolean;
  /** Show the Adjust column toolbar above the table. Default true when columnResize. */
  showColumnAdjust?: boolean;
};

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

function TableScrollShell({
  children,
  className,
  onScroll,
  tableId,
  columnResize,
  showColumnAdjust,
  forwardedRef,
}: Props & { forwardedRef: ForwardedRef<HTMLDivElement> }) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const ctx = useResizableTable();
  const adjustMode = Boolean(columnResize && ctx?.adjustMode);

  useTableColumnResize(localRef, tableId, columnResize);

  return (
    <>
      {columnResize && showColumnAdjust !== false ? (
        <TableColumnAdjustControls
          className="mb-1.5"
          getSnapshot={() => snapshotTableColumnWidths(localRef.current)}
        />
      ) : null}
      <div
        ref={node => {
          localRef.current = node;
          assignRef(forwardedRef, node);
        }}
        className={className}
        data-table-scroll
        data-table-id={tableId || undefined}
        data-column-resize={adjustMode ? 'true' : 'false'}
        onScroll={onScroll}
      >
        {children}
      </div>
    </>
  );
}

const TableScrollContainerInner = forwardRef<HTMLDivElement, Props>(
  function TableScrollContainerInner(props, ref) {
    const {
      children,
      className = TABLE_SCROLL_CLS,
      onScroll,
      tableId,
      columnResize = true,
      showColumnAdjust,
    } = props;

    return (
      <TableScrollShell
        forwardedRef={ref}
        className={className}
        onScroll={onScroll}
        tableId={tableId}
        columnResize={columnResize}
        showColumnAdjust={showColumnAdjust}
      >
        {children}
      </TableScrollShell>
    );
  },
);

export const TableScrollContainer = forwardRef<HTMLDivElement, Props>(function TableScrollContainer(
  props,
  ref,
) {
  return (
    <ResizableTableProvider tableId={props.tableId}>
      <TableScrollContainerInner {...props} ref={ref} />
    </ResizableTableProvider>
  );
});
