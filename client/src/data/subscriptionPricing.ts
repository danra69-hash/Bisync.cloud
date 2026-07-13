import type { CompanyBusinessType } from './companyProfile';

/** Sheet labels for payment UI (map to COMPANY_BUSINESS_TYPES). */
export const PAYMENT_TYPE_LABELS: Record<CompanyBusinessType, string> = {
  'Restaurant / Cafe / Bistro / Kiosk': 'RESTAURANT / CAFÉ / BISTRO / BAR / CLUB / HOTEL',
  'Central Kitchen / Warehouse (supply only)': 'CENTRAL KITCHEN / WAREHOUSE',
  Retail: 'RETAIL',
  Manufacturer: 'MANUFACTURER',
  Distributor: 'DISTRIBUTOR / IMPORTER',
};

export const PAYMENT_MODULE_LABELS = {
  RMS: 'REVENUE MANAGEMENT',
  POS: 'POINT OF SALES',
  HRM: 'HUMAN RESOURCES',
  Accounting: 'ACCOUNTING',
} as const;

/** Local (MYR) vs international (USD) amounts from the payment sheet. */
export const SUBSCRIPTION_PRICES = {
  standard: { myr: 300, usd: 99 },
  premium: { myr: 450, usd: 145 },
} as const;

export function isMalaysiaCountry(countryCode: string | null | undefined): boolean {
  return (countryCode ?? 'MY').trim().toUpperCase() === 'MY';
}

/** Central kitchen, manufacturer, and distributor bill at the premium rate. */
export function isPremiumLocationType(type: string | null | undefined): boolean {
  return type === 'Central Kitchen / Warehouse (supply only)'
    || type === 'Manufacturer'
    || type === 'Distributor';
}

export type BillableLocationLine = {
  companyId: number;
  companyName: string;
  locationId: number;
  locationName: string;
  /** Single location business type used for pricing. */
  locationType: string | null;
  countryCode: string;
};

export type PricedLine = BillableLocationLine & {
  amount: number;
  currency: 'MYR' | 'USD';
  tier: 'standard' | 'premium';
};

export function priceLocationLine(line: BillableLocationLine): PricedLine {
  const local = isMalaysiaCountry(line.countryCode);
  const premium = isPremiumLocationType(line.locationType);
  const tier = premium ? 'premium' : 'standard';
  const amount = local
    ? SUBSCRIPTION_PRICES[tier].myr
    : SUBSCRIPTION_PRICES[tier].usd;
  return {
    ...line,
    amount,
    currency: local ? 'MYR' : 'USD',
    tier,
  };
}

export function sumPricedLines(lines: PricedLine[]): { myr: number; usd: number } {
  return lines.reduce(
    (acc, line) => {
      if (line.currency === 'MYR') acc.myr += line.amount;
      else acc.usd += line.amount;
      return acc;
    },
    { myr: 0, usd: 0 },
  );
}

export function formatMoney(amount: number, currency: 'MYR' | 'USD'): string {
  if (currency === 'USD') return `USD ${amount.toFixed(2)}`;
  return `${amount.toFixed(2)}`;
}

const EXTRA_COMPANIES_KEY = 'bisync.paymentExtraCompanyIds';

export function getExtraPaymentCompanyIds(): number[] {
  try {
    const raw = localStorage.getItem(EXTRA_COMPANIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(Number).filter(n => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

export function addExtraPaymentCompanyId(companyId: number): void {
  const next = [...new Set([...getExtraPaymentCompanyIds(), companyId])];
  localStorage.setItem(EXTRA_COMPANIES_KEY, JSON.stringify(next));
}

export function clearExtraPaymentCompanyIds(): void {
  localStorage.removeItem(EXTRA_COMPANIES_KEY);
}
