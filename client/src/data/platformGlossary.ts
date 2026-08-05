/**
 * Platform definition glossary for Dev Console → Ref & Library.
 * Term = business name · Meaning = plain English · dbName = column / JSON key / API field.
 */

export const PLATFORM_GLOSSARY_TITLE = 'Platform Definitions (by Module)';

export const PLATFORM_GLOSSARY_REVISED_DATE = '5 Aug 2026';

export const PLATFORM_GLOSSARY_SUMMARY =
  'Definitions of names used across Bisync — what each term means in operations, '
  + 'and how it is stored in the database or API. Grouped by module.';

export type GlossaryEntry = {
  /** Business / UI name (and common acronym). */
  term: string;
  /** What it means in day-to-day operations. */
  meaning: string;
  /** Column, property, JSON key, or API field name. */
  dbName: string;
};

export type GlossaryModule = {
  id: string;
  /** Module heading (matches platform modules where possible). */
  module: string;
  entries: GlossaryEntry[];
};

export const PLATFORM_GLOSSARY_MODULES: GlossaryModule[] = [
  {
    id: 'platform',
    module: 'Platform & Organisation',
    entries: [
      {
        term: 'RMS',
        meaning: 'Revenue Management System — purchasing, inventory, products, and back-office ops.',
        dbName: 'ModulesJson ("RMS")',
      },
      {
        term: 'POS',
        meaning: 'Point of Sale — front-of-house ordering, payments, and kitchen displays.',
        dbName: 'ModulesJson ("POS")',
      },
      {
        term: 'HRM',
        meaning: 'Human Resources module — employees, attendance, levels, and pay structures.',
        dbName: 'ModulesJson ("HRM")',
      },
      {
        term: 'Accounting',
        meaning: 'Company-level accounting module (not assigned per location).',
        dbName: 'ModulesJson ("Accounting")',
      },
      {
        term: 'Company Code',
        meaning: 'Immutable 4-letter tenant prefix used to build Component IDs.',
        dbName: 'Companies.Code',
      },
      {
        term: 'Location External ID',
        meaning: 'Stable public key for a location used across stock, POS, and reports.',
        dbName: 'Locations.ExternalId',
      },
      {
        term: 'Physical Site Key',
        meaning: 'Shared key when two or more brand/concept locations operate in one physical venue.',
        dbName: 'Locations.PhysicalSiteKey',
      },
      {
        term: 'Concept Label',
        meaning: 'Brand name shown on POS when a physical site has multiple concepts.',
        dbName: 'Locations.ConceptLabel',
      },
      {
        term: 'Principal Contact',
        meaning: 'Primary user contact linked to a location for ops and admin.',
        dbName: 'Locations.PrincipalContactUserId',
      },
    ],
  },
  {
    id: 'components',
    module: 'Components & Inventory Identity',
    entries: [
      {
        term: 'Component (My Component)',
        meaning: 'Company-scoped ingredient or material used in recipes, purchasing, and stock.',
        dbName: 'Ingredients',
      },
      {
        term: 'Component ID',
        meaning: 'Immutable identity for a component, format COMPANY-XXXX (letter + digit).',
        dbName: 'Ingredients.ComponentId',
      },
      {
        term: 'Component Name',
        meaning: 'Unique display name of the component within a company (normalized).',
        dbName: 'Ingredients.Name',
      },
      {
        term: 'Principal Component Unit (PCU)',
        meaning:
          'Unit the component or ingredient uses in day-to-day operations (recipes, costing, par).',
        dbName: 'Ingredients.RecipeUom (PCU)',
      },
      {
        term: 'Inventory UOM',
        meaning: 'Unit used when receiving or counting stock; convertible to PCU.',
        dbName: 'Ingredients.InventoryUom',
      },
      {
        term: 'Category / Group',
        meaning: 'Classification filters for browsing the component catalog.',
        dbName: 'Ingredients.Category / Ingredients.Group',
      },
      {
        term: 'Par Stock',
        meaning: 'Target on-hand quantity used for reorder alerts.',
        dbName: 'Ingredients.ParStock',
      },
      {
        term: 'Par Stock UOM',
        meaning: 'Unit in which par stock is expressed (usually PCU).',
        dbName: 'Ingredients.ParStockUom',
      },
      {
        term: 'Last Price (Recipe / PCU)',
        meaning: 'Latest unit cost expressed in the principal component unit.',
        dbName: 'Ingredients.LastPriceRecipe',
      },
      {
        term: 'Last Price (Inventory)',
        meaning: 'Latest unit cost expressed in the inventory receiving unit.',
        dbName: 'Ingredients.LastPriceInventory',
      },
      {
        term: 'Daily Usage',
        meaning: 'Average daily consumption used for ordering guidance.',
        dbName: 'Ingredients.DailyUsage',
      },
      {
        term: 'Order Frequency (Days)',
        meaning: 'Typical number of days between reorders for this component.',
        dbName: 'Ingredients.OrderFreqDays',
      },
      {
        term: 'Storage Assignment',
        meaning: 'Where the component is stored (e.g. chiller, dry, freezer).',
        dbName: 'Ingredients.StorageJson',
      },
      {
        term: 'Split Use',
        meaning: 'Split one received parent into child components, with optional waste.',
        dbName: 'InventoryPurchases.Split* / SplitUse*',
      },
    ],
  },
  {
    id: 'stock-cogs',
    module: 'Stock, FIFO & COGS',
    entries: [
      {
        term: 'COGS',
        meaning: 'Cost of Goods Sold — cost of ingredients/products consumed or sold.',
        dbName: 'COGS / Products.TotalCost',
      },
      {
        term: 'COGS %',
        meaning: 'Cost as a percentage of sell price (COGS ÷ RRP).',
        dbName: 'cogsPercent (computed)',
      },
      {
        term: 'COGS Audit',
        meaning: 'Period stock and value audit (opening, debit, credit, closing, shortage).',
        dbName: '/api/cogs-audit/*',
      },
      {
        term: 'FIFO',
        meaning: 'First In, First Out — issues stock from the oldest cost batch first.',
        dbName: 'issue_fifo_stock / StockCard FIFO layers',
      },
      {
        term: 'Stock Card',
        meaning: 'Per-item ledger of receipts, issues, balances, and cost layers.',
        dbName: 'StockCard* APIs',
      },
      {
        term: 'On Hand Qty',
        meaning: 'Current available quantity for a stock item.',
        dbName: 'onHandQty',
      },
      {
        term: 'FIFO Layer / Batch',
        meaning: 'A cost-segregated receipt lot (date, remaining qty, unit cost).',
        dbName: 'InventoryPurchases / stock-card layers',
      },
      {
        term: 'Inventory Movement',
        meaning: 'Signed quantity change with reason, unit price, and reference.',
        dbName: 'InventoryMovements',
      },
      {
        term: 'Inventory Purchase',
        meaning: 'Inbound stock lot created from a PO receive or cash purchase.',
        dbName: 'InventoryPurchases',
      },
      {
        term: 'Avg COGS (on hand)',
        meaning: 'Quantity-weighted average cost of remaining FIFO layers.',
        dbName: 'onHandAverageCogs',
      },
      {
        term: 'Wastage',
        meaning: 'Write-off of lost, spoiled, or voided stock.',
        dbName: 'WastageEntries',
      },
      {
        term: 'Transfer',
        meaning: 'Stock move between locations (pending until received).',
        dbName: 'TransferEntries',
      },
      {
        term: 'Inventory Post',
        meaning: 'Start a physical count / freeze period for a location.',
        dbName: 'InventoryCountSessions',
      },
      {
        term: 'Inventory Confirmation',
        meaning: 'Confirm counted quantities and apply stock adjustments.',
        dbName: 'InventoryCountSessions.ConfirmedAt',
      },
      {
        term: 'Item Key',
        meaning: 'Stock identity string for component, product, or sub-product lines.',
        dbName: 'ItemKey / itemKey',
      },
    ],
  },
  {
    id: 'purchasing',
    module: 'Purchasing & Vendors',
    entries: [
      {
        term: 'Purchase Order (PO)',
        meaning: 'Vendor order document for goods to be delivered.',
        dbName: 'PurchaseOrders',
      },
      {
        term: 'PO Number',
        meaning: 'Human-readable purchase order identifier.',
        dbName: 'PurchaseOrders.PoNumber',
      },
      {
        term: 'Pre-committed PO',
        meaning: 'Blanket commitment drawn down by later release purchase orders.',
        dbName: 'PurchaseOrders.IsPreCommitted',
      },
      {
        term: 'Cash Purchase',
        meaning: 'Ad-hoc store purchase posted directly into stock (no formal PO).',
        dbName: 'CashPurchases',
      },
      {
        term: 'Order Template',
        meaning: 'Reusable set of PO lines for recurring orders.',
        dbName: 'OrderTemplates',
      },
      {
        term: 'Vendor External ID',
        meaning: 'Stable catalog key for a vendor.',
        dbName: 'Vendors.ExternalId',
      },
      {
        term: 'Vendor Product',
        meaning: 'A SKU offered by a vendor for ordering.',
        dbName: 'VendorProducts',
      },
      {
        term: 'Delivery Package / Unit',
        meaning: 'Vendor pack size and unit used when ordering and receiving.',
        dbName: 'PurchaseOrderItems.DeliveryPackage / DeliveryUnit',
      },
      {
        term: 'Engaged Vendor',
        meaning: 'Vendor approved for ordering at the company or specific locations.',
        dbName: 'Vendors.Engaged / EngagedLocationIdsJson',
      },
      {
        term: 'Partial Delivery',
        meaning: 'Vendor may ship in multiple receipts until the PO is complete.',
        dbName: 'Vendors.AllowPartialDelivery',
      },
      {
        term: 'Returnable Deposit',
        meaning: 'Container deposit line that is financial only (not inventory stock).',
        dbName: 'IsReturnableDeposit / ReturnableDeposit*',
      },
      {
        term: 'Credit Note',
        meaning: 'Purchasing credit raised against a vendor or PO.',
        dbName: 'creditNote (access task) / credit note records',
      },
    ],
  },
  {
    id: 'products',
    module: 'Products & Pricing',
    entries: [
      {
        term: 'B2C Product',
        meaning: 'Retail / POS sellable finished good for guests.',
        dbName: 'Products.B2cEnabled',
      },
      {
        term: 'B2B Principal Product',
        meaning: 'Wholesale principal SKU sold via sales orders / online PO.',
        dbName: 'Products.B2bEnabled',
      },
      {
        term: 'B2B Product Alias',
        meaning: 'Named sell variant that depletes the principal product’s stock.',
        dbName: 'ProductAliases',
      },
      {
        term: 'Sub-Product',
        meaning: 'Prep or intermediate BOM item (not sold alone on POS).',
        dbName: 'Products.IsSubProduct',
      },
      {
        term: 'Bi-Product',
        meaning: 'Secondary output from production with shared cost attribution.',
        dbName: 'Products.IsBiProduct / BiOfProductId',
      },
      {
        term: 'Variable Product',
        meaning: 'Sellable item priced by combination or weight.',
        dbName: 'Products.IsVariableProduct / VariableMode',
      },
      {
        term: 'RRP',
        meaning: 'Recommended Retail Price — standard sell price.',
        dbName: 'Products.Rrp',
      },
      {
        term: 'RPP',
        meaning: 'Recommended Promotional Price — promo sell price (≤ RRP).',
        dbName: 'PosPromotionProducts.Rpp / PackageRpp',
      },
      {
        term: 'Packaging Cost',
        meaning: 'Cost of packaging BOM lines on a finished product.',
        dbName: 'Products.PackagingCost',
      },
      {
        term: 'Product Total Cost (COGS)',
        meaning: 'Recipe plus packaging cost for a finished good.',
        dbName: 'Products.TotalCost',
      },
      {
        term: 'Yield UOM / Quantity',
        meaning: 'Batch production unit and quantity produced per recipe run.',
        dbName: 'Products.YieldUom / YieldQuantity',
      },
      {
        term: 'POS Enabled',
        meaning: 'Product appears on the POS menu when true.',
        dbName: 'Products.PosEnabled',
      },
      {
        term: 'POS Sales UOM',
        meaning: 'Unit label shown when selling the item on POS.',
        dbName: 'Products.PosSalesUom',
      },
      {
        term: 'Order Lock / Holdout Period',
        meaning: 'Days B2B stock stays reserved after sales-order issue.',
        dbName: 'Products.OrderLockPeriodDays',
      },
      {
        term: 'In Stock (product)',
        meaning: 'Finished-goods on-hand quantity at a location.',
        dbName: 'ProductB2bLocationStocks.InStock',
      },
      {
        term: 'On Order Qty',
        meaning: 'Reserved B2B quantity not yet delivered/sold.',
        dbName: 'ProductB2bLocationStocks.OnOrderQty',
      },
    ],
  },
  {
    id: 'pos',
    module: 'POS & Sales',
    entries: [
      {
        term: 'POS Session',
        meaning: 'Cash-drawer / shift period for one terminal — opened and closed with tallies.',
        dbName: 'POSSessions',
      },
      {
        term: 'POS Order',
        meaning: 'A sale ticket created on POS (dine-in, takeaway, delivery, etc.).',
        dbName: 'POSOrders',
      },
      {
        term: 'POS Order Item',
        meaning: 'A line on a POS order (product, qty, price, modifiers).',
        dbName: 'POSOrderItems',
      },
      {
        term: 'POS Payment',
        meaning: 'A tender against a POS order (cash, card, etc.).',
        dbName: 'POSPayments',
      },
      {
        term: 'POS Menu',
        meaning: 'Front-of-house catalog of POS-enabled B2C products.',
        dbName: 'Products (PosEnabled) + POS catalog',
      },
      {
        term: 'Promotion Scheduler',
        meaning: 'Time-based or prepaid POS promotions and package pricing.',
        dbName: 'PosPromotions',
      },
      {
        term: 'Modifier Group',
        meaning: 'Set of add-ons or choices attached to POS products.',
        dbName: 'PosModifierGroups',
      },
      {
        term: 'Sales Order (SO)',
        meaning: 'B2B customer order for wholesale fulfillment.',
        dbName: 'B2bSalesOrders',
      },
      {
        term: 'B2B Customer',
        meaning: 'Wholesale customer account.',
        dbName: 'B2bCustomers.ExternalId',
      },
      {
        term: 'Floor Plan',
        meaning: 'Table and zone layout for a location (supports multiple floors).',
        dbName: 'PosFloorPlans.LayoutJson',
      },
      {
        term: 'Floor',
        meaning: 'One level inside a multi-floor floor plan (e.g. Ground, Mezzanine).',
        dbName: 'PosFloorPlans.LayoutJson → floors[]',
      },
      {
        term: 'POS Device',
        meaning: 'Registered printer, KDS, bar display, or POS station.',
        dbName: 'PosDevices',
      },
      {
        term: 'Device Role',
        meaning: 'What the device is used as: POS, Printer, KDS, BDS, or Kiosk.',
        dbName: 'PosDevices.Role',
      },
      {
        term: 'KDS',
        meaning: 'Kitchen Display System — screen for kitchen tickets / prep.',
        dbName: 'PosDevices.Role = KDS',
      },
      {
        term: 'BDS',
        meaning: 'Bar Display System — screen for bar / beverage tickets.',
        dbName: 'PosDevices.Role = BDS',
      },
      {
        term: 'ESC/POS',
        meaning: 'Epson Standard Code for Point of Sale — printer command dialect for receipts and kitchen printers.',
        dbName: 'n/a (device protocol; PosDevices.ConnectionType)',
      },
      {
        term: 'Covers',
        meaning: 'Guest/cover count KPIs for a location.',
        dbName: 'Locations.Covers*',
      },
      {
        term: 'Checks',
        meaning: 'Check / ticket count KPIs for a location.',
        dbName: 'Locations.Checks*',
      },
      {
        term: 'BCG Matrix',
        meaning: 'Product portfolio report plotting margin against sales.',
        dbName: 'bcgMatrix (reports)',
      },
    ],
  },
  {
    id: 'hr',
    module: 'HR / Team',
    entries: [
      {
        term: 'Employee Code',
        meaning: 'Auto-generated business identifier for an employee.',
        dbName: 'Employees.EmployeeCode',
      },
      {
        term: 'POS PIN',
        meaning: 'Staff PIN used to unlock ordering on a POS station.',
        dbName: 'Employees.PosPin',
      },
      {
        term: 'Level & Entitlement',
        meaning: 'Employee grade with leave and duty-meal rules.',
        dbName: 'EmployeeLevels / leave rule JSON',
      },
      {
        term: 'Pay Structure',
        meaning: 'Compensation structure configuration for payroll.',
        dbName: 'PayStructures',
      },
      {
        term: 'Attendance',
        meaning: 'Clock-in / clock-out and shift attendance records.',
        dbName: 'Attendance',
      },
    ],
  },
];

export function flattenGlossaryEntries(): Array<GlossaryEntry & { module: string; moduleId: string }> {
  return PLATFORM_GLOSSARY_MODULES.flatMap(mod =>
    mod.entries.map(entry => ({
      ...entry,
      module: mod.module,
      moduleId: mod.id,
    })),
  );
}
