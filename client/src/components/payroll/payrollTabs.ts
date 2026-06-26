export const PAYROLL_TABS = [
  { id: 'directory', label: 'Employee Directory' },
  { id: 'process', label: 'Process Payroll' },
] as const;

export type PayrollTabId = (typeof PAYROLL_TABS)[number]['id'];
