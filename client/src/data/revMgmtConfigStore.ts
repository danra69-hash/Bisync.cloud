import { api } from '../api';
import type { ComponentHierarchyState } from './componentHierarchy';
import type { StorageAssignmentState } from './storageAssignment';

export const REV_MGMT_HIERARCHY_KEY = 'componentHierarchy';
export const REV_MGMT_STORAGE_KEY = 'storageAssignment';
export const REV_MGMT_CATALOG_KEY = 'componentCatalog';

export type ComponentCatalogState = {
  extraGroups: string[];
  extraUoms: string[];
  extraStorages: string[];
};

let hierarchyCache: ComponentHierarchyState | null = null;
let hierarchyCompanyId: number | null = null;
let storageCache: StorageAssignmentState | null = null;
let storageCompanyId: number | null = null;
let catalogCache: ComponentCatalogState | null = null;
let catalogCompanyId: number | null = null;

function readLocalJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function clearLocalKey(key: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
}

function normalizeHierarchy(state: unknown): ComponentHierarchyState | null {
  if (!state || typeof state !== 'object') return null;
  const parsed = state as ComponentHierarchyState;
  if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) return null;
  return {
    categories: parsed.categories ?? [],
    groups: parsed.groups ?? [],
    subGroups: parsed.subGroups ?? [],
    nextCategoryId: parsed.nextCategoryId ?? 1,
    nextGroupId: parsed.nextGroupId ?? 1,
    nextSubGroupId: parsed.nextSubGroupId ?? 1,
  };
}

function normalizeStorage(state: unknown): StorageAssignmentState | null {
  if (!state || typeof state !== 'object') return null;
  const parsed = state as StorageAssignmentState;
  if (!Array.isArray(parsed.entries) || parsed.entries.length === 0) return null;
  return {
    areas: parsed.areas ?? [],
    entries: parsed.entries ?? [],
    nextEntryId: parsed.nextEntryId ?? parsed.entries.length + 1,
  };
}

function uniqueSortedStrings(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map(value => value.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function normalizeCatalog(state: unknown): ComponentCatalogState | null {
  if (!state || typeof state !== 'object') return null;
  const parsed = state as ComponentCatalogState;
  return {
    extraGroups: uniqueSortedStrings(parsed.extraGroups),
    extraUoms: uniqueSortedStrings(parsed.extraUoms),
    extraStorages: uniqueSortedStrings(parsed.extraStorages),
  };
}

function emptyCatalog(): ComponentCatalogState {
  return { extraGroups: [], extraUoms: [], extraStorages: [] };
}

function readLegacyStringList(key: string): string[] {
  const raw = readLocalJson<string[]>(key);
  return Array.isArray(raw) ? uniqueSortedStrings(raw) : [];
}

export function getCachedComponentHierarchy(): ComponentHierarchyState | null {
  return hierarchyCache;
}

export function getCachedStorageAssignment(): StorageAssignmentState | null {
  return storageCache;
}

export function getCachedComponentCatalog(): ComponentCatalogState | null {
  return catalogCache;
}

export async function ensureComponentHierarchy(companyId: number): Promise<ComponentHierarchyState> {
  if (hierarchyCompanyId === companyId && hierarchyCache) return hierarchyCache;

  const response = await api.revMgmtConfig(companyId, REV_MGMT_HIERARCHY_KEY);
  let state = normalizeHierarchy(response.state);
  const legacy = readLocalJson<ComponentHierarchyState>('bisync.componentHierarchy');
  const legacyState = normalizeHierarchy(legacy);

  if (legacyState && (!state || response.seeded)) {
    state = legacyState;
    await api.updateRevMgmtConfig(companyId, REV_MGMT_HIERARCHY_KEY, JSON.stringify(state));
    clearLocalKey('bisync.componentHierarchy');
  }

  if (!state) {
    state = normalizeHierarchy(response.state)!;
  }

  hierarchyCache = state;
  hierarchyCompanyId = companyId;
  window.dispatchEvent(new CustomEvent('bisync:componentHierarchyChanged'));
  return state;
}

export async function saveComponentHierarchyApi(
  companyId: number,
  state: ComponentHierarchyState,
): Promise<ComponentHierarchyState> {
  const response = await api.updateRevMgmtConfig(
    companyId,
    REV_MGMT_HIERARCHY_KEY,
    JSON.stringify(state),
  );
  const saved = normalizeHierarchy(response.state) ?? state;
  hierarchyCache = saved;
  hierarchyCompanyId = companyId;
  window.dispatchEvent(new CustomEvent('bisync:componentHierarchyChanged'));
  return saved;
}

export async function ensureStorageAssignment(companyId: number): Promise<StorageAssignmentState> {
  if (storageCompanyId === companyId && storageCache) return storageCache;

  const response = await api.revMgmtConfig(companyId, REV_MGMT_STORAGE_KEY);
  let state = normalizeStorage(response.state);
  const legacy = readLocalJson<StorageAssignmentState>('bisync.storageAssignment');
  const legacyState = normalizeStorage(legacy);

  if (legacyState && (!state || response.seeded)) {
    state = legacyState;
    await api.updateRevMgmtConfig(companyId, REV_MGMT_STORAGE_KEY, JSON.stringify(state));
    clearLocalKey('bisync.storageAssignment');
  }

  if (!state) {
    state = normalizeStorage(response.state)!;
  }

  storageCache = state;
  storageCompanyId = companyId;
  window.dispatchEvent(new CustomEvent('bisync:storageAssignmentChanged'));
  return state;
}

export async function saveStorageAssignmentApi(
  companyId: number,
  state: StorageAssignmentState,
): Promise<StorageAssignmentState> {
  const response = await api.updateRevMgmtConfig(
    companyId,
    REV_MGMT_STORAGE_KEY,
    JSON.stringify(state),
  );
  const saved = normalizeStorage(response.state) ?? state;
  storageCache = saved;
  storageCompanyId = companyId;
  window.dispatchEvent(new CustomEvent('bisync:storageAssignmentChanged'));
  return saved;
}

export async function ensureComponentCatalog(companyId: number): Promise<ComponentCatalogState> {
  if (catalogCompanyId === companyId && catalogCache) return catalogCache;

  const response = await api.revMgmtConfig(companyId, REV_MGMT_CATALOG_KEY);
  let state = normalizeCatalog(response.state) ?? emptyCatalog();

  const legacyGroups = readLegacyStringList('bisync.productExtraGroups');
  const legacyUoms = readLegacyStringList('bisync.componentExtraUoms');
  const legacyStorages = readLegacyStringList('bisync.componentExtraStorages');
  const hasLegacy = legacyGroups.length > 0 || legacyUoms.length > 0 || legacyStorages.length > 0;
  const isEmptySeed = state.extraGroups.length === 0
    && state.extraUoms.length === 0
    && state.extraStorages.length === 0;

  if (hasLegacy && (response.seeded || isEmptySeed)) {
    state = {
      extraGroups: uniqueSortedStrings([...state.extraGroups, ...legacyGroups]),
      extraUoms: uniqueSortedStrings([...state.extraUoms, ...legacyUoms]),
      extraStorages: uniqueSortedStrings([...state.extraStorages, ...legacyStorages]),
    };
    await api.updateRevMgmtConfig(companyId, REV_MGMT_CATALOG_KEY, JSON.stringify(state));
    clearLocalKey('bisync.productExtraGroups');
    clearLocalKey('bisync.componentExtraUoms');
    clearLocalKey('bisync.componentExtraStorages');
  }

  catalogCache = state;
  catalogCompanyId = companyId;
  window.dispatchEvent(new CustomEvent('bisync:componentCatalogChanged'));
  return state;
}

export async function saveComponentCatalogApi(
  companyId: number,
  state: ComponentCatalogState,
): Promise<ComponentCatalogState> {
  const normalized: ComponentCatalogState = {
    extraGroups: uniqueSortedStrings(state.extraGroups),
    extraUoms: uniqueSortedStrings(state.extraUoms),
    extraStorages: uniqueSortedStrings(state.extraStorages),
  };
  catalogCache = normalized;
  catalogCompanyId = companyId;
  window.dispatchEvent(new CustomEvent('bisync:componentCatalogChanged'));

  const response = await api.updateRevMgmtConfig(
    companyId,
    REV_MGMT_CATALOG_KEY,
    JSON.stringify(normalized),
  );
  const saved = normalizeCatalog(response.state) ?? normalized;
  catalogCache = saved;
  catalogCompanyId = companyId;
  return saved;
}

export async function ensureRevMgmtConfig(companyId: number): Promise<void> {
  await Promise.all([
    ensureComponentHierarchy(companyId),
    ensureStorageAssignment(companyId),
    ensureComponentCatalog(companyId),
  ]);
}

export function clearRevMgmtConfigCache() {
  hierarchyCache = null;
  hierarchyCompanyId = null;
  storageCache = null;
  storageCompanyId = null;
  catalogCache = null;
  catalogCompanyId = null;
}
