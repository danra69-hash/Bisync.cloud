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
