import type { Employee, PayStructure } from '../../modules/hr/types';

export const MALAYSIA_MOBILE_OPERATORS = ['Maxis', 'Celcom', 'Digi', 'U-Mobile', 'Yes'] as const;

export function validatePayrollAllowanceDetails(employee: Employee): string | null {
  if (employee.transportProvided) {
    if (!employee.transportCarModel?.trim()) return 'Enter car model when transport is provided.';
    if (!employee.transportPlateNumber?.trim()) return 'Enter plate number when transport is provided.';
  }
  if (employee.accommodationProvided) {
    if (!employee.accommodationAddress?.trim()) return 'Enter accommodation address when accommodation is provided.';
    if (!employee.accommodationLeaseStart?.trim()) return 'Select lease start date when accommodation is provided.';
    if (!employee.accommodationLeaseEnd?.trim()) return 'Select lease end date when accommodation is provided.';
    if (employee.accommodationLeaseStart > employee.accommodationLeaseEnd) {
      return 'Lease end date must be on or after the start date.';
    }
  }
  if (employee.mobileProvided) {
    if (!employee.mobileAllowancePhone?.trim()) return 'Enter mobile number when mobile allowance is provided.';
    if (!employee.mobileProvider?.trim()) return 'Select mobile provider when mobile allowance is provided.';
  }
  if (employee.bonusEnabled) {
    if (!employee.bonusMonthly && !employee.bonusAnnually) {
      return 'Select at least one bonus frequency (Monthly or Annually).';
    }
    const hasAmount = employee.bonusAmount != null && employee.bonusAmount > 0;
    const hasBasis = employee.bonusByBasicSalary || employee.bonusByService;
    if (!hasAmount && !hasBasis) {
      return 'Enter a bonus amount or select Basic Salary and/or Service as the basis.';
    }
  }
  return null;
}

export function formatOvertimeRateLabel(multiplier?: number | null) {
  const rate = multiplier && multiplier > 0 ? multiplier : 1.5;
  return `${rate}× hourly rate`;
}

export function formatOvertimeConfigLabel(
  payStructure: Pick<PayStructure, 'overtimeCalculationMode' | 'overtimeRateMultiplier' | 'overtimeFixedHourlyRate' | 'payCycle'>,
  countryCode = 'MY',
) {
  const symbol = countryCode === 'MY' ? 'RM' : '$';
  if (payStructure.overtimeCalculationMode === 'Fixed') {
    const rate = payStructure.overtimeFixedHourlyRate ?? 0;
    return rate > 0 ? `${symbol} ${rate.toFixed(2)} per hour (fixed)` : 'Fixed hourly rate not set';
  }
  const period = payStructure.payCycle === 'Weekly' ? 'weekly salary' : 'monthly salary';
  const multiplier = payStructure.overtimeRateMultiplier > 0 ? payStructure.overtimeRateMultiplier : 1.5;
  return `${multiplier}× (${period} ÷ work days × working hours)`;
}

export function formatBonusSummary(employee: Employee, countryCode = 'MY') {
  if (!employee.bonusEnabled) return '—';
  const parts: string[] = [];
  if (employee.bonusMonthly) parts.push('Monthly');
  if (employee.bonusAnnually) parts.push('Annually');
  const freq = parts.length > 0 ? parts.join(' + ') : '—';
  const basis: string[] = [];
  if (employee.bonusAmount != null && employee.bonusAmount > 0) {
    const symbol = countryCode === 'MY' ? 'RM' : '$';
    basis.push(`${symbol} ${employee.bonusAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
  }
  if (employee.bonusByBasicSalary) basis.push('Basic Salary');
  if (employee.bonusByService) basis.push('Service');
  return `${freq}${basis.length > 0 ? ` · ${basis.join(' + ')}` : ''}`;
}
