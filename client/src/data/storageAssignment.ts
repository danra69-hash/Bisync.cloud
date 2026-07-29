import {
  ensureStorageAssignment,
  getCachedStorageAssignment,
  saveStorageAssignmentApi,
} from './revMgmtConfigStore';

export type StorageCatalogRow = {
  id: number;
  name: string;
  type: string;
  capacity: string;
  location: string;
  items: number;
};

export type MyStorageEntry = {
  id: number;
  location: string;
  area: string;
  sourceStorageId: number;
  name: string;
  type: string;
  items: number;
};

/** Row types shown on the Storage Assignment assignment table. */
export const ITEM_STORAGE_ASSIGNMENT_TYPES = [
  'Sub-component',
  'Component',
  'Sub-product',
  'B2C Product',
  'B2B Product',
] as const;

export type ItemStorageAssignmentType = (typeof ITEM_STORAGE_ASSIGNMENT_TYPES)[number];

export type ItemStorageAssignment = {
  /** Stable key, e.g. `component:BISY-A001` or `product:42`. */
  itemKey: string;
  itemType: ItemStorageAssignmentType;
  name: string;
  storageArea: string;
  storage1: string;
  storage2: string;
  storage3: string;
};

export type StorageAssignmentState = {
  areas: string[];
  entries: MyStorageEntry[];
  nextEntryId: number;
  /** Per-item storage picks on the Storage Assignment tab. */
  itemAssignments?: ItemStorageAssignment[];
};

export function emptyItemStorageAssignment(
  itemKey: string,
  itemType: ItemStorageAssignmentType,
  name: string,
): ItemStorageAssignment {
  return {
    itemKey,
    itemType,
    name,
    storageArea: '',
    storage1: '',
    storage2: '',
    storage3: '',
  };
}

export function normalizeItemAssignments(
  value: unknown,
): ItemStorageAssignment[] {
  if (!Array.isArray(value)) return [];
  const rows: ItemStorageAssignment[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const itemKey = String(row.itemKey ?? '').trim();
    const itemType = String(row.itemType ?? '').trim() as ItemStorageAssignmentType;
    if (!itemKey || !ITEM_STORAGE_ASSIGNMENT_TYPES.includes(itemType)) continue;
    rows.push({
      itemKey,
      itemType,
      name: String(row.name ?? '').trim(),
      storageArea: String(row.storageArea ?? '').trim(),
      storage1: String(row.storage1 ?? '').trim(),
      storage2: String(row.storage2 ?? '').trim(),
      storage3: String(row.storage3 ?? '').trim(),
    });
  }
  return rows;
}

/** Unique storage names under an area for the selected locations. */
export function listStorageNamesForArea(
  state: StorageAssignmentState,
  locationIds: string[],
  area: string,
): string[] {
  const areaKey = area.trim().toLowerCase();
  if (!areaKey) return [];
  return [...new Set(
    listStoragesForFilter(state, locationIds, area)
      .map(entry => entry.name.trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b));
}

/** Resolve storage types for selected named storages (used to sync ingredient StorageJson). */
export function resolveStorageTypesForNames(
  state: StorageAssignmentState,
  locationIds: string[],
  area: string,
  names: string[],
): string[] {
  const wanted = new Set(names.map(name => name.trim().toLowerCase()).filter(Boolean));
  if (wanted.size === 0) return [];
  const types = listStoragesForFilter(state, locationIds, area || 'All')
    .filter(entry => wanted.has(entry.name.trim().toLowerCase()))
    .map(entry => entry.type.trim())
    .filter(Boolean);
  return [...new Set(types)];
}

export const STORAGE_AREAS = ['Dining Room', 'Bar', 'Kitchen'] as const;

/** Maps demo catalog location labels to location external IDs. */
export const CATALOG_LOCATION_TO_EXTERNAL_ID: Record<string, string> = {
  Downtown: 'downtown',
  Midtown: 'midtown',
  Westend: 'westend',
  'All Locations': 'all',
};

export function normalizeStorageLocationKey(location: string): string {
  const trimmed = location.trim();
  if (!trimmed) return '';
  const fromCatalog = CATALOG_LOCATION_TO_EXTERNAL_ID[trimmed];
  if (fromCatalog) return fromCatalog;
  return trimmed.toLowerCase();
}

export function storageCatalogMatchesLocations(
  catalogLocation: string,
  selectedLocationIds: string[],
): boolean {
  if (selectedLocationIds.length === 0) return false;
  // Global catalog rows apply to every outlet.
  if (catalogLocation === 'All Locations') return true;
  const catalogKey = normalizeStorageLocationKey(catalogLocation);
  const selected = new Set(selectedLocationIds.map(id => id.trim().toLowerCase()).filter(Boolean));
  if (selected.has(catalogKey)) return true;
  // Demo catalog is keyed to Downtown/Midtown/Westend only. For any other real
  // cloud location, still show the full type catalog so the left panel isn't empty.
  const demoKeys = new Set(['downtown', 'midtown', 'westend']);
  return [...selected].some(id => !demoKeys.has(id));
}

export function storageEntryMatchesLocations(
  entryLocation: string,
  selectedLocationIds: string[],
): boolean {
  if (selectedLocationIds.length === 0) return false;
  const entryKey = normalizeStorageLocationKey(entryLocation);
  const selected = new Set(selectedLocationIds.map(id => id.trim().toLowerCase()).filter(Boolean));
  return selected.has(entryKey);
}

/** @deprecated Use STORAGE_AREAS */
export const DEFAULT_AREAS = [...STORAGE_AREAS];

export const STORAGE_CATALOG: StorageCatalogRow[] = [
  { id: 1, name: 'Walk-in Freezer', type: 'Freezer', capacity: '120 m³', location: 'Downtown', items: 18 },
  { id: 2, name: 'Main Chiller', type: 'Chiller', capacity: '80 m³', location: 'Downtown', items: 32 },
  { id: 3, name: 'Wine Cellar', type: 'Wine Cellar', capacity: '45 m³', location: 'Downtown', items: 14 },
  { id: 4, name: 'Dry Store', type: 'Dry Store', capacity: '60 m³', location: 'All Locations', items: 41 },
  { id: 5, name: 'Bar Cooler', type: 'Chiller', capacity: '12 m³', location: 'Midtown', items: 9 },
  { id: 6, name: 'Prep Kitchen Store', type: 'Prep Kitchen', capacity: '25 m³', location: 'Midtown', items: 22 },
  { id: 7, name: 'Westend Freezer', type: 'Freezer', capacity: '90 m³', location: 'Westend', items: 11 },
  { id: 8, name: 'Westend Chiller', type: 'Chiller', capacity: '55 m³', location: 'Westend', items: 16 },
];

const DEFAULT_MY_STORAGE_ENTRIES: Omit<MyStorageEntry, 'id'>[] = [
  { location: 'downtown', area: 'Kitchen', sourceStorageId: 1, name: 'Walk-in Freezer', type: 'Freezer', items: 18 },
  { location: 'downtown', area: 'Kitchen', sourceStorageId: 2, name: 'Main Chiller', type: 'Chiller', items: 32 },
  { location: 'downtown', area: 'Bar', sourceStorageId: 3, name: 'Wine Cellar', type: 'Wine Cellar', items: 14 },
  { location: 'downtown', area: 'Kitchen', sourceStorageId: 4, name: 'Dry Store', type: 'Dry Store', items: 41 },
  { location: 'midtown', area: 'Bar', sourceStorageId: 5, name: 'Bar Cooler', type: 'Chiller', items: 9 },
  { location: 'midtown', area: 'Kitchen', sourceStorageId: 6, name: 'Prep Kitchen Store', type: 'Prep Kitchen', items: 22 },
  { location: 'westend', area: 'Kitchen', sourceStorageId: 7, name: 'Westend Freezer', type: 'Freezer', items: 11 },
  { location: 'westend', area: 'Kitchen', sourceStorageId: 8, name: 'Westend Chiller', type: 'Chiller', items: 16 },
  { location: 'midtown', area: 'Kitchen', sourceStorageId: 4, name: 'Dry Store', type: 'Dry Store', items: 41 },
  { location: 'westend', area: 'Kitchen', sourceStorageId: 4, name: 'Dry Store', type: 'Dry Store', items: 41 },
];


function defaultState(): StorageAssignmentState {
  return {
    areas: [...STORAGE_AREAS],
    entries: DEFAULT_MY_STORAGE_ENTRIES.map((entry, index) => ({ ...entry, id: index + 1 })),
    nextEntryId: DEFAULT_MY_STORAGE_ENTRIES.length + 1,
    itemAssignments: [],
  };
}

export function parseComponentStorageJson(storageJson: string | null | undefined): string[] {
  if (!storageJson?.trim()) return [];
  try {
    const parsed = JSON.parse(storageJson) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(value => String(value).trim()).filter(Boolean);
    }
    if (typeof parsed === 'string') {
      const label = parsed.trim();
      return label ? [label] : [];
    }
    return [];
  } catch {
    const trimmed = storageJson.trim();
    return trimmed ? [trimmed] : [];
  }
}

export function externalIdToStorageLocation(externalId: string): string {
  const trimmed = externalId.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function resolveStorageLocationLabels(locationIds: string[]): string[] {
  if (locationIds.length === 0) return [];
  return [...new Set(locationIds.map(externalIdToStorageLocation).filter(Boolean))];
}

export function loadStorageAssignment(): StorageAssignmentState {
  return getCachedStorageAssignment() ?? defaultState();
}

export async function loadStorageAssignmentForCompany(companyId: number): Promise<StorageAssignmentState> {
  return ensureStorageAssignment(companyId);
}

export function saveStorageAssignment(state: StorageAssignmentState, companyId?: number | null) {
  if (!companyId) return;
  void saveStorageAssignmentApi(companyId, state);
}

export function storageEntryKey(entry: Pick<MyStorageEntry, 'location' | 'area' | 'sourceStorageId' | 'name'>) {
  return `${entry.location}::${entry.area}::${entry.sourceStorageId}::${entry.name}`;
}

/** Default Kitchen storages seeded when a location has no My Storage rows yet. */
const DEFAULT_LOCATION_STORAGE_TEMPLATES: Omit<MyStorageEntry, 'id' | 'location'>[] = [
  { area: 'Kitchen', sourceStorageId: 1, name: 'Walk-in Freezer', type: 'Freezer', items: 0 },
  { area: 'Kitchen', sourceStorageId: 2, name: 'Main Chiller', type: 'Chiller', items: 0 },
  { area: 'Kitchen', sourceStorageId: 4, name: 'Dry Store', type: 'Dry Store', items: 0 },
];

/**
 * Ensures each selected location has at least the default Kitchen storages.
 * Seeded company configs only cover downtown/midtown/westend — other cloud locations
 * otherwise leave the Inventory Storage dropdown empty.
 */
export function ensureLocationStorageEntries(
  state: StorageAssignmentState,
  locationIds: string[],
): { state: StorageAssignmentState; changed: boolean } {
  if (locationIds.length === 0) return { state, changed: false };

  let nextId = state.nextEntryId;
  const entries = [...state.entries];
  let changed = false;

  for (const locationId of locationIds) {
    const key = normalizeStorageLocationKey(locationId);
    if (!key) continue;
    const hasAny = entries.some(entry => normalizeStorageLocationKey(entry.location) === key);
    if (hasAny) continue;

    for (const template of DEFAULT_LOCATION_STORAGE_TEMPLATES) {
      entries.push({
        ...template,
        id: nextId++,
        location: key,
      });
    }
    changed = true;
  }

  if (!changed) return { state, changed: false };

  const areas = [...new Set([...state.areas, ...STORAGE_AREAS])];
  return {
    state: {
      areas,
      entries,
      nextEntryId: nextId,
      itemAssignments: state.itemAssignments ?? [],
    },
    changed: true,
  };
}

export function listAreasForLocations(state: StorageAssignmentState, locationIds: string[]): string[] {
  const ensured = ensureLocationStorageEntries(state, locationIds).state;
  const areas = ensured.entries
    .filter(entry => storageEntryMatchesLocations(entry.location, locationIds))
    .map(entry => entry.area);
  return [...new Set(areas)].sort((a, b) => a.localeCompare(b));
}

export function listStoragesForFilter(
  state: StorageAssignmentState,
  locationIds: string[],
  areaFilter: string,
): MyStorageEntry[] {
  const ensured = ensureLocationStorageEntries(state, locationIds).state;
  return ensured.entries
    .filter(entry => storageEntryMatchesLocations(entry.location, locationIds))
    .filter(entry => areaFilter === 'All' || entry.area === areaFilter)
    .sort((a, b) => a.area.localeCompare(b.area) || a.name.localeCompare(b.name));
}

export function selectedStorageTypes(
  storages: MyStorageEntry[],
  selectedKeys: string[],
): string[] {
  if (selectedKeys.length === 0) return [];
  const keySet = new Set(selectedKeys);
  return [...new Set(storages.filter(entry => keySet.has(storageEntryKey(entry))).map(entry => entry.type))];
}

export function rowMatchesStorageFilter(
  itemType: string,
  itemKey: string,
  componentStorageByKey: Record<string, string[]>,
  activeStorageTypes: string[],
): boolean {
  if (activeStorageTypes.length === 0) return true;
  if (itemType !== 'component') return false;
  const componentStorages = componentStorageByKey[itemKey] ?? [];
  return componentStorages.some(storage => activeStorageTypes.includes(storage));
}

export type ComponentAreaStorageLabels = {
  areas: string;
  storages: string;
  sortArea: string;
  sortStorage: string;
};

export function resolveComponentAreaStorage(
  componentStorageTypes: string[],
  locationIds: string[],
  assignment: StorageAssignmentState,
): ComponentAreaStorageLabels {
  if (componentStorageTypes.length === 0) {
    return { areas: '—', storages: '—', sortArea: '', sortStorage: '' };
  }

  const matched = assignment.entries.filter(
    entry => storageEntryMatchesLocations(entry.location, locationIds)
      && componentStorageTypes.includes(entry.type),
  );

  const areas = [...new Set(matched.map(entry => entry.area))].sort((a, b) => a.localeCompare(b));
  const storages = [...new Set(matched.map(entry => entry.name))].sort((a, b) => a.localeCompare(b));

  if (matched.length === 0) {
    const fallback = [...componentStorageTypes].sort((a, b) => a.localeCompare(b));
    return {
      areas: '—',
      storages: fallback.join(', '),
      sortArea: '',
      sortStorage: fallback[0] ?? '',
    };
  }

  return {
    areas: areas.join(', '),
    storages: storages.join(', '),
    sortArea: areas[0] ?? '',
    sortStorage: storages[0] ?? '',
  };
}
