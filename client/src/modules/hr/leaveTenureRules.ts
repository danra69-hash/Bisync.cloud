/** Years-of-service leave band: fromYears ≤ YOS < toYears (toYears null = and above). */
export type LeaveTenureRule = {
  fromYears: number;
  toYears: number | null;
  days: number;
};

export const DEFAULT_LEAVE_TENURE_RULES: LeaveTenureRule[] = [
  { fromYears: 1, toYears: 3, days: 10 },
  { fromYears: 3, toYears: 5, days: 12 },
  { fromYears: 5, toYears: null, days: 14 },
];

export function cloneLeaveTenureRules(rules?: LeaveTenureRule[] | null): LeaveTenureRule[] {
  const source = rules && rules.length > 0 ? rules : DEFAULT_LEAVE_TENURE_RULES;
  return source.map(r => ({
    fromYears: Math.max(0, Number(r.fromYears) || 0),
    toYears: r.toYears == null ? null : Math.max(0, Number(r.toYears) || 0),
    days: Math.max(0, Number(r.days) || 0),
  }));
}

export function parseLeaveTenureRules(json?: string | null, fallbackDays?: number): LeaveTenureRule[] {
  if (json && json.trim()) {
    try {
      const parsed = JSON.parse(json) as LeaveTenureRule[];
      if (Array.isArray(parsed) && parsed.length > 0) return cloneLeaveTenureRules(parsed);
    } catch {
      /* fall through */
    }
  }
  if (fallbackDays != null && fallbackDays > 0) {
    return [{ fromYears: 0, toYears: null, days: fallbackDays }];
  }
  return cloneLeaveTenureRules(DEFAULT_LEAVE_TENURE_RULES);
}

export function summarizeLeaveTenureRules(rules: LeaveTenureRule[]): string {
  if (rules.length === 0) return '—';
  const days = rules.map(r => r.days);
  const min = Math.min(...days);
  const max = Math.max(...days);
  return min === max ? `${min}d` : `${min}–${max}d`;
}

export function blankLeaveTenureRule(after?: LeaveTenureRule): LeaveTenureRule {
  const fromYears = after?.toYears ?? (after ? after.fromYears + 1 : 0);
  return {
    fromYears,
    toYears: fromYears + 2,
    days: after?.days ?? 10,
  };
}

/** Round to nearest 0.5 day (matches API AnnualLeaveEntitlement). */
export function roundToHalfDay(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Pro-rate full-year AL for the operating (calendar) year.
 * Prior-year joiners keep the full entitlement; same-year joiners get
 * (months from join month through Dec inclusive) / 12.
 */
export function prorateAnnualLeaveForOperatingYear(
  fullYearDays: number,
  joinDate: Date | string,
  asOf: Date = new Date(),
): number {
  if (fullYearDays <= 0) return 0;
  const join = typeof joinDate === 'string' ? new Date(`${joinDate}T00:00:00Z`) : joinDate;
  if (Number.isNaN(join.getTime())) return 0;

  const asOfUtc = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const joinUtc = new Date(Date.UTC(join.getUTCFullYear(), join.getUTCMonth(), join.getUTCDate()));
  if (joinUtc > asOfUtc) return 0;

  const yearStart = new Date(Date.UTC(asOfUtc.getUTCFullYear(), 0, 1));
  if (joinUtc < yearStart) return roundToHalfDay(fullYearDays);

  const monthsRemaining = 12 - joinUtc.getUTCMonth();
  return roundToHalfDay((fullYearDays * monthsRemaining) / 12);
}
