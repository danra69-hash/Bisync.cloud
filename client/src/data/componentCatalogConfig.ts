import { fromApiUom, RECIPE_UNITS, STORAGE_OPTIONS, toApiUom, type ComponentRow } from './componentForm';
import { siGroups } from './revenueManagement';
import type { SmartComponentImportDraft, SmartComponentImportPlan } from './smartComponentCatalog';

const EXTRA_GROUPS_KEY = 'bisync.productExtraGroups';
const EXTRA_UOMS_KEY = 'bisync.componentExtraUoms';
const EXTRA_STORAGES_KEY = 'bisync.componentExtraStorages';

export type CatalogEnsureResult = {
  groups: string[];
  recipeUoms: string[];
  inventoryUoms: string[];
  storages: string[];
};

function loadStringList(key: string): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.map(value => value.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveStringList(key: string, values: string[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(values));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function loadExtraGroups(): string[] {
  return loadStringList(EXTRA_GROUPS_KEY);
}

export function saveExtraGroups(groups: string[]) {
  saveStringList(EXTRA_GROUPS_KEY, uniqueSorted(groups));
}

export function removeExtraGroup(groupName: string): string[] {
  const key = groupName.trim().toLowerCase();
  const next = loadExtraGroups().filter(group => group.toLowerCase() !== key);
  saveExtraGroups(next);
  return next;
}

export function isBuiltinGroup(groupName: string): boolean {
  const trimmed = groupName.trim();
  if (!trimmed) return false;
  return siGroups
    .filter(group => group !== 'All')
    .some(group => group.toLowerCase() === trimmed.toLowerCase());
}

export function isDeletableProductGroup(groupName: string): boolean {
  return Boolean(groupName.trim()) && !isBuiltinGroup(groupName);
}

export function getKnownGroups(existingRows: ComponentRow[] = []): string[] {
  const fromRows = existingRows.map(row => row.group).filter(Boolean);
  const base = siGroups.filter(group => group !== 'All');
  return uniqueSorted([...base, ...loadExtraGroups(), ...fromRows]);
}

export function ensureGroupsExist(groups: string[], existingRows: ComponentRow[] = []): { added: string[] } {
  const known = new Set(getKnownGroups(existingRows).map(group => group.toLowerCase()));
  const extras = loadExtraGroups();
  const added: string[] = [];

  for (const group of groups) {
    const trimmed = group.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (known.has(key)) continue;
    extras.push(trimmed);
    known.add(key);
    added.push(trimmed);
  }

  if (added.length > 0) saveExtraGroups(extras);
  return { added };
}

export function normalizeRecipeUnitInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const mapped = fromApiUom(toApiUom(trimmed));
  if (mapped) return mapped;
  const direct = RECIPE_UNITS.find(unit => unit.toLowerCase() === trimmed.toLowerCase());
  return direct ?? trimmed;
}

export function getKnownRecipeUnits(): string[] {
  const extras = loadStringList(EXTRA_UOMS_KEY).map(normalizeRecipeUnitInput).filter(Boolean);
  return uniqueSorted([...RECIPE_UNITS, ...extras]);
}

export function ensureRecipeUnitsExist(units: string[]): { added: string[] } {
  const known = new Set(getKnownRecipeUnits().map(unit => unit.toLowerCase()));
  const extras = loadStringList(EXTRA_UOMS_KEY);
  const added: string[] = [];

  for (const unit of units) {
    const normalized = normalizeRecipeUnitInput(unit);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (known.has(key)) continue;
    extras.push(normalized);
    known.add(key);
    added.push(normalized);
  }

  if (added.length > 0) saveStringList(EXTRA_UOMS_KEY, uniqueSorted(extras));
  return { added };
}

export function getKnownStorageOptions(): string[] {
  const extras = loadStringList(EXTRA_STORAGES_KEY);
  return uniqueSorted([...STORAGE_OPTIONS, ...extras]);
}

export function ensureStorageOptionsExist(names: string[]): { added: string[] } {
  const known = new Set(getKnownStorageOptions().map(name => name.toLowerCase()));
  const extras = loadStringList(EXTRA_STORAGES_KEY);
  const added: string[] = [];

  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (known.has(key)) continue;
    extras.push(trimmed);
    known.add(key);
    added.push(trimmed);
  }

  if (added.length > 0) saveStringList(EXTRA_STORAGES_KEY, uniqueSorted(extras));
  return { added };
}

export function collectDraftsFromPlan(plan: SmartComponentImportPlan): SmartComponentImportDraft[] {
  return [
    ...plan.creates,
    ...plan.updates.map(update => update.draft),
  ];
}

function findNewValues(values: string[], knownValues: string[]): string[] {
  const known = new Set(knownValues.map(value => value.toLowerCase()));
  const added: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (known.has(key)) continue;
    known.add(key);
    added.push(trimmed);
  }
  return added;
}

function collectDraftUoms(drafts: SmartComponentImportDraft[]): string[] {
  return drafts.flatMap(draft => [
    draft.recipeUom,
    draft.inventoryUom,
    ...draft.altRecipeUnits.map(alt => alt.unit),
    ...draft.altInventoryUnits.map(alt => alt.unit),
  ]);
}

export function previewCatalogEnsuresFromPlan(
  plan: SmartComponentImportPlan,
  existingRows: ComponentRow[] = [],
): CatalogEnsureResult {
  const drafts = collectDraftsFromPlan(plan);
  const uoms = collectDraftUoms(drafts).map(normalizeRecipeUnitInput);
  return {
    groups: findNewValues(drafts.map(draft => draft.group), getKnownGroups(existingRows)),
    recipeUoms: findNewValues(uoms, getKnownRecipeUnits()),
    inventoryUoms: findNewValues(uoms, getKnownRecipeUnits()),
    storages: findNewValues(drafts.flatMap(draft => draft.storage), getKnownStorageOptions()),
  };
}

export function resolveGroupName(raw: string, existingRows: ComponentRow[] = []): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const match = getKnownGroups(existingRows).find(group => group.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
}

export function resolveStorageName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const match = getKnownStorageOptions().find(name => name.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
}

export function ensureComponentCatalogFromPlan(
  plan: SmartComponentImportPlan,
  existingRows: ComponentRow[] = [],
): CatalogEnsureResult {
  const drafts = collectDraftsFromPlan(plan);
  const uoms = collectDraftUoms(drafts);
  return {
    groups: ensureGroupsExist(drafts.map(draft => draft.group), existingRows).added,
    recipeUoms: ensureRecipeUnitsExist(uoms).added,
    inventoryUoms: ensureRecipeUnitsExist(uoms).added,
    storages: ensureStorageOptionsExist(drafts.flatMap(draft => draft.storage)).added,
  };
}

function normalizeAltUnits(units: SmartComponentImportDraft['altRecipeUnits']) {
  return units.map(unit => ({
    ...unit,
    unit: normalizeRecipeUnitInput(unit.unit),
  }));
}

export function normalizeImportDraft(
  draft: SmartComponentImportDraft,
  existingRows: ComponentRow[] = [],
): SmartComponentImportDraft {
  return {
    ...draft,
    group: resolveGroupName(draft.group, existingRows),
    recipeUom: normalizeRecipeUnitInput(draft.recipeUom),
    inventoryUom: normalizeRecipeUnitInput(draft.inventoryUom),
    altRecipeUnits: normalizeAltUnits(draft.altRecipeUnits),
    altInventoryUnits: normalizeAltUnits(draft.altInventoryUnits),
    storage: draft.storage.map(resolveStorageName).filter(Boolean),
    convertFromInventoryQty: draft.convertFromInventoryQty || '1',
    convertToRecipeQty: draft.convertToRecipeQty || '1',
  };
}
