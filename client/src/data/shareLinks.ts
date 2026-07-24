/** Public web origin used in share / WhatsApp messages (must be https for clickable links). */
const DEFAULT_PUBLIC_APP_ORIGIN = 'https://bisync-cloud-389272498937.asia-southeast1.run.app';

/**
 * Resolve the origin embedded in vendor/customer share links.
 * WhatsApp does not auto-linkify localhost / http://127.0.0.1 URLs.
 */
export function resolveShareAppOrigin(): string {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL ?? '')
    .trim()
    .replace(/\/$/, '');
  if (configured) return configured;

  if (typeof window === 'undefined') return DEFAULT_PUBLIC_APP_ORIGIN;

  const { origin, hostname, protocol } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || protocol !== 'https:') {
    return DEFAULT_PUBLIC_APP_ORIGIN;
  }
  return origin.replace(/\/$/, '');
}

/** Build a WhatsApp click-to-chat URL with prefilled text (recipient picker). */
export function buildWhatsAppShareHref(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Open WhatsApp to a phone (E.164 digits) with prefilled text, or recipient picker if no phone. */
export function buildWhatsAppHref(message: string, mobileDigits?: string | null): string {
  const digits = (mobileDigits ?? '').replace(/\D/g, '');
  if (digits.length >= 8) {
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }
  return buildWhatsAppShareHref(message);
}

/** Prefill body with label + URL alone on its own line so WhatsApp linkifies it. */
export function buildShareMessageWithLink(intro: string, url: string): string {
  const lead = intro.trim();
  return lead ? `${lead}\n\n${url.trim()}` : url.trim();
}
