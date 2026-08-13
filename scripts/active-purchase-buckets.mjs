/**
 * Active Purchase KPI bucket classification.
 */
import assert from 'node:assert/strict';

function resolveActivePurchaseBucket(order) {
  if (order.status === 'Expired') return 'expired';
  if (order.isPreCommitted) return 'pre_committed';
  if (
    order.documentType === 'PR'
    || order.status === 'Pending Approval'
    || order.canApprove === true
  ) {
    return 'purchase_request';
  }
  if (order.status === 'Reconciled') return 'reconciled';
  if (order.status === 'Received' || order.status === 'Partially Delivered') return 'received';
  if (
    order.canReceive
    || ['Open', 'Pending', 'Confirmed', 'Accepted', 'In Transit'].includes(order.status)
  ) {
    return 'po_accepted';
  }
  return null;
}

assert.equal(
  resolveActivePurchaseBucket({ documentType: 'PR', status: 'Pending Approval' }),
  'purchase_request',
);
assert.equal(
  resolveActivePurchaseBucket({ documentType: 'PO', status: 'Accepted', canReceive: true }),
  'po_accepted',
);
assert.equal(
  resolveActivePurchaseBucket({ documentType: 'PO', status: 'Received' }),
  'received',
);
assert.equal(
  resolveActivePurchaseBucket({ documentType: 'PO', status: 'Partially Delivered', canReceive: true }),
  'received',
);
assert.equal(
  resolveActivePurchaseBucket({ documentType: 'PO', status: 'Reconciled' }),
  'reconciled',
);
assert.equal(
  resolveActivePurchaseBucket({ documentType: 'PO', status: 'Expired' }),
  'expired',
);
assert.equal(
  resolveActivePurchaseBucket({ documentType: 'PO', status: 'Committed', isPreCommitted: true }),
  'pre_committed',
);
assert.equal(
  resolveActivePurchaseBucket({ documentType: 'PO', status: 'Expired', isPreCommitted: true }),
  'expired',
);

console.log('active-purchase-buckets: ok');
