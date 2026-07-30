import { fromApiUom, RECIPE_UNITS, STORAGE_OPTIONS, toApiUom, type ComponentRow } from './componentForm';
import { resolveSiCategoryName, siGroups } from './revenueManagement';
import type { SmartComponentImportDraft, SmartComponentImportPlan } from './smartComponentCatalog';
import {
  ensureComponentCatalog,
  getCachedComponentCatalog,
  saveComponentCatalogApi,
  setCachedComponentCatalog,
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

/** Case-insensitive unique; prefers RECIPE_UNITS / preferred casing. */
function uniqueSortedUnits(values: string[], preferred: readonly string[] = RECIPE_UNITS): string[] {
  const preferredByKey = new Map(
    preferred.map(value => [value.trim().toLowerCase(), value.trim()] as const).filter(([key]) => key),
  );
  const byKey = new Map<string, string>();
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    const preferredLabel = preferredByKey.get(key);
    if (!byKey.has(key)) {
      byKey.set(key, preferredLabel ?? trimmed);
    } else if (preferredLabel) {
      byKey.set(key, preferredLabel);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

function emptyCatalog(): ComponentCatalogState {
  return { extraGroups: [], extraUoms: [], myUoms: [], extraStorages: [] };
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
  if (!id) {
    setCachedComponentCatalog(next);
    return;
  }
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
  const aliases: Record<string, string> = {
    gr: 'Gr',
    gram: 'Gr',
    grams: 'Gr',
    g: 'Gr',
    kg: 'Kg',
    lt: 'Ltr',
    l: 'Ltr',
    ltr: 'Ltr',
    litre: 'Ltr',
    liter: 'Ltr',
    ml: 'Ml',
    btl: 'Bottle',
    bottle: 'Bottle',
    pcs: 'Each',
    each: 'Each',
  };
  const lower = trimmed.toLowerCase();
  if (aliases[lower]) return aliases[lower];
  const builtin = RECIPE_UNITS.find(unit => unit.toLowerCase() === lower);
  if (builtin) return builtin;
  const mapped = fromApiUom(toApiUom(trimmed));
  const mappedBuiltin = RECIPE_UNITS.find(unit => unit.toLowerCase() === mapped.toLowerCase());
  return mappedBuiltin ?? mapped;
}

export function isBuiltinRecipeUnit(unit: string): boolean {
  const normalized = normalizeRecipeUnitInput(unit);
  if (!normalized) return false;
  return RECIPE_UNITS.some(builtin => builtin.toLowerCase() === normalized.toLowerCase());
}

export function isDeletableRecipeUnit(unit: string): boolean {
  const normalized = normalizeRecipeUnitInput(unit);
  if (!normalized || isBuiltinRecipeUnit(normalized)) return false;
  return currentCatalog().extraUoms.some(
    extra => normalizeRecipeUnitInput(extra).toLowerCase() === normalized.toLowerCase()
      || extra.trim().toLowerCase() === unit.trim().toLowerCase(),
  );
}

export function getKnownRecipeUnits(): string[] {
  const extras = currentCatalog().extraUoms.map(normalizeRecipeUnitInput).filter(Boolean);
  return uniqueSortedUnits([...RECIPE_UNITS, ...extras], RECIPE_UNITS);
}

export function getMyRecipeUnits(): string[] {
  return uniqueSortedUnits(
    currentCatalog().myUoms.map(normalizeRecipeUnitInput).filter(Boolean),
    RECIPE_UNITS,
  );
}

export function saveMyRecipeUnits(units: string[], companyId?: number | null) {
  const next = {
    ...currentCatalog(),
    myUoms: uniqueSortedUnits(units.map(normalizeRecipeUnitInput).filter(Boolean), RECIPE_UNITS),
  };
  persistCatalog(next, companyId);
}

/** Normalize / de-dupe extraUoms + myUoms (case-insensitive, alias fold). */
export function sanitizeRecipeUnitsCatalog(companyId?: number | null): {
  removedExtras: string[];
  changed: boolean;
} {
  const catalog = currentCatalog();
  const nextExtras = uniqueSortedUnits(
    catalog.extraUoms
      .map(normalizeRecipeUnitInput)
      .filter(unit => unit && !isBuiltinRecipeUnit(unit)),
    RECIPE_UNITS,
  );
  const nextMy = uniqueSortedUnits(
    catalog.myUoms.map(normalizeRecipeUnitInput).filter(Boolean),
    RECIPE_UNITS,
  );
  const prevExtras = uniqueSorted(catalog.extraUoms);
  const prevMy = uniqueSorted(catalog.myUoms);
  const removedExtras = prevExtras.filter(
    old => !nextExtras.some(next => next.toLowerCase() === normalizeRecipeUnitInput(old).toLowerCase())
      && !isBuiltinRecipeUnit(old),
  );
  const changed =
    JSON.stringify(prevExtras.map(normalizeRecipeUnitInput).sort()) !== JSON.stringify([...nextExtras].sort())
    || JSON.stringify(prevMy.map(normalizeRecipeUnitInput).sort()) !== JSON.stringify([...nextMy].sort());

  if (changed) {
    persistCatalog({ ...catalog, extraUoms: nextExtras, myUoms: nextMy }, companyId);
  }
  return { removedExtras, changed };
}

export function removeExtraRecipeUnit(unit: string, companyId?: number | null): string[] {
  const key = unit.trim().toLowerCase();
  const normalizedKey = normalizeRecipeUnitInput(unit).toLowerCase();
  if (!key || isBuiltinRecipeUnit(unit)) return loadExtraRecipeUnits();
  const nextExtras = currentCatalog().extraUoms.filter(extra => {
    const extraKey = extra.trim().toLowerCase();
    const extraNorm = normalizeRecipeUnitInput(extra).toLowerCase();
    return extraKey !== key && extraNorm !== normalizedKey;
  });
  const nextMy = currentCatalog().myUoms.filter(extra => {
    const extraKey = extra.trim().toLowerCase();
    const extraNorm = normalizeRecipeUnitInput(extra).toLowerCase();
    return extraKey !== key && extraNorm !== normalizedKey;
  });
  persistCatalog(
    {
      ...currentCatalog(),
      extraUoms: uniqueSortedUnits(nextExtras.map(normalizeRecipeUnitInput).filter(u => u && !isBuiltinRecipeUnit(u)), RECIPE_UNITS),
      myUoms: uniqueSortedUnits(nextMy.map(normalizeRecipeUnitInput).filter(Boolean), RECIPE_UNITS),
    },
    companyId,
  );
  return loadExtraRecipeUnits();
}

export function loadExtraRecipeUnits(): string[] {
  return uniqueSortedUnits(
    currentCatalog().extraUoms.map(normalizeRecipeUnitInput).filter(unit => unit && !isBuiltinRecipeUnit(unit)),
    RECIPE_UNITS,
  );
}

export function renameRecipeUnit(
  fromRaw: string,
  toRaw: string,
  companyId?: number | null,
): { ok: true; from: string; to: string } | { ok: false; message: string } {
  const from = fromRaw.trim();
  const to = normalizeRecipeUnitInput(toRaw);
  if (!from) return { ok: false, message: 'Current UOM is required.' };
  if (!to) return { ok: false, message: 'Enter a new UOM name.' };
  if (from.toLowerCase() === to.toLowerCase()) {
    return { ok: false, message: 'New name is the same as the current name.' };
  }
  if (!isDeletableRecipeUnit(from)) {
    return { ok: false, message: 'Only custom (added) UOMs can be renamed.' };
  }

  const catalog = currentCatalog();
  const fromKey = from.toLowerCase();
  const replaceUnit = (value: string) => (
    value.trim().toLowerCase() === fromKey ? to : value
  );

  const nextExtras = uniqueSortedUnits(
    catalog.extraUoms
      .map(replaceUnit)
      .map(normalizeRecipeUnitInput)
      .filter(unit => unit && !isBuiltinRecipeUnit(unit)),
    RECIPE_UNITS,
  );
  const extrasClean = isBuiltinRecipeUnit(to)
    ? nextExtras.filter(unit => unit.toLowerCase() !== to.toLowerCase())
    : nextExtras.some(unit => unit.toLowerCase() === to.toLowerCase())
      ? nextExtras
      : uniqueSortedUnits([...nextExtras, to], RECIPE_UNITS);

  const nextMy = uniqueSortedUnits(
    catalog.myUoms.map(replaceUnit).map(normalizeRecipeUnitInput).filter(Boolean),
    RECIPE_UNITS,
  );

  persistCatalog({ ...catalog, extraUoms: extrasClean, myUoms: nextMy }, companyId);
  return { ok: true, from, to };
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
    persistCatalog(
      {
        ...currentCatalog(),
        extraUoms: uniqueSortedUnits(
          extras.map(normalizeRecipeUnitInput).filter(unit => unit && !isBuiltinRecipeUnit(unit)),
          RECIPE_UNITS,
        ),
      },
      companyId,
    );
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

export function resolveCategoryName(raw: string, existingRows: ComponentRow[] = []): string {
  return resolveSiCategoryName(
    raw,
    existingRows.map(row => row.category).filter(Boolean),
  );
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
    category: resolveCategoryName(draft.category, existingRows),
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
