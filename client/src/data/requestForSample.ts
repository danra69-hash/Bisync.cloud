import { COUNTRIES } from './countries';

export const SAMPLE_REQUEST_COUNTRY_OPTIONS = [
  ...COUNTRIES.map(c => c.name),
  'China',
  'India',
  'Indonesia',
  'Japan',
  'South Korea',
  'Thailand',
  'Vietnam',
  'United Kingdom',
  'Germany',
  'France',
  'Netherlands',
  'Brazil',
  'Mexico',
].sort((a, b) => a.localeCompare(b));

export type SampleQuoteTemplateId = 'sample-request-flavours';

export type SampleQuoteTemplate = {
  id: SampleQuoteTemplateId;
  name: string;
  description: string;
};

/** Templates available under Sample & Quote. */
export const SAMPLE_QUOTE_TEMPLATES: SampleQuoteTemplate[] = [
  {
    id: 'sample-request-flavours',
    name: 'Sample Request for Flavours',
    description: 'Capture flavour sample requirements, commercial estimates, and specific conditions for vendor or R&D follow-up.',
  },
];

export function previewSampleRequestNumber(dateRequested: string): string {
  const digits = dateRequested.replace(/-/g, '');
  if (digits.length !== 8) return 'SR-YYYYMMDD-0001';
  return `SR-${digits}-0001`;
}

export function buildSampleRequestShareUrl(shareToken: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/sample-request/${shareToken}`;
}

export function parseSampleRequestToken(pathname: string): string | null {
  const match = pathname.match(/^\/sample-request\/([a-f0-9]{32})$/i);
  return match ? match[1] : null;
}

export async function copySampleRequestShareLink(shareToken: string): Promise<void> {
  const url = buildSampleRequestShareUrl(shareToken);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function buildSampleRequestWhatsAppUrl(
  shareToken: string,
  requestNumber: string,
  customerName?: string,
): string {
  const url = buildSampleRequestShareUrl(shareToken);
  const who = customerName?.trim() ? ` for ${customerName.trim()}` : '';
  const text = `Sample Request for Flavours ${requestNumber}${who}:\n${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildSampleRequestMailtoUrl(
  shareToken: string,
  requestNumber: string,
  customerName?: string,
  toEmail?: string,
): string {
  const url = buildSampleRequestShareUrl(shareToken);
  const who = customerName?.trim() ? ` for ${customerName.trim()}` : '';
  const subject = encodeURIComponent(`Sample Request for Flavours ${requestNumber}`);
  const body = encodeURIComponent(
    `Please review Sample Request for Flavours ${requestNumber}${who}:\n\n${url}\n\nThank you.`,
  );
  const to = toEmail?.trim() ?? '';
  return to ? `mailto:${to}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`;
}

export function formatSampleRequestType(value: string): string {
  switch (value) {
    case 'new_submission':
      return 'New submission';
    case 'repeat':
      return 'Repeat';
    case 'modification':
      return 'Modification';
    default:
      return value || '—';
  }
}

export function formatSampleProjectScope(value: string): string {
  return value === 'ongoing' ? 'Ongoing project' : 'New project';
}
