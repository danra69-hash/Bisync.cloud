/** Shared legal document helpers for Bisync.cloud. */

export const LEGAL_PROVIDER = 'Cube Value Sdn Bhd (Company No. 1164413X)';
export const LEGAL_PRODUCT = 'Bisync.cloud';
export const LEGAL_EFFECTIVE_DATE = '24 July 2026';
/** Public privacy / legal contact for website and store listings. */
export const LEGAL_CONTACT_EMAIL = 'support@bisync.cloud';

/** Canonical public paths (short URLs preferred for store / marketing listings). */
export const LEGAL_PUBLIC_PATHS = {
  eula: '/eula',
  privacy: '/privacy',
  dpa: '/dpa',
  /** Legacy aliases kept for existing links and bookmarks. */
  eulaLegacy: '/legal/eula',
  privacyLegacy: '/legal/privacy',
  dpaLegacy: '/legal/dpa',
} as const;

export type LegalSection = {
  id: string;
  heading: string;
  paragraphs: string[];
};

export type LegalDocMeta = {
  version: string;
  title: string;
  effectiveDate: string;
  path: string;
};
