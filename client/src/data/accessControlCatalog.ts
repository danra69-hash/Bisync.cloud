import { RMS_TASK_GROUPS } from './userAccess';
import { posItems } from './revenueManagement';

export const ACCESS_CONTROL_TYPE_COUNT = 8;

/** Default first column — always fully granted for every catalog task (except restriction rows). */
export const SUPER_USER_ACCESS_TYPE_ID = 'ac1';
export const SUPER_USER_ACCESS_TYPE_LABEL = 'Super User';

export type AccessControlType = {
  id: string;
  label: string;
};

export type AccessControlRow = {
  key: string;
  module: string;
  function: string;
  task: string;
};

export type AccessControlMatrix = Record<string, Record<string, boolean>>;

export function defaultAccessControlTypes(): AccessControlType[] {
  return Array.from({ length: ACCESS_CONTROL_TYPE_COUNT }, (_, index) => ({
    id: `ac${index + 1}`,
    label: index === 0 ? SUPER_USER_ACCESS_TYPE_LABEL : `AC ${index + 1}`,
  }));
}

/** True when this AC column is the Super User role (by reserved id or label). */
export function isSuperUserAccessType(type: AccessControlType | null | undefined): boolean {
  if (!type) return false;
  if (type.id === SUPER_USER_ACCESS_TYPE_ID) return true;
  return /^super\s*user$/i.test((type.label ?? '').trim());
}

function taskIdFromLabel(task: string): string {
  return task.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function row(module: string, functionName: string, task: string, taskId?: string): AccessControlRow {
  const moduleKey = module.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const functionKey = functionName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const id = taskId ?? taskIdFromLabel(task);
  return {
    key: `${moduleKey}:${functionKey}:${id}`,
    module,
    function: functionName,
    task,
  };
}

function rowsFromGroups(
  module: string,
  groups: { function: string; tasks: { label: string; id?: string }[] }[],
): AccessControlRow[] {
  return groups.flatMap(group =>
    group.tasks.map(task => row(module, group.function, task.label, task.id)),
  );
}

function labelTasks(functionName: string, tasks: string[]) {
  return { function: functionName, tasks: tasks.map(label => ({ label })) };
}

function platformConfigRows(): AccessControlRow[] {
  return rowsFromGroups('Platform Config', [
    labelTasks('Companies', [
      'View Companies',
      'Create and Edit Company',
      'Manage Company Modules',
      'Manage Company Profile',
    ]),
    labelTasks('Locations', [
      'View Locations',
      'Create and Edit Location',
      'Manage Location Modules',
      'Manage Opening Hours',
      'Manage Access Control Levels',
    ]),
    labelTasks('Users', [
      'View Users',
      'Grant Platform Access',
      'Assign Access Control Type',
      'Manage Module Access',
    ]),
    labelTasks('Access Control', [
      'View Access Control',
      'Edit Access Control Matrix',
    ]),
    labelTasks('Audit Trail', ['View Audit Trail']),
    labelTasks('Ghost Support', ['Enter Ghost Support', 'View Ghost Support Log']),
  ]);
}

function homeAndReportRows(): AccessControlRow[] {
  return rowsFromGroups('Home & Reports', [
    labelTasks('Home', ['View Home Dashboard', 'View Notifications']),
    labelTasks('Report', ['View Reports Hub', 'Export Reports']),
  ]);
}

function rmsRows(): AccessControlRow[] {
  const fromUserAccess = RMS_TASK_GROUPS.flatMap(group =>
    group.tasks.map(task => row('Revenue Management', group.label, task.label, task.id)),
  );

  // Nav / product gaps not covered by RMS_TASK_GROUPS task ids.
  const extras = rowsFromGroups('Revenue Management', [
    {
      function: 'Order',
      tasks: [
        { label: 'Returnable Goods', id: 'returnableGoods' },
        { label: 'Credit Note', id: 'creditNote' },
      ],
    },
    {
      function: 'Sales',
      tasks: [{ label: 'Active Sales', id: 'activeSales' }],
    },
  ]);

  const seen = new Set(fromUserAccess.map(r => r.key));
  return [...fromUserAccess, ...extras.filter(r => !seen.has(r.key))];
}

function posRows(): AccessControlRow[] {
  const configuration = posItems.map(item =>
    row('Point of Sales', 'Configuration', item, taskIdFromLabel(item)),
  );

  const operations = rowsFromGroups('Point of Sales', [
    labelTasks('Web App Access', [
      'Open POS Web App',
      'Unlock with Staff PIN',
    ]),
    labelTasks('Order Service', [
      'Register',
      'Floor Plan',
      'Reservations',
      'Waitlist',
      'Edit Floor Plan',
      'Take Out',
      'History',
    ]),
    labelTasks('Cashier', [
      'Checkout',
      'Split Check',
      'Tips & Gratuity',
      'Cash Drawer',
      'Takeout & Delivery',
      'Discounts & Voids',
    ]),
    labelTasks('Kiosk', ['Start Order', 'Browse Menu', 'Pay']),
    labelTasks('Back of House', [
      'Kitchen Display (KDS)',
      'Bar Display (BDS)',
      'Customer Display (CDS)',
      'QR Order',
      'Order Routing',
      'Time Clock',
      'Reports & Analytics',
      'User Permissions',
      'Settings',
    ]),
  ]);

  return [...configuration, ...operations];
}

function hrmRows(): AccessControlRow[] {
  return rowsFromGroups('Human Resource Management', [
    labelTasks('Employee', [
      'View Employees',
      'Create and Edit Employee',
      'Deactivate Employee',
      'Reset Payroll PIN',
      'Manage Platform Access',
    ]),
    labelTasks('Attendance', [
      'View Attendance',
      'Edit Attendance',
      'Export Attendance',
      'Calendar View',
    ]),
    labelTasks('Leave', [
      'View Leave',
      'Approve Leave',
      'Manage Leave Balance',
      'Submit Leave (Portal)',
    ]),
    labelTasks('Schedule', [
      'View Schedule',
      'Edit Schedule Type 1',
      'Edit Schedule Type 2',
      'Copy Last Week',
    ]),
    labelTasks('Team', [
      'Open Team Portal',
      'Check In Out',
      'Scan POS QR',
      'Manage Team PIN',
      'Send Company Announcement',
    ]),
    labelTasks('Employee Portal', [
      'Open Employee Portal',
      'View Own Schedule',
      'View Own Payslip',
    ]),
    labelTasks('Payroll', [
      'View Payroll',
      'Run Payroll',
      'Approve Payroll',
      'Income Tax Settings',
    ]),
    labelTasks('Configuration', [
      'PH Setting',
      'Level & Entitlement',
      'Pay Structure',
      'Divisions & Department',
    ]),
  ]);
}

/**
 * Accounting AC rows.
 * Live workspace tasks are enforceable today.
 * General Ledger / AP / AR / payroll-GL rows are reserved for Books Phase B+
 * (see docs/ACCOUNTING_ARCHITECTURE.md). Keep function keys stable so stored
 * matrices do not break; do not wire these ids to UI until APIs exist.
 */
function accountingRows(): AccessControlRow[] {
  return rowsFromGroups('Accounting', [
    labelTasks('Workspace', [
      'Open Accounting',
      'View Payroll Workspace',
      'View Ops Finance Bridges',
      'View Books Roadmap',
    ]),
    labelTasks('General Ledger', [
      'View Chart of Accounts',
      'Manage Journal Entries',
      'Bank Reconciliation',
      'Financial Reports',
      'Account Mapping',
      'Soft Close Periods',
      'Hard Close Periods',
    ]),
    labelTasks('Accounts Payable', [
      'View AP',
      'Manage Vendor Bills',
      'Pay Bills',
      'Approve Vendor Bills',
    ]),
    labelTasks('Accounts Receivable', [
      'View AR',
      'Manage Customer Invoices',
      'Receive Payments',
    ]),
    labelTasks('Payroll Accounting', [
      'Post Payroll Journals',
      'View Payroll GL Mapping',
    ]),
  ]);
}

/**
 * Bisync RMS Web / mobile webapp (Attendance app) — Identity-style permission names
 * kept as task ids so matrix ticks can map to webapp permissionNames later.
 */
function webAppAccessRows(): AccessControlRow[] {
  return rowsFromGroups('Web App Access', [
    labelTasks('App Access', [
      'Open Web App',
      'Operator Role',
      'Vendor Role',
      'Login with Password',
      'Login with PIN',
      'Biometric Unlock',
    ]),
    {
      function: 'Orders',
      tasks: [
        { label: 'Create Order (View)', id: 'CreateOrderView' },
        { label: 'Create Order (Add/Edit)', id: 'CreateOrderAddEdit' },
        { label: 'Order List (View)', id: 'OrderListView' },
        { label: 'Order List (Add/Edit)', id: 'OrderListAddEdit' },
        { label: 'Edit Pending Approval Order', id: 'EditPendingApprovalOrder' },
        { label: 'Receive (Add/Edit)', id: 'ReceiveAddEdit' },
        { label: 'Consolidate (Add/Edit)', id: 'ConsolidateAddEdit' },
        { label: 'Receive & Consolidate (Add/Edit)', id: 'ReceiveConsolidateAddEdit' },
        { label: 'Procurement Price (View)', id: 'ProcurementPriceView' },
      ],
    },
    {
      function: 'Stock',
      tasks: [
        { label: 'Wastage (View)', id: 'WastageView' },
        { label: 'Wastage (Add/Edit)', id: 'WastageAddEdit' },
        { label: 'Transfer (View)', id: 'TransferView' },
        { label: 'Transfer (Add/Edit)', id: 'TransferAddEdit' },
        { label: 'Transfer (Delete)', id: 'TransferDelete' },
        { label: 'Inventory Ingredient (View)', id: 'InventoryIngredientView' },
        { label: 'Inventory Ingredient (Add/Edit)', id: 'InventoryIngredientAddEdit' },
      ],
    },
    {
      function: 'Vendor',
      tasks: [
        { label: 'Vendor Order (View)', id: 'VendorOrderView' },
        { label: 'Vendor Order (Add/Edit)', id: 'VendorOrderAddEdit' },
        { label: 'Sales', id: 'Sales' },
        {
          label: 'Vendor Order Approve/Reject Required Approval',
          id: 'VendorOrderApproveRejectRequiredApproval',
        },
      ],
    },
    labelTasks('Attendance', [
      'View Month Schedule',
      'Clock In Out',
      'View Attendance History',
    ]),
  ]);
}

/** Stable module order for filters and documentation. */
export const ACCESS_CONTROL_MODULE_ORDER = [
  'Home & Reports',
  'Platform Config',
  'Revenue Management',
  'Point of Sales',
  'Human Resource Management',
  'Accounting',
  'Web App Access',
] as const;

export const ACCESS_CONTROL_ROWS: AccessControlRow[] = [
  ...homeAndReportRows(),
  ...platformConfigRows(),
  ...rmsRows(),
  ...posRows(),
  ...hrmRows(),
  ...accountingRows(),
  ...webAppAccessRows(),
];

/** Restriction rows (tick = limit, not grant). Excluded from column “tick all”. */
export function isAccessControlRestrictionRow(row: AccessControlRow): boolean {
  return row.function === 'Policies' || row.key.endsWith(':hidePrices');
}

export function parseAccessControlTypes(json: string | null | undefined): AccessControlType[] {
  if (!json?.trim() || json === '[]') return defaultAccessControlTypes();
  try {
    const parsed = JSON.parse(json) as AccessControlType[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultAccessControlTypes();
    return defaultAccessControlTypes().map((fallback, index) => {
      const item = parsed[index];
      const id = item?.id?.trim() || fallback.id;
      let label = item?.label?.trim() || fallback.label;
      // Keep reserved Super User slot labeled unless the org already renamed it away
      // from both the default id and an empty/AC-1 style placeholder.
      if (id === SUPER_USER_ACCESS_TYPE_ID
        && (/^ac\s*1$/i.test(label) || label.length === 0)) {
        label = SUPER_USER_ACCESS_TYPE_LABEL;
      }
      return { id, label };
    });
  } catch {
    return defaultAccessControlTypes();
  }
}

export function parseAccessControlMatrix(json: string | null | undefined): AccessControlMatrix {
  if (!json?.trim() || json === '{}') return {};
  try {
    const parsed = JSON.parse(json) as AccessControlMatrix;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

/**
 * Ensure every Super User column is ticked for all grant tasks.
 * Runs whenever the catalog grows so new line items stay granted by default.
 */
export function ensureSuperUserMatrixGrants(
  matrix: AccessControlMatrix,
  types: AccessControlType[] = defaultAccessControlTypes(),
  rows: AccessControlRow[] = ACCESS_CONTROL_ROWS,
): AccessControlMatrix {
  const superTypeIds = types.filter(isSuperUserAccessType).map(t => t.id);
  if (superTypeIds.length === 0) return matrix;

  let next = matrix;
  let changed = false;
  for (const typeId of superTypeIds) {
    for (const accessRow of rows) {
      if (isAccessControlRestrictionRow(accessRow)) continue;
      if (next[accessRow.key]?.[typeId]) continue;
      if (!changed) {
        next = { ...matrix };
        changed = true;
      }
      const rowPerms = { ...(next[accessRow.key] ?? {}) };
      rowPerms[typeId] = true;
      next[accessRow.key] = rowPerms;
    }
  }
  return next;
}

export function serializeAccessControlTypes(types: AccessControlType[]): string {
  return JSON.stringify(types);
}

export function serializeAccessControlMatrix(matrix: AccessControlMatrix): string {
  return JSON.stringify(matrix);
}

export function isTaskAllowedForType(
  matrix: AccessControlMatrix,
  rowKey: string,
  typeId: string,
  types?: AccessControlType[],
): boolean {
  const row = ACCESS_CONTROL_ROWS.find(r => r.key === rowKey);
  const isRestriction = row ? isAccessControlRestrictionRow(row) : rowKey.endsWith(':hidePrices');

  // Super User always has every grant task, including newly added catalog rows.
  if (!isRestriction) {
    if (typeId === SUPER_USER_ACCESS_TYPE_ID) return true;
    if (types?.some(t => t.id === typeId && isSuperUserAccessType(t))) return true;
  }

  return !!matrix[rowKey]?.[typeId];
}

export function setTaskAllowedForType(
  matrix: AccessControlMatrix,
  rowKey: string,
  typeId: string,
  allowed: boolean,
  types: AccessControlType[] = defaultAccessControlTypes(),
): AccessControlMatrix {
  const type = types.find(t => t.id === typeId);
  const row = ACCESS_CONTROL_ROWS.find(r => r.key === rowKey);
  // Super User grant ticks cannot be cleared (restrictions still editable).
  if (
    type
    && isSuperUserAccessType(type)
    && !allowed
    && row
    && !isAccessControlRestrictionRow(row)
  ) {
    return matrix;
  }

  const rowState = { ...(matrix[rowKey] ?? {}) };
  if (allowed) rowState[typeId] = true;
  else delete rowState[typeId];
  return { ...matrix, [rowKey]: rowState };
}

export function setAllTasksForType(
  matrix: AccessControlMatrix,
  typeId: string,
  allowed: boolean,
  rows: AccessControlRow[] = ACCESS_CONTROL_ROWS,
  types: AccessControlType[] = defaultAccessControlTypes(),
): AccessControlMatrix {
  const type = types.find(t => t.id === typeId);
  // Super User column always stays fully granted for non-restriction rows.
  if (type && isSuperUserAccessType(type) && !allowed) {
    return ensureSuperUserMatrixGrants(matrix, types, ACCESS_CONTROL_ROWS);
  }

  const next = { ...matrix };
  for (const accessRow of rows) {
    // Never bulk-enable restriction policies (e.g. Price Hide).
    if (allowed && isAccessControlRestrictionRow(accessRow)) continue;
    const rowPerms = { ...(next[accessRow.key] ?? {}) };
    if (allowed) rowPerms[typeId] = true;
    else delete rowPerms[typeId];
    next[accessRow.key] = rowPerms;
  }
  return type && isSuperUserAccessType(type)
    ? ensureSuperUserMatrixGrants(next, types, ACCESS_CONTROL_ROWS)
    : next;
}
