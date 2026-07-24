/** Shared legal document helpers for Bisync.cloud. */

export const LEGAL_PROVIDER = 'Cube Value Sdn Bhd (Company No. 1164413X)';
export const LEGAL_PRODUCT = 'Bisync.cloud';
export const LEGAL_EFFECTIVE_DATE = '24 July 2026';

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
