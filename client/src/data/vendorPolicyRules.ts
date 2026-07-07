import type { Company, LocationConfig, Vendor } from '../api';
import {
  parseStringArrayJson,
  resolveLocationProfileForDisplay,
  type CompanyVendorPolicyTag,
} from './companyProfile';

export type { CompanyVendorPolicyTag };
export type VendorProductPolicyTag = CompanyVendorPolicyTag;

export const VENDOR_PRODUCT_POLICY_OPTIONS = [
  { id: 'halal' as const, label: 'Halal', description: 'All products are halal certified.' },
  { id: 'muslim-friendly' as const, label: 'Muslim Friendly', description: 'Halal food products; may include alcoholic beverages.' },
  { id: 'non-halal' as const, label: 'Non-halal', description: 'Products are not restricted to halal certification.' },
];

export function resolveOrgVendorPolicyTags(
  company: Company | null | undefined,
  locations: LocationConfig[],
  locationExternalIds: string[],
): CompanyVendorPolicyTag[] {
  if (!company) return [];

  const scopedLocations = locationExternalIds.length === 0
    ? locations.filter(loc => loc.companyId === company.id)
    : locations.filter(loc => loc.companyId === company.id && locationExternalIds.includes(loc.externalId));

  const tagSets = scopedLocations.length > 0
    ? scopedLocations.map(loc => parseStringArrayJson(
      resolveLocationProfileForDisplay(loc, company).vendorPolicyTagsJson,
    ) as CompanyVendorPolicyTag[])
    : [parseStringArrayJson(company.vendorPolicyTagsJson) as CompanyVendorPolicyTag[]];

  return strictestVendorPolicyTags(tagSets);
}

function strictestVendorPolicyTags(tagSets: CompanyVendorPolicyTag[][]): CompanyVendorPolicyTag[] {
  if (tagSets.length === 0) return [];
  if (tagSets.some(tags => tags.includes('non-halal'))) return ['non-halal'];
  if (tagSets.some(tags => tags.includes('halal') && !tags.includes('muslim-friendly') && !tags.includes('non-halal'))) {
    return ['halal'];
  }
  if (tagSets.some(tags => tags.includes('halal'))) return ['halal'];
  if (tagSets.some(tags => tags.includes('muslim-friendly'))) return ['muslim-friendly'];
  return tagSets[0] ?? [];
}

export function orgAllowsAllVendorProducts(orgTags: CompanyVendorPolicyTag[]): boolean {
  return orgTags.length === 0 || orgTags.includes('non-halal');
}

export function orgRequiresHalalCertOnReceive(orgTags: CompanyVendorPolicyTag[]): boolean {
  return orgTags.includes('halal') && !orgTags.includes('non-halal');
}

export function allowedVendorPolicyTags(orgTags: CompanyVendorPolicyTag[]): Set<VendorProductPolicyTag> | 'all' {
  if (orgAllowsAllVendorProducts(orgTags)) return 'all';
  const allowed = new Set<VendorProductPolicyTag>();
  if (orgTags.includes('halal')) allowed.add('halal');
  if (orgTags.includes('muslim-friendly')) {
    allowed.add('halal');
    allowed.add('muslim-friendly');
  }
  return allowed;
}

export function inferVendorPolicyTag(
  vendor: Pick<Vendor, 'productPolicyTag' | 'name' | 'products'>,
): VendorProductPolicyTag {
  if (vendor.productPolicyTag) return vendor.productPolicyTag;
  const text = `${vendor.name} ${vendor.products}`.toLowerCase();
  if (
    text.includes('wine')
    || text.includes('spirit')
    || text.includes('beer')
    || text.includes('pork')
    || text.includes('craft brew')
  ) {
    return 'non-halal';
  }
  return 'halal';
}

export function vendorMatchesOrgPolicy(
  vendorTag: VendorProductPolicyTag | null | undefined,
  orgTags: CompanyVendorPolicyTag[],
  vendor?: Pick<Vendor, 'productPolicyTag' | 'name' | 'products'>,
): boolean {
  const allowed = allowedVendorPolicyTags(orgTags);
  if (allowed === 'all') return true;
  const effectiveTag = vendorTag ?? (vendor ? inferVendorPolicyTag(vendor) : null);
  if (!effectiveTag) return false;
  return allowed.has(effectiveTag);
}

export function productMatchesOrgPolicy(
  productTag: VendorProductPolicyTag | null | undefined,
  vendorTag: VendorProductPolicyTag | null | undefined,
  orgTags: CompanyVendorPolicyTag[],
  group?: string,
): boolean {
  const allowed = allowedVendorPolicyTags(orgTags);
  if (allowed === 'all') return true;

  const effectiveTag = productTag ?? vendorTag;
  if (!effectiveTag) return false;
  if (allowed.has(effectiveTag)) return true;

  if (orgTags.includes('muslim-friendly') && !orgTags.includes('non-halal')) {
    const beverageGroup = (group ?? '').toLowerCase();
    if (beverageGroup.includes('beverage') || beverageGroup.includes('wine') || beverageGroup.includes('spirit')) {
      return effectiveTag === 'muslim-friendly' || effectiveTag === 'halal';
    }
  }

  return false;
}

export function formatVendorPolicyLabel(tag: VendorProductPolicyTag | null | undefined): string {
  if (!tag) return '—';
  return VENDOR_PRODUCT_POLICY_OPTIONS.find(option => option.id === tag)?.label ?? tag;
}

export function resolveVendorProductPolicyTag(
  vendor: Pick<Vendor, 'productPolicyTag' | 'name' | 'products'>,
): VendorProductPolicyTag {
  return vendor.productPolicyTag ?? inferVendorPolicyTag(vendor);
}
