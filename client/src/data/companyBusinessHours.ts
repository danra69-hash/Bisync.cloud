/** Company office / business hours (HQ admin staff) — separate from location opening hours. */

export const BUSINESS_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type BusinessWeekday = (typeof BUSINESS_WEEKDAYS)[number];

export type CompanyDayHours = {
  openFrom: string;
  openTo: string;
  closed: boolean;
};

export type CompanyBusinessHours = Record<BusinessWeekday, CompanyDayHours>;

export const BUSINESS_WEEKDAY_LABELS: Record<BusinessWeekday, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

/** JS getDay(): 0 = Sunday … 6 = Saturday → business weekday key */
const DOW_TO_WEEKDAY: BusinessWeekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/** 00:00, 00:30, … 23:30 */
export const BUSINESS_HALF_HOUR_TIMES: string[] = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minute}`;
});

export function blankBusinessDayHours(): CompanyDayHours {
  return { openFrom: '', openTo: '', closed: false };
}

/** Default HQ office: Mon–Fri 09:00–18:00, Sat/Sun closed. */
export function defaultBusinessHours(): CompanyBusinessHours {
  const open: CompanyDayHours = { openFrom: '09:00', openTo: '18:00', closed: false };
  const closed: CompanyDayHours = { openFrom: '', openTo: '', closed: true };
  return {
    monday: { ...open },
    tuesday: { ...open },
    wednesday: { ...open },
    thursday: { ...open },
    friday: { ...open },
    saturday: { ...closed },
    sunday: { ...closed },
  };
}

export function blankBusinessHours(): CompanyBusinessHours {
  return {
    monday: blankBusinessDayHours(),
    tuesday: blankBusinessDayHours(),
    wednesday: blankBusinessDayHours(),
    thursday: blankBusinessDayHours(),
    friday: blankBusinessDayHours(),
    saturday: blankBusinessDayHours(),
    sunday: blankBusinessDayHours(),
  };
}

/** Parse HH:mm and snap minutes to :00 or :30. */
export function normalizeBusinessTime(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return '';

  const totalMinutes = hour * 60 + minute;
  let snapped = Math.round(totalMinutes / 30) * 30;
  if (snapped >= 24 * 60) snapped = 0;
  const snappedHour = Math.floor(snapped / 60);
  const snappedMinute = snapped % 60;
  return `${String(snappedHour).padStart(2, '0')}:${String(snappedMinute).padStart(2, '0')}`;
}

export function parseBusinessHoursJson(json: string | null | undefined): CompanyBusinessHours {
  const base = blankBusinessHours();
  if (!json?.trim() || json === '{}') return base;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    for (const day of BUSINESS_WEEKDAYS) {
      const raw = parsed[day];
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as Record<string, unknown>;
      base[day] = {
        openFrom: normalizeBusinessTime(row.openFrom ?? row.open ?? row.from),
        openTo: normalizeBusinessTime(row.openTo ?? row.close ?? row.to),
        closed: Boolean(row.closed),
      };
    }
  } catch {
    // keep blanks
  }
  return base;
}

/** True when at least one day has hours or an explicit closed flag stored. */
export function hasConfiguredBusinessHours(json: string | null | undefined): boolean {
  if (!json?.trim() || json === '{}') return false;
  const hours = parseBusinessHoursJson(json);
  return BUSINESS_WEEKDAYS.some(day => {
    const row = hours[day];
    return row.closed || Boolean(row.openFrom) || Boolean(row.openTo);
  });
}

export function serializeBusinessHours(hours: CompanyBusinessHours): string {
  const payload: Record<string, CompanyDayHours> = {};
  for (const day of BUSINESS_WEEKDAYS) {
    const row = hours[day] ?? blankBusinessDayHours();
    payload[day] = {
      openFrom: normalizeBusinessTime(row.openFrom),
      openTo: normalizeBusinessTime(row.openTo),
      closed: Boolean(row.closed),
    };
  }
  return JSON.stringify(payload);
}

export function validateBusinessHours(hours: CompanyBusinessHours): string | null {
  for (const day of BUSINESS_WEEKDAYS) {
    const row = hours[day];
    if (row.closed) continue;
    const from = normalizeBusinessTime(row.openFrom);
    const to = normalizeBusinessTime(row.openTo);
    if ((from && !to) || (!from && to)) {
      return `${BUSINESS_WEEKDAY_LABELS[day]}: set both From and To, or mark Closed.`;
    }
  }
  return null;
}

export type OfficeHoursExpectation = {
  closed: boolean;
  openFrom: string | null;
  openTo: string | null;
};

/**
 * Resolve expected office in/out for a calendar date (yyyy-mm-dd).
 * Returns null when business hours are not configured at all.
 */
export function resolveOfficeHoursForDate(
  businessHoursJson: string | null | undefined,
  dateStr: string,
): OfficeHoursExpectation | null {
  if (!hasConfiguredBusinessHours(businessHoursJson)) return null;
  const hours = parseBusinessHoursJson(businessHoursJson);
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const day = DOW_TO_WEEKDAY[d.getDay()];
  const row = hours[day];
  if (row.closed) {
    return { closed: true, openFrom: null, openTo: null };
  }
  const openFrom = normalizeBusinessTime(row.openFrom) || null;
  const openTo = normalizeBusinessTime(row.openTo) || null;
  return { closed: false, openFrom, openTo };
}
