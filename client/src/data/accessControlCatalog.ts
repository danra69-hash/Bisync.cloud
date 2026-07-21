import { RMS_TASK_GROUPS } from './userAccess';
import { posItems } from './revenueManagement';

export const ACCESS_CONTROL_TYPE_COUNT = 8;

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
    label: `AC ${index + 1}`,
  }));
}

function row(module: string, functionName: string, task: string, taskId: string): AccessControlRow {
  const moduleKey = module.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const functionKey = functionName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    key: `${moduleKey}:${functionKey}:${taskId}`,
    module,
    function: functionName,
    task,
  };
}

function platformConfigRows(): AccessControlRow[] {
  const groups: { function: string; tasks: string[] }[] = [
    { function: 'Companies', tasks: ['View Companies', 'Create and Edit Company', 'Manage Company Modules'] },
    {
      function: 'Locations',
      tasks: [
        'View Locations',
        'Create and Edit Location',
        'Manage Location Modules',
        'Manage Opening Hours',
      ],
    },
    { function: 'Access Control', tasks: ['View Access Control', 'Edit Access Control Matrix'] },
    { function: 'Audit Trail', tasks: ['View Audit Trail'] },
  ];
  return groups.flatMap(group =>
    group.tasks.map(task =>
      row('Platform Config', group.function, task, task.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
    ),
  );
}

function rmsRows(): AccessControlRow[] {
  return RMS_TASK_GROUPS.flatMap(group =>
    group.tasks.map(task => row('Revenue Management', group.label, task.label, task.id)),
  );
}

function posRows(): AccessControlRow[] {
  return posItems.map(item =>
    row('Point of Sales', 'Configuration', item, item.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
  );
}

function hrmRows(): AccessControlRow[] {
  const groups: { function: string; tasks: string[] }[] = [
    { function: 'Employee', tasks: ['View Employees', 'Create and Edit Employee', 'Deactivate Employee'] },
    { function: 'Payroll', tasks: ['View Payroll', 'Run Payroll', 'Approve Payroll'] },
    { function: 'Leave', tasks: ['View Leave', 'Approve Leave', 'Manage Leave Balance'] },
    { function: 'Configuration', tasks: ['PH Setting', 'Level & Entitlement', 'Pay Structure', 'Divisions & Department'] },
  ];
  return groups.flatMap(group =>
    group.tasks.map(task =>
      row('Human Resource Management', group.function, task, task.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
    ),
  );
}

function accountingRows(): AccessControlRow[] {
  const tasks = [
    'View Chart of Accounts',
    'Manage Journal Entries',
    'Bank Reconciliation',
    'Financial Reports',
    'Account Mapping',
  ];
  return tasks.map(task =>
    row('Accounting', 'General Ledger', task, task.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
  );
}

export const ACCESS_CONTROL_ROWS: AccessControlRow[] = [
  ...platformConfigRows(),
  ...rmsRows(),
  ...posRows(),
  ...hrmRows(),
  ...accountingRows(),
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
      return {
        id: item?.id?.trim() || fallback.id,
        label: item?.label?.trim() || fallback.label,
      };
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
): boolean {
  return !!matrix[rowKey]?.[typeId];
}

export function setTaskAllowedForType(
  matrix: AccessControlMatrix,
  rowKey: string,
  typeId: string,
  allowed: boolean,
): AccessControlMatrix {
  const row = { ...(matrix[rowKey] ?? {}) };
  if (allowed) row[typeId] = true;
  else delete row[typeId];
  return { ...matrix, [rowKey]: row };
}

export function setAllTasksForType(
  matrix: AccessControlMatrix,
  typeId: string,
  allowed: boolean,
  rows: AccessControlRow[] = ACCESS_CONTROL_ROWS,
): AccessControlMatrix {
  const next = { ...matrix };
  for (const row of rows) {
    // Never bulk-enable restriction policies (e.g. Price Hide).
    if (allowed && isAccessControlRestrictionRow(row)) continue;
    const rowPerms = { ...(next[row.key] ?? {}) };
    if (allowed) rowPerms[typeId] = true;
    else delete rowPerms[typeId];
    next[row.key] = rowPerms;
  }
  return next;
}
