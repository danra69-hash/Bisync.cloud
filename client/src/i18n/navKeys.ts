import type { NavItem } from '../data/revenueManagement';

/** Internal nav keys stay in English for routing; map to i18n keys for display. */
export const NAV_ITEM_I18N: Record<NavItem, string> = {
  Overview: 'nav.overview',
  'Revenue Management': 'nav.revenueManagement',
  'Point-of-Sales': 'nav.pointOfSales',
  'Human Resources': 'nav.humanResources',
  Accounting: 'nav.accounting',
  Report: 'nav.report',
  'System Configuration': 'nav.systemConfiguration',
};

export const REV_MGMT_SECTION_I18N: Record<string, string> = {
  Operation: 'revMgmt.sections.operation',
  Component: 'revMgmt.sections.component',
  Vendors: 'revMgmt.sections.vendors',
  Products: 'revMgmt.sections.products',
  Sales: 'revMgmt.sections.sales',
  Reports: 'revMgmt.sections.reports',
};

export const REV_MGMT_SUBTITLE_I18N: Record<string, string> = {
  Order: 'revMgmt.subtitles.order',
  Production: 'revMgmt.subtitles.production',
  Inventory: 'revMgmt.subtitles.inventory',
};

export const REV_MGMT_ITEM_I18N: Record<string, string> = {
  'My Order': 'revMgmt.items.myOrder',
  'Active Purchase': 'revMgmt.items.activePurchase',
  'Active Sales': 'revMgmt.items.activeSales',
  'Cash Purchase': 'revMgmt.items.cashPurchase',
  'Order Template': 'revMgmt.items.orderTemplate',
  Production: 'revMgmt.items.production',
  'Stock Card': 'revMgmt.items.stockCard',
  Inventory: 'revMgmt.items.inventory',
  Wastage: 'revMgmt.items.wastage',
  Transfer: 'revMgmt.items.transfer',
  'Inventory Config': 'revMgmt.items.inventoryConfig',
  'Smart Component': 'revMgmt.items.smartComponent',
  'Component Config': 'revMgmt.items.componentConfig',
  'Account Mapping': 'revMgmt.items.accountMapping',
  'Vendor List & Products': 'revMgmt.items.vendorListProducts',
  'Compare Price': 'revMgmt.items.comparePrice',
  Products: 'revMgmt.items.products',
  'External POS Mapping': 'revMgmt.items.externalPosMapping',
  'Sales Order': 'revMgmt.items.activeSalesOrder',
  'Active Sales Order': 'revMgmt.items.activeSalesOrder',
  'Customer List': 'revMgmt.items.customerList',
  'Customer Group': 'revMgmt.items.customerGroup',
  'Customer Management': 'revMgmt.items.customerManagement',
  'Promotion Scheduler': 'revMgmt.items.promotionScheduler',
  'Itemized Sales Summary': 'revMgmt.items.itemizedSalesSummary',
  'Inventory Summary': 'revMgmt.items.inventorySummary',
  'Detailed Purchase Summary': 'revMgmt.items.detailedPurchaseSummary',
  'Production Report': 'revMgmt.items.productionReport',
  'Wastage Report': 'revMgmt.items.wastageReport',
};

export const POS_ITEM_I18N: Record<string, string> = {
  'POS Menu': 'pos.items.menu',
  'POS Modifier Group': 'pos.items.modifierGroup',
  'Promotion Scheduler': 'pos.items.promotionScheduler',
  'Device Management': 'pos.items.deviceManagement',
  'E-Invoice': 'pos.items.eInvoice',
};

export const HR_CONFIG_TAB_I18N: Record<string, string> = {
  'PH Setting': 'hrConfig.phSetting',
  'Level & Entitlement': 'hrConfig.levelEntitlement',
  'Pay Structure': 'hrConfig.payStructure',
  'Divisions & Department': 'hrConfig.divisionsDepartment',
  Companies: 'systemConfig.companies',
  Locations: 'systemConfig.locations',
  'Access Control': 'systemConfig.accessControl',
  'COGS Audit': 'systemConfig.cogsAudit',
  'Audit Trail': 'systemConfig.auditTrail',
  'Ghost Support': 'systemConfig.ghostSupport',
};

export const MODULE_I18N: Record<string, string> = {
  RMS: 'modules.rms',
  POS: 'modules.pos',
  HRM: 'modules.hrm',
  Accounting: 'modules.accounting',
};
