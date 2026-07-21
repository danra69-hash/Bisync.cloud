import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { sortTableRows } from '../../utils/tableSort';
import { pageShellClass } from '../layout/pageLayout';
import { Plus } from 'lucide-react';
import { api, type Ingredient, type LocationConfig } from '../../api';
import {
  loadStorageAssignment,
  loadStorageAssignmentForCompany,
  saveStorageAssignment,
  ensureLocationStorageEntries,
  STORAGE_AREAS,
  STORAGE_CATALOG,
  storageCatalogMatchesLocations,
  storageEntryMatchesLocations,
  storageEntryKey,
  type MyStorageEntry,
  type StorageCatalogRow,
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
import { ComponentHierarchyPanel } from './ComponentHierarchyPanel';
import { StorageAreaPicker } from './StorageAreaPicker';
import { UomConfigPanel } from './UomConfigPanel';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';

type MyStorageTableRow =
  | { kind: 'header'; id: string; label: string }
  | { kind: 'entry'; entry: MyStorageEntry };

type StorageSortColumn = 'name' | 'type' | 'items';

const ALL_STORAGE_COLUMNS: SortableColumnDef<StorageSortColumn>[] = [
  { key: 'name', label: 'Storage Area' },
  { key: 'type', label: 'Storage Type' },
];

const MY_STORAGE_COLUMNS: SortableColumnDef<StorageSortColumn>[] = [
  { key: 'name', label: 'Storage Area' },
  { key: 'type', label: 'Storage Type' },
  { key: 'items', label: 'No. of stored Components', align: 'right' },
];

const CONFIG_TABS = [
  { id: 'hierarchy' as const, label: 'Component Hierarchy' },
  { id: 'storage' as const, label: 'Storage Assignment' },
  { id: 'uom' as const, label: 'UOM Config' },
] as const;

const STORAGE_AREAS_LIST = [...STORAGE_AREAS];

function resolveFallbackLocationLabels(locationIds: string[]): string {
  return locationIds
    .map(id => id.trim())
    .filter(Boolean)
    .map(id => id.charAt(0).toUpperCase() + id.slice(1))
    .join(', ');
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
  const [storage] = useState(STORAGE_CATALOG);
  const [companyLocations, setCompanyLocations] = useState<LocationConfig[]>([]);
  const orgReady = Boolean(selectedCompanyId) && selectedLocationIds.length > 0;
  const selectedLocations = useMemo(
    () => companyLocations.filter(location => selectedLocationIds.includes(location.externalId)),
    [companyLocations, selectedLocationIds],
  );
  const locationLabelDisplay = selectedLocations.length > 0
    ? selectedLocations.map(location => location.name).join(', ')
    : resolveFallbackLocationLabels(selectedLocationIds);
  const [myStorageEntries, setMyStorageEntries] = useState<MyStorageEntry[]>(() => loadStorageAssignment().entries);
  const [nextEntryId, setNextEntryId] = useState(() => loadStorageAssignment().nextEntryId);
  const [pendingStorage, setPendingStorage] = useState<StorageCatalogRow | null>(null);

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
      if (ensured.changed) {
        saveStorageAssignment(ensured.state, selectedCompanyId);
        setMyStorageEntries(ensured.state.entries);
        setNextEntryId(ensured.state.nextEntryId);
      } else {
        setMyStorageEntries(nextStorage.entries);
        setNextEntryId(nextStorage.nextEntryId);
      }
      setCompanyLocations(locations.filter(location => location.companyId === selectedCompanyId));
    });
  }, [selectedCompanyId, selectedLocationIds.join(',')]);

  useEffect(() => {
    const reloadHierarchy = () => setHierarchy(loadComponentHierarchy());
    const reloadStorage = () => {
      const nextStorage = loadStorageAssignment();
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

  const locationStorage = useMemo(() => {
    const matched = storage.filter(row => storageCatalogMatchesLocations(row.location, selectedLocationIds));
    // Non-demo locations may match every catalog row; keep one entry per storage name.
    const seen = new Set<string>();
    return matched.filter(row => {
      const key = `${row.name}::${row.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [storage, selectedLocationIds]);

  const myStorageByArea = useMemo(() => {
    const entries = myStorageEntries.filter(entry => storageEntryMatchesLocations(entry.location, selectedLocationIds));
    return STORAGE_AREAS_LIST.map(area => ({
      area,
      entries: entries.filter(entry => entry.area === area),
    }));
  }, [myStorageEntries, selectedLocationIds]);

  const hasMyStorage = myStorageByArea.some(section => section.entries.length > 0);

  const locationStorageScrollRef = useRef<HTMLDivElement>(null);
  const myStorageScrollRef = useRef<HTMLDivElement>(null);

  const {
    sortColumn: locationStorageSortColumn,
    sortDirection: locationStorageSortDirection,
    toggleSort: toggleLocationStorageSort,
    resetSort: resetLocationStorageSort,
  } = useTableSort<StorageSortColumn>();
  const {
    sortColumn: myStorageSortColumn,
    sortDirection: myStorageSortDirection,
    toggleSort: toggleMyStorageSort,
    resetSort: resetMyStorageSort,
  } = useTableSort<StorageSortColumn>();

  useEffect(() => {
    resetLocationStorageSort();
    resetMyStorageSort();
  }, [tab, selectedLocationIds, myStorageEntries, resetLocationStorageSort, resetMyStorageSort]);

  const sortedLocationStorage = useMemo(
    () =>
      sortTableRows(locationStorage, locationStorageSortColumn, locationStorageSortDirection, {
        name: row => row.name,
        type: row => row.type,
      }),
    [locationStorage, locationStorageSortColumn, locationStorageSortDirection],
  );
  const sortedMyStorageTableRows = useMemo((): MyStorageTableRow[] => {
    return myStorageByArea.flatMap(section => {
      const sortedEntries = sortTableRows(
        section.entries,
        myStorageSortColumn,
        myStorageSortDirection,
        {
          name: row => row.name,
          type: row => row.type,
          items: row => row.items,
        },
      );
      return [
        { kind: 'header' as const, id: `hdr-${section.area}`, label: section.area },
        ...sortedEntries.map(entry => ({ kind: 'entry' as const, entry })),
      ];
    });
  }, [myStorageByArea, myStorageSortColumn, myStorageSortDirection]);

  const locationStorageScroll = useInfiniteScrollSlice(sortedLocationStorage, { scrollRootRef: locationStorageScrollRef });
  const myStorageScroll = useInfiniteScrollSlice(sortedMyStorageTableRows, { scrollRootRef: myStorageScrollRef });

  function openStorageAreaPicker(source: StorageCatalogRow) {
    setPendingStorage(source);
  }

  function closeStorageAreaPicker() {
    setPendingStorage(null);
  }

  function confirmAddToMyStorage(area: string) {
    if (!pendingStorage || selectedLocationIds.length === 0) return;
    const existingKeys = new Set(myStorageEntries.map(storageEntryKey));
    const newEntries: MyStorageEntry[] = [];
    let nextId = nextEntryId;

    for (const location of selectedLocationIds) {
      const candidate: MyStorageEntry = {
        id: nextId,
        location,
        area,
        sourceStorageId: pendingStorage.id,
        name: pendingStorage.name,
        type: pendingStorage.type,
        items: pendingStorage.items,
      };
      const key = storageEntryKey(candidate);
      if (!existingKeys.has(key)) {
        newEntries.push(candidate);
        existingKeys.add(key);
        nextId += 1;
      }
    }

    if (newEntries.length === 0) {
      setPendingStorage(null);
      return;
    }

    setNextEntryId(nextId);
    setMyStorageEntries(prev => {
      const next = [...prev, ...newEntries];
      saveStorageAssignment({ areas: STORAGE_AREAS_LIST, entries: next, nextEntryId: nextId }, selectedCompanyId);
      return next;
    });
    setPendingStorage(null);
  }

  function removeMyStorageEntry(entryId: number) {
    setMyStorageEntries(prev => {
      const next = prev.filter(e => e.id !== entryId);
      saveStorageAssignment({ areas: STORAGE_AREAS_LIST, entries: next, nextEntryId }, selectedCompanyId);
      return next;
    });
  }

  return (
    <div className={pageShellClass()}>
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
            <button
              type="button"
              onClick={() => {
                locationStorageScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                const first = locationStorage[0];
                if (first) openStorageAreaPicker(first);
              }}
              disabled={locationStorage.length === 0}
              title={locationStorage.length === 0 ? 'No storage areas available for this location' : 'Pick a storage area to add to My Storage'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={11} /> Add Storage
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="bg-card border border-border rounded-lg overflow-hidden min-w-0">
              <div className="px-3 py-2 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold">All Storage — {locationLabelDisplay}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Click a storage area, then choose an area to copy it to My Storage</p>
              </div>
              <TableScrollContainer ref={locationStorageScrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
              <table className="w-full table-fixed text-xs">
                <thead>
                  <SortableTableHeaderRow
                    columns={ALL_STORAGE_COLUMNS}
                    sortColumn={locationStorageSortColumn}
                    sortDirection={locationStorageSortDirection}
                    onSort={toggleLocationStorageSort}
                    className="border-b border-border bg-muted/40"
                  />
                </thead>
                <tbody>
                  {locationStorageScroll.visibleItems.map(s => (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => openStorageAreaPicker(s)}
                          className="font-medium text-left text-primary hover:underline"
                        >
                          {s.name}
                        </button>
                        {s.location === 'All Locations' && (
                          <p className="text-xs text-muted-foreground mt-0.5">All locations</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-sans">{s.type}</span>
                      </td>
                    </tr>
                  ))}
                  {locationStorage.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">
                        No storage for this location.
                      </td>
                    </tr>
                  )}
                  <InfiniteScrollTableSentinel colSpan={2} hasMore={locationStorageScroll.hasMore} onLoadMore={locationStorageScroll.loadMore} nextPageSize={locationStorageScroll.nextPageSize} sentinelRef={locationStorageScroll.sentinelRef} totalCount={locationStorageScroll.totalCount} visibleCount={locationStorageScroll.visibleCount} />
                </tbody>
              </table>
              </TableScrollContainer>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden min-w-0">
              <div className="px-3 py-2 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold">My Storage — {locationLabelDisplay}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Grouped by Dining Room, Bar, and Kitchen. Click a storage area to remove it.</p>
              </div>

              {!hasMyStorage ? (
                <div className="px-3 py-6">
                  <p className="text-center text-xs text-muted-foreground mb-4">
                    No storage assigned yet. Click a storage area on the left and select Dining Room, Bar, or Kitchen.
                  </p>
                  <table className="w-full table-fixed text-xs">
                    <tbody>
                      {STORAGE_AREAS_LIST.map(area => (
                        <tr key={area} className="border-b border-border/60">
                          <td className="px-3 py-2 text-xs font-sans font-semibold uppercase tracking-wider text-muted-foreground">
                            {area}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <TableScrollContainer ref={myStorageScrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
                  <table className="w-full table-fixed text-xs">
                    <thead>
                      <SortableTableHeaderRow
                        columns={MY_STORAGE_COLUMNS}
                        sortColumn={myStorageSortColumn}
                        sortDirection={myStorageSortDirection}
                        onSort={toggleMyStorageSort}
                        className="border-b border-border bg-muted/40"
                      />
                    </thead>
                    <tbody>
                      {myStorageScroll.visibleItems.map(row => {
                        if (row.kind === 'header') {
                          return (
                            <tr key={row.id} className="bg-muted/20 border-b border-border">
                              <td colSpan={3} className="px-3 py-2 text-xs font-sans font-semibold uppercase tracking-wider text-foreground">
                                {row.label}
                              </td>
                            </tr>
                          );
                        }
                        const entry = row.entry;
                        return (
                          <tr key={entry.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => removeMyStorageEntry(entry.id)}
                                className="font-medium text-left text-primary hover:underline"
                              >
                                {entry.name}
                              </button>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-sans">{entry.type}</span>
                            </td>
                            <td className="px-3 py-2.5 font-sans">{entry.items}</td>
                          </tr>
                        );
                      })}
                      <InfiniteScrollTableSentinel colSpan={3} hasMore={myStorageScroll.hasMore} onLoadMore={myStorageScroll.loadMore} nextPageSize={myStorageScroll.nextPageSize} sentinelRef={myStorageScroll.sentinelRef} totalCount={myStorageScroll.totalCount} visibleCount={myStorageScroll.visibleCount} />
                    </tbody>
                  </table>
                </TableScrollContainer>
              )}
            </div>
          </div>
          </>
          )}
        </div>
      ) : (
        <UomConfigPanel selectedCompanyId={selectedCompanyId} />
      )}

      {pendingStorage && (
        <StorageAreaPicker
          storageName={pendingStorage.name}
          areas={STORAGE_AREAS_LIST}
          onClose={closeStorageAreaPicker}
          onConfirm={confirmAddToMyStorage}
        />
      )}
    </div>
  );
}
