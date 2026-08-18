import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appSrc = readFileSync(join(root, 'web/src/App.tsx'), 'utf8');
const paySrc = readFileSync(join(root, 'web/src/pages/PaymentsPage.tsx'), 'utf8');
const shareSrc = readFileSync(join(root, 'web/src/lib/invoiceShare.ts'), 'utf8');
const apiSrc = readFileSync(join(root, 'api/src/server.mjs'), 'utf8');
const domainSrc = readFileSync(join(root, 'api/src/domain.mjs'), 'utf8');

test('Invoices nav is merged into Payments', () => {
  assert.doesNotMatch(appSrc, /label: 'Invoices'/);
  assert.match(appSrc, /Navigate to="\/app\/payments"/);
  assert.match(paySrc, /Capture payment &(?:amp;)? invoice/);
  assert.doesNotMatch(paySrc, /Issue invoice<\/h2>/);
  assert.doesNotMatch(paySrc, /submitInvoice/);
});

test('Ledger shows Invoice actions next to Method after payment', () => {
  assert.match(paySrc, /ledger-method-row/);
  assert.match(paySrc, /Invoice/);
  assert.match(paySrc, /PDF/);
  assert.match(paySrc, /WhatsApp/);
  assert.match(paySrc, /Print/);
  assert.match(shareSrc, /buildWhatsAppShareHref/);
  assert.match(shareSrc, /openInvoiceReceipt/);
});

test('Payment capture auto-creates receipt invoice when none linked', () => {
  assert.match(apiSrc, /create receipt invoice|Every captured payment gets a receipt/i);
  assert.match(apiSrc, /gateBilling/);
  assert.match(domainSrc, /accounting: \[[^\]]*payments[^\]]*\]/);
  assert.doesNotMatch(
    domainSrc,
    /accounting: \[[^\]]*invoices[^\]]*\]/,
  );
});
