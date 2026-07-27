import type { PowerQaContext, QaTaskResult } from './devQaRunner';

export type QaIssueGuide = {
  area: string;
  expected: string;
  whereToFix: string[];
  checks: string[];
};

const GUIDES: Record<string, QaIssueGuide> = {
  'register-activate': {
    area: "Setup & Tenancy",
    expected: "Sign in as QA operator (ms@cubevalue.com) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'company-onboarding': {
    area: "Setup & Tenancy",
    expected: "Company onboarding completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'location-onboarding': {
    area: "Setup & Tenancy",
    expected: "Location onboarding (Restaurant Halal) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'create-kitchen-location': {
    area: "Setup & Tenancy",
    expected: "Add Central Kitchen location (Muslim Friendly) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'payment-continue': {
    area: "Setup & Tenancy",
    expected: "Payment Continue (types, modules, pricing) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'provision-company-db': {
    area: "Setup & Tenancy",
    expected: "Provision company operational DB completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'create-system-admin': {
    area: "System Configuration",
    expected: "Grant System Admin rights to QA operator completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'login-system-admin': {
    area: "Setup & Tenancy",
    expected: "Log in as QA operator (ms@cubevalue.com) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'sysconfig-companies-locations': {
    area: "System Configuration",
    expected: "Verify Companies & Locations in System Configuration completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'sysconfig-access-control': {
    area: "System Configuration",
    expected: "Verify Access Control matrix loads completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'create-first-component-vendor': {
    area: "Component \u00b7 My Component",
    expected: "Add Component + Vendor + Vendor Product (seed #1) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'create-five-component-vendors': {
    area: "Component \u00b7 My Component",
    expected: "Create 5 Components + Vendors + Vendor Products completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'component-download-template': {
    area: "Component \u00b7 My Component",
    expected: "Download My Component CSV template (export) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'component-upload-import': {
    area: "Component \u00b7 My Component",
    expected: "Upload / import My Component CSV (create via plan) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'component-edit-par-stock': {
    area: "Component \u00b7 My Component",
    expected: "Edit component par stock / daily usage completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'component-config': {
    area: "Component \u00b7 My Component",
    expected: "Component Config (hierarchy / storage) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'vendor-compare-price': {
    area: "Vendors",
    expected: "Compare Price across vendor products completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'vendor-rating': {
    area: "Vendors",
    expected: "Rate a vendor (delivery / quality) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'vendor-activate-deactivate-product': {
    area: "Vendors",
    expected: "Deactivate then reactivate a vendor product completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'vendor-rfq': {
    area: "Vendors",
    expected: "Create vendor RFQ (quote request) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'vendor-sample-request': {
    area: "Vendors",
    expected: "Create vendor sample request completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'create-sub-product': {
    area: "Products",
    expected: "Create Sub-Product using 3 components completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'create-finished-product': {
    area: "Products",
    expected: "Create Product utilizing all 5 components (incl. sub-product) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'set-rrp-check-cogs': {
    area: "Products",
    expected: "Add RRP and verify COGS / COGS% completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'create-b2b-product': {
    area: "Products",
    expected: "Create B2B-enabled finished product completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'product-audit': {
    area: "Products",
    expected: "Run Product Audit for current month completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'products-account-mapping': {
    area: "Products",
    expected: "Products \u00b7 Account Mapping completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'create-purchase-orders': {
    area: "Operation \u00b7 Order",
    expected: "Open POs to all test vendors (5 POs each) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'vendor-accept-pos': {
    area: "Operation \u00b7 Order",
    expected: "Vendors accept POs (1 simulated price change) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'receive-all-pos': {
    area: "Operation \u00b7 Order",
    expected: "Receive all vendor products completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'order-template': {
    area: "Operation \u00b7 Order",
    expected: "Create Order Template (schedule) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'order-precommitted-template': {
    area: "Operation \u00b7 Order",
    expected: "Create Pre-committed PO template completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'verify-stock-after-po': {
    area: "Operation \u00b7 Inventory",
    expected: "Verify STOCK CARD after PO receipts completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'cash-purchase': {
    area: "Operation \u00b7 Order",
    expected: "Cash-purchase one component completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'verify-stock-after-cash': {
    area: "Operation \u00b7 Inventory",
    expected: "Verify cash purchase on STOCK CARD completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'inventory-wastage': {
    area: "Operation \u00b7 Inventory",
    expected: "Record wastage on a component completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'inventory-transfer': {
    area: "Operation \u00b7 Inventory",
    expected: "Transfer stock kitchen \u2192 restaurant and receive completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'inventory-adjustment': {
    area: "Operation \u00b7 Inventory",
    expected: "Stock Card inventory adjustment completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'inventory-config': {
    area: "Operation \u00b7 Inventory",
    expected: "Inventory Config completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'produce-and-pos-sales': {
    area: "Operation \u00b7 Production",
    expected: "Produce product (2 batches) + offline sales for FIFO completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'final-stock-card-audit': {
    area: "Operation \u00b7 Inventory",
    expected: "Final STOCK CARD audit (PO + cash + produce + sales / FIFO) completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'sales-b2b-customer': {
    area: "Sales",
    expected: "Create B2B customer completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'sales-b2b-order': {
    area: "Sales",
    expected: "Create & issue B2B sales order completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'sales-promotion': {
    area: "Sales",
    expected: "Create promotion schedule completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'sales-account-mapping': {
    area: "Sales",
    expected: "Sales \u00b7 Account Mapping completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'cogs-audit-history': {
    area: "Reports",
    expected: "Confirm inventory + COGS Audit History completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'report-itemized-sales': {
    area: "Reports",
    expected: "Itemized Sales Summary completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'report-inventory-summary': {
    area: "Reports",
    expected: "Inventory Summary completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'report-purchase-summary': {
    area: "Reports",
    expected: "Detailed Purchase Summary completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'report-production': {
    area: "Reports",
    expected: "Production Report completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'report-wastage': {
    area: "Reports",
    expected: "Wastage Report completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'component-account-mapping': {
    area: "Component \u00b7 My Component",
    expected: "Component \u00b7 Account Mapping completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
  'vendor-account-mapping': {
    area: "Vendors",
    expected: "Vendors \u00b7 Account Mapping completes without error and records verification facts.",
    whereToFix: [
      'Open Dev Console → Automated QA → this step detail.',
      'Retry the step or re-run full QA after fixing the underlying API/data issue.',
      'Purge leftover QA Power companies if tenancy is stuck from a prior failed run.',
    ],
    checks: ['Step status pass or intentional warn (coming soon)', 'Facts populated', 'No unexpected irregularities'],
  },
};

const FALLBACK: QaIssueGuide = {
  area: 'Automated QA',
  expected: 'Step completes successfully with verifiable facts.',
  whereToFix: ['Retry the step', 'Re-run full QA', 'Purge QA operational data if needed'],
  checks: ['Status is pass', 'Detail explains outcome'],
};

export function getQaIssueGuide(taskId: string): QaIssueGuide {
  return GUIDES[taskId] ?? FALLBACK;
}

export type QaIssueViewModel = {
  task: QaTaskResult;
  guide: QaIssueGuide;
  context: PowerQaContext | null;
  runSummary: string | null;
};

export function buildIssueView(
  task: QaTaskResult,
  context: PowerQaContext | null,
  runSummary: string | null,
): QaIssueViewModel {
  return {
    task,
    guide: getQaIssueGuide(task.id),
    context,
    runSummary,
  };
}
