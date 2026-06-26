export const HR_EMPLOYEE_CONFIG_TABS = [
  { id: 'employee' as const, label: 'Employee' },
  { id: 'ph' as const, label: 'PH Setting' },
  { id: 'levels' as const, label: 'Level & Entitlement' },
  { id: 'pay' as const, label: 'Pay Structure' },
  { id: 'org' as const, label: 'Divisions & Department' },
];

export type HrEmployeeConfigTabId = (typeof HR_EMPLOYEE_CONFIG_TABS)[number]['id'];

export const SYSTEM_HR_CONFIG_TABS = [
  { id: 'companies' as const, label: 'Companies' },
  { id: 'locations' as const, label: 'Locations' },
  ...HR_EMPLOYEE_CONFIG_TABS,
];

export type SystemHrConfigTabId = (typeof SYSTEM_HR_CONFIG_TABS)[number]['id'];
