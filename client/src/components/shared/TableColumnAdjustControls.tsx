import { Columns3 } from 'lucide-react';
import type { TableColumnWidthMap } from '../../data/tableColumnPrefs';
import { useResizableTable } from './ResizableTableContext';

type Props = {
  className?: string;
  /** Optional DOM snapshot of current column widths, merged on Save. */
  getSnapshot?: () => TableColumnWidthMap;
};

/**
 * Toggle adjust mode for the nearest ResizableTableProvider table.
 * Drag header edges while adjusting, then Save to keep widths for next visit.
 */
export function TableColumnAdjustControls({ className = '', getSnapshot }: Props) {
  const ctx = useResizableTable();
  if (!ctx) return null;

  const { adjustMode, beginAdjustments, saveAdjustments, cancelAdjustments, resetColumnWidths } = ctx;

  if (!adjustMode) {
    return (
      <div className={`flex items-center justify-end ${className}`.trim()}>
        <button
          type="button"
          onClick={() => beginAdjustments(getSnapshot?.())}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-[11px] font-semibold text-foreground hover:bg-muted/50"
          title="Resize table columns, then save for your next visit"
        >
          <Columns3 size={12} />
          Adjust column
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 ${className}`.trim()}
    >
      <p className="text-[11px] text-muted-foreground">
        Drag the right edge of a column header to resize. Click{' '}
        <span className="font-semibold text-foreground">Save</span> to keep these widths next visit.
      </p>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={resetColumnWidths}
          className="px-2 py-1 rounded-md border border-border text-[11px] font-medium text-muted-foreground hover:bg-muted/50"
          title="Clear saved widths for this table"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={cancelAdjustments}
          className="px-2 py-1 rounded-md border border-border text-[11px] font-medium hover:bg-muted/50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => saveAdjustments(getSnapshot?.())}
          className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90"
        >
          Save
        </button>
      </div>
    </div>
  );
}
