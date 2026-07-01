export function buildVendorOrderShareUrl(shareToken: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/vendor/order/${shareToken}`;
}

export function parseVendorOrderToken(pathname: string): string | null {
  const match = pathname.match(/^\/vendor\/order\/([a-f0-9]{32})$/i);
  return match ? match[1] : null;
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
