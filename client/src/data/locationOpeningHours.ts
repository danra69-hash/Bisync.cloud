/** Weekly opening hours + last-order times for a location (HH:mm, 24h, :00 or :30 only). */

export const LOCATION_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type LocationWeekday = (typeof LOCATION_WEEKDAYS)[number];

export type LocationDayHours = {
  openFrom: string;
  openTo: string;
  lastOrder: string;
  closed: boolean;
};

export type LocationOpeningHours = Record<LocationWeekday, LocationDayHours>;

export const LOCATION_WEEKDAY_LABELS: Record<LocationWeekday, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

/** 00:00, 00:30, … 23:30 */
export const HALF_HOUR_TIMES: string[] = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minute}`;
});

export function blankDayHours(): LocationDayHours {
  return { openFrom: '', openTo: '', lastOrder: '', closed: false };
}

export function blankOpeningHours(): LocationOpeningHours {
  return {
    monday: blankDayHours(),
    tuesday: blankDayHours(),
    wednesday: blankDayHours(),
    thursday: blankDayHours(),
    friday: blankDayHours(),
    saturday: blankDayHours(),
    sunday: blankDayHours(),
  };
}

/** Parse HH:mm and snap minutes to :00 or :30. */
export function normalizeTime(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  // Accept H:mm, HH:mm, or HH:mm:ss
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return '';

  const totalMinutes = hour * 60 + minute;
  let snapped = Math.round(totalMinutes / 30) * 30;
  if (snapped >= 24 * 60) snapped = 0; // 23:45+ → 00:00
  const snappedHour = Math.floor(snapped / 60);
  const snappedMinute = snapped % 60;
  return `${String(snappedHour).padStart(2, '0')}:${String(snappedMinute).padStart(2, '0')}`;
}

export function parseOpeningHoursJson(json: string | null | undefined): LocationOpeningHours {
  const base = blankOpeningHours();
  if (!json?.trim() || json === '{}') return base;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    for (const day of LOCATION_WEEKDAYS) {
      const raw = parsed[day];
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as Record<string, unknown>;
      base[day] = {
        openFrom: normalizeTime(row.openFrom ?? row.open ?? row.from),
        openTo: normalizeTime(row.openTo ?? row.close ?? row.to),
        lastOrder: normalizeTime(row.lastOrder ?? row.lastOrderTime),
        closed: Boolean(row.closed),
      };
    }
  } catch {
    // keep blanks
  }
  return base;
}

export function serializeOpeningHours(hours: LocationOpeningHours): string {
  const payload: Record<string, LocationDayHours> = {};
  for (const day of LOCATION_WEEKDAYS) {
    const row = hours[day] ?? blankDayHours();
    payload[day] = {
      openFrom: normalizeTime(row.openFrom),
      openTo: normalizeTime(row.openTo),
      lastOrder: normalizeTime(row.lastOrder),
      closed: Boolean(row.closed),
    };
  }
  return JSON.stringify(payload);
}

/** Optional validation: when not closed, openFrom/openTo should both be set if either is. */
export function validateOpeningHours(hours: LocationOpeningHours): string | null {
  for (const day of LOCATION_WEEKDAYS) {
    const row = hours[day];
    if (row.closed) continue;
    const from = normalizeTime(row.openFrom);
    const to = normalizeTime(row.openTo);
    const last = normalizeTime(row.lastOrder);
    if ((from && !to) || (!from && to)) {
      return `${LOCATION_WEEKDAY_LABELS[day]}: set both Opening From and To, or leave both blank.`;
    }
    if (last && !from && !to) {
      return `${LOCATION_WEEKDAY_LABELS[day]}: set Opening Hours before Last Order time.`;
    }
  }
  return null;
}
