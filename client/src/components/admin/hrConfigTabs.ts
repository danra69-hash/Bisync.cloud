export const HR_CONFIG_TABS = [
  { id: 'ph' as const, label: 'PH Setting' },
  { id: 'levels' as const, label: 'Level & Entitlement' },
  { id: 'pay' as const, label: 'Pay Structure' },
  { id: 'org' as const, label: 'Divisions & Department' },
] as const;

export type HrConfigTabId = (typeof HR_CONFIG_TABS)[number]['id'];

export type HrEmployeeConfigTabId = 'employee' | HrConfigTabId;

export const SYSTEM_HR_CONFIG_TABS = [
  { id: 'companies' as const, label: 'Companies' },
  { id: 'locations' as const, label: 'Locations' },
  { id: 'accessControl' as const, label: 'Access Control' },
  { id: 'auditTrail' as const, label: 'Audit Trail' },
] as const;

export type SystemHrConfigTabId = (typeof SYSTEM_HR_CONFIG_TABS)[number]['id'];
