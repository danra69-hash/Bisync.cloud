/** Product-aligned Automated QA groups (matches Revenue Management + modules). */

export const QA_GROUPS = [
  { id: 'setup', label: '1 · Setup & Tenancy' },
  { id: 'system-config', label: '2 · System Configuration' },
  { id: 'component', label: '3 · Component (My Component)' },
  { id: 'vendors', label: '4 · Vendors' },
  { id: 'products', label: '5 · Products' },
  { id: 'operation-order', label: '6 · Operation · Order' },
  { id: 'operation-inventory', label: '7 · Operation · Inventory' },
  { id: 'operation-production', label: '8 · Operation · Production' },
  { id: 'sales', label: '9 · Sales' },
  { id: 'reports', label: '10 · Reports' },
  { id: 'hr', label: '11 · Human Resources' },
  { id: 'accounting', label: '12 · Accounting' },
  { id: 'pos', label: '13 · Point-of-Sales' },
] as const;

export type QaGroupId = (typeof QA_GROUPS)[number]['id'];

export const QA_GROUP_LABEL: Record<QaGroupId, string> = Object.fromEntries(
  QA_GROUPS.map(g => [g.id, g.label]),
) as Record<QaGroupId, string>;
