import type { PayrollOtherAllowance } from '../../modules/hr/types';
import { getCurrencySymbol } from '../../utils/numberFormat';

export function payrollCurrencySymbol(countryCode = 'MY') {
  return getCurrencySymbol(countryCode);
}

export function formatPayrollAmount(amount: number | null | undefined, countryCode = 'MY') {
  if (amount == null || Number.isNaN(amount)) return '—';
  const symbol = payrollCurrencySymbol(countryCode);
  return `${symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatJoinDate(joinDate: string) {
  const date = new Date(`${joinDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return joinDate;
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatLeasePeriod(start?: string | null, end?: string | null) {
  if (!start && !end) return '—';
  if (start && end) return `${formatJoinDate(start)} – ${formatJoinDate(end)}`;
  if (start) return `From ${formatJoinDate(start)}`;
  return `Until ${formatJoinDate(end!)}`;
}

export function otherAllowancesTotal(allowances?: PayrollOtherAllowance[]) {
  return (allowances ?? []).reduce((sum, item) => sum + (item.amount ?? 0), 0);
}

export function formatOtherAllowancesSummary(allowances?: PayrollOtherAllowance[], countryCode = 'MY') {
  const items = allowances ?? [];
  if (items.length === 0) return '—';
  const total = otherAllowancesTotal(items);
  if (items.length === 1) return formatPayrollAmount(total, countryCode);
  return `${formatPayrollAmount(total, countryCode)} (${items.length})`;
}

export function formatWorkPermitLabel(workPermitByCompany?: boolean | null) {
  if (workPermitByCompany === true) return 'Company';
  if (workPermitByCompany === false) return 'Self';
  return '—';
}

export function parsePayrollAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
