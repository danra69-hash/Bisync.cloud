import { useMemo, useRef, useState } from 'react';
import { useInfiniteScrollSlice } from '../../hooks/useInfiniteScrollSlice';
import { InfiniteScrollTableSentinel } from '../shared/infiniteScroll';
import { TableScrollContainer } from '../shared/TableScrollContainer';
import { pageShellClass } from '../layout/pageLayout';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { selectCls } from '../../data/componentForm';
import { GroupEditPanel, type GroupRow } from './GroupEditPanel';
import { StorageAreaPicker } from './StorageAreaPicker';
import { UomConfigPanel } from './UomConfigPanel';
import { useRevMgmtPageLabel } from './RevMgmtTitleContext';

type StorageRow = { id: number; name: string; type: string; capacity: string; location: string; items: number };

type MyStorageEntry = {
  id: number;
  location: string;
  area: string;
  sourceStorageId: number;
  name: string;
  type: string;
  items: number;
};

type MyStorageTableRow =
  | { kind: 'header'; id: string; label: string }
  | { kind: 'entry'; entry: MyStorageEntry };

const thCls = 'text-left px-3 py-2 text-xs font-sans uppercase tracking-wider text-muted-foreground font-normal';

const CONFIG_TABS = [
  { id: 'group' as const, label: 'Group Assignment' },
  { id: 'storage' as const, label: 'Storage Assignment' },
  { id: 'uom' as const, label: 'UOM Config' },
] as const;

const STORAGE_LOCATIONS = ['Downtown', 'Midtown', 'Westend'] as const;

const DEFAULT_AREAS = ['Dining Room', 'Bar', 'Kitchen', 'Prep Kitchen', 'Hot Kitchen'];

const initialGroups: GroupRow[] = [
  { id: 1, name: 'Proteins', category: 'Food', items: 12 },
  { id: 2, name: 'Dairy', category: 'Food', items: 8 },
  { id: 3, name: 'Produce', category: 'Food', items: 15 },
  { id: 4, name: 'Spirits', category: 'Beverage', items: 24 },
  { id: 5, name: 'Dry Goods', category: 'Food', items: 18 },
];

const initialStorage: StorageRow[] = [
  { id: 1, name: 'Walk-in Freezer', type: 'Freezer', capacity: '120 m³', location: 'Downtown', items: 18 },
  { id: 2, name: 'Main Chiller', type: 'Chiller', capacity: '80 m³', location: 'Downtown', items: 32 },
  { id: 3, name: 'Wine Cellar', type: 'Wine Cellar', capacity: '45 m³', location: 'Downtown', items: 14 },
  { id: 4, name: 'Dry Store', type: 'Dry Store', capacity: '60 m³', location: 'All Locations', items: 41 },
  { id: 5, name: 'Bar Cooler', type: 'Chiller', capacity: '12 m³', location: 'Midtown', items: 9 },
  { id: 6, name: 'Prep Kitchen Store', type: 'Prep Kitchen', capacity: '25 m³', location: 'Midtown', items: 22 },
  { id: 7, name: 'Westend Freezer', type: 'Freezer', capacity: '90 m³', location: 'Westend', items: 11 },
  { id: 8, name: 'Westend Chiller', type: 'Chiller', capacity: '55 m³', location: 'Westend', items: 16 },
];

function storageMatchesLocation(row: StorageRow, location: string) {
  return row.location === location || row.location === 'All Locations';
}

export function ComponentConfigPage({ selectedCompanyId }: { selectedCompanyId: number | null }) {
  const [tab, setTab] = useState<'group' | 'storage' | 'uom'>('group');

  const activeTabLabel = CONFIG_TABS.find(t => t.id === tab)?.label ?? 'Group Assignment';
  useRevMgmtPageLabel(activeTabLabel);
  const [groups, setGroups] = useState(initialGroups);
  const [storage] = useState(initialStorage);
  const [myGroupIds, setMyGroupIds] = useState<number[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>(STORAGE_LOCATIONS[0]);
  const [areas, setAreas] = useState<string[]>(DEFAULT_AREAS);
  const [myStorageEntries, setMyStorageEntries] = useState<MyStorageEntry[]>([]);
  const [nextEntryId, setNextEntryId] = useState(1);
  const [pendingStorage, setPendingStorage] = useState<StorageRow | null>(null);
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

  const myStorageTableRows = useMemo((): MyStorageTableRow[] => {
    return myStorageByArea.flatMap(section => [
      { kind: 'header' as const, id: `hdr-${section.area}`, label: section.area },
      ...section.entries.map(entry => ({ kind: 'entry' as const, entry })),
    ]);
  }, [myStorageByArea]);

  const groupsScrollRef = useRef<HTMLDivElement>(null);
  const myGroupsScrollRef = useRef<HTMLDivElement>(null);
  const locationStorageScrollRef = useRef<HTMLDivElement>(null);
  const myStorageScrollRef = useRef<HTMLDivElement>(null);

  const groupsScroll = useInfiniteScrollSlice(groups, { scrollRootRef: groupsScrollRef });
  const myGroupsScroll = useInfiniteScrollSlice(myGroups, { scrollRootRef: myGroupsScrollRef });
  const locationStorageScroll = useInfiniteScrollSlice(locationStorage, { scrollRootRef: locationStorageScrollRef });
  const myStorageScroll = useInfiniteScrollSlice(myStorageTableRows, { scrollRootRef: myStorageScrollRef });

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

  function openStorageAreaPicker(source: StorageRow) {
    setPendingStorage(source);
  }

  function closeStorageAreaPicker() {
    setPendingStorage(null);
  }

  function addArea(name: string) {
    const trimmed = name.trim();
    if (!trimmed || areas.some(a => a.toLowerCase() === trimmed.toLowerCase())) return;
    setAreas(prev => [...prev, trimmed]);
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
    setNextEntryId(id => id + 1);
    setMyStorageEntries(prev => [...prev, entry]);
    setPendingStorage(null);
  }

  function removeMyStorageEntry(entryId: number) {
    setMyStorageEntries(prev => prev.filter(e => e.id !== entryId));
  }

  return (
    <div className={pageShellClass()}>
      {selectedCompanyId && (
      <>
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
                  <tr className="border-b border-border bg-muted/40">
                    {['Category', 'Group Name', 'Actions'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
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
                  <tr className="border-b border-border bg-muted/40">
                    {['Category', 'Group Name', 'Components'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
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
                  <tr className="border-b border-border bg-muted/40">
                    {['Storage Name', 'Type'].map(h => (
                      <th key={h} className={thCls}>{h}</th>
                    ))}
                  </tr>
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
                      <tr className="border-b border-border bg-muted/40">
                        {['Storage Name', 'Type', 'No. of stored Components'].map(h => (
                          <th key={h} className={thCls}>{h}</th>
                        ))}
                      </tr>
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
      </>
      )}
    </div>
  );
}
