import { useEffect, type RefObject } from 'react';
import {
  clampTableColumnWidth,
  type TableColumnWidthMap,
} from '../data/tableColumnPrefs';
import { useResizableTable } from '../components/shared/ResizableTableContext';

const EDGE_PX = 8;
const MIN_WIDTH_PX = 48;

function headerFingerprint(table: HTMLTableElement): string {
  const row =
    table.querySelector('thead tr:last-child') ??
    table.querySelector('thead tr');
  if (!row) return 'empty';
  const ths = [...row.children].filter(
    (el): el is HTMLTableCellElement => el instanceof HTMLTableCellElement && el.tagName === 'TH',
  );
  return ths
    .map(th => (th.dataset.colKey || th.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40))
    .join('|');
}

function resolveAutoTableId(container: HTMLElement, table: HTMLTableElement): string {
  const path =
    typeof window !== 'undefined'
      ? window.location.pathname.replace(/\/+$/, '') || '/'
      : '/';
  const scrolls = [...document.querySelectorAll<HTMLElement>('[data-table-scroll]')];
  const index = Math.max(0, scrolls.indexOf(container));
  return `${path}::${index}::${headerFingerprint(table)}`;
}

function listHeaderCells(table: HTMLTableElement): HTMLTableCellElement[] {
  const row =
    table.querySelector('thead tr:last-child') ??
    table.querySelector('thead tr');
  if (!row) return [];
  return [...row.children].filter(
    (el): el is HTMLTableCellElement =>
      el instanceof HTMLTableCellElement &&
      el.tagName === 'TH' &&
      (el.colSpan == null || el.colSpan <= 1),
  );
}

function ensureColKeys(table: HTMLTableElement, ths: HTMLTableCellElement[]) {
  let colgroup = table.querySelector('colgroup');
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    table.insertBefore(colgroup, table.firstChild);
  }
  while (colgroup.children.length < ths.length) {
    colgroup.appendChild(document.createElement('col'));
  }
  const cols = [...colgroup.children].filter(
    (el): el is HTMLTableColElement => el instanceof HTMLTableColElement,
  );
  ths.forEach((th, index) => {
    const col = cols[index];
    if (!col) return;
    const key = th.dataset.colKey || col.dataset.colKey || `c${index}`;
    th.dataset.colKey = key;
    col.dataset.colKey = key;
  });
  return cols;
}

function hitResizeEdge(th: HTMLTableCellElement, clientX: number): boolean {
  const rect = th.getBoundingClientRect();
  return clientX >= rect.right - EDGE_PX && clientX <= rect.right + 2;
}

function applyWidthMap(table: HTMLTableElement, widths: TableColumnWidthMap) {
  const ths = listHeaderCells(table);
  const cols = ensureColKeys(table, ths);
  ths.forEach((th, index) => {
    const col = cols[index];
    if (!col) return;
    const key = th.dataset.colKey || col.dataset.colKey || `c${index}`;
    const px = widths[key];
    if (px == null) {
      col.style.removeProperty('width');
      col.style.removeProperty('min-width');
      return;
    }
    const width = `${clampTableColumnWidth(px)}px`;
    col.style.width = width;
    col.style.minWidth = width;
  });
}

/**
 * Applies saved/draft column widths. Drag-to-resize is only active while
 * ResizableTableProvider.adjustMode is true.
 */
export function useTableColumnResize(
  containerRef: RefObject<HTMLElement | null>,
  explicitTableId?: string,
  enabled = true,
) {
  const ctx = useResizableTable();
  const bindTableId = ctx?.bindTableId;
  const setColumnWidth = ctx?.setColumnWidth;
  const adjustMode = ctx?.adjustMode ?? false;
  const widths = ctx?.widths;

  // Always bind table id + apply current width map (including when not adjusting).
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container || !bindTableId) return;

    const bindId = () => {
      const table = container.querySelector('table');
      if (!table) return null;
      const ths = listHeaderCells(table);
      if (ths.length === 0) return null;
      ensureColKeys(table, ths);
      const id = explicitTableId?.trim() || resolveAutoTableId(container, table);
      container.dataset.tableId = id;
      bindTableId(id);
      return table;
    };

    bindId();
    const observer = new MutationObserver(() => {
      bindId();
    });
    observer.observe(container, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [containerRef, explicitTableId, enabled, bindTableId]);

  // Re-apply width map whenever draft/saved widths change.
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container || !widths) return;
    const table = container.querySelector('table');
    if (!table) return;
    applyWidthMap(table, widths);
  }, [containerRef, enabled, widths]);

  // Pointer drag only while adjust mode is on.
  useEffect(() => {
    if (!enabled || !adjustMode) return;
    const container = containerRef.current;
    if (!container || !setColumnWidth) return;

    let dragging:
      | {
          col: HTMLTableColElement;
          key: string;
          startX: number;
          startWidth: number;
        }
      | null = null;

    const onMove = (event: PointerEvent) => {
      if (dragging) {
        const delta = event.clientX - dragging.startX;
        const next = clampTableColumnWidth(dragging.startWidth + delta);
        const width = `${next}px`;
        dragging.col.style.width = width;
        dragging.col.style.minWidth = width;
        event.preventDefault();
        return;
      }
      const table = container.querySelector('table');
      if (!table) {
        container.classList.remove('is-col-resize-hover');
        return;
      }
      const over = listHeaderCells(table).some(th => hitResizeEdge(th, event.clientX));
      container.classList.toggle('is-col-resize-hover', over);
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const th = target.closest('th');
      if (!(th instanceof HTMLTableCellElement) || !container.contains(th)) return;
      if (!hitResizeEdge(th, event.clientX)) return;

      const table = container.querySelector('table');
      if (!table) return;
      const ths = listHeaderCells(table);
      const index = ths.indexOf(th);
      if (index < 0) return;
      const cols = ensureColKeys(table, ths);
      const col = cols[index];
      if (!col) return;

      const startWidth = Math.max(MIN_WIDTH_PX, th.getBoundingClientRect().width);
      col.style.width = `${Math.round(startWidth)}px`;
      col.style.minWidth = `${Math.round(startWidth)}px`;

      dragging = {
        col,
        key: th.dataset.colKey || col.dataset.colKey || `c${index}`,
        startX: event.clientX,
        startWidth,
      };
      container.classList.add('is-col-resizing');
      container.classList.remove('is-col-resize-hover');
      event.preventDefault();
      event.stopPropagation();
    };

    const endDrag = () => {
      if (!dragging) return;
      const width = Number.parseFloat(dragging.col.style.width);
      if (Number.isFinite(width)) {
        // Draft only — Save button commits to localStorage.
        setColumnWidth(dragging.key, width, { persist: false });
      }
      dragging = null;
      container.classList.remove('is-col-resizing');
    };

    container.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    return () => {
      container.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      container.classList.remove('is-col-resizing', 'is-col-resize-hover');
    };
  }, [containerRef, enabled, adjustMode, setColumnWidth]);
}

/** Snapshot every col width currently applied on the table into a map. */
export function snapshotTableColumnWidths(container: HTMLElement | null): TableColumnWidthMap {
  if (!container) return {};
  const table = container.querySelector('table');
  if (!table) return {};
  const ths = listHeaderCells(table);
  const cols = ensureColKeys(table, ths);
  const out: TableColumnWidthMap = {};
  ths.forEach((th, index) => {
    const col = cols[index];
    if (!col) return;
    const key = th.dataset.colKey || col.dataset.colKey || `c${index}`;
    const fromStyle = Number.parseFloat(col.style.width);
    const px = Number.isFinite(fromStyle)
      ? fromStyle
      : th.getBoundingClientRect().width;
    if (Number.isFinite(px) && px > 0) {
      out[key] = clampTableColumnWidth(px);
    }
  });
  return out;
}
