/**
 * Stock Card FIFO outbound entry types must include credit_note so CN postings
 * appear on the ledger (previously classified then silently dropped).
 */
import assert from 'node:assert/strict';

/** Mirrors StockCardFifoEngine.IsOutboundConsume */
function isOutboundConsume(entryType) {
  return [
    'production',
    'pos_sale',
    'online_order',
    'offline_order',
    'wastage',
    'transfer_out',
    'outbound',
    'split_use',
    'credit_note',
    'store_issue',
  ].includes(entryType);
}

assert.equal(isOutboundConsume('credit_note'), true);
assert.equal(isOutboundConsume('store_issue'), true);
assert.equal(isOutboundConsume('purchase'), false);

/** Mirrors StockCardService credit-note reference formatting */
function formatCreditNoteRef(referenceId, fifoHexN) {
  if (referenceId <= 0) return '';
  if (fifoHexN && fifoHexN.length >= 8) {
    return `CN-${referenceId} · TX ${fifoHexN.slice(0, 8).toUpperCase()}`;
  }
  return `CN-${referenceId}`;
}

assert.equal(
  formatCreditNoteRef(42, 'a1b2c3d4e5f6789012345678abcdef01'),
  'CN-42 · TX A1B2C3D4',
);
assert.equal(formatCreditNoteRef(7, ''), 'CN-7');

console.log('stockcard-credit-note-outbound.test.mjs: OK');
