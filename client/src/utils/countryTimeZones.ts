/** IANA timezone resolution for company country + optional location state/province. */

const COUNTRY_TIMEZONES: Record<string, string> = {
  MY: 'Asia/Kuala_Lumpur',
  SG: 'Asia/Singapore',
  ID: 'Asia/Jakarta',
  TH: 'Asia/Bangkok',
  VN: 'Asia/Ho_Chi_Minh',
  PH: 'Asia/Manila',
  JP: 'Asia/Tokyo',
  KR: 'Asia/Seoul',
  CN: 'Asia/Shanghai',
  HK: 'Asia/Hong_Kong',
  TW: 'Asia/Taipei',
  AU: 'Australia/Sydney',
  NZ: 'Pacific/Auckland',
  GB: 'Europe/London',
  UK: 'Europe/London',
  FR: 'Europe/Paris',
  DE: 'Europe/Berlin',
  IT: 'Europe/Rome',
  ES: 'Europe/Madrid',
  US: 'America/New_York',
  CA: 'America/Toronto',
  AE: 'Asia/Dubai',
  IN: 'Asia/Kolkata',
};

const REGION_TIMEZONES: Record<string, Record<string, string>> = {
  US: {
    AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago',
    CA: 'America/Los_Angeles', CO: 'America/Denver', CT: 'America/New_York', DE: 'America/New_York',
    FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu', ID: 'America/Boise',
    IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', IA: 'America/Chicago', KS: 'America/Chicago',
    KY: 'America/New_York', LA: 'America/Chicago', ME: 'America/New_York', MD: 'America/New_York',
    MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago', MS: 'America/Chicago',
    MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago', NV: 'America/Los_Angeles',
    NH: 'America/New_York', NJ: 'America/New_York', NM: 'America/Denver', NY: 'America/New_York',
    NC: 'America/New_York', ND: 'America/Chicago', OH: 'America/New_York', OK: 'America/Chicago',
    OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York', SC: 'America/New_York',
    SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago', UT: 'America/Denver',
    VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles', WV: 'America/New_York',
    WI: 'America/Chicago', WY: 'America/Denver',
    Alabama: 'America/Chicago', Alaska: 'America/Anchorage', Arizona: 'America/Phoenix',
    California: 'America/Los_Angeles', Colorado: 'America/Denver', Florida: 'America/New_York',
    Hawaii: 'Pacific/Honolulu', Illinois: 'America/Chicago', 'New York': 'America/New_York',
    Texas: 'America/Chicago', Washington: 'America/Los_Angeles',
  },
  AU: {
    NSW: 'Australia/Sydney', 'New South Wales': 'Australia/Sydney',
    VIC: 'Australia/Melbourne', Victoria: 'Australia/Melbourne',
    QLD: 'Australia/Brisbane', Queensland: 'Australia/Brisbane',
    SA: 'Australia/Adelaide', 'South Australia': 'Australia/Adelaide',
    WA: 'Australia/Perth', 'Western Australia': 'Australia/Perth',
    TAS: 'Australia/Hobart', Tasmania: 'Australia/Hobart',
    NT: 'Australia/Darwin', 'Northern Territory': 'Australia/Darwin',
    ACT: 'Australia/Sydney', 'Australian Capital Territory': 'Australia/Sydney',
  },
  CA: {
    ON: 'America/Toronto', Ontario: 'America/Toronto',
    QC: 'America/Toronto', Quebec: 'America/Toronto',
    BC: 'America/Vancouver', 'British Columbia': 'America/Vancouver',
    AB: 'America/Edmonton', Alberta: 'America/Edmonton',
    MB: 'America/Winnipeg', Manitoba: 'America/Winnipeg',
    SK: 'America/Regina', Saskatchewan: 'America/Regina',
    NS: 'America/Halifax', 'Nova Scotia': 'America/Halifax',
    NB: 'America/Moncton', 'New Brunswick': 'America/Moncton',
    NL: 'America/St_Johns', 'Newfoundland and Labrador': 'America/St_Johns',
    PE: 'America/Halifax', 'Prince Edward Island': 'America/Halifax',
    YT: 'America/Whitehorse', Yukon: 'America/Whitehorse',
    NT: 'America/Yellowknife', 'Northwest Territories': 'America/Yellowknife',
    NU: 'America/Iqaluit', Nunavut: 'America/Iqaluit',
  },
  ID: {
    Jakarta: 'Asia/Jakarta', 'Jawa Barat': 'Asia/Jakarta', 'West Java': 'Asia/Jakarta',
    Bali: 'Asia/Makassar', Sulawesi: 'Asia/Makassar', Makassar: 'Asia/Makassar',
    Papua: 'Asia/Jayapura', Maluku: 'Asia/Jayapura',
  },
};

export const DEFAULT_ORG_TIME_ZONE_ID = 'Asia/Kuala_Lumpur';

export function resolveOrgTimeZoneId(
  countryCode?: string | null,
  stateProvince?: string | null,
  explicitTimeZoneId?: string | null,
): string {
  if (explicitTimeZoneId?.trim()) return explicitTimeZoneId.trim();
  const code = (countryCode ?? 'MY').trim().toUpperCase() || 'MY';
  const region = (stateProvince ?? '').trim();
  if (region) {
    const byRegion = REGION_TIMEZONES[code];
    if (byRegion) {
      const match = byRegion[region] ?? byRegion[region.toUpperCase()];
      if (match) return match;
    }
  }
  return COUNTRY_TIMEZONES[code] ?? 'UTC';
}

/** Resolve IANA TZ for the selected company + primary selected location (cloud org clock). */
export function resolveSessionTimeZoneId(opts: {
  countryCode?: string | null;
  stateProvince?: string | null;
  companyTimeZoneId?: string | null;
  locationTimeZoneId?: string | null;
  locationCountryCode?: string | null;
  locationStateProvince?: string | null;
}): string {
  return resolveOrgTimeZoneId(
    opts.locationCountryCode || opts.countryCode || 'MY',
    opts.locationStateProvince || opts.stateProvince || '',
    opts.locationTimeZoneId || opts.companyTimeZoneId,
  );
}

/**
 * Calendar date (YYYY-MM-DD) for an instant in the org/cloud timezone.
 * Prefer this over `Date#getFullYear/getMonth/getDate` (browser local) or
 * `toISOString().slice(0, 10)` (UTC).
 */
export function toDateInputValueInTz(date: Date = new Date(), timeZoneId?: string | null): string {
  const tz = timeZoneId?.trim() || DEFAULT_ORG_TIME_ZONE_ID;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }
}

/** Today's business date in the org/cloud timezone (YYYY-MM-DD). */
export function orgTodayYmd(timeZoneId?: string | null, date: Date = new Date()): string {
  return toDateInputValueInTz(date, timeZoneId);
}

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function zonedParts(date: Date, timeZoneId: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZoneId,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(p => p.type === type)?.value ?? '0');
  let hour = num('hour');
  // Some engines emit hour 24 at midnight.
  if (hour === 24) hour = 0;
  return {
    year: num('year'),
    month: num('month'),
    day: num('day'),
    hour,
    minute: num('minute'),
    second: num('second'),
  };
}

/** Wall-clock HH:mm in the org/cloud timezone. */
export function orgClockHhMm(date: Date = new Date(), timeZoneId?: string | null): string {
  const tz = timeZoneId?.trim() || DEFAULT_ORG_TIME_ZONE_ID;
  try {
    const p = zonedParts(date, tz);
    return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
  } catch {
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

/** `<input type="datetime-local">` value (YYYY-MM-DDTHH:mm) in org/cloud timezone. */
export function toDateTimeLocalValueInTz(date: Date = new Date(), timeZoneId?: string | null): string {
  const ymd = toDateInputValueInTz(date, timeZoneId);
  const hm = orgClockHhMm(date, timeZoneId);
  return `${ymd}T${hm}`;
}

/**
 * Interpret a datetime-local string as wall time in the org/cloud timezone
 * and return a UTC ISO instant for API persistence.
 */
export function dateTimeLocalInTzToUtcIso(
  localValue: string,
  timeZoneId?: string | null,
): string {
  const m = localValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    const fallback = new Date(localValue);
    return Number.isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? '0');
  const tz = timeZoneId?.trim() || DEFAULT_ORG_TIME_ZONE_ID;
  const desiredAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  let utcMs = desiredAsUtcMs;
  try {
    for (let i = 0; i < 3; i++) {
      const wall = zonedParts(new Date(utcMs), tz);
      const wallAsUtcMs = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
      const diff = desiredAsUtcMs - wallAsUtcMs;
      utcMs += diff;
      if (diff === 0) break;
    }
  } catch {
    utcMs = desiredAsUtcMs;
  }
  return new Date(utcMs).toISOString();
}

/** Add whole calendar years to a YYYY-MM-DD string (clamps Feb 29). */
export function addCalendarYearsToYmd(ymd: string, years: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const targetYear = y + years;
  const lastDay = new Date(Date.UTC(targetYear, m, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Add whole calendar days to a YYYY-MM-DD string. */
export function addCalendarDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Add whole calendar months to a YYYY-MM-DD string (clamps day-of-month). */
export function addCalendarMonthsToYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const idx = y * 12 + (m - 1) + months;
  const targetYear = Math.floor(idx / 12);
  const targetMonth = (idx % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatOrgDateTime(
  date: Date,
  timeZoneId: string,
  locale = 'en-GB',
  options?: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timeZoneId,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      ...options,
    }).format(date);
  } catch {
    return date.toLocaleString(locale);
  }
}

export function formatOrgClockLine(
  date: Date,
  timeZoneId: string,
  locale = 'en-GB',
): string {
  return formatOrgDateTime(date, timeZoneId, locale);
}
