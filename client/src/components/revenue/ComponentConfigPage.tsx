import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { useTableSort } from '../../hooks/useTableSort';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { SortableTableHeaderRow, type SortableColumnDef } from '../shared/SortableTableHead';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { sortTableRows } from '../../utils/tableSort';
import { pageShellClass } from '../layout/pageLayout';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { selectCls } from '../../data/componentForm';
import {
  loadStorageAssignment,
  saveStorageAssignment,
  STORAGE_CATALOG,
  type MyStorageEntry,
  type StorageCatalogRow,
} from '../../data/storageAssignment';
import { GroupEditPanel, type GroupRow } from './GroupEditPanel';
import { StorageAreaPicker } from './StorageAreaPicker';
import { UomConfigPanel } from './UomConfigPanel';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';

type MyStorageTableRow =
  | { kind: 'header'; id: string; label: string }
  | { kind: 'entry'; entry: MyStorageEntry };

type GroupSortColumn = 'category' | 'name' | 'items' | 'actions';
type StorageSortColumn = 'name' | 'type' | 'items';

const ALL_GROUPS_COLUMNS: SortableColumnDef<GroupSortColumn>[] = [
  { key: 'category', label: 'Category' },
  { key: 'name', label: 'Group Name' },
  { key: 'actions', label: 'Actions', sortable: false },
];

const MY_GROUPS_COLUMNS: SortableColumnDef<GroupSortColumn>[] = [
  { key: 'category', label: 'Category' },
  { key: 'name', label: 'Group Name' },
  { key: 'items', label: 'Components', align: 'right' },
];

const ALL_STORAGE_COLUMNS: SortableColumnDef<StorageSortColumn>[] = [
  { key: 'name', label: 'Storage Name' },
  { key: 'type', label: 'Type' },
];

const MY_STORAGE_COLUMNS: SortableColumnDef<StorageSortColumn>[] = [
  { key: 'name', label: 'Storage Name' },
  { key: 'type', label: 'Type' },
  { key: 'items', label: 'No. of stored Components', align: 'right' },
];

const CONFIG_TABS = [
  { id: 'group' as const, label: 'Group Assignment' },
  { id: 'storage' as const, label: 'Storage Assignment' },
  { id: 'uom' as const, label: 'UOM Config' },
] as const;

const STORAGE_LOCATIONS = ['Downtown', 'Midtown', 'Westend'] as const;

const initialGroups: GroupRow[] = [
  { id: 1, name: 'Proteins', category: 'Food', items: 12 },
  { id: 2, name: 'Dairy', category: 'Food', items: 8 },
  { id: 3, name: 'Produce', category: 'Food', items: 15 },
  { id: 4, name: 'Spirits', category: 'Beverage', items: 24 },
  { id: 5, name: 'Dry Goods', category: 'Food', items: 18 },
];

const initialStorage: StorageCatalogRow[] = STORAGE_CATALOG;

function storageMatchesLocation(row: StorageCatalogRow, location: string) {
  return row.location === location || row.location === 'All Locations';
}

export function ComponentConfigPage({ selectedCompanyId: _selectedCompanyId }: { selectedCompanyId: number | null }) {
  const [tab, setTab] = useState<'group' | 'storage' | 'uom'>('group');

  const activeTabLabel = CONFIG_TABS.find(t => t.id === tab)?.label ?? 'Group Assignment';
  useRevMgmtPageLabel(activeTabLabel);
  const [groups, setGroups] = useState(initialGroups);
  const [storage] = useState(initialStorage);
  const [myGroupIds, setMyGroupIds] = useState<number[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>(STORAGE_LOCATIONS[0]);
  const [areas, setAreas] = useState<string[]>(() => loadStorageAssignment().areas);
  const [myStorageEntries, setMyStorageEntries] = useState<MyStorageEntry[]>(() => loadStorageAssignment().entries);
  const [nextEntryId, setNextEntryId] = useState(() => loadStorageAssignment().nextEntryId);
  const [pendingStorage, setPendingStorage] = useState<StorageCatalogRow | null>(null);
  const [editingGroup, setEditingGroup] = useState<GroupRow | null>(null);
  const [isNewGroup, setIsNewGroup] = useState(false);

  const myGroups = groups.filter(g => myGroupIds.includes(g.id));
  const locationStorage = useMemo(
    () => storage.filter(s => storageMatchesLocation(s, selectedLocation)),
    [storage, selectedLocation],
  );

  const myStorageByArea = useMemo(() => {
    const entries = myStorageEntries.filter(e => e.location === selectedLocation);
    return areas
      .map(area => ({ area, entries: entries.filter(e => e.area === area) }))
      .filter(section => section.entries.length > 0);
  }, [areas, myStorageEntries, selectedLocation]);

  const hasMyStorage = myStorageByArea.length > 0;

  const groupsScrollRef = useRef<HTMLDivElement>(null);
  const myGroupsScrollRef = useRef<HTMLDivElement>(null);
  const locationStorageScrollRef = useRef<HTMLDivElement>(null);
  const myStorageScrollRef = useRef<HTMLDivElement>(null);

  const {
    sortColumn: groupsSortColumn,
    sortDirection: groupsSortDirection,
    toggleSort: toggleGroupsSort,
    resetSort: resetGroupsSort,
  } = useTableSort<GroupSortColumn>();
  const {
    sortColumn: myGroupsSortColumn,
    sortDirection: myGroupsSortDirection,
    toggleSort: toggleMyGroupsSort,
    resetSort: resetMyGroupsSort,
  } = useTableSort<GroupSortColumn>();
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
    resetGroupsSort();
    resetMyGroupsSort();
  }, [tab, resetGroupsSort, resetMyGroupsSort]);

  useEffect(() => {
    resetLocationStorageSort();
    resetMyStorageSort();
  }, [tab, selectedLocation, myGroupIds, myStorageEntries, resetLocationStorageSort, resetMyStorageSort]);

  const sortedGroups = useMemo(
    () =>
      sortTableRows(groups, groupsSortColumn, groupsSortDirection, {
        category: row => row.category,
        name: row => row.name,
        items: row => row.items,
      }),
    [groups, groupsSortColumn, groupsSortDirection],
  );
  const sortedMyGroups = useMemo(
    () =>
      sortTableRows(myGroups, myGroupsSortColumn, myGroupsSortDirection, {
        category: row => row.category,
        name: row => row.name,
        items: row => row.items,
      }),
    [myGroups, myGroupsSortColumn, myGroupsSortDirection],
  );
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

  const groupsScroll = useInfiniteScrollSlice(sortedGroups, { scrollRootRef: groupsScrollRef });
  const myGroupsScroll = useInfiniteScrollSlice(sortedMyGroups, { scrollRootRef: myGroupsScrollRef });
  const locationStorageScroll = useInfiniteScrollSlice(sortedLocationStorage, { scrollRootRef: locationStorageScrollRef });
  const myStorageScroll = useInfiniteScrollSlice(sortedMyStorageTableRows, { scrollRootRef: myStorageScrollRef });

  function openNewGroup() {
    const nextId = groups.reduce((max, g) => Math.max(max, g.id), 0) + 1;
    setEditingGroup({ id: nextId, name: '', category: 'Food', items: 0 });
    setIsNewGroup(true);
  }

  function openEditGroup(group: GroupRow) {
    setEditingGroup(group);
    setIsNewGroup(false);
  }

  function closeGroupEditor() {
    setEditingGroup(null);
    setIsNewGroup(false);
  }

  function saveGroup(updated: GroupRow) {
    setGroups(prev => {
      if (isNewGroup) return [...prev, updated];
      return prev.map(g => (g.id === updated.id ? updated : g));
    });
  }

  function addToMyGroup(id: number) {
    setMyGroupIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  }

  function removeFromMyGroup(id: number) {
    setMyGroupIds(prev => prev.filter(x => x !== id));
  }

  function deleteGroup(id: number) {
    setGroups(prev => prev.filter(x => x.id !== id));
    setMyGroupIds(prev => prev.filter(x => x !== id));
  }

  function openStorageAreaPicker(source: StorageCatalogRow) {
    setPendingStorage(source);
  }

  function closeStorageAreaPicker() {
    setPendingStorage(null);
  }

  function addArea(name: string) {
    const trimmed = name.trim();
    if (!trimmed || areas.some(a => a.toLowerCase() === trimmed.toLowerCase())) return;
    setAreas(prev => {
      const next = [...prev, trimmed];
      saveStorageAssignment({ areas: next, entries: myStorageEntries, nextEntryId });
      return next;
    });
  }

  function confirmAddToMyStorage(area: string) {
    if (!pendingStorage) return;
    const entry: MyStorageEntry = {
      id: nextEntryId,
      location: selectedLocation,
      area,
      sourceStorageId: pendingStorage.id,
      name: pendingStorage.name,
      type: pendingStorage.type,
      items: pendingStorage.items,
    };
    const nextId = nextEntryId + 1;
    setNextEntryId(nextId);
    setMyStorageEntries(prev => {
      const next = [...prev, entry];
      saveStorageAssignment({ areas, entries: next, nextEntryId: nextId });
      return next;
    });
    setPendingStorage(null);
  }

  function removeMyStorageEntry(entryId: number) {
    setMyStorageEntries(prev => {
      const next = prev.filter(e => e.id !== entryId);
      saveStorageAssignment({ areas, entries: next, nextEntryId });
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

      {tab === 'group' ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openNewGroup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground"
            >
              <Plus size={11} /> Add Group
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="bg-card border border-border rounded-lg overflow-hidden min-w-0">
              <div className="px-3 py-2 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold">All Groups</p>
                <p className="text-xs text-muted-foreground mt-0.5">Click a group name to add it to My Group</p>
              </div>
              <TableScrollContainer ref={groupsScrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
              <table className="w-full table-fixed text-xs">
                <thead>
                  <SortableTableHeaderRow
                    columns={ALL_GROUPS_COLUMNS}
                    sortColumn={groupsSortColumn}
                    sortDirection={groupsSortDirection}
                    onSort={toggleGroupsSort}
                    className="border-b border-border bg-muted/40"
                  />
                </thead>
                <tbody>
                  {groupsScroll.visibleItems.map(g => {
                    const inMyGroup = myGroupIds.includes(g.id);
                    return (
                      <tr key={g.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2.5 text-muted-foreground">{g.category}</td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => addToMyGroup(g.id)}
                            disabled={inMyGroup}
                            className={`font-medium text-left hover:underline ${
                              inMyGroup ? 'text-muted-foreground cursor-default' : 'text-primary'
                            }`}
                          >
                            {g.name}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditGroup(g)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Edit group"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteGroup(g.id)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500"
                              title="Delete group"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <InfiniteScrollTableSentinel colSpan={3} hasMore={groupsScroll.hasMore} sentinelRef={groupsScroll.sentinelRef} totalCount={groupsScroll.totalCount} visibleCount={groupsScroll.visibleCount} />
                </tbody>
              </table>
              </TableScrollContainer>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden min-w-0">
              <div className="px-3 py-2 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold">My Group</p>
                <p className="text-xs text-muted-foreground mt-0.5">Click a group name to remove it from My Group</p>
              </div>
              <TableScrollContainer ref={myGroupsScrollRef} className="max-h-[calc(100vh-12rem)] overflow-y-auto">
              <table className="w-full table-fixed text-xs">
                <thead>
                  <SortableTableHeaderRow
                    columns={MY_GROUPS_COLUMNS}
                    sortColumn={myGroupsSortColumn}
                    sortDirection={myGroupsSortDirection}
                    onSort={toggleMyGroupsSort}
                    className="border-b border-border bg-muted/40"
                  />
                </thead>
                <tbody>
                  {myGroupsScroll.visibleItems.map(g => (
                    <tr key={g.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2.5 text-muted-foreground">{g.category}</td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => removeFromMyGroup(g.id)}
                          className="font-medium text-left text-primary hover:underline"
                        >
                          {g.name}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-sans">{g.items}</td>
                    </tr>
                  ))}
                  {myGroups.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                        No groups selected. Click a group name on the left to add it here.
                      </td>
                    </tr>
                  )}
                  <InfiniteScrollTableSentinel colSpan={3} hasMore={myGroupsScroll.hasMore} sentinelRef={myGroupsScroll.sentinelRef} totalCount={myGroupsScroll.totalCount} visibleCount={myGroupsScroll.visibleCount} />
                </tbody>
              </table>
              </TableScrollContainer>
            </div>
          </div>
        </div>
      ) : tab === 'storage' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <label htmlFor="storage-location" className="text-xs font-sans uppercase tracking-wider text-muted-foreground">
                Location
              </label>
              <select
                id="storage-location"
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                className={`${selectCls} mt-1 `}
              >
                {STORAGE_LOCATIONS.map(location => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground"
            >
              <Plus size={11} /> Add Storage
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="bg-card border border-border rounded-lg overflow-hidden min-w-0">
              <div className="px-3 py-2 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold">All Storage — {selectedLocation}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Click a storage name, then choose an area to copy it to My Storage</p>
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
                  <InfiniteScrollTableSentinel colSpan={2} hasMore={locationStorageScroll.hasMore} sentinelRef={locationStorageScroll.sentinelRef} totalCount={locationStorageScroll.totalCount} visibleCount={locationStorageScroll.visibleCount} />
                </tbody>
              </table>
              </TableScrollContainer>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden min-w-0">
              <div className="px-3 py-2 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold">My Storage — {selectedLocation}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Grouped by area. Click a storage name to remove it.</p>
              </div>

              {!hasMyStorage ? (
                <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No storage assigned yet. Click a storage name on the left and select an area.
                </p>
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
                      <InfiniteScrollTableSentinel colSpan={3} hasMore={myStorageScroll.hasMore} sentinelRef={myStorageScroll.sentinelRef} totalCount={myStorageScroll.totalCount} visibleCount={myStorageScroll.visibleCount} />
                    </tbody>
                  </table>
                </TableScrollContainer>
              )}
            </div>
          </div>
        </div>
      ) : (
        <UomConfigPanel />
      )}

      {editingGroup && (
        <GroupEditPanel
          group={editingGroup}
          isNew={isNewGroup}
          onClose={closeGroupEditor}
          onSave={saveGroup}
        />
      )}

      {pendingStorage && (
        <StorageAreaPicker
          storageName={pendingStorage.name}
          areas={areas}
          onClose={closeStorageAreaPicker}
          onConfirm={confirmAddToMyStorage}
          onAddArea={addArea}
        />
      )}
    </div>
  );
}
