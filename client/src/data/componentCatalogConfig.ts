import { fromApiUom, RECIPE_UNITS, STORAGE_OPTIONS, toApiUom, type ComponentRow } from './componentForm';
import { siGroups } from './revenueManagement';
import type { SmartComponentImportDraft, SmartComponentImportPlan } from './smartComponentCatalog';
import {
  ensureComponentCatalog,
  getCachedComponentCatalog,
  saveComponentCatalogApi,
  type ComponentCatalogState,
} from './revMgmtConfigStore';

export type CatalogEnsureResult = {
  groups: string[];
  recipeUoms: string[];
  inventoryUoms: string[];
  storages: string[];
};

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function emptyCatalog(): ComponentCatalogState {
  return { extraGroups: [], extraUoms: [], extraStorages: [] };
}

function currentCatalog(): ComponentCatalogState {
  return getCachedComponentCatalog() ?? emptyCatalog();
}

let pendingCatalogCompanyId: number | null = null;

/** Company used for catalog writes when callers omit companyId. */
export function setComponentCatalogCompanyId(companyId: number | null) {
  pendingCatalogCompanyId = companyId;
}

export function getComponentCatalogCompanyId(): number | null {
  return pendingCatalogCompanyId;
}

function resolveCompanyId(companyId?: number | null): number | null {
  return companyId ?? pendingCatalogCompanyId;
}

function persistCatalog(next: ComponentCatalogState, companyId?: number | null) {
  const id = resolveCompanyId(companyId);
  if (!id) return;
  void saveComponentCatalogApi(id, next);
}

export async function loadComponentCatalogForCompany(companyId: number): Promise<ComponentCatalogState> {
  pendingCatalogCompanyId = companyId;
  return ensureComponentCatalog(companyId);
}

export function loadExtraGroups(): string[] {
  return currentCatalog().extraGroups;
}

export function saveExtraGroups(groups: string[], companyId?: number | null) {
  const next = {
    ...currentCatalog(),
    extraGroups: uniqueSorted(groups),
  };
  persistCatalog(next, companyId);
}

export function removeExtraGroup(groupName: string, companyId?: number | null): string[] {
  const key = groupName.trim().toLowerCase();
  const nextGroups = loadExtraGroups().filter(group => group.toLowerCase() !== key);
  saveExtraGroups(nextGroups, companyId);
  return nextGroups;
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

export function ensureGroupsExist(
  groups: string[],
  existingRows: ComponentRow[] = [],
  companyId?: number | null,
): { added: string[] } {
  const known = new Set(getKnownGroups(existingRows).map(group => group.toLowerCase()));
  const extras = [...loadExtraGroups()];
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

  if (added.length > 0) saveExtraGroups(extras, companyId);
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
  const extras = currentCatalog().extraUoms.map(normalizeRecipeUnitInput).filter(Boolean);
  return uniqueSorted([...RECIPE_UNITS, ...extras]);
}

export function ensureRecipeUnitsExist(units: string[], companyId?: number | null): { added: string[] } {
  const known = new Set(getKnownRecipeUnits().map(unit => unit.toLowerCase()));
  const extras = [...currentCatalog().extraUoms];
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

  if (added.length > 0) {
    persistCatalog({ ...currentCatalog(), extraUoms: uniqueSorted(extras) }, companyId);
  }
  return { added };
}

export function getKnownStorageOptions(): string[] {
  const extras = currentCatalog().extraStorages;
  return uniqueSorted([...STORAGE_OPTIONS, ...extras]);
}

export function ensureStorageOptionsExist(names: string[], companyId?: number | null): { added: string[] } {
  const known = new Set(getKnownStorageOptions().map(name => name.toLowerCase()));
  const extras = [...currentCatalog().extraStorages];
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

  if (added.length > 0) {
    persistCatalog({ ...currentCatalog(), extraStorages: uniqueSorted(extras) }, companyId);
  }
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
  companyId?: number | null,
): CatalogEnsureResult {
  const drafts = collectDraftsFromPlan(plan);
  const uoms = collectDraftUoms(drafts);
  return {
    groups: ensureGroupsExist(drafts.map(draft => draft.group), existingRows, companyId).added,
    recipeUoms: ensureRecipeUnitsExist(uoms, companyId).added,
    inventoryUoms: ensureRecipeUnitsExist(uoms, companyId).added,
    storages: ensureStorageOptionsExist(drafts.flatMap(draft => draft.storage), companyId).added,
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
