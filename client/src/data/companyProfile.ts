export const COMPANY_BUSINESS_TYPES = [
  'Restaurant / Cafe / Bistro / Kiosk',
  'Central Kitchen / Warehouse (supply only)',
  'Retail',
  'Manufacturer',
  'Distributor',
] as const;

export type CompanyBusinessType = (typeof COMPANY_BUSINESS_TYPES)[number];

/**
 * Business types that can use Active Sales / Sales Order (wholesale selling).
 * Central kitchen & warehouse share one label; includes distributor and manufacturer.
 */
export const SUPPLY_SIDE_BUSINESS_TYPES = [
  'Central Kitchen / Warehouse (supply only)',
  'Manufacturer',
  'Distributor',
] as const satisfies readonly CompanyBusinessType[];

export type SupplySideBusinessType = (typeof SUPPLY_SIDE_BUSINESS_TYPES)[number];

/**
 * Business types that can create/manage B2B products.
 * Central Kitchen / Warehouse and Manufacturer only (not Distributor or Restaurant).
 */
export const B2B_PRODUCT_BUSINESS_TYPES = [
  'Central Kitchen / Warehouse (supply only)',
  'Manufacturer',
] as const satisfies readonly CompanyBusinessType[];

export type B2bProductBusinessType = (typeof B2B_PRODUCT_BUSINESS_TYPES)[number];

export function isSupplySideBusinessType(type: string | null | undefined): boolean {
  return SUPPLY_SIDE_BUSINESS_TYPES.includes(type as SupplySideBusinessType);
}

export function isB2bProductBusinessType(type: string | null | undefined): boolean {
  return B2B_PRODUCT_BUSINESS_TYPES.includes(type as B2bProductBusinessType);
}

/** True when any of the given types is a supply-side (Active Sales) business type. */
export function hasSupplySideBusinessType(types: readonly string[] | null | undefined): boolean {
  return (types ?? []).some(isSupplySideBusinessType);
}

/** True when any of the given types can manage B2B products. */
export function hasB2bProductBusinessType(types: readonly string[] | null | undefined): boolean {
  return (types ?? []).some(isB2bProductBusinessType);
}

export const COMPANY_VENDOR_POLICY_TAGS = [
  {
    id: 'halal',
    label: 'Halal',
    description: 'Only buying or selling halal certified vendor products.',
  },
  {
    id: 'muslim-friendly',
    label: 'Muslim Friendly',
    description: 'Halal certified vendor food products; alcoholic beverages may be included.',
  },
  {
    id: 'non-halal',
    label: 'Non-halal',
    description: 'Open to all vendors.',
  },
] as const;

export type CompanyVendorPolicyTag = (typeof COMPANY_VENDOR_POLICY_TAGS)[number]['id'];

export function parseStringArrayJson(json: string | null | undefined): string[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(value => String(value).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function validateCompanyProfile(
  businessTypes: string[],
  vendorPolicyTags: string[],
): string | null {
  if (businessTypes.length === 0) {
    return 'Select at least one Type of Business.';
  }

  const invalidBusinessType = businessTypes.find(
    type => !COMPANY_BUSINESS_TYPES.includes(type as CompanyBusinessType),
  );
  if (invalidBusinessType) {
    return `Invalid business type: ${invalidBusinessType}`;
  }

  if (vendorPolicyTags.length === 0) {
    return 'Select at least one vendor policy (Halal, Muslim Friendly, or Non-halal).';
  }
  if (vendorPolicyTags.length > 2) {
    return 'Select at most two vendor policies.';
  }

  const allowedTags = new Set(COMPANY_VENDOR_POLICY_TAGS.map(tag => tag.id));
  const invalidTag = vendorPolicyTags.find(tag => !allowedTags.has(tag as CompanyVendorPolicyTag));
  if (invalidTag) {
    return `Invalid vendor policy: ${invalidTag}`;
  }

  if (vendorPolicyTagsConflict(vendorPolicyTags)) {
    return 'Non-halal cannot be combined with Halal or Muslim Friendly.';
  }

  return null;
}

export function validateLocationBusinessTypesSubset(
  locationTypes: CompanyBusinessType[],
  companyTypes: CompanyBusinessType[],
): string | null {
  if (locationTypes.length === 0) return null;
  if (locationTypes.some(type => !companyTypes.includes(type))) {
    return 'Location business types must be selected from the company Type of Business list.';
  }
  return null;
}

export function vendorPolicyTagsConflict(vendorPolicyTags: string[]): boolean {
  return vendorPolicyTags.includes('non-halal') && vendorPolicyTags.length > 1;
}

export function toggleVendorPolicyTags(
  selected: CompanyVendorPolicyTag[],
  tagId: CompanyVendorPolicyTag,
): CompanyVendorPolicyTag[] {
  if (selected.includes(tagId)) {
    return selected.filter(value => value !== tagId);
  }

  if (tagId === 'non-halal') {
    return ['non-halal'];
  }

  if (selected.includes('non-halal')) {
    return [tagId];
  }

  if (selected.length >= 2) {
    return selected;
  }

  return [...selected, tagId];
}

export function isVendorPolicyTagDisabled(
  selected: CompanyVendorPolicyTag[],
  tagId: CompanyVendorPolicyTag,
): boolean {
  if (selected.includes(tagId)) return false;
  if (selected.includes('non-halal')) return true;
  if (tagId === 'non-halal') {
    return selected.includes('halal') || selected.includes('muslim-friendly');
  }
  return selected.length >= 2;
}

export function serializeStringArray(values: string[]): string {
  return JSON.stringify(values);
}

export function profileArraysFromCompany(company: {
  businessTypesJson?: string | null;
  vendorPolicyTagsJson?: string | null;
}) {
  return {
    businessTypes: parseStringArrayJson(company.businessTypesJson) as CompanyBusinessType[],
    vendorPolicyTags: parseStringArrayJson(company.vendorPolicyTagsJson) as CompanyVendorPolicyTag[],
  };
}

const BUSINESS_TYPE_SHORT_LABELS: Record<CompanyBusinessType, string> = {
  'Restaurant / Cafe / Bistro / Kiosk': 'Restaurant / Cafe',
  'Central Kitchen / Warehouse (supply only)': 'Central Kitchen',
  'Retail': 'Retail',
  'Manufacturer': 'Manufacturer',
  'Distributor': 'Distributor',
};

export function formatBusinessTypesCell(json: string | null | undefined): string {
  const types = parseStringArrayJson(json) as CompanyBusinessType[];
  if (types.length === 0) return '—';
  return types.map(type => BUSINESS_TYPE_SHORT_LABELS[type] ?? type).join(', ');
}

export function formatVendorPolicyCell(json: string | null | undefined): string {
  const tags = parseStringArrayJson(json) as CompanyVendorPolicyTag[];
  if (tags.length === 0) return '—';
  const labelById = new Map(COMPANY_VENDOR_POLICY_TAGS.map(tag => [tag.id, tag.label]));
  return tags.map(tag => labelById.get(tag) ?? tag).join(', ');
}

export function profilesEquivalent(
  leftJson: string | null | undefined,
  rightJson: string | null | undefined,
  options?: { ignoreCase?: boolean },
): boolean {
  const ignoreCase = options?.ignoreCase ?? false;
  const normalize = (values: string[]) => (ignoreCase ? values.map(value => value.toLowerCase()) : values);
  const left = normalize([...parseStringArrayJson(leftJson)]).sort();
  const right = normalize([...parseStringArrayJson(rightJson)]).sort();
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export function resolveLocationProfileForDisplay(
  location: {
    businessTypesJson?: string;
    vendorPolicyTagsJson?: string;
    profileOverridden?: boolean;
  },
  company?: {
    businessTypesJson?: string | null;
    vendorPolicyTagsJson?: string | null;
  } | null,
) {
  const inherits = location.profileOverridden !== true;
  const businessTypesJson = location.businessTypesJson
    ?? (inherits && company ? company.businessTypesJson : '[]');
  const vendorPolicyTagsJson = location.vendorPolicyTagsJson
    ?? (inherits && company ? company.vendorPolicyTagsJson : '[]');
  return {
    businessTypesJson,
    vendorPolicyTagsJson,
    inherits,
  };
}

type OrgCapabilityCompany = {
  id?: number;
  businessTypesJson?: string | null;
};

type OrgCapabilityLocation = {
  companyId?: number | null;
  externalId: string;
  businessTypesJson?: string;
  vendorPolicyTagsJson?: string;
  profileOverridden?: boolean;
};

function resolveOrgEffectiveBusinessTypes(
  company: OrgCapabilityCompany,
  locations: OrgCapabilityLocation[],
  locationExternalIds: string[],
): string[] {
  const companyTypes = parseStringArrayJson(company.businessTypesJson);
  const scopedLocations = locationExternalIds.length === 0
    ? locations.filter(loc => loc.companyId == null || loc.companyId === company.id)
    : locations.filter(loc =>
      (loc.companyId == null || loc.companyId === company.id)
      && locationExternalIds.includes(loc.externalId),
    );

  if (scopedLocations.length === 0) return companyTypes;

  const union = new Set<string>();
  for (const loc of scopedLocations) {
    const resolved = resolveLocationProfileForDisplay(loc, company);
    const types = parseStringArrayJson(resolved.businessTypesJson);
    const effective = types.length > 0 ? types : companyTypes;
    for (const type of effective) union.add(type);
  }
  return [...union];
}

function resolveOrgHasCapability(
  company: OrgCapabilityCompany | null | undefined,
  locations: OrgCapabilityLocation[],
  locationExternalIds: string[],
  matcher: (types: readonly string[]) => boolean,
): boolean {
  if (!company) return false;
  return matcher(resolveOrgEffectiveBusinessTypes(company, locations, locationExternalIds));
}

/**
 * Whether the org context can use Active Sales / Sales Order.
 * Uses selected locations' effective business types (empty location types inherit company).
 */
export function resolveOrgHasSupplySideCapability(
  company: OrgCapabilityCompany | null | undefined,
  locations: OrgCapabilityLocation[],
  locationExternalIds: string[],
): boolean {
  return resolveOrgHasCapability(company, locations, locationExternalIds, hasSupplySideBusinessType);
}

/**
 * Whether the org context can create/manage B2B products
 * (Central Kitchen / Warehouse or Manufacturer).
 */
export function resolveOrgHasB2bProductCapability(
  company: OrgCapabilityCompany | null | undefined,
  locations: OrgCapabilityLocation[],
  locationExternalIds: string[],
): boolean {
  return resolveOrgHasCapability(company, locations, locationExternalIds, hasB2bProductBusinessType);
}

export function buildLocationProfilePayload(
  company: {
    businessTypesJson: string;
    vendorPolicyTagsJson: string;
  },
  businessTypes: CompanyBusinessType[],
  vendorPolicyTags: CompanyVendorPolicyTag[],
  forceInherit: boolean,
) {
  const businessTypesJson = serializeStringArray(businessTypes);
  const vendorPolicyTagsJson = serializeStringArray(vendorPolicyTags);
  const inheritBusiness = forceInherit || profilesEquivalent(businessTypesJson, company.businessTypesJson);
  const inheritVendor = forceInherit || profilesEquivalent(vendorPolicyTagsJson, company.vendorPolicyTagsJson, { ignoreCase: true });

  return {
    businessTypesJson: inheritBusiness ? '[]' : businessTypesJson,
    vendorPolicyTagsJson: inheritVendor ? '[]' : vendorPolicyTagsJson,
    profileOverridden: !inheritBusiness || !inheritVendor,
    effectiveBusinessTypesJson: inheritBusiness ? company.businessTypesJson : businessTypesJson,
    effectiveVendorPolicyTagsJson: inheritVendor ? company.vendorPolicyTagsJson : vendorPolicyTagsJson,
  };
}
