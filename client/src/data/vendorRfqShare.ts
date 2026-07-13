import { buildShareMessageWithLink, buildWhatsAppShareHref, resolveShareAppOrigin } from './shareLinks';

export function buildVendorRfqShareUrl(shareToken: string): string {
  return `${resolveShareAppOrigin()}/vendor/rfq/${shareToken}`;
}

export function parseVendorRfqToken(pathname: string): string | null {
  const match = pathname.match(/^\/vendor\/rfq\/([a-f0-9]{32})$/i);
  return match ? match[1] : null;
}

export async function copyVendorRfqShareLink(shareToken: string): Promise<void> {
  const url = buildVendorRfqShareUrl(shareToken);
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

export function buildVendorRfqWhatsAppUrl(shareToken: string, vendorName: string, rfqNumber: string): string {
  const url = buildVendorRfqShareUrl(shareToken);
  const text = buildShareMessageWithLink(
    `Hi${vendorName ? ` ${vendorName}` : ''}, please fill in our Sample & Quote ${rfqNumber}:`,
    url,
  );
  return buildWhatsAppShareHref(text);
}

export function buildVendorRfqMailtoUrl(
  email: string,
  shareToken: string,
  vendorName: string,
  rfqNumber: string,
): string {
  const url = buildVendorRfqShareUrl(shareToken);
  const subject = encodeURIComponent(`Sample & Quote ${rfqNumber}`);
  const body = encodeURIComponent(
    `Hi${vendorName ? ` ${vendorName}` : ''},\n\nPlease fill in our Sample & Quote ${rfqNumber} using this link:\n\n${url}\n\nThank you.`,
  );
  const to = email.trim();
  return to ? `mailto:${to}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`;
}
