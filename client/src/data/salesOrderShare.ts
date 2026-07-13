import { buildShareMessageWithLink, buildWhatsAppShareHref, resolveShareAppOrigin } from './shareLinks';

export type SalesOrderShareTarget = {
  token: string;
  pdfOnly: boolean;
};

export function buildSalesOrderShareUrl(shareToken: string): string {
  return `${resolveShareAppOrigin()}/sales-order/${shareToken}/pdf`;
}

export function parseSalesOrderToken(pathname: string): string | null {
  return parseSalesOrderShareTarget(pathname)?.token ?? null;
}

/** Matches /sales-order/{token} and /sales-order/{token}/pdf — both open the PDF viewer. */
export function parseSalesOrderShareTarget(pathname: string): SalesOrderShareTarget | null {
  const match = pathname.match(/^\/sales-order\/([a-f0-9]{32})(\/pdf)?\/?$/i);
  if (!match) return null;
  return {
    token: match[1],
    pdfOnly: true,
  };
}

export async function copySalesOrderShareLink(shareToken: string): Promise<void> {
  const url = buildSalesOrderShareUrl(shareToken);
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

export function buildSalesOrderWhatsAppUrl(
  shareToken: string,
  orderNumber: string,
  customerName?: string,
): string {
  const url = buildSalesOrderShareUrl(shareToken);
  const who = customerName?.trim() ? ` for ${customerName.trim()}` : '';
  const text = buildShareMessageWithLink(
    `Sales Order ${orderNumber}${who}. Please review the PDF:`,
    url,
  );
  return buildWhatsAppShareHref(text);
}
