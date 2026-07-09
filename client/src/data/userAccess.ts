/** Shared user access definitions — used by System Configuration and Human Resources. */

export type AccessModule = 'RMS' | 'POS' | 'HRM' | 'Accounting';

export const ACCESS_MODULES: { id: AccessModule; label: string; description: string }[] = [
  { id: 'RMS', label: 'RMS', description: 'Revenue Management' },
  { id: 'POS', label: 'POS', description: 'Point of Sales' },
  { id: 'HRM', label: 'HRM', description: 'Human Resources' },
  { id: 'Accounting', label: 'Accounting', description: 'Accounting' },
];

export type RmsTaskGroup = {
  id: string;
  label: string;
  tasks: { id: string; label: string }[];
};

export const RMS_TASK_GROUPS: RmsTaskGroup[] = [
  {
    id: 'order',
    label: 'Order',
    tasks: [
      { id: 'viewOrder', label: 'View Order' },
      { id: 'createEditOrder', label: 'Create and Edit Order' },
      { id: 'approveOrder', label: 'Approve Order' },
      { id: 'receiveOrder', label: 'Receive Order' },
      { id: 'consolidateOrder', label: 'Consolidate Order' },
      { id: 'cashPurchase', label: 'Cash Purchase' },
      { id: 'orderTemplate', label: 'Order Template' },
    ],
  },
  {
    id: 'production',
    label: 'Production',
    tasks: [
      { id: 'productManagement', label: 'B2B Product' },
      { id: 'subProductManagement', label: 'Sub-Product' },
      { id: 'offlineSales', label: 'Offline Sales' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    tasks: [
      { id: 'stockCard', label: 'Stock Card' },
      { id: 'inventoryPost', label: 'Inventory Post' },
      { id: 'inventoryConfirmation', label: 'Inventory Confirmation' },
      { id: 'inventoryAdjustment', label: 'Inventory Adjustment' },
      { id: 'creditNote', label: 'Credit Note' },
      { id: 'wastage', label: 'Wastage' },
      { id: 'transfer', label: 'Transfer' },
      { id: 'inventoryConfiguration', label: 'Inventory Configuration' },
    ],
  },
  {
    id: 'smartComponent',
    label: 'Smart Component',
    tasks: [
      { id: 'createEdit', label: 'Create and edit' },
      { id: 'activateDeactivateVendorProducts', label: 'Activate/Deactivate Vendor Products' },
      { id: 'createEditComponentGroup', label: 'Create and Edit Component Group' },
      { id: 'createEditStorageAssignment', label: 'Create and edit Storage Assignment' },
      { id: 'accountMapping', label: 'Account Mapping' },
    ],
  },
  {
    id: 'vendor',
    label: 'Vendor',
    tasks: [
      { id: 'viewVendorList', label: 'View Vendor List & Products' },
      { id: 'viewVendorProducts', label: 'View Vendor Products' },
      { id: 'activateDeactivateVendor', label: 'Activate/deactivate Vendor' },
      { id: 'accountMapping', label: 'Account Mapping' },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    tasks: [
      { id: 'viewProductSubProduct', label: 'View Product & sub-product' },
      { id: 'manageProductSubProduct', label: 'Manage Product & sub-product' },
      { id: 'accountMapping', label: 'Account Mapping' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    tasks: [
      { id: 'manageCustomers', label: 'Manage Customers' },
      { id: 'customerGroup', label: 'Customer Group' },
      { id: 'manageSalesOrder', label: 'Manage Sales Order' },
      { id: 'manageInvoice', label: 'Manage Invoice' },
      { id: 'promotionScheduler', label: 'Promotion Scheduler' },
      { id: 'accountMapping', label: 'Account Mapping' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    tasks: [{ id: 'viewReports', label: 'View Reports' }],
  },
];

export type RmsPermissions = {
  enabled: boolean;
  tasks: Record<string, boolean>;
};

export type UserAccess = {
  modules: AccessModule[];
  rms?: RmsPermissions;
  superAdmin?: boolean;
  accessControlTypeId?: string | null;
};

export function allRmsTaskIds(): string[] {
  return RMS_TASK_GROUPS.flatMap(g => g.tasks.map(t => t.id));
}

export function defaultRmsPermissions(): RmsPermissions {
  const tasks: Record<string, boolean> = {};
  for (const id of allRmsTaskIds()) tasks[id] = false;
  return { enabled: false, tasks };
}

export function defaultUserAccess(): UserAccess {
  return { modules: [], rms: defaultRmsPermissions() };
}

export function parseUserAccess(raw: string | UserAccess | null | undefined): UserAccess {
  if (!raw) return defaultUserAccess();
  if (typeof raw !== 'string') return normalizeUserAccess(raw);
  try {
    return normalizeUserAccess(JSON.parse(raw) as UserAccess);
  } catch {
    return defaultUserAccess();
  }
}

function normalizeUserAccess(access: UserAccess): UserAccess {
  const rms = access.rms ?? defaultRmsPermissions();
  const tasks = { ...defaultRmsPermissions().tasks, ...rms.tasks };
  return {
    modules: access.modules ?? [],
    rms: { enabled: rms.enabled ?? false, tasks },
    superAdmin: access.superAdmin ?? false,
    accessControlTypeId: access.accessControlTypeId?.trim() || null,
  };
}

export function isSuperAdmin(access: UserAccess): boolean {
  return !!parseUserAccess(access).superAdmin;
}

export function hasModule(access: UserAccess, module: AccessModule): boolean {
  const normalized = parseUserAccess(access);
  if (normalized.superAdmin) return true;
  return normalized.modules.includes(module);
}

export function setAccessControlType(access: UserAccess, typeId: string | null): UserAccess {
  return { ...access, accessControlTypeId: typeId?.trim() || null };
}

export function toggleModule(access: UserAccess, module: AccessModule): UserAccess {
  const modules = hasModule(access, module)
    ? access.modules.filter(m => m !== module)
    : [...access.modules, module];
  return { ...access, modules };
}

export function setRmsEnabled(access: UserAccess, enabled: boolean): UserAccess {
  return {
    ...access,
    rms: { ...(access.rms ?? defaultRmsPermissions()), enabled },
  };
}

export function setRmsTask(access: UserAccess, taskId: string, enabled: boolean): UserAccess {
  const rms = access.rms ?? defaultRmsPermissions();
  return {
    ...access,
    rms: { ...rms, tasks: { ...rms.tasks, [taskId]: enabled } },
  };
}

export function setRmsGroup(access: UserAccess, groupId: string, enabled: boolean): UserAccess {
  const group = RMS_TASK_GROUPS.find(g => g.id === groupId);
  if (!group) return access;
  const rms = access.rms ?? defaultRmsPermissions();
  const tasks = { ...rms.tasks };
  for (const t of group.tasks) tasks[t.id] = enabled;
  return { ...access, rms: { ...rms, tasks } };
}

export function rmsGroupAllEnabled(access: UserAccess, groupId: string): boolean {
  const group = RMS_TASK_GROUPS.find(g => g.id === groupId);
  if (!group) return false;
  const tasks = access.rms?.tasks ?? {};
  return group.tasks.every(t => tasks[t.id]);
}

export function rmsGroupSomeEnabled(access: UserAccess, groupId: string): boolean {
  const group = RMS_TASK_GROUPS.find(g => g.id === groupId);
  if (!group) return false;
  const tasks = access.rms?.tasks ?? {};
  return group.tasks.some(t => tasks[t.id]);
}

export const RMS_APPROVE_ORDER_TASK = 'approveOrder';
export const RMS_RECEIVE_ORDER_TASK = 'receiveOrder';
export const RMS_INVENTORY_POST_TASK = 'inventoryPost';
export const RMS_INVENTORY_CONFIRM_TASK = 'inventoryConfirmation';

export function canReceivePurchaseOrder(access: UserAccess): boolean {
  return hasRmsTask(access, RMS_RECEIVE_ORDER_TASK);
}

export function canSaveInventoryCount(access: UserAccess): boolean {
  return hasRmsTask(access, RMS_INVENTORY_POST_TASK);
}

export function canConfirmInventoryCount(access: UserAccess): boolean {
  return hasRmsTask(access, RMS_INVENTORY_CONFIRM_TASK);
}

export function hasRmsTask(access: UserAccess, taskId: string): boolean {
  const normalized = parseUserAccess(access);
  if (normalized.superAdmin && hasModule(normalized, 'RMS')) return true;
  if (!hasModule(normalized, 'RMS')) return false;
  const rms = normalized.rms;
  if (!rms?.enabled) return false;
  return !!rms.tasks[taskId];
}

export function canApprovePurchaseOrder(access: UserAccess): boolean {
  return hasRmsTask(access, RMS_APPROVE_ORDER_TASK);
}
