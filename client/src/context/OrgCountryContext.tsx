import { createContext, useContext } from 'react';

const DEFAULT_COUNTRY_CODE = 'MY';

const OrgCountryContext = createContext(DEFAULT_COUNTRY_CODE);

type Props = {
  countryCode: string;
  children: React.ReactNode;
};

export function OrgCountryProvider({ countryCode, children }: Props) {
  return (
    <OrgCountryContext.Provider value={countryCode || DEFAULT_COUNTRY_CODE}>
      {children}
    </OrgCountryContext.Provider>
  );
}

export function useOrgCountryCode(): string {
  return useContext(OrgCountryContext);
}

export function resolveCompanyCountryCode(
  companies: Array<{ id: number; countryCode: string }>,
  selectedCompanyId: number | null | undefined,
): string {
  if (!selectedCompanyId) return DEFAULT_COUNTRY_CODE;
  return companies.find(c => c.id === selectedCompanyId)?.countryCode ?? DEFAULT_COUNTRY_CODE;
}
