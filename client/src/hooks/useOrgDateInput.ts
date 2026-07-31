import { useMemo } from 'react';
import { useOrgTimeZoneId } from '../context/OrgCountryContext';
import {
  addCalendarDaysToYmd,
  addCalendarMonthsToYmd,
  addCalendarYearsToYmd,
  dateTimeLocalInTzToUtcIso,
  orgClockHhMm,
  orgTodayYmd,
  toDateInputValueInTz,
  toDateTimeLocalValueInTz,
} from '../utils/countryTimeZones';

/**
 * Date/time helpers bound to the selected company/location cloud timezone
 * (not the browser's local timezone or UTC midnight).
 */
export function useOrgDateInput() {
  const timeZoneId = useOrgTimeZoneId();

  return useMemo(() => {
    const todayYmd = orgTodayYmd(timeZoneId);
    return {
      timeZoneId,
      /** Today's business date YYYY-MM-DD in org TZ. */
      todayYmd,
      /** Format an instant as YYYY-MM-DD in org TZ (for `<input type="date">`). */
      toDateInputValue: (date: Date = new Date()) => toDateInputValueInTz(date, timeZoneId),
      /** Format an instant as YYYY-MM-DDTHH:mm in org TZ (for `<input type="datetime-local">`). */
      toDateTimeLocalValue: (date: Date = new Date()) => toDateTimeLocalValueInTz(date, timeZoneId),
      /** Convert datetime-local wall time in org TZ → UTC ISO for the API. */
      dateTimeLocalToUtcIso: (localValue: string) => dateTimeLocalInTzToUtcIso(localValue, timeZoneId),
      /** Two years before org today (live history window). */
      earliestLiveYmd: () => addCalendarYearsToYmd(orgTodayYmd(timeZoneId), -2),
      addDays: (ymd: string, days: number) => addCalendarDaysToYmd(ymd, days),
      addMonths: (ymd: string, months: number) => addCalendarMonthsToYmd(ymd, months),
      addYears: (ymd: string, years: number) => addCalendarYearsToYmd(ymd, years),
      clockHhMm: (date: Date = new Date()) => orgClockHhMm(date, timeZoneId),
    };
  }, [timeZoneId]);
}
