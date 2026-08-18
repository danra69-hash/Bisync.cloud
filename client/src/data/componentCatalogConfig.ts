import { RECIPE_UNITS, STORAGE_OPTIONS, type ComponentRow } from './componentForm';
import { resolveSiCategoryName, siGroups } from './revenueManagement';
import type { SmartComponentImportDraft, SmartComponentImportPlan } from './smartComponentCatalog';
import {
  ensureComponentCatalog,
  getCachedComponentCatalog,
  saveComponentCatalogApi,
  setCachedComponentCatalog,
  type ComponentCatalogState,
} from './revMgmtConfigStore';
import {
  ensureAreaStorageAssignmentFromPlan,
  loadStorageAssignment,
} from './storageAssignment';

export type CatalogEnsureResult = {
  groups: string[];
  recipeUoms: string[];
  inventoryUoms: string[];
  storages: string[];
  areas: string[];
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
  return { extraGroups: [], extraUoms: [], myUoms: [], extraStorages: [], hiddenUoms: [] };
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

function persistCatalog(next: ComponentCatalogState, companyId?: number | null): void {
  const id = resolveCompanyId(companyId);
  if (!id) {
    setCachedComponentCatalog(next);
    return;
  }
  void saveComponentCatalogApi(id, next);
}

async function persistCatalogAsync(
  next: ComponentCatalogState,
  companyId?: number | null,
): Promise<void> {
  const id = resolveCompanyId(companyId);
  if (!id) {
    setCachedComponentCatalog(next);
    return;
  }
  await saveComponentCatalogApi(id, next);
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
  // Keep custom catalog spellings (Box, Ctn, Carton, …). Do not fold via API maps
  // (e.g. box→Case) or newly typed UOMs disappear as "already exists".
  return trimmed;
}

export function isBuiltinRecipeUnit(unit: string): boolean {
  const trimmed = unit.trim();
  if (!trimmed) return false;
  // Exact built-in match only — do not treat aliases like "Gram"/"Liter" as built-ins.
  return RECIPE_UNITS.some(builtin => builtin.toLowerCase() === trimmed.toLowerCase());
}

function hiddenUomKeys(): Set<string> {
  return new Set(
    (currentCatalog().hiddenUoms ?? []).map(unit => unit.trim().toLowerCase()).filter(Boolean),
  );
}

export function isRecipeUnitHidden(unit: string): boolean {
  const trimmed = unit.trim();
  if (!trimmed) return false;
  const hidden = hiddenUomKeys();
  if (hidden.has(trimmed.toLowerCase())) return true;
  const exactBuiltin = RECIPE_UNITS.find(builtin => builtin.toLowerCase() === trimmed.toLowerCase());
  return exactBuiltin ? hidden.has(exactBuiltin.toLowerCase()) : false;
}

/** Every All-UOM row can be edited or removed (custom delete / built-in hide). */
export function isManageableRecipeUnit(unit: string): boolean {
  return Boolean(unit.trim());
}

/** @deprecated Use isManageableRecipeUnit — kept for call sites expecting the old name. */
export function isDeletableRecipeUnit(unit: string): boolean {
  return isManageableRecipeUnit(unit);
}

/**
 * Rename target: keep the user's typed spelling.
 * Only canonicalizes casing when it exactly matches a built-in code (e.g. "kg" → "Kg").
 */
export function resolveRenameTarget(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const exactBuiltin = RECIPE_UNITS.find(unit => unit.toLowerCase() === trimmed.toLowerCase());
  return exactBuiltin ?? trimmed;
}

export function getKnownRecipeUnits(): string[] {
  const hidden = hiddenUomKeys();
  // Preserve custom spellings in extraUoms — never alias-fold them back to built-ins.
  const extras = currentCatalog().extraUoms
    .map(unit => unit.trim())
    .filter(unit => unit && !isBuiltinRecipeUnit(unit) && !hidden.has(unit.toLowerCase()));
  const builtins = RECIPE_UNITS.filter(unit => !hidden.has(unit.toLowerCase()));
  return uniqueSortedUnits([...builtins, ...extras], [...extras, ...RECIPE_UNITS]);
}

export function getMyRecipeUnits(): string[] {
  const hidden = hiddenUomKeys();
  return uniqueSortedUnits(
    currentCatalog().myUoms
      .map(unit => {
        const trimmed = unit.trim();
        if (!trimmed) return '';
        if (isBuiltinRecipeUnit(trimmed)) return resolveRenameTarget(trimmed);
        return trimmed;
      })
      .filter(unit => unit && !hidden.has(unit.toLowerCase())),
    [...currentCatalog().extraUoms, ...RECIPE_UNITS],
  );
}

export function saveMyRecipeUnits(units: string[], companyId?: number | null) {
  const next = {
    ...currentCatalog(),
    myUoms: uniqueSortedUnits(
      units.map(unit => unit.trim()).filter(Boolean),
      [...currentCatalog().extraUoms, ...RECIPE_UNITS],
    ),
  };
  persistCatalog(next, companyId);
}

/** De-dupe catalog UOMs without destroying custom spellings (Gram, Liter, ctn, …). */
export function sanitizeRecipeUnitsCatalog(companyId?: number | null): {
  removedExtras: string[];
  changed: boolean;
} {
  const catalog = currentCatalog();
  const nextExtras = uniqueSortedUnits(
    catalog.extraUoms
      .map(unit => unit.trim())
      .filter(unit => unit && !isBuiltinRecipeUnit(unit)),
    catalog.extraUoms,
  );
  const nextMy = uniqueSortedUnits(
    catalog.myUoms.map(unit => unit.trim()).filter(Boolean),
    [...nextExtras, ...RECIPE_UNITS],
  );
  const nextHidden = uniqueSortedUnits(
    (catalog.hiddenUoms ?? []).map(unit => {
      const trimmed = unit.trim();
      const exactBuiltin = RECIPE_UNITS.find(builtin => builtin.toLowerCase() === trimmed.toLowerCase());
      return exactBuiltin ?? trimmed;
    }).filter(Boolean),
    RECIPE_UNITS,
  );
  const prevExtras = uniqueSorted(catalog.extraUoms);
  const prevMy = uniqueSorted(catalog.myUoms);
  const prevHidden = uniqueSorted(catalog.hiddenUoms ?? []);
  const removedExtras = prevExtras.filter(
    old => !nextExtras.some(next => next.toLowerCase() === old.trim().toLowerCase())
      && !isBuiltinRecipeUnit(old),
  );
  const changed =
    JSON.stringify(prevExtras.map(v => v.trim().toLowerCase()).sort()) !== JSON.stringify(nextExtras.map(v => v.toLowerCase()).sort())
    || JSON.stringify(prevMy.map(v => v.trim().toLowerCase()).sort()) !== JSON.stringify(nextMy.map(v => v.toLowerCase()).sort())
    || JSON.stringify(prevHidden.map(v => v.toLowerCase()).sort()) !== JSON.stringify(nextHidden.map(v => v.toLowerCase()).sort());

  if (changed) {
    persistCatalog({ ...catalog, extraUoms: nextExtras, myUoms: nextMy, hiddenUoms: nextHidden }, companyId);
  }
  return { removedExtras, changed };
}

export function removeRecipeUnit(unit: string, companyId?: number | null): { mode: 'deleted' | 'hidden' } {
  const key = unit.trim().toLowerCase();
  const catalog = currentCatalog();

  if (isBuiltinRecipeUnit(unit)) {
    const canon = resolveRenameTarget(unit);
    const hidden = uniqueSortedUnits(
      [...(catalog.hiddenUoms ?? []), canon],
      RECIPE_UNITS,
    );
    const nextMy = catalog.myUoms.filter(extra => extra.trim().toLowerCase() !== key);
    persistCatalog(
      {
        ...catalog,
        hiddenUoms: hidden,
        myUoms: uniqueSortedUnits(nextMy.map(v => v.trim()).filter(Boolean), [...catalog.extraUoms, ...RECIPE_UNITS]),
      },
      companyId,
    );
    return { mode: 'hidden' };
  }

  const nextExtras = catalog.extraUoms.filter(extra => extra.trim().toLowerCase() !== key);
  const nextMy = catalog.myUoms.filter(extra => extra.trim().toLowerCase() !== key);
  persistCatalog(
    {
      ...catalog,
      extraUoms: uniqueSortedUnits(nextExtras.map(v => v.trim()).filter(Boolean), nextExtras),
      myUoms: uniqueSortedUnits(nextMy.map(v => v.trim()).filter(Boolean), [...nextExtras, ...RECIPE_UNITS]),
    },
    companyId,
  );
  return { mode: 'deleted' };
}

/** @deprecated Prefer removeRecipeUnit */
export function removeExtraRecipeUnit(unit: string, companyId?: number | null): string[] {
  removeRecipeUnit(unit, companyId);
  return loadExtraRecipeUnits();
}

export function loadExtraRecipeUnits(): string[] {
  return uniqueSortedUnits(
    currentCatalog().extraUoms
      .map(unit => unit.trim())
      .filter(unit => unit && !isBuiltinRecipeUnit(unit)),
    currentCatalog().extraUoms,
  );
}

export async function renameRecipeUnit(
  fromRaw: string,
  toRaw: string,
  companyId?: number | null,
): Promise<{ ok: true; from: string; to: string } | { ok: false; message: string }> {
  const from = fromRaw.trim();
  const to = resolveRenameTarget(toRaw);
  if (!from) return { ok: false, message: 'Current UOM is required.' };
  if (!to) return { ok: false, message: 'Enter a new UOM name.' };
  if (from.toLowerCase() === to.toLowerCase()) {
    return { ok: false, message: 'New name is the same as the current name.' };
  }

  const catalog = currentCatalog();
  const fromKey = from.toLowerCase();
  const replaceUnit = (value: string) => (
    value.trim().toLowerCase() === fromKey ? to : value.trim()
  );

  let nextExtras = uniqueSortedUnits(
    catalog.extraUoms
      .map(replaceUnit)
      .filter(unit => unit && !isBuiltinRecipeUnit(unit)),
    [to, ...catalog.extraUoms],
  );
  if (!isBuiltinRecipeUnit(to) && !nextExtras.some(unit => unit.toLowerCase() === to.toLowerCase())) {
    nextExtras = uniqueSortedUnits([...nextExtras, to], [to, ...nextExtras]);
  }

  const nextMy = uniqueSortedUnits(
    catalog.myUoms.map(replaceUnit).filter(Boolean),
    [to, ...nextExtras, ...RECIPE_UNITS],
  );

  let nextHidden = [...(catalog.hiddenUoms ?? [])];
  if (isBuiltinRecipeUnit(from)) {
    const fromCanon = resolveRenameTarget(from);
    if (!nextHidden.some(unit => unit.toLowerCase() === fromCanon.toLowerCase())) {
      nextHidden.push(fromCanon);
    }
  }
  if (isBuiltinRecipeUnit(to)) {
    const toCanon = resolveRenameTarget(to);
    nextHidden = nextHidden.filter(unit => unit.toLowerCase() !== toCanon.toLowerCase());
  }

  await persistCatalogAsync(
    {
      ...catalog,
      extraUoms: nextExtras,
      myUoms: nextMy,
      hiddenUoms: uniqueSortedUnits(nextHidden, RECIPE_UNITS),
    },
    companyId,
  );
  return { ok: true, from, to };
}

export function ensureRecipeUnitsExist(units: string[], companyId?: number | null): { added: string[] } {
  const catalog = currentCatalog();
  const known = new Set(getKnownRecipeUnits().map(unit => unit.toLowerCase()));
  const extras = [...catalog.extraUoms];
  const added: string[] = [];
  const hidden = hiddenUomKeys();

  for (const unit of units) {
    const trimmed = (unit ?? '').trim();
    if (!trimmed) continue;

    // Never restore a built-in the company intentionally hid/renamed.
    if (isBuiltinRecipeUnit(trimmed) && hidden.has(trimmed.toLowerCase())) {
      continue;
    }
    const folded = normalizeRecipeUnitInput(trimmed);
    if (isBuiltinRecipeUnit(folded) && hidden.has(folded.toLowerCase())) {
      // Ingredient still uses an alias of a hidden built-in — keep/add the typed custom form.
      const key = trimmed.toLowerCase();
      if (known.has(key) || extras.some(extra => extra.toLowerCase() === key)) continue;
      if (!isBuiltinRecipeUnit(trimmed)) {
        extras.push(trimmed);
        known.add(key);
        added.push(trimmed);
      }
      continue;
    }

    if (isBuiltinRecipeUnit(trimmed) || (isBuiltinRecipeUnit(folded) && !hidden.has(folded.toLowerCase()))) {
      known.add(folded.toLowerCase());
      continue;
    }

    const key = trimmed.toLowerCase();
    if (known.has(key) || extras.some(extra => extra.toLowerCase() === key)) continue;
    extras.push(trimmed);
    known.add(key);
    added.push(trimmed);
  }

  if (added.length > 0) {
    persistCatalog(
      {
        ...currentCatalog(),
        extraUoms: uniqueSortedUnits(
          extras.map(unit => unit.trim()).filter(unit => unit && !isBuiltinRecipeUnit(unit)),
          extras,
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
  const knownAreas = loadStorageAssignment().areas;
  return {
    groups: findNewValues(drafts.map(draft => draft.group), getKnownGroups(existingRows)),
    recipeUoms: findNewValues(uoms, getKnownRecipeUnits()),
    inventoryUoms: findNewValues(uoms, getKnownRecipeUnits()),
    storages: findNewValues(drafts.flatMap(draft => draft.storage), getKnownStorageOptions()),
    areas: findNewValues(drafts.map(draft => draft.area), knownAreas),
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
    areas: [],
  };
}

/** Catalog extras + My Storage areas/entries from non-blank Area / Storage cells. */
export async function ensureComponentCatalogAndStorageFromPlan(
  plan: SmartComponentImportPlan,
  existingRows: ComponentRow[] = [],
  companyId?: number | null,
  locationIds: string[] = [],
): Promise<CatalogEnsureResult> {
  const base = ensureComponentCatalogFromPlan(plan, existingRows, companyId);
  const drafts = collectDraftsFromPlan(plan);
  const areaStorage = await ensureAreaStorageAssignmentFromPlan(drafts, locationIds, companyId);
  // Storage types also land in component catalog extras when brand-new.
  if (areaStorage.storages.length > 0) {
    ensureStorageOptionsExist(areaStorage.storages, companyId);
  }
  return {
    ...base,
    areas: areaStorage.areas,
    storages: uniqueSorted([...base.storages, ...areaStorage.storages]),
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
    category: draft.category.trim()
      ? resolveCategoryName(draft.category, existingRows)
      : draft.category,
    group: draft.group.trim()
      ? resolveGroupName(draft.group, existingRows)
      : draft.group,
    recipeUom: normalizeRecipeUnitInput(draft.recipeUom),
    inventoryUom: normalizeRecipeUnitInput(draft.inventoryUom),
    altRecipeUnits: normalizeAltUnits(draft.altRecipeUnits),
    altInventoryUnits: normalizeAltUnits(draft.altInventoryUnits),
    storage: draft.storage.map(resolveStorageName).filter(Boolean),
    convertFromInventoryQty: draft.convertFromInventoryQty || '1',
    convertToRecipeQty: draft.convertToRecipeQty || '1',
  };
}
