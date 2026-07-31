import { useEffect, useMemo, useState } from 'react';
import type { Company } from '../../api';
import type { DropdownLocation } from '../../utils/orgFilters';
import { formatOrgClockLine, resolveSessionTimeZoneId } from '../../utils/countryTimeZones';
import { useAppTranslation } from '../../i18n/useAppTranslation';

type Props = {
  companies: Company[];
  selectedCompanyId: number | null;
  locations: DropdownLocation[];
  selectedLocationIds: string[];
};

function resolveClockContext(
  companies: Company[],
  selectedCompanyId: number | null,
  locations: DropdownLocation[],
  selectedLocationIds: string[],
) {
  const company = companies.find(c => c.id === selectedCompanyId) ?? null;
  const selected = selectedLocationIds.length > 0
    ? locations.filter(l => selectedLocationIds.includes(l.externalId))
    : [];
  const primaryLocation = selected[0] ?? null;
  const timeZoneId = resolveSessionTimeZoneId({
    countryCode: company?.countryCode,
    stateProvince: company?.stateProvince,
    companyTimeZoneId: company?.timeZoneId,
    locationTimeZoneId: primaryLocation?.timeZoneId,
    locationCountryCode: primaryLocation?.countryCode,
    locationStateProvince: primaryLocation?.stateProvince,
  });
  return { timeZoneId, hasOrg: Boolean(company) };
}

export function HeaderOrgClock({
  companies,
  selectedCompanyId,
  locations,
  selectedLocationIds,
}: Props) {
  const { i18n } = useAppTranslation();
  const { timeZoneId, hasOrg } = useMemo(
    () => resolveClockContext(companies, selectedCompanyId, locations, selectedLocationIds),
    [companies, selectedCompanyId, locations, selectedLocationIds],
  );
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [timeZoneId]);

  if (!hasOrg) {
    return <p className="text-xs mt-0.5 hidden sm:block text-white">Select a company</p>;
  }

  const locale = i18n.language?.startsWith('en') ? 'en-GB' : i18n.language || 'en-GB';
  const line = formatOrgClockLine(now, timeZoneId, locale);

  return (
    <p className="text-xs mt-0.5 hidden sm:block text-white truncate" title={`${line} · ${timeZoneId}`}>
      {line}
    </p>
  );
}
