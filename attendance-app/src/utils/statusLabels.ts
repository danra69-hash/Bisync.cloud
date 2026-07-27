/** Human-readable order status labels and hints for Operator + Vendor UI. */

const OPERATOR_LABELS: Record<string, string> = {
  requested: 'Requested',
  submitted: 'Submitted',
  submittedwithchanges: 'Submitted with changes',
  waitingforaccepted: 'Waiting for accept',
  pendingvendorreview: 'Pending vendor review',
  accepted: 'Accepted',
  vendorapproved: 'Vendor approved',
  toship: 'To ship',
  received: 'Received',
  delivered: 'Received',
  consolidated: 'Consolidated',
  disapproved: 'Disapproved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  viewed: 'Viewed',
  failed: 'Failed',
  approved: 'Approved',
  pendingpayment: 'Pending payment',
  paymentapproved: 'Payment approved',
  paymentfailed: 'Payment failed',
  vendorrejected: 'Rejected',
}

/** Vendor pipeline labels (New / Active / Delivered). */
const VENDOR_LABELS: Record<string, string> = {
  ...OPERATOR_LABELS,
  submitted: 'To Accept',
  submittedwithchanges: 'To Accept',
  waitingforaccepted: 'To Accept',
  pendingvendorreview: 'To Approve',
  vendorapproved: 'To Accept',
  viewed: 'To Accept',
  received: 'Delivered',
  delivered: 'Delivered',
  consolidated: 'Delivered',
}

const OPERATOR_HINTS: Record<string, string> = {
  requested: 'Waiting for approval — adjust qty or add items under To Approve',
  approved: 'Approved — add items or Issue, then share the PDF link with the vendor',
  submitted: 'Issued — add items if needed; share PDF link via WhatsApp',
  submittedwithchanges: 'Issued with changes — PDF link shared',
  waitingforaccepted:
    'Issued — add items before delivery; share PDF and wait for vendor accept',
  viewed: 'Vendor viewed the PO — add items before delivery if needed',
  accepted: 'Vendor accepted — add items or receive when goods arrive',
  vendorapproved: 'Vendor accepted — receive when goods arrive',
  toship: 'Ready to receive — add items, adjust qty and price if needed',
  received: 'Received — add items, then consolidate to stock',
  delivered: 'Received — add items, then consolidate to stock',
  consolidated: 'Consolidated — quantities added to stock',
}

const VENDOR_HINTS: Record<string, string> = {
  submitted: 'Waiting for client to open the PDF link and accept',
  submittedwithchanges: 'Waiting for client to accept (with changes)',
  waitingforaccepted: 'Waiting for client to open the PDF link and accept',
  pendingvendorreview: 'Needs internal Approve / Reject before issuing',
  vendorapproved: 'Internally approved — create PDF link and send to client',
  viewed: 'Client viewed the sales order PDF',
  accepted: 'Accepted — Active Order',
  toship: 'Active — ready to deliver / receive',
  received: 'Client has received — Delivered',
  consolidated: 'Delivered and closed',
}

function normalizeKey(status?: string | null) {
  return (status || '').toLowerCase().replace(/\s+/g, '')
}

function roleLabels(role?: 'operator' | 'vendor' | null) {
  return role === 'vendor' ? VENDOR_LABELS : OPERATOR_LABELS
}

function roleHints(role?: 'operator' | 'vendor' | null) {
  return role === 'vendor' ? VENDOR_HINTS : OPERATOR_HINTS
}

export function formatOrderStatus(
  status?: string | null,
  role?: 'operator' | 'vendor' | null,
) {
  const key = normalizeKey(status)
  if (!key) return '—'
  return roleLabels(role)[key] || status || '—'
}

export function orderStatusHint(
  status?: string | null,
  role?: 'operator' | 'vendor' | null,
) {
  const key = normalizeKey(status)
  return roleHints(role)[key] || null
}
