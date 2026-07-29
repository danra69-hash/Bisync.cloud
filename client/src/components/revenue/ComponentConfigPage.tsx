import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { sortTableRows } from '../../utils/tableSort';
import { pageShellClass } from '../layout/pageLayout';
import { PageStickyFilters } from '../layout/PageStickyFilters';
import { Plus, Trash2 } from 'lucide-react';
import { api, type Ingredient, type LocationConfig } from '../../api';
import {
  loadStorageAssignment,
  loadStorageAssignmentForCompany,
  saveStorageAssignment,
  ensureLocationStorageEntries,
  STORAGE_AREAS,
  storageEntryMatchesLocations,
  storageEntryKey,
  type MyStorageEntry,
  type StorageAssignmentState,
} from '../../data/storageAssignment';
import {
  buildHierarchyAttachmentCounts,
  emptyHierarchyAttachmentCounts,
  loadComponentHierarchy,
  loadComponentHierarchyForCompany,
  saveComponentHierarchy,
  type ComponentHierarchyState,
  type HierarchyAttachmentCounts,
} from '../../data/componentHierarchy';
import { getKnownStorageOptions } from '../../data/componentCatalogConfig';
import { ComponentHierarchyPanel } from './ComponentHierarchyPanel';
import { CreateStorageAreaDialog, CreateStorageDialog } from './StorageAreaPicker';
import { UomConfigPanel } from './UomConfigPanel';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';

type StorageSortColumn = 'area' | 'storage';

const STORAGE_TABLE_COLUMNS: SortableColumnDef<StorageSortColumn>[] = [
  { key: 'area', label: 'Storage Area' },
  { key: 'storage', label: 'Storage' },
];

const CONFIG_TABS = [
  { id: 'hierarchy' as const, label: 'Component Hierarchy' },
  { id: 'storage' as const, label: 'Storage Assignment' },
  { id: 'uom' as const, label: 'UOM Config' },
] as const;

function resolveFallbackLocationLabels(locationIds: string[]): string {
  return locationIds
    .map(id => id.trim())
    .filter(Boolean)
    .map(id => id.charAt(0).toUpperCase() + id.slice(1))
    .join(', ');
}

function uniqueAreas(areas: string[], entries: MyStorageEntry[]): string[] {
  return [...new Set([
    ...STORAGE_AREAS,
    ...areas,
    ...entries.map(entry => entry.area),
  ].map(area => area.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

export function ComponentConfigPage({
  selectedCompanyId,
  selectedLocationIds,
}: {
  selectedCompanyId: number | null;
  selectedLocationIds: string[];
}) {
  const [tab, setTab] = useState<'hierarchy' | 'storage' | 'uom'>('hierarchy');

  const activeTabLabel = CONFIG_TABS.find(t => t.id === tab)?.label ?? 'Component Hierarchy';
  useRevMgmtPageLabel(activeTabLabel);
  const [hierarchy, setHierarchy] = useState<ComponentHierarchyState>(() => loadComponentHierarchy());
  const [attachmentCounts, setAttachmentCounts] = useState<HierarchyAttachmentCounts>(
    () => emptyHierarchyAttachmentCounts(),
  );
  const [companyLocations, setCompanyLocations] = useState<LocationConfig[]>([]);
  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;
  const selectedLocations = useMemo(
    () => companyLocations.filter(location => selectedLocationIds.includes(location.externalId)),
    [companyLocations, selectedLocationIds],
  );
  const locationLabelDisplay = selectedLocations.length > 0
    ? selectedLocations.map(location => location.name).join(', ')
    : resolveFallbackLocationLabels(selectedLocationIds);

  const initialAssignment = loadStorageAssignment();
  const [storageAreas, setStorageAreas] = useState<string[]>(() => uniqueAreas(initialAssignment.areas, initialAssignment.entries));
  const [myStorageEntries, setMyStorageEntries] = useState<MyStorageEntry[]>(() => initialAssignment.entries);
  const [nextEntryId, setNextEntryId] = useState(() => initialAssignment.nextEntryId);
  const [createAreaOpen, setCreateAreaOpen] = useState(false);
  const [createStorageOpen, setCreateStorageOpen] = useState(false);

  function persistAssignment(next: StorageAssignmentState) {
    setStorageAreas(uniqueAreas(next.areas, next.entries));
    setMyStorageEntries(next.entries);
    setNextEntryId(next.nextEntryId);
    saveStorageAssignment(next, selectedCompanyId);
  }

  function updateHierarchy(next: ComponentHierarchyState) {
    setHierarchy(next);
    saveComponentHierarchy(next, selectedCompanyId);
  }

  useEffect(() => {
    if (!selectedCompanyId) {
      setAttachmentCounts(emptyHierarchyAttachmentCounts());
      return;
    }
    void Promise.all([
      loadComponentHierarchyForCompany(selectedCompanyId),
      loadStorageAssignmentForCompany(selectedCompanyId),
      api.locationsConfig().catch(() => [] as LocationConfig[]),
      api.ingredients(selectedCompanyId).catch(() => [] as Ingredient[]),
    ]).then(([nextHierarchy, nextStorage, locations, ingredients]) => {
      setHierarchy(nextHierarchy);
      setAttachmentCounts(buildHierarchyAttachmentCounts(ingredients));
      const companyLocIds = locations
        .filter(location => location.companyId === selectedCompanyId)
        .map(location => location.externalId);
      const selectedOrCompany = selectedLocationIds.length > 0 ? selectedLocationIds : companyLocIds;
      const ensured = ensureLocationStorageEntries(nextStorage, selectedOrCompany);
      const state = ensured.changed ? ensured.state : nextStorage;
      if (ensured.changed) {
        saveStorageAssignment(state, selectedCompanyId);
      }
      setStorageAreas(uniqueAreas(state.areas, state.entries));
      setMyStorageEntries(state.entries);
      setNextEntryId(state.nextEntryId);
      setCompanyLocations(locations.filter(location => location.companyId === selectedCompanyId));
    });
  }, [selectedCompanyId, selectedLocationIds.join(',')]);

  useEffect(() => {
    const reloadHierarchy = () => setHierarchy(loadComponentHierarchy());
    const reloadStorage = () => {
      const nextStorage = loadStorageAssignment();
      setStorageAreas(uniqueAreas(nextStorage.areas, nextStorage.entries));
      setMyStorageEntries(nextStorage.entries);
      setNextEntryId(nextStorage.nextEntryId);
    };
    window.addEventListener('bisync:componentHierarchyChanged', reloadHierarchy);
    window.addEventListener('bisync:storageAssignmentChanged', reloadStorage);
    return () => {
      window.removeEventListener('bisync:componentHierarchyChanged', reloadHierarchy);
      window.removeEventListener('bisync:storageAssignmentChanged', reloadStorage);
    };
  }, []);

  const visibleEntries = useMemo(
    () => myStorageEntries.filter(entry => storageEntryMatchesLocations(entry.location, selectedLocationIds)),
    [myStorageEntries, selectedLocationIds],
  );

  const storageScrollRef = useRef<HTMLDivElement>(null);
  const {
    sortColumn,
    sortDirection,
    toggleSort,
    resetSort,
  } = useTableSort<StorageSortColumn>('area');

  useEffect(() => {
    resetSort();
  }, [tab, selectedLocationIds, resetSort]);

  const sortedEntries = useMemo(
    () =>
      sortTableRows(visibleEntries, sortColumn, sortDirection, {
        area: row => row.area,
        storage: row => row.name,
      }),
    [visibleEntries, sortColumn, sortDirection],
  );

  const storageScroll = useInfiniteScrollSlice(sortedEntries, { scrollRootRef: storageScrollRef });
  const storageTypes = useMemo(() => getKnownStorageOptions(), []);

  function createStorageArea(areaName: string) {
    const areas = uniqueAreas([...storageAreas, areaName], myStorageEntries);
    persistAssignment({
      areas,
      entries: myStorageEntries,
      nextEntryId,
    });
    setCreateAreaOpen(false);
  }

  function createStorage(payload: { area: string; name: string; type: string }) {
    if (selectedLocationIds.length === 0) return;

    const existingKeys = new Set(myStorageEntries.map(storageEntryKey));
    const newEntries: MyStorageEntry[] = [];
    let nextId = nextEntryId;

    for (const location of selectedLocationIds) {
      const candidate: MyStorageEntry = {
        id: nextId,
        location,
        area: payload.area,
        sourceStorageId: 0,
        name: payload.name,
        type: payload.type,
        items: 0,
      };
      const key = storageEntryKey(candidate);
      if (!existingKeys.has(key)) {
        newEntries.push(candidate);
        existingKeys.add(key);
        nextId += 1;
      }
    }

    if (newEntries.length === 0) {
      setCreateStorageOpen(false);
      return;
    }

    persistAssignment({
      areas: uniqueAreas([...storageAreas, payload.area], [...myStorageEntries, ...newEntries]),
      entries: [...myStorageEntries, ...newEntries],
      nextEntryId: nextId,
    });
    setCreateStorageOpen(false);
  }

  function removeMyStorageEntry(entryId: number) {
    const nextEntries = myStorageEntries.filter(e => e.id !== entryId);
    persistAssignment({
      areas: uniqueAreas(storageAreas, nextEntries),
      entries: nextEntries,
      nextEntryId,
    });
  }

  return (
    <div className={pageShellClass()}>
      <PageStickyFilters opaque className="pb-0">
        <div className="flex gap-1 border-b border-border">
          {CONFIG_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </PageStickyFilters>

      {tab === 'hierarchy' ? (
        <ComponentHierarchyPanel
          state={hierarchy}
          onChange={updateHierarchy}
          attachmentCounts={attachmentCounts}
        />
      ) : tab === 'storage' ? (
        <div className="space-y-3">
          {!orgReady ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Select a company and at least one location to manage storage assignment.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  Location: <span className="font-medium text-foreground">{locationLabelDisplay}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateAreaOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-border bg-background text-foreground hover:bg-muted/40"
                  >
                    <Plus size={11} /> Create Storage Area
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateStorageOpen(true)}
                    disabled={storageAreas.length === 0}
                    title={storageAreas.length === 0 ? 'Create a storage area first' : 'Create storage'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={11} /> Create Storage
                  </button>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg overflow-hidden min-w-0">
                <div className="px-3 py-2 border-b border-border bg-muted/30">
                  <p className="text-xs font-semibold">Storage — {locationLabelDisplay}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create storage areas, then add storages under each area.
                  </p>
                </div>
                <TableScrollContainer ref={storageScrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
                  <table className="w-full table-fixed text-xs">
                    <thead>
                      <SortableTableHeaderRow
                        columns={STORAGE_TABLE_COLUMNS}
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className="border-b border-border bg-muted/40"
                      />
                    </thead>
                    <tbody>
                      {storageScroll.visibleItems.map(entry => (
                        <tr key={entry.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2.5 font-medium">{entry.area}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span>{entry.name}</span>
                              <button
                                type="button"
                                onClick={() => removeMyStorageEntry(entry.id)}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40"
                                title="Remove storage"
                                aria-label={`Remove ${entry.name}`}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {visibleEntries.length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">
                            No storage yet. Create a storage area, then create storage.
                          </td>
                        </tr>
                      )}
                      <InfiniteScrollTableSentinel
                        colSpan={2}
                        hasMore={storageScroll.hasMore}
                        onLoadMore={storageScroll.loadMore}
                        nextPageSize={storageScroll.nextPageSize}
                        sentinelRef={storageScroll.sentinelRef}
                        totalCount={storageScroll.totalCount}
                        visibleCount={storageScroll.visibleCount}
                      />
                    </tbody>
                  </table>
                </TableScrollContainer>
              </div>
            </>
          )}
        </div>
      ) : (
        <UomConfigPanel selectedCompanyId={selectedCompanyId} />
      )}

      {createAreaOpen && (
        <CreateStorageAreaDialog
          existingAreas={storageAreas}
          onClose={() => setCreateAreaOpen(false)}
          onConfirm={createStorageArea}
        />
      )}
      {createStorageOpen && (
        <CreateStorageDialog
          areas={storageAreas}
          storageTypes={storageTypes}
          onClose={() => setCreateStorageOpen(false)}
          onConfirm={createStorage}
        />
      )}
    </div>
  );
}
