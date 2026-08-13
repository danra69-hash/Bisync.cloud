/**
 * System-wide Category → Group filter helpers.
 * Group options must always be scoped to the selected Category when one is chosen.
 */
import {
  getHierarchyGroupOptions,
  loadComponentHierarchy,
} from './componentHierarchy';
import {
  getSiCategoryFilterOptions,
  getSiGroupFilterOptions,
} from './revenueManagement';
import { labelsEqual, uniqueLabelsPreferCanonical } from '../utils/labelMatch';

export type CategoryGroupRow = {
  category?: string | null;
  group?: string | null;
};

/** Category dropdown options (includes "All"). */
export function listCategoryFilterOptions(rowCategories: string[] = []): string[] {
  return getSiCategoryFilterOptions(rowCategories);
}

/**
 * Group dropdown options scoped to the selected category.
 * When category is "All"/empty, returns groups across the catalog.
 */
export function listGroupFilterOptions(
  rows: CategoryGroupRow[],
  categoryFilter: string,
  extras: string[] = [],
): string[] {
  const scoped = isSpecificCategory(categoryFilter)
    ? rows.filter(row => labelsEqual(row.category, categoryFilter))
    : rows;
  const fromRows = scoped
    .map(row => (row.group ?? '').trim())
    .filter(Boolean);
  return getSiGroupFilterOptions([...fromRows, ...extras], categoryFilter || 'All');
}

/** Group options for create/edit forms (no "All"). */
export function listGroupFormOptions(
  categoryName: string,
  rows: CategoryGroupRow[] = [],
  currentGroup = '',
  extras: string[] = [],
): string[] {
  const category = categoryName.trim();
  if (!category) {
    return uniqueLabelsPreferCanonical([
      ...extras,
      ...(currentGroup.trim() ? [currentGroup.trim()] : []),
    ]);
  }

  const hierarchy = loadComponentHierarchy();
  const scopedRows = rows.filter(row => labelsEqual(row.category, category));
  const fromRows = scopedRows.map(row => (row.group ?? '').trim()).filter(Boolean);
  const fromHierarchy = getHierarchyGroupOptions(hierarchy, category, currentGroup, []);
  return uniqueLabelsPreferCanonical(
    [...fromHierarchy, ...fromRows, ...extras, ...(currentGroup.trim() ? [currentGroup] : [])],
  );
}

export function isSpecificCategory(categoryFilter: string | null | undefined): boolean {
  const value = (categoryFilter ?? '').trim();
  return Boolean(value) && value.toLowerCase() !== 'all';
}

/** True when the group belongs under the selected category (or category is All). */
export function isGroupValidForCategory(
  group: string,
  categoryFilter: string,
  rows: CategoryGroupRow[] = [],
): boolean {
  const g = group.trim();
  if (!g || g.toLowerCase() === 'all') return true;
  if (!isSpecificCategory(categoryFilter)) return true;

  const options = listGroupFilterOptions(rows, categoryFilter);
  return options.some(option => option === 'All' || labelsEqual(option, g));
}

/**
 * When Category changes, clear Group if it is no longer valid under the new category.
 * Returns the next group filter value.
 */
export function coerceGroupFilterForCategory(
  groupFilter: string,
  categoryFilter: string,
  rows: CategoryGroupRow[],
): string {
  if (!groupFilter || groupFilter === 'All') return groupFilter || 'All';
  if (isGroupValidForCategory(groupFilter, categoryFilter, rows)) return groupFilter;
  return 'All';
}
