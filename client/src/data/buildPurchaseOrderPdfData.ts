import type { Company, DeliveryLocation, LocationConfig, Vendor } from '../api';
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

type PdfShipToLocation =
  | LocationConfig
  | (Pick<DeliveryLocation, 'name' | 'addressLine1' | 'addressLine2' | 'city' | 'stateProvince' | 'postcode'> & {
      logoBase64?: string;
      logoContentType?: string;
    });

export function buildPurchaseOrderPdfData(params: {
  poNumber: string;
  group: OrderCartVendorGroup;
  company: Company;
  deliveryLocations: PdfShipToLocation[];
  vendor: Vendor | null;
  orderDateLabel: string;
  deliveryDateLabel: string;
  deliveryDateHeading?: string;
  isPreCommitted?: boolean;
  initiatedBy: string;
  approvedBy: string;
  documentKind?: PurchaseDocumentKind;
  taxRate?: number;
}): PurchaseOrderPdfData {
  const taxRate = params.taxRate ?? DEFAULT_TAX_RATE;
  const documentKind = params.documentKind ?? 'purchase_order';
  const isPreCommitted = Boolean(params.isPreCommitted);
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
    isPreCommitted,
    orderDate: params.orderDateLabel,
    deliveryDate: params.deliveryDateLabel,
    deliveryDateHeading: isPreCommitted
      ? (params.deliveryDateHeading ?? 'Commitment Period')
      : params.deliveryDateHeading,
    countryCode: params.company.countryCode,
    company: {
      name: params.company.name,
      address: formatCompanyAddress(params.company),
      brn: params.company.brn,
      gstTin: params.company.gstTin,
      phone: params.company.phone,
      email: params.company.email,
    },
    companyLogo: params.company.logoBase64
      ? {
          contentType: params.company.logoContentType,
          base64: params.company.logoBase64,
        }
      : null,
    deliveryLocations: params.deliveryLocations.map(loc => ({
      name: loc.name,
      address: formatLocationAddress(loc),
      logo: loc.logoBase64
        ? {
            contentType: loc.logoContentType,
            base64: loc.logoBase64,
          }
        : null,
    })),
    vendor: {
      name: params.vendor?.name ?? params.group.vendorName,
      address: params.vendor ? formatVendorAddress(params.vendor) : '',
      brn: params.vendor?.brn,
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
