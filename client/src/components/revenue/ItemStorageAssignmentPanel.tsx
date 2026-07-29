import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { sortTableRows } from '../../utils/tableSort';
import { api, type Ingredient, type Product } from '../../api';
import { selectCls, parseDetailConfigJson } from '../../data/componentForm';
import {
  emptyItemStorageAssignment,
  listAreasForLocations,
  listStorageNamesForArea,
  normalizeItemAssignments,
  resolveStorageTypesForNames,
  type ItemStorageAssignment,
  type ItemStorageAssignmentType,
  type StorageAssignmentState,
} from '../../data/storageAssignment';

type AssignmentSortColumn = 'type' | 'name' | 'storageArea' | 'storage1' | 'storage2' | 'storage3';

const ASSIGNMENT_TABLE_COLUMNS: SortableColumnDef<AssignmentSortColumn>[] = [
  { key: 'type', label: 'Type' },
  { key: 'name', label: 'Name' },
  { key: 'storageArea', label: 'Storage Area', sortable: false },
  { key: 'storage1', label: 'Storage 1', sortable: false },
  { key: 'storage2', label: 'Storage 2', sortable: false },
  { key: 'storage3', label: 'Storage 3', sortable: false },
];

function collectSubComponentIds(ingredients: Ingredient[]): Set<string> {
  const ids = new Set<string>();
  for (const ingredient of ingredients) {
    const splitUse = parseDetailConfigJson(ingredient.detailConfigJson).splitUse;
    if (!splitUse?.enabled) continue;
    for (const line of splitUse.lines) {
      if (line.isWaste) continue;
      const childId = (line.childComponentId ?? '').trim().toLowerCase();
      if (childId) ids.add(childId);
    }
  }
  return ids;
}

function buildAssignmentRows(
  ingredients: Ingredient[],
  products: Product[],
  saved: ItemStorageAssignment[],
): ItemStorageAssignment[] {
  const byKey = new Map(saved.map(row => [row.itemKey, row]));
  const subComponentIds = collectSubComponentIds(ingredients);
  const rows: ItemStorageAssignment[] = [];

  for (const ingredient of ingredients) {
    if (ingredient.active === false) continue;
    const componentId = (ingredient.componentId || '').trim();
    if (!componentId) continue;
    const itemKey = `component:${componentId}`;
    const itemType: ItemStorageAssignmentType = subComponentIds.has(componentId.toLowerCase())
      ? 'Sub-component'
      : 'Component';
    const existing = byKey.get(itemKey);
    rows.push({
      ...(existing ?? emptyItemStorageAssignment(itemKey, itemType, ingredient.name)),
      itemKey,
      itemType,
      name: ingredient.name,
    });
  }

  for (const product of products) {
    if (product.active === false) continue;
    const itemKey = `product:${product.id}`;
    let itemType: ItemStorageAssignmentType | null = null;
    if (product.isSubProduct) itemType = 'Sub-product';
    else if (product.b2bEnabled) itemType = 'B2B Product';
    else if (product.b2cEnabled) itemType = 'B2C Product';
    if (!itemType) continue;
    const existing = byKey.get(itemKey);
    rows.push({
      ...(existing ?? emptyItemStorageAssignment(itemKey, itemType, product.name)),
      itemKey,
      itemType,
      name: product.name,
    });
  }

  return rows.sort((a, b) =>
    a.itemType.localeCompare(b.itemType)
    || a.name.localeCompare(b.name),
  );
}

type Props = {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
  locationLabelDisplay: string;
  assignment: StorageAssignmentState;
  onSaveAssignments: (rows: ItemStorageAssignment[]) => Promise<void>;
};

export function ItemStorageAssignmentPanel({
  selectedCompanyId,
  selectedLocationIds,
  locationLabelDisplay,
  assignment,
  onSaveAssignments,
}: Props) {
  const [rows, setRows] = useState<ItemStorageAssignment[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const areaOptions = useMemo(
    () => listAreasForLocations(assignment, selectedLocationIds),
    [assignment, selectedLocationIds],
  );

  useEffect(() => {
    if (!selectedCompanyId) {
      setRows([]);
      setIngredients([]);
      setDirty(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      api.ingredients(selectedCompanyId).catch(() => [] as Ingredient[]),
      api.products(selectedCompanyId).catch(() => [] as Product[]),
    ]).then(([nextIngredients, nextProducts]) => {
      if (cancelled) return;
      setIngredients(nextIngredients);
      setRows(buildAssignmentRows(
        nextIngredients,
        nextProducts,
        normalizeItemAssignments(assignment.itemAssignments),
      ));
      setDirty(false);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCompanyId, assignment.itemAssignments, assignment.entries, assignment.areas]);

  const {
    sortColumn,
    sortDirection,
    toggleSort,
    resetSort,
  } = useTableSort<AssignmentSortColumn>('type');

  useEffect(() => {
    resetSort();
  }, [selectedCompanyId, selectedLocationIds, resetSort]);

  const sortedRows = useMemo(
    () =>
      sortTableRows(rows, sortColumn, sortDirection, {
        type: row => row.itemType,
        name: row => row.name,
        storageArea: row => row.storageArea,
      }),
    [rows, sortColumn, sortDirection],
  );

  const scroll = useInfiniteScrollSlice(sortedRows, { scrollRootRef: scrollRef });

  function patchRow(itemKey: string, patch: Partial<ItemStorageAssignment>) {
    setRows(prev => prev.map(row => {
      if (row.itemKey !== itemKey) return row;
      const next = { ...row, ...patch };
      if (patch.storageArea !== undefined && patch.storageArea !== row.storageArea) {
        const names = new Set(listStorageNamesForArea(assignment, selectedLocationIds, next.storageArea));
        if (!names.has(next.storage1)) next.storage1 = '';
        if (!names.has(next.storage2)) next.storage2 = '';
        if (!names.has(next.storage3)) next.storage3 = '';
      }
      return next;
    }));
    setDirty(true);
    setError(null);
  }

  async function save() {
    if (!selectedCompanyId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSaveAssignments(rows);

      // Keep component StorageJson types in sync so Inventory filters still work.
      const ingredientByComponentId = new Map(
        ingredients.map(ingredient => [ingredient.componentId.trim().toLowerCase(), ingredient]),
      );
      for (const row of rows) {
        if (!row.itemKey.startsWith('component:')) continue;
        const componentId = row.itemKey.slice('component:'.length).trim().toLowerCase();
        const ingredient = ingredientByComponentId.get(componentId);
        if (!ingredient) continue;
        const types = resolveStorageTypesForNames(
          assignment,
          selectedLocationIds,
          row.storageArea,
          [row.storage1, row.storage2, row.storage3],
        );
        const nextJson = JSON.stringify(types);
        if ((ingredient.storageJson || '[]') === nextJson) continue;
        await api.updateIngredient(ingredient.id, {
          ...ingredient,
          storageJson: nextJson,
        });
        ingredient.storageJson = nextJson;
      }

      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save storage assignment.');
    } finally {
      setSaving(false);
    }
  }

  if (!selectedCompanyId || selectedLocationIds.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Select a company and at least one location to assign storage.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            Location: <span className="font-medium text-foreground">{locationLabelDisplay}</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Choose a storage area, then Storage 1–3 from storages in that area. Save to keep selections.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || loading || !dirty}
          className="px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-xs">
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden min-w-0">
        <TableScrollContainer ref={scrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          <table className="w-full table-fixed text-xs">
            <thead>
              <SortableTableHeaderRow
                columns={ASSIGNMENT_TABLE_COLUMNS}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={toggleSort}
                className="border-b border-border bg-muted/40"
              />
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Loading items…
                  </td>
                </tr>
              ) : (
                <>
                  {scroll.visibleItems.map(row => {
                    const storageNames = listStorageNamesForArea(
                      assignment,
                      selectedLocationIds,
                      row.storageArea,
                    );
                    return (
                      <tr key={row.itemKey} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2 align-middle font-medium whitespace-nowrap">{row.itemType}</td>
                        <td className="px-3 py-2 align-middle truncate" title={row.name}>{row.name}</td>
                        <td className="px-2 py-1.5 align-middle">
                          <select
                            className={selectCls}
                            value={row.storageArea}
                            onChange={e => patchRow(row.itemKey, { storageArea: e.target.value })}
                            aria-label={`${row.name} storage area`}
                          >
                            <option value="">—</option>
                            {areaOptions.map(area => (
                              <option key={area} value={area}>{area}</option>
                            ))}
                          </select>
                        </td>
                        {(['storage1', 'storage2', 'storage3'] as const).map(field => (
                          <td key={field} className="px-2 py-1.5 align-middle">
                            <select
                              className={selectCls}
                              value={row[field]}
                              disabled={!row.storageArea}
                              onChange={e => patchRow(row.itemKey, { [field]: e.target.value })}
                              aria-label={`${row.name} ${field}`}
                            >
                              <option value="">—</option>
                              {storageNames.map(name => (
                                <option key={`${field}-${name}`} value={name}>{name}</option>
                              ))}
                            </select>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                        No components or products found for this company.
                      </td>
                    </tr>
                  )}
                  <InfiniteScrollTableSentinel
                    colSpan={6}
                    hasMore={scroll.hasMore}
                    onLoadMore={scroll.loadMore}
                    nextPageSize={scroll.nextPageSize}
                    sentinelRef={scroll.sentinelRef}
                    totalCount={scroll.totalCount}
                    visibleCount={scroll.visibleCount}
                  />
                </>
              )}
            </tbody>
          </table>
        </TableScrollContainer>
      </div>
    </div>
  );
}
