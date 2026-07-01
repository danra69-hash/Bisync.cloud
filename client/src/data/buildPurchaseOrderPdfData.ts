import type { Company, LocationConfig, Vendor } from '../api';
import type { OrderCartItem, OrderCartVendorGroup } from './createOrder';
import {
  DEFAULT_TAX_RATE,
  formatCompanyAddress,
  formatLocationAddress,
  formatVendorAddress,
  formatVendorContact,
} from './purchaseOrderFormat';
import type { PurchaseOrderPdfData } from './generatePurchaseOrderPdf';
import type { PurchaseDocumentKind } from './purchaseOrderSignatories';

export function buildPurchaseOrderPdfData(params: {
  poNumber: string;
  group: OrderCartVendorGroup;
  company: Company;
  deliveryLocations: LocationConfig[];
  vendor: Vendor | null;
  orderDateLabel: string;
  deliveryDateLabel: string;
  initiatedBy: string;
  approvedBy: string;
  documentKind?: PurchaseDocumentKind;
  taxRate?: number;
}): PurchaseOrderPdfData {
  const taxRate = params.taxRate ?? DEFAULT_TAX_RATE;
  const documentKind = params.documentKind ?? 'purchase_order';
  const items = params.group.items.map(item => {
    const lineSubtotal = item.lineTotal;
    const taxAmount = lineSubtotal * taxRate;
    return {
      name: item.productName,
      deliveryUnit: item.deliveryUnitLabel,
      quantity: item.quantity,
      unitPrice: item.deliveryPrice,
      taxAmount,
      lineTotal: lineSubtotal + taxAmount,
    };
  });
  const orderTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxTotal = items.reduce((sum, item) => sum + item.taxAmount, 0);
  const totalAmount = orderTotal + taxTotal;

  return {
    poNumber: params.poNumber,
    documentKind,
    orderDate: params.orderDateLabel,
    deliveryDate: params.deliveryDateLabel,
    company: {
      name: params.company.name,
      address: formatCompanyAddress(params.company),
      brn: params.company.brn,
      gstTin: params.company.gstTin,
      phone: params.company.phone,
      email: params.company.email,
    },
    deliveryLocations: params.deliveryLocations.map(loc => ({
      name: loc.name,
      address: formatLocationAddress(loc),
    })),
    vendor: {
      name: params.vendor?.name ?? params.group.vendorName,
      address: params.vendor ? formatVendorAddress(params.vendor) : '',
      contact: params.vendor ? formatVendorContact(params.vendor) : '',
    },
    items,
    orderTotal,
    taxTotal,
    totalAmount,
    initiatedBy: params.initiatedBy,
    approvedBy: params.approvedBy,
    termsAndConditions: '',
  };
}

export function findVendorForGroup(vendors: Vendor[], group: OrderCartVendorGroup): Vendor | null {
  return vendors.find(v => v.externalId === group.vendorExternalId)
    ?? vendors.find(v => v.name === group.vendorName)
    ?? null;
}

export function findCartItemVendor(
  vendors: Vendor[],
  item: OrderCartItem,
): Vendor | null {
  return vendors.find(v => v.externalId === item.vendorExternalId) ?? null;
}
