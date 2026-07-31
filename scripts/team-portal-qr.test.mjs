import test from 'node:test';
import assert from 'node:assert/strict';

const QR_RE = /^([^/]+)\/(\d{4}-\d{2}-\d{2})\/(\d{2}:\d{2})$/;

function parsePosQr(payload) {
  const m = QR_RE.exec(String(payload).trim());
  if (!m) return null;
  return { outletInitial: m[1], date: m[2], time: m[3] };
}

function formatOutstandingLeave(alBalance, alCarryForward) {
  const carry = Number(alCarryForward) || 0;
  return carry > 0 ? `${alBalance} (${carry})` : String(alBalance);
}

test('parsePosQr accepts POS check-in payload', () => {
  assert.deepEqual(parsePosQr('WB/2026-07-17/09:15'), {
    outletInitial: 'WB',
    date: '2026-07-17',
    time: '09:15',
  });
});

test('parsePosQr rejects invalid payloads', () => {
  assert.equal(parsePosQr('not-a-qr'), null);
  assert.equal(parsePosQr('WB/2026-07-17'), null);
});

test('outstanding leave shows carry-forward in brackets', () => {
  assert.equal(formatOutstandingLeave(16, 3), '16 (3)');
  assert.equal(formatOutstandingLeave(16, 0), '16');
  assert.equal(formatOutstandingLeave(12, undefined), '12');
});
