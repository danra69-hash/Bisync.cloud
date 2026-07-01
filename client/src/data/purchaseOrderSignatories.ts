import type { AppUser } from '../api';
import { canApprovePurchaseOrder, parseUserAccess } from './userAccess';

export type PurchaseDocumentKind = 'purchase_order' | 'purchase_request';

export type PurchaseOrderSignatories = {
  initiatedBy: string;
  approvedBy: string;
  canSelfApprove: boolean;
  documentKind: PurchaseDocumentKind;
};

export type PurchaseDocumentLabels = {
  kind: PurchaseDocumentKind;
  title: string;
  confirmTitle: string;
  successTitle: string;
  successSubtitle: (count: number) => string;
  numberLabel: string;
  pdfTitle: string;
  submitButton: string;
  submittingButton: string;
  savedMessage: string;
  combinedPdfName: string;
  errorCreate: string;
};

export function getPurchaseDocumentLabels(kind: PurchaseDocumentKind): PurchaseDocumentLabels {
  if (kind === 'purchase_request') {
    return {
      kind,
      title: 'Purchase Request',
      confirmTitle: 'Confirm Purchase Request',
      successTitle: 'Purchase Requests Submitted',
      successSubtitle: count => `${count} PR${count !== 1 ? 's' : ''} submitted for approval · download PDF below`,
      numberLabel: 'PR No.:',
      pdfTitle: 'PURCHASE REQUEST',
      submitButton: 'Submit for approval',
      submittingButton: 'Submitting…',
      savedMessage: 'Purchase requests saved and sent for approval',
      combinedPdfName: 'Purchase-Requests',
      errorCreate: 'Failed to submit purchase requests.',
    };
  }

  return {
    kind,
    title: 'Purchase Order',
    confirmTitle: 'Confirm Purchase Orders',
    successTitle: 'Purchase Orders Created',
    successSubtitle: count => `${count} PO${count !== 1 ? 's' : ''} saved · download PDF below`,
    numberLabel: 'PO No.:',
    pdfTitle: 'PURCHASE ORDER',
    submitButton: 'Confirm & Create POs',
    submittingButton: 'Creating POs…',
    savedMessage: 'Purchase orders saved to database',
    combinedPdfName: 'Purchase-Orders',
    errorCreate: 'Failed to create purchase orders.',
  };
}

export function resolvePurchaseOrderSignatories(user: AppUser): PurchaseOrderSignatories {
  const access = parseUserAccess(user.accessJson);
  const name = user.fullName.trim() || 'Unknown User';
  const canSelfApprove = canApprovePurchaseOrder(access);
  return {
    initiatedBy: name,
    approvedBy: canSelfApprove ? name : 'Pending',
    canSelfApprove,
    documentKind: canSelfApprove ? 'purchase_order' : 'purchase_request',
  };
}

export function resolvePurchaseDocumentLabels(user: AppUser): PurchaseDocumentLabels {
  const signatories = resolvePurchaseOrderSignatories(user);
  return getPurchaseDocumentLabels(signatories.documentKind);
}
