/** Dial-code options for registration phone entry (flag + ISO + E.164 prefix). */
export type PhoneCountryOption = {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
};

export const PHONE_COUNTRIES: PhoneCountryOption[] = [
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾' },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬' },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', flag: '🇮🇩' },
  { code: 'TH', name: 'Thailand', dialCode: '+66', flag: '🇹🇭' },
  { code: 'PH', name: 'Philippines', dialCode: '+63', flag: '🇵🇭' },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', flag: '🇻🇳' },
  { code: 'CN', name: 'China', dialCode: '+86', flag: '🇨🇳' },
  { code: 'HK', name: 'Hong Kong', dialCode: '+852', flag: '🇭🇰' },
  { code: 'TW', name: 'Taiwan', dialCode: '+886', flag: '🇹🇼' },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', dialCode: '+82', flag: '🇰🇷' },
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳' },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
  { code: 'IE', name: 'Ireland', dialCode: '+353', flag: '🇮🇪' },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪' },
  { code: 'IT', name: 'Italy', dialCode: '+39', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', dialCode: '+34', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', flag: '🇳🇱' },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦' },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦' },
];

export const DEFAULT_PHONE_COUNTRY = 'MY';

export function getPhoneCountry(code: string | null | undefined): PhoneCountryOption {
  const normalized = (code ?? '').trim().toUpperCase();
  return PHONE_COUNTRIES.find(c => c.code === normalized)
    ?? PHONE_COUNTRIES.find(c => c.code === DEFAULT_PHONE_COUNTRY)!;
}

export function composeMobile(dialCode: string, nationalNumber: string): string {
  const national = nationalNumber.replace(/[^\d]/g, '');
  if (!national) return dialCode.trim();
  return `${dialCode.trim()} ${national}`;
}

/** Infer default preferred language from a country ISO code. */
export function preferredLanguageForCountry(countryCode: string): string {
  switch (countryCode.toUpperCase()) {
    case 'MY': return 'ms';
    case 'ID': return 'id';
    case 'TH': return 'th';
    case 'CN':
    case 'TW':
    case 'HK':
    case 'SG': return 'zh';
    case 'KR': return 'ko';
    case 'JP': return 'ja';
    case 'FR': return 'fr';
    case 'ES':
    case 'MX':
    case 'AR': return 'es';
    case 'IT': return 'it';
    default: return 'en';
  }
}
