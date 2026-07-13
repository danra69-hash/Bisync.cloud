import { buildShareMessageWithLink, buildWhatsAppShareHref, resolveShareAppOrigin } from './shareLinks';

export type VendorOrderShareTarget = {
  token: string;
  /** When true, open the PDF viewer page instead of the full vendor portal. */
  pdfOnly: boolean;
};

export function buildVendorOrderShareUrl(shareToken: string): string {
  return `${resolveShareAppOrigin()}/vendor/order/${shareToken}/pdf`;
}

export function buildVendorOrderPortalUrl(shareToken: string): string {
  return `${resolveShareAppOrigin()}/vendor/order/${shareToken}`;
}

export function parseVendorOrderToken(pathname: string): string | null {
  return parseVendorOrderShareTarget(pathname)?.token ?? null;
}

export function parseVendorOrderShareTarget(pathname: string): VendorOrderShareTarget | null {
  const match = pathname.match(/^\/vendor\/order\/([a-f0-9]{32})(\/pdf)?\/?$/i);
  if (!match) return null;
  return {
    token: match[1],
    pdfOnly: Boolean(match[2]),
  };
}

export async function copyVendorOrderShareLink(shareToken: string): Promise<void> {
  const url = buildVendorOrderShareUrl(shareToken);
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

export function buildVendorOrderWhatsAppUrl(
  shareToken: string,
  poNumber: string,
  vendorName?: string,
): string {
  const url = buildVendorOrderShareUrl(shareToken);
  const who = vendorName?.trim() ? ` for ${vendorName.trim()}` : '';
  const text = buildShareMessageWithLink(
    `Purchase Order ${poNumber}${who}. Please review the PDF:`,
    url,
  );
  return buildWhatsAppShareHref(text);
}
