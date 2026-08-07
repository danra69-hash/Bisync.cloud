/**
 * Pre-committed PO PDF must title as PRE-COMMITTED ORDER and use commitment period.
 */
import assert from 'node:assert/strict';

function resolvePurchaseOrderPdfTitle(data) {
  if (data.isPreCommitted) return 'PRE-COMMITTED ORDER';
  if (data.documentKind === 'purchase_request') return 'PURCHASE REQUEST';
  if (data.documentKind === 'sales_order') return 'SALES ORDER';
  return 'PURCHASE ORDER';
}

function resolvePurchaseOrderPdfDateHeading(data) {
  if (data.isPreCommitted) {
    return (data.deliveryDateHeading ?? 'Commitment Period').toUpperCase();
  }
  return (data.deliveryDateHeading ?? 'Preferred Delivery Date').toUpperCase();
}

assert.equal(
  resolvePurchaseOrderPdfTitle({ documentKind: 'purchase_order', isPreCommitted: true }),
  'PRE-COMMITTED ORDER',
);
assert.equal(
  resolvePurchaseOrderPdfTitle({ documentKind: 'purchase_order' }),
  'PURCHASE ORDER',
);
assert.equal(
  resolvePurchaseOrderPdfDateHeading({
    isPreCommitted: true,
    deliveryDateHeading: 'Commitment Period',
  }),
  'COMMITMENT PERIOD',
);
assert.equal(
  resolvePurchaseOrderPdfDateHeading({ documentKind: 'purchase_order' }),
  'PREFERRED DELIVERY DATE',
);

console.log('precommitted-po-pdf-label: ok');
