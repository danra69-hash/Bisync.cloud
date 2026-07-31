import {
  forwardRef,
  useRef,
  type ForwardedRef,
  type ReactNode,
  type UIEventHandler,
} from 'react';
import { TABLE_SCROLL_CLS } from '../layout/pageLayout';
import { useTableColumnResize } from '../../hooks/useTableColumnResize';
import { ResizableTableProvider } from './ResizableTableContext';

type Props = {
  children: ReactNode;
  className?: string;
  onScroll?: UIEventHandler<HTMLDivElement>;
  /**
   * Stable id for persisted column widths. When omitted, widths are keyed by
   * route path + table order + header labels.
   */
  tableId?: string;
  /** Set false to disable drag-to-resize for this table. Default true. */
  columnResize?: boolean;
};

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

const TableScrollContainerInner = forwardRef<HTMLDivElement, Props>(
  function TableScrollContainerInner(
    { children, className = TABLE_SCROLL_CLS, onScroll, tableId, columnResize = true },
    ref,
  ) {
    const localRef = useRef<HTMLDivElement | null>(null);
    useTableColumnResize(localRef, tableId, columnResize);

    return (
      <div
        ref={node => {
          localRef.current = node;
          assignRef(ref, node);
        }}
        className={className}
        data-table-scroll
        data-table-id={tableId || undefined}
        data-column-resize={columnResize ? 'true' : 'false'}
        onScroll={onScroll}
      >
        {children}
      </div>
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
