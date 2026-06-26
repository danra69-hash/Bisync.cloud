export const PAYROLL_MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const;

export function payrollYearOptions(anchorYear = new Date().getFullYear()) {
  return Array.from({ length: 5 }, (_, index) => anchorYear - 2 + index);
}

export function formatAttendanceSummary(presentDays: number, workingDays: number, payType: string, totalHours: number) {
  if (payType === 'Hourly') return `${totalHours.toFixed(1)} hrs`;
  return `${presentDays.toFixed(1)} / ${workingDays} days`;
}

export function formatOvertimeSummary(
  amount: number,
  hours: number,
  countryCode: string,
  formatAmount: (amount: number, countryCode?: string) => string,
) {
  if (amount <= 0 && hours <= 0) return '—';
  if (hours > 0) return `${formatAmount(amount, countryCode)} (${hours.toFixed(1)}h)`;
  return formatAmount(amount, countryCode);
}

export function formatPositionDept(position: string, department: string) {
  const pos = position?.trim() || '—';
  const dept = department?.trim();
  return dept ? `${pos} (${dept})` : pos;
}

export function formatPayPackageSummary(
  baseSalary: number,
  allowancesTotal: number,
  bonusAmount: number,
  overtimeAmount: number,
  countryCode: string,
  formatAmount: (amount: number, countryCode?: string) => string,
) {
  const parts = [
    `Base ${formatAmount(baseSalary, countryCode)}`,
    allowancesTotal > 0 ? `Allowances ${formatAmount(allowancesTotal, countryCode)}` : null,
    bonusAmount > 0 ? `Bonus ${formatAmount(bonusAmount, countryCode)}` : null,
    overtimeAmount > 0 ? `OT ${formatAmount(overtimeAmount, countryCode)}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

export function formatProcessedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function groupRunsByYear(runs: { year: number }[]) {
  const years = [...new Set(runs.map(run => run.year))].sort((a, b) => b - a);
  return years;
}
