/** Licensed commercial banks in Malaysia (ABM members, 2026). */
export const MALAYSIA_BANKS = [
  'Affin Bank',
  'Alliance Bank',
  'AmBank',
  'Bangkok Bank',
  'Bank of America',
  'Bank of China',
  'BNP Paribas',
  'Boost Bank',
  'China Construction Bank',
  'CIMB Bank',
  'Citibank',
  'Deutsche Bank',
  'GX Bank',
  'Hong Leong Bank',
  'HSBC Bank',
  'ICBC',
  'J.P. Morgan Chase Bank',
  'Maybank',
  'Mizuho Bank',
  'MUFG Bank',
  'OCBC Bank',
  'Public Bank',
  'RHB Bank',
  'Ryt Bank',
  'Standard Chartered Bank',
  'Sumitomo Mitsui Banking Corporation',
  'United Overseas Bank',
] as const;

export type MalaysiaBank = (typeof MALAYSIA_BANKS)[number];

export function isMalaysiaCountry(code?: string | null) {
  return (code?.trim().toUpperCase() || 'MY') === 'MY';
}

export function buildBankOptions(customBanks: string[], selectedBank?: string | null): string[] {
  const names = new Set<string>(MALAYSIA_BANKS);
  for (const bank of customBanks) {
    const trimmed = bank.trim();
    if (trimmed) names.add(trimmed);
  }
  const selected = selectedBank?.trim();
  if (selected) names.add(selected);

  const standard = MALAYSIA_BANKS.filter(bank => names.has(bank));
  const custom = [...names]
    .filter(name => !MALAYSIA_BANKS.includes(name as MalaysiaBank))
    .sort((a, b) => a.localeCompare(b));
  return [...standard, ...custom];
}
