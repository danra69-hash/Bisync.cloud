import { money } from './api';
import type { Invoice, Member, Payment } from './api';

const LIVE_ORIGIN = 'https://pulse-cloud-etx3n2bf5q-as.a.run.app';

export function resolvePulseShareOrigin(): string {
  if (typeof window === 'undefined') return LIVE_ORIGIN;
  const { origin, hostname, protocol } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || protocol !== 'https:') {
    return LIVE_ORIGIN;
  }
  return origin.replace(/\/$/, '');
}

export function buildWhatsAppShareHref(message: string, phone?: string | null): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 8) {
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function invoiceShareMessage(invoice: Invoice, member?: Member | null): string {
  const name = member
    ? `${member.firstName} ${member.lastName}`
    : invoice.member
      ? `${invoice.member.firstName} ${invoice.member.lastName}`
      : 'Member';
  const origin = resolvePulseShareOrigin();
  return [
    `Pulse invoice ${invoice.number}`,
    `${name} — ${money(invoice.total)} (${invoice.status})`,
    `View: ${origin}/app/payments?invoice=${encodeURIComponent(invoice.id)}`,
  ].join('\n');
}

export function buildInvoiceReceiptHtml(
  invoice: Invoice,
  member?: Member | null,
  payment?: Payment | null,
): string {
  const who = member || invoice.member;
  const memberName = who ? `${who.firstName} ${who.lastName}` : invoice.memberId;
  const lines = (invoice.lines || [])
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.description)}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${money(l.unitPrice)}</td><td style="text-align:right">${money(l.qty * l.unitPrice)}</td></tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.number)}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #1b2430; margin: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .muted { color: #6b778a; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 8px 6px; border-bottom: 1px solid #d7dee8; font-size: 14px; }
    th { text-align: left; color: #6b778a; font-weight: 600; font-size: 11px; text-transform: uppercase; }
    .totals { margin-top: 16px; width: 240px; margin-left: auto; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
    .total { font-weight: 700; font-size: 16px; border-top: 1px solid #1b2430; padding-top: 8px; margin-top: 6px; }
    @media print {
      body { margin: 12mm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <p class="muted">Pulse Fitness · Invoice</p>
  <h1>${escapeHtml(invoice.number)}</h1>
  <p class="muted">Status: ${escapeHtml(invoice.status)}${payment ? ` · Paid via ${escapeHtml(payment.method)}` : ''}</p>
  <p><strong>${escapeHtml(memberName)}</strong><br/>
  <span class="muted">${who?.email ? escapeHtml(who.email) : ''}${who?.phone ? ` · ${escapeHtml(who.phone)}` : ''}</span></p>
  <table>
    <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead>
    <tbody>${lines || '<tr><td colspan="4">Membership payment</td></tr>'}</tbody>
  </table>
  <div class="totals">
    <div><span class="muted">Subtotal</span><span>${money(invoice.subtotal)}</span></div>
    <div><span class="muted">Tax</span><span>${money(invoice.tax)}</span></div>
    <div class="total"><span>Total</span><span>${money(invoice.total)}</span></div>
  </div>
  <p class="muted no-print" style="margin-top:24px">Use your browser Print dialog to print or save as PDF.</p>
  <script>
    window.addEventListener('load', function () {
      var q = new URLSearchParams(location.search);
      if (q.get('autoprint') === '1') setTimeout(function () { window.print(); }, 200);
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function openInvoiceReceipt(
  invoice: Invoice,
  opts?: { member?: Member | null; payment?: Payment | null; autoprint?: boolean },
) {
  const html = buildInvoiceReceiptHtml(invoice, opts?.member, opts?.payment);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(
    opts?.autoprint ? `${url}#autoprint` : url,
    '_blank',
    'noopener,noreferrer,width=720,height=900',
  );
  if (opts?.autoprint && win) {
    // Fallback if hash handling is awkward with blob URLs
    setTimeout(() => {
      try {
        win.print();
      } catch {
        /* ignore */
      }
    }, 400);
  }
  // Revoke later so the tab can load
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return win;
}

/** Best-effort: web cannot reliably detect a connected printer; Print is always offered. */
export function canOfferPrint(): boolean {
  return typeof window !== 'undefined' && typeof window.print === 'function';
}
