import {
  ensureComponentHierarchy,
  getCachedComponentHierarchy,
  saveComponentHierarchyApi,
} from './revMgmtConfigStore';

export type ComponentCategory = {
  id: number;
  name: string;
};

export type ComponentGroup = {
  id: number;
  categoryId: number;
  name: string;
  items: number;
};

export type ComponentSubGroup = {
  id: number;
  groupId: number;
  name: string;
  items: number;
};

export type ComponentHierarchyState = {
  categories: ComponentCategory[];
  groups: ComponentGroup[];
  subGroups: ComponentSubGroup[];
  nextCategoryId: number;
  nextGroupId: number;
  nextSubGroupId: number;
};

export type HierarchyAssignmentRow = {
  id: number;
  category: string;
  group: string;
  subGroup: string;
  items: number;
};

/** Empty hierarchy — no demo Food/Proteins/Beef residue. */
export function emptyComponentHierarchy(): ComponentHierarchyState {
  return {
    categories: [],
    groups: [],
    subGroups: [],
    nextCategoryId: 1,
    nextGroupId: 1,
    nextSubGroupId: 1,
  };
}

function defaultState(): ComponentHierarchyState {
  return emptyComponentHierarchy();
}

/** Legacy seeded demo tree shipped before hierarchy became user/component-owned. */
const LEGACY_SEED_GROUPS = new Set(['proteins', 'dairy', 'produce', 'spirits', 'dry goods']);
const LEGACY_SEED_SUBGROUPS = new Set(['beef', 'poultry', 'cheese', 'whisky']);

export function isLegacySeedHierarchy(state: ComponentHierarchyState): boolean {
  if (state.groups.some(g => !LEGACY_SEED_GROUPS.has(g.name.trim().toLowerCase()))) return false;
  if (state.subGroups.some(s => !LEGACY_SEED_SUBGROUPS.has(s.name.trim().toLowerCase()))) return false;
  const seedGroups = state.groups.filter(g => LEGACY_SEED_GROUPS.has(g.name.trim().toLowerCase())).length;
  const seedSubs = state.subGroups.filter(s => LEGACY_SEED_SUBGROUPS.has(s.name.trim().toLowerCase())).length;
  const fakeItems = state.groups.some(g => g.items > 0) || state.subGroups.some(s => s.items > 0);
  return (seedGroups >= 3 && seedSubs >= 2) || (seedGroups >= 4 && fakeItems);
}

/**
 * Drop unused legacy seed rows and ensure categories/groups from live components
 * exist in the hierarchy (wired to real ingredient Category/Group values).
 */
export function reconcileHierarchyWithComponents(
  state: ComponentHierarchyState,
  ingredients: { category?: string | null; group?: string | null }[],
): { state: ComponentHierarchyState; changed: boolean } {
  const counts = buildHierarchyAttachmentCounts(ingredients);
  let next = isLegacySeedHierarchy(state) ? emptyComponentHierarchy() : { ...state };

  // Strip seed residue that has no attached components.
  const keptGroups = next.groups.filter(group => {
    const cat = next.categories.find(c => c.id === group.categoryId)?.name ?? '';
    const attached = groupIngredientCount(counts, cat, group.name);
    if (attached > 0) return true;
    return !LEGACY_SEED_GROUPS.has(group.name.trim().toLowerCase());
  });
  const keptGroupIds = new Set(keptGroups.map(g => g.id));
  const keptSubGroups = next.subGroups.filter(sub => {
    if (!keptGroupIds.has(sub.groupId)) return false;
    const group = keptGroups.find(g => g.id === sub.groupId);
    if (!group) return false;
    const cat = next.categories.find(c => c.id === group.categoryId)?.name ?? '';
    const attached = groupIngredientCount(counts, cat, group.name);
    if (attached > 0) return true;
    return !LEGACY_SEED_SUBGROUPS.has(sub.name.trim().toLowerCase());
  });
  const keptCategoryIds = new Set(keptGroups.map(g => g.categoryId));
  // Keep non-seed empty categories the user may have just created.
  const keptCategories = next.categories.filter(cat => {
    if (keptCategoryIds.has(cat.id)) return true;
    const attached = categoryIngredientCount(counts, cat.name);
    if (attached > 0) return true;
    const isSeedCat = cat.name.trim().toLowerCase() === 'food'
      || cat.name.trim().toLowerCase() === 'beverage';
    // Drop unused Food/Beverage only when they came from the legacy seed rebuild path
    // or have no groups left and no components.
    if (isLegacySeedHierarchy(state) && isSeedCat && attached === 0) return false;
    return true;
  });

  next = {
    ...next,
    categories: keptCategories,
    groups: keptGroups,
    subGroups: keptSubGroups,
  };

  // Ensure every live component category/group is present.
  let nextCategoryId = Math.max(1, next.nextCategoryId, ...next.categories.map(c => c.id + 1));
  let nextGroupId = Math.max(1, next.nextGroupId, ...next.groups.map(g => g.id + 1));
  const categories = [...next.categories];
  const groups = [...next.groups];

  for (const ingredient of ingredients) {
    const categoryNameValue = (ingredient.category ?? '').trim();
    const groupNameValue = (ingredient.group ?? '').trim();
    if (!categoryNameValue) continue;

    let category = categories.find(
      c => c.name.trim().toLowerCase() === categoryNameValue.toLowerCase(),
    );
    if (!category) {
      category = { id: nextCategoryId++, name: categoryNameValue };
      categories.push(category);
    }

    if (!groupNameValue) continue;
    const exists = groups.some(
      g => g.categoryId === category!.id
        && g.name.trim().toLowerCase() === groupNameValue.toLowerCase(),
    );
    if (!exists) {
      groups.push({
        id: nextGroupId++,
        categoryId: category.id,
        name: groupNameValue,
        items: 0,
      });
    }
  }

  // Refresh item counts from live attachments.
  const withCounts: ComponentHierarchyState = {
    categories,
    groups: groups.map(group => {
      const cat = categories.find(c => c.id === group.categoryId)?.name ?? '';
      return { ...group, items: groupIngredientCount(counts, cat, group.name) };
    }),
    subGroups: next.subGroups.map(sub => {
      const group = groups.find(g => g.id === sub.groupId);
      if (!group) return { ...sub, items: 0 };
      const cat = categories.find(c => c.id === group.categoryId)?.name ?? '';
      return { ...sub, items: groupIngredientCount(counts, cat, group.name) };
    }),
    nextCategoryId,
    nextGroupId,
    nextSubGroupId: Math.max(1, next.nextSubGroupId, ...next.subGroups.map(s => s.id + 1)),
  };

  const changed = JSON.stringify(withCounts) !== JSON.stringify(state);
  return { state: withCounts, changed };
}

export function loadComponentHierarchy(): ComponentHierarchyState {
  return getCachedComponentHierarchy() ?? defaultState();
}

export async function loadComponentHierarchyForCompany(companyId: number): Promise<ComponentHierarchyState> {
  return ensureComponentHierarchy(companyId);
}

export function saveComponentHierarchy(state: ComponentHierarchyState, companyId?: number | null): void {
  if (!companyId) return;
  void saveComponentHierarchyApi(companyId, state);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** First category + first group under it for new component defaults. */
export function getDefaultCategoryAndGroup(state: ComponentHierarchyState): { category: string; group: string } {
  const category = state.categories[0];
  if (!category) return { category: '', group: '' };
  const groups = state.groups
    .filter(group => group.categoryId === category.id)
    .map(group => group.name);
  return {
    category: category.name,
    group: groups[0] ?? '',
  };
}

/** Category names for component detail dropdowns. */
export function getHierarchyCategoryOptions(
  state: ComponentHierarchyState,
  currentValue = '',
  fallback: string[] = [],
): string[] {
  const fromHierarchy = state.categories.map(category => category.name);
  // Always merge fallbacks (e.g. categories already used on components) so uploads
  // beyond the saved hierarchy still appear in detail/filter pickers.
  const base = uniqueSorted([
    ...(fromHierarchy.length > 0 ? fromHierarchy : []),
    ...fallback,
  ]);
  const current = currentValue.trim();
  if (current && !base.some(name => name.toLowerCase() === current.toLowerCase())) {
    return uniqueSorted([...base, current]);
  }
  return base;
}

/** Group names under a category for component detail dropdowns. */
export function getHierarchyGroupOptions(
  state: ComponentHierarchyState,
  categoryName: string,
  currentValue = '',
  fallback: string[] = [],
): string[] {
  const category = state.categories.find(
    item => item.name.toLowerCase() === categoryName.trim().toLowerCase(),
  );
  const hasHierarchy = state.categories.length > 0;
  const fromHierarchy = category
    ? state.groups.filter(group => group.categoryId === category.id).map(group => group.name)
    : hasHierarchy
      ? uniqueSorted(state.groups.map(group => group.name))
      : [];
  // Merge fallback groups from existing components even when hierarchy already has entries.
  const base = uniqueSorted([...fromHierarchy, ...fallback]);
  const current = currentValue.trim();
  if (current && !base.some(name => name.toLowerCase() === current.toLowerCase())) {
    return uniqueSorted([...base, current]);
  }
  return base;
}

export function flattenHierarchyForAssignment(state: ComponentHierarchyState): HierarchyAssignmentRow[] {
  const rows: HierarchyAssignmentRow[] = [];

  for (const subGroup of state.subGroups) {
    const group = state.groups.find(item => item.id === subGroup.groupId);
    const category = group ? state.categories.find(item => item.id === group.categoryId) : undefined;
    if (!group || !category) continue;
    rows.push({
      id: subGroup.id,
      category: category.name,
      group: group.name,
      subGroup: subGroup.name,
      items: subGroup.items,
    });
  }

  for (const group of state.groups) {
    const hasSubGroups = state.subGroups.some(item => item.groupId === group.id);
    if (hasSubGroups) continue;
    const category = state.categories.find(item => item.id === group.categoryId);
    if (!category) continue;
    rows.push({
      id: 100000 + group.id,
      category: category.name,
      group: group.name,
      subGroup: '—',
      items: group.items,
    });
  }

  return rows.sort((a, b) =>
    a.category.localeCompare(b.category)
    || a.group.localeCompare(b.group)
    || a.subGroup.localeCompare(b.subGroup),
  );
}

export function categoryName(state: ComponentHierarchyState, categoryId: number): string {
  return state.categories.find(item => item.id === categoryId)?.name ?? '—';
}

export function groupLabel(state: ComponentHierarchyState, groupId: number): string {
  const group = state.groups.find(item => item.id === groupId);
  if (!group) return '—';
  return `${categoryName(state, group.categoryId)} · ${group.name}`;
}

/** Live ingredient attachment counts keyed by lowercase category / category::group. */
export type HierarchyAttachmentCounts = {
  category: Record<string, number>;
  group: Record<string, number>;
};

export function emptyHierarchyAttachmentCounts(): HierarchyAttachmentCounts {
  return { category: {}, group: {} };
}

export function buildHierarchyAttachmentCounts(
  ingredients: { category?: string | null; group?: string | null }[],
): HierarchyAttachmentCounts {
  const category: Record<string, number> = {};
  const group: Record<string, number> = {};
  for (const ingredient of ingredients) {
    const cat = (ingredient.category ?? '').trim().toLowerCase();
    const grp = (ingredient.group ?? '').trim().toLowerCase();
    if (cat) category[cat] = (category[cat] ?? 0) + 1;
    if (grp) {
      const key = cat ? `${cat}::${grp}` : `::${grp}`;
      group[key] = (group[key] ?? 0) + 1;
    }
  }
  return { category, group };
}

function categoryIngredientCount(counts: HierarchyAttachmentCounts, name: string): number {
  return counts.category[name.trim().toLowerCase()] ?? 0;
}

function groupIngredientCount(
  counts: HierarchyAttachmentCounts,
  categoryNameValue: string,
  groupNameValue: string,
): number {
  const cat = categoryNameValue.trim().toLowerCase();
  const grp = groupNameValue.trim().toLowerCase();
  if (!grp) return 0;
  const keyed = counts.group[`${cat}::${grp}`] ?? 0;
  const loose = counts.group[`::${grp}`] ?? 0;
  return keyed + (keyed > 0 ? 0 : loose);
}

/** Category delete blocked when it has groups or any attached components. */
export function categoryDeleteBlocked(
  state: ComponentHierarchyState,
  categoryId: number,
  counts: HierarchyAttachmentCounts,
): { blocked: boolean; reason: string } {
  const category = state.categories.find(item => item.id === categoryId);
  if (!category) return { blocked: true, reason: 'Category not found.' };
  const childGroups = state.groups.filter(item => item.categoryId === categoryId).length;
  if (childGroups > 0) {
    return {
      blocked: true,
      reason: `Cannot delete: ${childGroups} group${childGroups === 1 ? '' : 's'} attached. Remove groups first.`,
    };
  }
  const attached = categoryIngredientCount(counts, category.name);
  if (attached > 0) {
    return {
      blocked: true,
      reason: `Cannot delete: ${attached} component${attached === 1 ? '' : 's'} attached under this category.`,
    };
  }
  return { blocked: false, reason: 'Delete category' };
}

/** Group delete blocked when it has sub-groups or any attached components. */
export function groupDeleteBlocked(
  state: ComponentHierarchyState,
  groupId: number,
  counts: HierarchyAttachmentCounts,
): { blocked: boolean; reason: string; componentCount: number } {
  const group = state.groups.find(item => item.id === groupId);
  if (!group) return { blocked: true, reason: 'Group not found.', componentCount: 0 };
  const childSubs = state.subGroups.filter(item => item.groupId === groupId).length;
  const catName = categoryName(state, group.categoryId);
  const componentCount = groupIngredientCount(counts, catName, group.name);
  if (childSubs > 0) {
    return {
      blocked: true,
      reason: `Cannot delete: ${childSubs} sub-group${childSubs === 1 ? '' : 's'} attached. Remove sub-groups first.`,
      componentCount,
    };
  }
  if (componentCount > 0) {
    return {
      blocked: true,
      reason: `Cannot delete: ${componentCount} component${componentCount === 1 ? '' : 's'} attached under this group.`,
      componentCount,
    };
  }
  return { blocked: false, reason: 'Delete group', componentCount: 0 };
}

/**
 * Sub-group delete blocked when components are attached under its parent group
 * (components are assigned at category/group level today) or the row still has a stored count.
 */
export function subGroupDeleteBlocked(
  state: ComponentHierarchyState,
  subGroupId: number,
  counts: HierarchyAttachmentCounts,
): { blocked: boolean; reason: string; componentCount: number } {
  const subGroup = state.subGroups.find(item => item.id === subGroupId);
  if (!subGroup) return { blocked: true, reason: 'Sub-group not found.', componentCount: 0 };
  const group = state.groups.find(item => item.id === subGroup.groupId);
  if (!group) return { blocked: true, reason: 'Parent group not found.', componentCount: 0 };
  const catName = categoryName(state, group.categoryId);
  const componentCount = groupIngredientCount(counts, catName, group.name);
  if (componentCount > 0) {
    return {
      blocked: true,
      reason: `Cannot delete: ${componentCount} component${componentCount === 1 ? '' : 's'} attached under this group/sub-group.`,
      componentCount,
    };
  }
  return { blocked: false, reason: 'Delete sub-group', componentCount: 0 };
}
