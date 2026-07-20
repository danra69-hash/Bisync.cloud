import { loadComponentHierarchy } from './componentHierarchy';

export type RevMgmtItem = { label: string };
export type RevMgmtSubSection = { subtitle?: string; items: RevMgmtItem[] };
export type RevMgmtSection = { title: string; subs: RevMgmtSubSection[] };

/** Nav labels for Active Sales / Sales Order (CK, warehouse, distributor, manufacturer). */
export const SUPPLY_SIDE_NAV_LABELS = new Set([
  'Active Sales',
  'Sales Order',
]);

/** Nav labels for B2B Product management (CK / warehouse and manufacturer only). */
export const B2B_PRODUCT_NAV_LABELS = new Set([
  'B2B Product',
]);

export const revMgmtNav: RevMgmtSection[] = [
  {
    title: 'Operation',
    subs: [
      {
        subtitle: 'Order',
        items: [
          { label: 'My Order' },
          { label: 'Cash Purchase' },
          { label: 'Order Template' },
        ],
      },
      {
        subtitle: 'Production',
        items: [
          { label: 'Production' },
        ],
      },
      {
        subtitle: 'Inventory',
        items: [
          { label: 'Stock Card' },
          { label: 'Inventory' },
          { label: 'Wastage' },
          { label: 'Transfer' },
          { label: 'Inventory Config' },
        ],
      },
    ],
  },
  {
    title: 'Component',
    subs: [
      {
        items: [
          { label: 'Smart Component' },
          { label: 'Component Config' },
          { label: 'Account Mapping' },
        ],
      },
    ],
  },
  {
    title: 'Vendors',
    subs: [
      {
        items: [
          { label: 'Vendor List & Products' },
          { label: 'Compare Price' },
          { label: 'Account Mapping' },
        ],
      },
    ],
  },
  {
    title: 'Products',
    subs: [
      {
        items: [
          { label: 'Products' },
          { label: 'Account Mapping' },
          { label: 'External POS Mapping' },
        ],
      },
    ],
  },
  {
    title: 'Sales',
    subs: [
      {
        items: [
          { label: 'Sales Order' },
          { label: 'Customer List' },
          { label: 'Customer Group' },
          { label: 'Customer Management' },
          { label: 'Promotion Scheduler' },
          { label: 'Account Mapping' },
        ],
      },
    ],
  },
  {
    title: 'Reports',
    subs: [
      {
        items: [
          { label: 'Itemized Sales Summary' },
          { label: 'Inventory Summary' },
          { label: 'Detailed Purchase Summary' },
          { label: 'Production Report' },
          { label: 'Wastage Report' },
        ],
      },
    ],
  },
];

/** Hide Active Sales / Sales Order / B2B Product nav by business-type capability. */
export function filterRevMgmtNavForSupplyCapability(
  sections: RevMgmtSection[],
  hasSupplyCapability: boolean,
  hasB2bProductCapability = hasSupplyCapability,
): RevMgmtSection[] {
  const hidden = new Set<string>();
  if (!hasSupplyCapability) {
    for (const label of SUPPLY_SIDE_NAV_LABELS) hidden.add(label);
  }
  if (!hasB2bProductCapability) {
    for (const label of B2B_PRODUCT_NAV_LABELS) hidden.add(label);
  }
  if (hidden.size === 0) return sections;

  return sections
    .map(section => ({
      ...section,
      subs: section.subs
        .map(sub => ({
          ...sub,
          items: sub.items.filter(item => !hidden.has(item.label)),
        }))
        .filter(sub => sub.items.length > 0),
    }))
    .filter(section => section.subs.length > 0);
}

export function isSupplySideNavLabel(label: string | null | undefined): boolean {
  return Boolean(label && SUPPLY_SIDE_NAV_LABELS.has(label));
}

export function isB2bProductNavLabel(label: string | null | undefined): boolean {
  return Boolean(label && B2B_PRODUCT_NAV_LABELS.has(label));
}

export const posItems = [
  'POS Menu',
  'POS Modifier Group',
  'Promotion Scheduler',
  'Device Management',
  'E-Invoice',
];

export const NAV_ITEMS = [
  'Overview',
  'Revenue Management',
  'Point-of-Sales',
  'Human Resources',
  'Accounting',
  'Report',
  'System Configuration',
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

export const siCategories = ['All', 'Assets', 'Ops Expenses', 'FF&E', 'Maintenance', 'MarComm', 'Food', 'Beverage', 'Retail'];
export const siGroups = ['All', 'Proteins', 'Dairy', 'Produce', 'Dry Goods', 'Beverages', 'Spirits', 'Cleaning', 'Equipment', 'Packaging'];

function uniqueSortedLabels(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Category filter options: company hierarchy + static fallbacks + caller extras.
 * Always includes "All" so dropdowns never look blank on cloud.
 */
export function getSiCategoryFilterOptions(extra: string[] = []): string[] {
  const hierarchyNames = loadComponentHierarchy().categories.map(category => category.name);
  return ['All', ...uniqueSortedLabels([
    ...hierarchyNames,
    ...siCategories.filter(category => category !== 'All'),
    ...extra,
  ])];
}

/**
 * Group filter options: company hierarchy groups + static fallbacks + caller extras.
 */
export function getSiGroupFilterOptions(extra: string[] = []): string[] {
  const hierarchyNames = loadComponentHierarchy().groups.map(group => group.name);
  return ['All', ...uniqueSortedLabels([
    ...hierarchyNames,
    ...siGroups.filter(group => group !== 'All'),
    ...extra,
  ])];
}

export type IngredientRow = {
  name: string;
  category: string;
  group: string;
  recipeUOM: string;
  inventoryUOM: string;
  lastPriceRecipe: number;
  lastPriceInventory: number;
  dailyUsage: number;
  orderFreqDays: number;
  storage: string[];
  attachedProducts: number;
  attachedVendors: number;
  active: boolean;
  locations: string[];
};

export const siDataInit: IngredientRow[] = [
  { name: 'Wagyu Beef A5', category: 'Food', group: 'Proteins', recipeUOM: 'g', inventoryUOM: 'kg', lastPriceRecipe: 0.38, lastPriceInventory: 380, dailyUsage: 2.4, orderFreqDays: 3, storage: ['Freezer'], attachedProducts: 3, attachedVendors: 2, active: true, locations: ['downtown', 'midtown'] },
  { name: 'Black Truffle', category: 'Food', group: 'Produce', recipeUOM: 'g', inventoryUOM: 'g', lastPriceRecipe: 1.8, lastPriceInventory: 1.8, dailyUsage: 45, orderFreqDays: 7, storage: ['Chiller'], attachedProducts: 2, attachedVendors: 1, active: true, locations: ['downtown'] },
  { name: 'Burrata', category: 'Food', group: 'Dairy', recipeUOM: 'pcs', inventoryUOM: 'pcs', lastPriceRecipe: 8.75, lastPriceInventory: 8.75, dailyUsage: 8, orderFreqDays: 2, storage: ['Chiller'], attachedProducts: 4, attachedVendors: 1, active: true, locations: ['downtown', 'midtown', 'westend'] },
  { name: 'Merlot Reserve 2019', category: 'Beverage', group: 'Spirits', recipeUOM: 'ml', inventoryUOM: 'btl', lastPriceRecipe: 0.127, lastPriceInventory: 95, dailyUsage: 3.2, orderFreqDays: 5, storage: ['Wine Cellar'], attachedProducts: 1, attachedVendors: 1, active: true, locations: ['all'] },
  { name: 'Espresso Beans', category: 'Beverage', group: 'Beverages', recipeUOM: 'g', inventoryUOM: 'kg', lastPriceRecipe: 0.028, lastPriceInventory: 28, dailyUsage: 0.8, orderFreqDays: 10, storage: ['Dry Store'], attachedProducts: 2, attachedVendors: 1, active: true, locations: ['all'] },
];

export const VENDOR_DISTANCES: Record<string, number | 'online'> = {
  V001: 8.2, V002: 12.5, V003: 22.1, V004: 'online',
  V005: 45.8, V006: 'online', V007: 38.4, V008: 'online', V011: 14.6,
  V012: 28.4, V013: 46.2, V014: 52.1, V015: 11.8, V016: 95.3,
  V017: 'online', V018: 35.6, V019: 18.2, V020: 22.7, V021: 9.4,
  V022: 19.6, V023: 'online', V024: 8.9, V025: 36.8, V026: 10.2,
  V027: 'online', V028: 41.5, V029: 7.6, V030: 17.3, V031: 32.9,
};

export const VENDOR_PRICES: Record<string, Record<string, { deliveryUnit: string; deliveryQty: number; pricePerDelivery: number }>> = {
  'Wagyu Beef A5': { V001: { deliveryUnit: 'kg', deliveryQty: 1, pricePerDelivery: 380 } },
  'Black Truffle': { V002: { deliveryUnit: '100g', deliveryQty: 100, pricePerDelivery: 180 } },
  'Burrata': { V003: { deliveryUnit: '6pcs', deliveryQty: 6, pricePerDelivery: 52.5 } },
  'Merlot Reserve 2019': { V004: { deliveryUnit: 'btl', deliveryQty: 1, pricePerDelivery: 95 } },
  'Espresso Beans': { V010: { deliveryUnit: 'kg', deliveryQty: 1, pricePerDelivery: 26 } },
  'Baked Beans': {
    V007: { deliveryUnit: 'box/12 tin/400g', deliveryQty: 1, pricePerDelivery: 42 },
    V011: { deliveryUnit: 'box/12 tin/380g', deliveryQty: 1, pricePerDelivery: 39.5 },
  },
};
