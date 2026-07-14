import type { PowerQaContext, QaTaskResult } from './devQaRunner';

export type QaIssueGuide = {
  area: string;
  expected: string;
  whereToFix: string[];
  checks: string[];
};

const GUIDES: Record<string, QaIssueGuide> = {
  'register-activate': {
    area: 'Public registration → email activation',
    expected: 'New person registers, activationUrl is returned (SMTP stub), confirm-activation, then login succeeds.',
    whereToFix: [
      'POST /api/auth/register with unique email/mobile and matching passwords (≥8).',
      'Use activationUrl from the register response (LoggingEmailSender stub).',
      'POST /api/auth/confirm-activation with the token, then login.',
    ],
    checks: ['Register returns activationUrl', 'User Active after confirm', 'Login as owner works'],
  },
  'company-onboarding': {
    area: 'Company onboarding',
    expected: 'Registered owner completes company onboarding; user.companyId set.',
    whereToFix: [
      'Call complete-company-onboarding with company profile (types + modules).',
      'Confirm owner is Company Admin for the new company.',
    ],
    checks: ['companyId assigned', 'Company name is QA Power Co*', 'Modules include RMS/POS/HRM'],
  },
  'location-onboarding': {
    area: 'Location onboarding',
    expected: 'First location created via onboarding, then typed as Restaurant / Halal.',
    whereToFix: [
      'complete-location-onboarding for the owner.',
      'Update location config: Restaurant type + halal policy.',
    ],
    checks: ['Restaurant location exists', 'externalId present', 'Halal policy saved'],
  },
  'create-kitchen-location': {
    area: 'System Configuration → Locations',
    expected: 'Second location: Central Kitchen / Muslim Friendly for dual-policy QA.',
    whereToFix: [
      'Add Central Kitchen location under the QA company.',
      'Set Muslim Friendly vendor policy (override).',
    ],
    checks: ['Kitchen location exists', 'Policies differ from restaurant'],
  },
  'payment-continue': {
    area: 'Payment page Continue',
    expected: 'Company/location profiles saved; subscription pricing MYR 300+450; no gateway charge yet.',
    whereToFix: [
      'Ensure company types include Restaurant + Central Kitchen and modules set.',
      'Location types inherit from company types.',
      'Assert standard (300) vs premium (450) MYR pricing.',
    ],
    checks: ['Company updated', 'Locations typed', 'Pricing totals MYR 750'],
  },
  'provision-company-db': {
    area: 'SaaS tenancy provision',
    expected: 'Operational DB bisync_c_{id} (+ archive) provisioned or already present.',
    whereToFix: [
      'Call provision-company-db after payment Continue.',
      'Confirm Postgres CREATE DATABASE rights / Tenancy:ProvisionCompanyDatabases.',
      'Set X-Bisync-Company-Id for subsequent API calls.',
    ],
    checks: ['provisioned or alreadyProvisioned', 'databaseName matches', 'Feature flag not blocking'],
  },
  'create-system-admin': {
    area: 'HR Employees + Access Control',
    expected: 'HR employee + AppUser System Admin with superAdmin and all RMS tasks.',
    whereToFix: [
      'Create employee under Human Resources for the QA company.',
      'System Configuration → Access Control → create user linked to that employee.',
      'Grant all modules; set superAdmin in accessJson if UI lacks the toggle.',
    ],
    checks: ['Employee created', 'User linked to employee', 'superAdmin true', 'All RMS tasks on'],
  },
  'create-hr-staff': {
    area: 'HR Employees + Access Control',
    expected: 'Second HR employee (Operations Staff) with limited non-admin access.',
    whereToFix: [
      'Create employee under Operations (or People).',
      'Link AppUser with role Staff and superAdmin false.',
    ],
    checks: ['Staff employee created', 'User not superAdmin', 'Distinct from System Admin'],
  },
  'login-system-admin': {
    area: 'Authentication',
    expected: 'api.login succeeds with QA System Admin email / default password.',
    whereToFix: [
      'Confirm user is Active.',
      'Try password Pass@123 (seed default when hash empty).',
      'Re-create user if login still fails.',
    ],
    checks: ['Login returns user', 'Email matches QA admin'],
  },
  'create-first-component-vendor': {
    area: 'Smart Components + Vendors',
    expected: 'Component, vendor, catalog product created; vendor engaged; product tagged to component.',
    whereToFix: [
      'Create component with recipe/inventory UOM and locations.',
      'Create vendor + vendor product catalog line.',
      'Engage vendor, then tag catalog product onto the component.',
    ],
    checks: ['Component id present', 'Vendor engaged', 'detailConfigJson tagged'],
  },
  'create-five-component-vendors': {
    area: 'Smart Components + Vendors',
    expected: 'Five full component ↔ vendor ↔ catalog ↔ tag bundles.',
    whereToFix: [
      'Repeat component/vendor/catalog/engage/tag for remaining items.',
      'Ensure unique names after a partial run.',
    ],
    checks: ['5 components', '5 engaged vendors', '5 tagged catalog products'],
  },
  'create-sub-product': {
    area: 'Products → Sub-Product',
    expected: 'Sub-product BOM of 3 components; totalCost matches sum of component UOM prices.',
    whereToFix: [
      'Create sub-product with 3 QA components on the recipe.',
      'Compare totalCost to BOM line extensions.',
      'Fix componentUomPrice if costs drifted after tagging.',
    ],
    checks: ['isSubProduct true', '3 BOM lines', 'totalCost ≈ expected'],
  },
  'create-finished-product': {
    area: 'Products → Finished Product',
    expected: 'Finished product uses sub-product + remaining components (covers all 5).',
    whereToFix: [
      'Add sub-product as a BOM line (componentId = sub productId string).',
      'Add the other two components as direct lines.',
      'Confirm locations include restaurant + kitchen.',
    ],
    checks: ['Sub-product on BOM', 'All 5 components represented', 'totalCost plausible'],
  },
  'set-rrp-check-cogs': {
    area: 'Products → RRP / COGS%',
    expected: 'RRP > COGS and COGS% = (COGS / RRP) × 100.',
    whereToFix: [
      'Set RRP on the finished product.',
      'Compare calculated COGS% to UI COGS%.',
      'Adjust RRP or BOM costs if margin looks wrong.',
    ],
    checks: ['RRP saved', 'COGS computed', 'COGS% matches formula'],
  },
  'create-purchase-orders': {
    area: 'Create Order / Purchase Orders',
    expected: '5 POs per vendor (25 total) with staggered delivery dates and prices.',
    whereToFix: [
      'Create POs per engaged vendor for the tagged vendor product.',
      'Vary delivery dates and unit prices across the five POs.',
      'Target Central Kitchen location for receiving.',
    ],
    checks: ['25 POs created', 'Dates differ', 'Prices differ'],
  },
  'vendor-accept-pos': {
    area: 'PO Approve + Vendor Accept',
    expected: 'All POs approved and accepted via vendor share token.',
    whereToFix: [
      'Approve each PO.',
      'Open vendor share link and Accept.',
      'Price change is applied at receive (portal cannot edit prices).',
    ],
    checks: ['Approved', 'vendorAcceptedAt set', 'Share token present'],
  },
  'receive-all-pos': {
    area: 'Active Purchases → Receive / Reconcile',
    expected: 'All POs received and reconciled into inventory.',
    whereToFix: [
      'Receive each accepted PO at kitchen location.',
      'For the designated PO, receive at the changed unit price.',
      'Reconcile to close the PO.',
    ],
    checks: ['Received', 'Reconciled', 'Inventory movements created'],
  },
  'verify-stock-after-po': {
    area: 'Inventory → Stock Cards',
    expected: '~50 Kg on-hand per component (5×10) with multiple FIFO layers.',
    whereToFix: [
      'Open each component stock card filtered to kitchen.',
      'Confirm inbound from POs and layer count ≥ 2.',
      'Re-receive missing POs if on-hand is short.',
    ],
    checks: ['On-hand ≈ 50', 'Multiple layers', 'No negatives'],
  },
  'cash-purchase': {
    area: 'Cash Purchase',
    expected: 'One component purchased via cash (7 Kg) at kitchen.',
    whereToFix: [
      'Create cash purchase for component #1.',
      'Confirm location and UOM match stock card.',
    ],
    checks: ['Cash purchase saved', 'Inventory purchase linked'],
  },
  'verify-stock-after-cash': {
    area: 'Inventory → Stock Cards',
    expected: 'Cash purchase adds 7 Kg (≈57 total for component #1).',
    whereToFix: [
      'Refresh stock card after cash purchase.',
      'Check cash purchase date/location filters.',
    ],
    checks: ['On-hand ≈ 57', 'New layer or inbound present'],
  },
  'produce-and-pos-sales': {
    area: 'Product Management → Produce + Record Sale',
    expected: 'Two dated produce batches then POS sales that exercise FIFO.',
    whereToFix: [
      'Produce batch 1 and batch 2 with different production dates.',
      'Record POS sales while ≥2 layers exist.',
      'If produce fails on shortage, use override or replenish components.',
    ],
    checks: ['Two produce batches', 'POS sales posted', 'Layers existed pre-sale'],
  },
  'final-stock-card-audit': {
    area: 'Inventory → Stock Cards (final)',
    expected: 'Product and component cards consistent after PO, cash, produce, and sales.',
    whereToFix: [
      'Audit finished product on-hand (produce − sales).',
      'Confirm no negative component stock.',
      'Inspect FIFO layers for anomalies.',
    ],
    checks: ['Product on-hand coherent', 'Components non-negative', 'Irregularities cleared'],
  },
  'cogs-audit-history': {
    area: 'Inventory confirm → COGS Audit History',
    expected: 'Full inventory confirmed writes a System COGS Audit History run for the QA company/period.',
    whereToFix: [
      'Save a full inventory count (counted = system qty) for the kitchen.',
      'Confirm the session to trigger SystemCogsAuditSnapshotService.',
      'Open COGS Audit → System History and verify the new run.',
    ],
    checks: ['Inventory session confirmed', 'History runId present', 'Live summary reachable'],
  },
};

export function getQaIssueGuide(taskId: string): QaIssueGuide {
  return (
    GUIDES[taskId] ?? {
      area: 'Platform',
      expected: 'Step completes without error.',
      whereToFix: ['Inspect API error detail.', 'Re-run the step after fixing data.'],
      checks: ['Error understood', 'Fix applied', 'Step passes on retry'],
    }
  );
}

export type QaIssueViewModel = {
  task: QaTaskResult;
  guide: QaIssueGuide;
  context?: PowerQaContext | null;
  runSummary?: string | null;
};

export function buildIssueView(
  task: QaTaskResult,
  context?: PowerQaContext | null,
  runSummary?: string | null,
): QaIssueViewModel {
  return {
    task,
    guide: getQaIssueGuide(task.id),
    context: context ?? null,
    runSummary: runSummary ?? null,
  };
}
