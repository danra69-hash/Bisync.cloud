import { getQaIssueGuide } from './devQaIssueGuide';

export type QaSceneActor = 'visitor' | 'owner' | 'admin' | 'vendor' | 'system';

export type QaSceneMeta = {
  taskId: string;
  screenTitle: string;
  routeHint: string;
  actor: QaSceneActor;
  /** Short line describing what the operator would be doing on screen */
  activity: string;
  /** Fake UI panels / cards shown in the monitor chrome */
  panels: string[];
};

const SCENES: Record<string, Omit<QaSceneMeta, 'taskId'>> = {
  'register-activate': {
    screenTitle: 'QA operator sign-in',
    routeHint: '/login',
    actor: 'admin',
    activity: 'Signing in as ms@cubevalue.com for Automated QA',
    panels: ['Email', 'Password', 'Session'],
  },
  'company-onboarding': {
    screenTitle: 'Company setup',
    routeHint: '/config/companies',
    actor: 'admin',
    activity: 'Creating QA Power Co and assigning ms@cubevalue.com',
    panels: ['Company name', 'Modules RMS/POS/HRM', 'Business types'],
  },
  'location-onboarding': {
    screenTitle: 'First location',
    routeHint: '/onboarding/location',
    actor: 'owner',
    activity: 'Creating Restaurant Halal location for the new company',
    panels: ['Location name', 'Type: Restaurant', 'Halal policy'],
  },
  'create-kitchen-location': {
    screenTitle: 'Locations',
    routeHint: '/config/locations',
    actor: 'owner',
    activity: 'Adding Central Kitchen with Muslim Friendly policy',
    panels: ['Location list', 'Add kitchen', 'Vendor policy override'],
  },
  'payment-continue': {
    screenTitle: 'Subscription Continue',
    routeHint: '/onboarding/payment',
    actor: 'owner',
    activity: 'Confirming types, modules, and MYR pricing (no charge yet)',
    panels: ['Plan summary', 'Standard MYR 300', 'Premium MYR 450'],
  },
  'provision-company-db': {
    screenTitle: 'Provisioning',
    routeHint: 'SaaS tenancy',
    actor: 'system',
    activity: 'Creating operational database for the QA company',
    panels: ['Company DB', 'Archive DB', 'Tenant header'],
  },
  'create-system-admin': {
    screenTitle: 'Access Control',
    routeHint: '/config/access',
    actor: 'admin',
    activity: 'Granting System Admin rights to ms@cubevalue.com on the QA company',
    panels: ['Operator profile', 'superAdmin', 'RMS tasks'],
  },
  'create-hr-staff': {
    screenTitle: 'HR Employees',
    routeHint: '/hr/employees',
    actor: 'admin',
    activity: 'Adding non-admin Operations Staff user',
    panels: ['Employee roster', 'Staff role', 'Limited access'],
  },
  'login-system-admin': {
    screenTitle: 'Sign in',
    routeHint: '/login',
    actor: 'admin',
    activity: 'Re-authenticating as ms@cubevalue.com before operational steps',
    panels: ['Email', 'Password', 'Session'],
  },
  'create-first-component-vendor': {
    screenTitle: 'Smart Components',
    routeHint: '/rms/components + vendors',
    actor: 'admin',
    activity: 'Creating first component, vendor, catalog tag, and engagement',
    panels: ['Component editor', 'Vendor card', 'Catalog product', 'Engage'],
  },
  'create-five-component-vendors': {
    screenTitle: 'Components & vendors',
    routeHint: '/rms/components',
    actor: 'admin',
    activity: 'Building five full component/vendor bundles',
    panels: ['Component grid', 'Vendor list', 'Tagging'],
  },
  'create-sub-product': {
    screenTitle: 'Product engineering',
    routeHint: '/rms/products',
    actor: 'admin',
    activity: 'Creating sub-product BOM from three components',
    panels: ['Product form', 'BOM lines', 'Yield'],
  },
  'create-finished-product': {
    screenTitle: 'Finished product',
    routeHint: '/rms/products',
    actor: 'admin',
    activity: 'Assembling finished product from sub-product + direct components',
    panels: ['Recipe tree', 'Components', 'Cost preview'],
  },
  'set-rrp-check-cogs': {
    screenTitle: 'Product costing',
    routeHint: '/rms/products · RRP / COGS',
    actor: 'admin',
    activity: 'Setting RRP and verifying theoretical COGS %',
    panels: ['RRP', 'COGS', 'Margin'],
  },
  'create-purchase-orders': {
    screenTitle: 'Purchase orders',
    routeHint: '/rms/orders',
    actor: 'admin',
    activity: 'Raising POs across vendors (5 × 5)',
    panels: ['Order draft', 'Vendor lines', 'Submit'],
  },
  'vendor-accept-pos': {
    screenTitle: 'Vendor portal / approvals',
    routeHint: '/vendor-order + approvals',
    actor: 'vendor',
    activity: 'Approving POs and simulating one vendor price change',
    panels: ['PO inbox', 'Accept', 'Price change'],
  },
  'receive-all-pos': {
    screenTitle: 'Receiving',
    routeHint: '/rms/orders · receive',
    actor: 'admin',
    activity: 'Receiving and reconciling all purchase orders',
    panels: ['Receive qty', 'Variance', 'Stock inbound'],
  },
  'verify-stock-after-po': {
    screenTitle: 'Stock cards',
    routeHint: '/inventory/stock-cards',
    actor: 'admin',
    activity: 'Checking on-hand after PO receipts',
    panels: ['On hand', 'Layers', 'Movements'],
  },
  'cash-purchase': {
    screenTitle: 'Cash purchase',
    routeHint: '/rms/cash-purchase',
    actor: 'admin',
    activity: 'Posting a cash purchase for one component',
    panels: ['Cash PO', 'Vendor', 'Receive'],
  },
  'verify-stock-after-cash': {
    screenTitle: 'Stock cards',
    routeHint: '/inventory/stock-cards',
    actor: 'admin',
    activity: 'Re-checking stock after cash purchase',
    panels: ['On hand', 'New layer', 'History'],
  },
  'produce-and-pos-sales': {
    screenTitle: 'Produce + POS sales',
    routeHint: '/rms/produce + sales',
    actor: 'admin',
    activity: 'Running two produce batches then FIFO POS sales',
    panels: ['Produce batch', 'POS sale', 'FIFO layers'],
  },
  'final-stock-card-audit': {
    screenTitle: 'Final stock audit',
    routeHint: '/inventory/stock-cards',
    actor: 'admin',
    activity: 'Auditing product and component cards after the full loop',
    panels: ['Product on-hand', 'Component balances', 'Irregularities'],
  },
  'cogs-audit-history': {
    screenTitle: 'COGS Audit History',
    routeHint: '/inventory/cogs-audit',
    actor: 'admin',
    activity: 'Confirming inventory and writing System COGS Audit History',
    panels: ['Inventory count', 'Confirm', 'History run'],
  },
};

const ACTOR_LABEL: Record<QaSceneActor, string> = {
  visitor: 'Visitor',
  owner: 'Company owner',
  admin: 'System admin',
  vendor: 'Vendor',
  system: 'Platform',
};

export function getQaScene(taskId: string, fallbackLabel?: string): QaSceneMeta {
  const base = SCENES[taskId];
  if (base) return { taskId, ...base };
  const guide = getQaIssueGuide(taskId);
  return {
    taskId,
    screenTitle: fallbackLabel ?? taskId,
    routeHint: guide.area,
    actor: 'admin',
    activity: guide.expected,
    panels: guide.checks.slice(0, 4),
  };
}

export function qaActorLabel(actor: QaSceneActor): string {
  return ACTOR_LABEL[actor];
}
