import { createContext, useContext, useMemo } from 'react';
import {
  DEFAULT_ORG_TIME_ZONE_ID,
  resolveOrgTimeZoneId,
} from '../utils/countryTimeZones';

const DEFAULT_COUNTRY_CODE = 'MY';

type OrgLocaleValue = {
  countryCode: string;
  timeZoneId: string;
};

const OrgCountryContext = createContext<OrgLocaleValue>({
  countryCode: DEFAULT_COUNTRY_CODE,
  timeZoneId: DEFAULT_ORG_TIME_ZONE_ID,
});

type Props = {
  /** ISO country where the selected company was set up — drives currency formatting. */
  countryCode: string;
  /** IANA timezone for the selected company/location — drives date inputs & business day. */
  timeZoneId?: string | null;
  children: React.ReactNode;
};

export function OrgCountryProvider({ countryCode, timeZoneId, children }: Props) {
  const value = useMemo<OrgLocaleValue>(() => {
    const code = countryCode || DEFAULT_COUNTRY_CODE;
    return {
      countryCode: code,
      timeZoneId: timeZoneId?.trim() || resolveOrgTimeZoneId(code) || DEFAULT_ORG_TIME_ZONE_ID,
    };
  }, [countryCode, timeZoneId]);

  return (
    <OrgCountryContext.Provider value={value}>
      {children}
    </OrgCountryContext.Provider>
  );
}

export function useOrgCountryCode(): string {
  return useContext(OrgCountryContext).countryCode;
}

/** Cloud/org IANA timezone for date inputs and business-day defaults. */
export function useOrgTimeZoneId(): string {
  return useContext(OrgCountryContext).timeZoneId;
}

export function resolveCompanyCountryCode(
  companies: Array<{ id: number; countryCode: string }>,
  selectedCompanyId: number | null | undefined,
): string {
  if (!selectedCompanyId) return DEFAULT_COUNTRY_CODE;
  return companies.find(c => c.id === selectedCompanyId)?.countryCode ?? DEFAULT_COUNTRY_CODE;
}
