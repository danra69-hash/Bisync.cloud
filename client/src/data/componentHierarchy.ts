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

const STORAGE_KEY = 'bisync.componentHierarchy';

function defaultState(): ComponentHierarchyState {
  const categories: ComponentCategory[] = [
    { id: 1, name: 'Food' },
    { id: 2, name: 'Beverage' },
  ];
  const groups: ComponentGroup[] = [
    { id: 1, categoryId: 1, name: 'Proteins', items: 12 },
    { id: 2, categoryId: 1, name: 'Dairy', items: 8 },
    { id: 3, categoryId: 1, name: 'Produce', items: 15 },
    { id: 4, categoryId: 2, name: 'Spirits', items: 24 },
    { id: 5, categoryId: 1, name: 'Dry Goods', items: 18 },
  ];
  const subGroups: ComponentSubGroup[] = [
    { id: 1, groupId: 1, name: 'Beef', items: 5 },
    { id: 2, groupId: 1, name: 'Poultry', items: 4 },
    { id: 3, groupId: 2, name: 'Cheese', items: 6 },
    { id: 4, groupId: 4, name: 'Whisky', items: 10 },
  ];
  return {
    categories,
    groups,
    subGroups,
    nextCategoryId: 3,
    nextGroupId: 6,
    nextSubGroupId: 5,
  };
}

export function loadComponentHierarchy(): ComponentHierarchyState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as ComponentHierarchyState;
    if (!parsed?.categories?.length) return defaultState();
    return {
      categories: parsed.categories ?? [],
      groups: parsed.groups ?? [],
      subGroups: parsed.subGroups ?? [],
      nextCategoryId: parsed.nextCategoryId ?? 1,
      nextGroupId: parsed.nextGroupId ?? 1,
      nextSubGroupId: parsed.nextSubGroupId ?? 1,
    };
  } catch {
    return defaultState();
  }
}

export function saveComponentHierarchy(state: ComponentHierarchyState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('bisync:componentHierarchyChanged'));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** First category + first group under it for new component defaults. */
export function getDefaultCategoryAndGroup(state: ComponentHierarchyState): { category: string; group: string } {
  const category = state.categories[0];
  if (!category) return { category: 'Food', group: 'Proteins' };
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
  const base = fromHierarchy.length > 0 ? fromHierarchy : fallback;
  const current = currentValue.trim();
  if (current && !base.some(name => name.toLowerCase() === current.toLowerCase())) {
    return uniqueSorted([...base, current]);
  }
  return uniqueSorted(base);
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
  const base = fromHierarchy.length > 0 ? fromHierarchy : (hasHierarchy ? [] : fallback);
  const current = currentValue.trim();
  if (current && !base.some(name => name.toLowerCase() === current.toLowerCase())) {
    return uniqueSorted([...base, current]);
  }
  return uniqueSorted(base);
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
