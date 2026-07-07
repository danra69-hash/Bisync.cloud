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

export type StorageAssignmentState = {
  areas: string[];
  entries: MyStorageEntry[];
  nextEntryId: number;
};

export const DEFAULT_AREAS = ['Dining Room', 'Bar', 'Kitchen', 'Prep Kitchen', 'Hot Kitchen'];

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
  { location: 'Downtown', area: 'Kitchen', sourceStorageId: 1, name: 'Walk-in Freezer', type: 'Freezer', items: 18 },
  { location: 'Downtown', area: 'Kitchen', sourceStorageId: 2, name: 'Main Chiller', type: 'Chiller', items: 32 },
  { location: 'Downtown', area: 'Bar', sourceStorageId: 3, name: 'Wine Cellar', type: 'Wine Cellar', items: 14 },
  { location: 'Downtown', area: 'Kitchen', sourceStorageId: 4, name: 'Dry Store', type: 'Dry Store', items: 41 },
  { location: 'Midtown', area: 'Bar', sourceStorageId: 5, name: 'Bar Cooler', type: 'Chiller', items: 9 },
  { location: 'Midtown', area: 'Prep Kitchen', sourceStorageId: 6, name: 'Prep Kitchen Store', type: 'Prep Kitchen', items: 22 },
  { location: 'Westend', area: 'Kitchen', sourceStorageId: 7, name: 'Westend Freezer', type: 'Freezer', items: 11 },
  { location: 'Westend', area: 'Kitchen', sourceStorageId: 8, name: 'Westend Chiller', type: 'Chiller', items: 16 },
  { location: 'Midtown', area: 'Kitchen', sourceStorageId: 4, name: 'Dry Store', type: 'Dry Store', items: 41 },
  { location: 'Westend', area: 'Kitchen', sourceStorageId: 4, name: 'Dry Store', type: 'Dry Store', items: 41 },
];

const STORAGE_ASSIGNMENT_KEY = 'bisync.storageAssignment';

function defaultState(): StorageAssignmentState {
  return {
    areas: [...DEFAULT_AREAS],
    entries: DEFAULT_MY_STORAGE_ENTRIES.map((entry, index) => ({ ...entry, id: index + 1 })),
    nextEntryId: DEFAULT_MY_STORAGE_ENTRIES.length + 1,
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
  if (!trimmed) return 'Downtown';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function resolveStorageLocationLabels(locationIds: string[]): string[] {
  if (locationIds.length === 0) return ['Downtown'];
  return [...new Set(locationIds.map(externalIdToStorageLocation))];
}

export function loadStorageAssignment(): StorageAssignmentState {
  if (typeof localStorage === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_ASSIGNMENT_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<StorageAssignmentState>;
    const areas = Array.isArray(parsed.areas) && parsed.areas.length > 0 ? parsed.areas : [...DEFAULT_AREAS];
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const nextEntryId = typeof parsed.nextEntryId === 'number' ? parsed.nextEntryId : entries.length + 1;
    if (entries.length === 0) return defaultState();
    return { areas, entries, nextEntryId };
  } catch {
    return defaultState();
  }
}

export function saveStorageAssignment(state: StorageAssignmentState) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_ASSIGNMENT_KEY, JSON.stringify(state));
}

export function storageEntryKey(entry: Pick<MyStorageEntry, 'location' | 'area' | 'sourceStorageId' | 'name'>) {
  return `${entry.location}::${entry.area}::${entry.sourceStorageId}::${entry.name}`;
}

export function listAreasForLocations(state: StorageAssignmentState, locationLabels: string[]): string[] {
  const labels = new Set(locationLabels);
  const areas = state.entries
    .filter(entry => labels.has(entry.location))
    .map(entry => entry.area);
  return [...new Set(areas)].sort((a, b) => a.localeCompare(b));
}

export function listStoragesForFilter(
  state: StorageAssignmentState,
  locationLabels: string[],
  areaFilter: string,
): MyStorageEntry[] {
  const labels = new Set(locationLabels);
  return state.entries
    .filter(entry => labels.has(entry.location))
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
  locationLabels: string[],
  assignment: StorageAssignmentState,
): ComponentAreaStorageLabels {
  if (componentStorageTypes.length === 0) {
    return { areas: '—', storages: '—', sortArea: '', sortStorage: '' };
  }

  const labels = new Set(locationLabels);
  const matched = assignment.entries.filter(
    entry => labels.has(entry.location) && componentStorageTypes.includes(entry.type),
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
