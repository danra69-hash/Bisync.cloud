import type { VendorOrderPortal } from '../api';
import { DEFAULT_TAX_RATE } from './purchaseOrderFormat';
import type { PurchaseOrderPdfData } from './generatePurchaseOrderPdf';

function formatAddress(parts: string[]): string {
  return parts.filter(Boolean).join('\n');
}

function formatDisplayDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function buildPurchaseOrderPdfDataFromPortal(portal: VendorOrderPortal): PurchaseOrderPdfData {
  const taxRate = DEFAULT_TAX_RATE;
  const items = portal.items.map(item => {
    const lineSubtotal = item.quantity * item.unitPrice;
    const taxAmount = lineSubtotal * taxRate;
    return {
      name: item.name,
      deliveryUnit: item.deliveryPackage,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxAmount,
      lineTotal: lineSubtotal + taxAmount,
    };
  });
  const orderTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxTotal = items.reduce((sum, item) => sum + item.taxAmount, 0);

  const company = portal.company;
  const vendor = portal.vendor;
  const isPreCommitted = Boolean(portal.isPreCommitted);
  const commitmentStart = portal.commitmentStartDate?.trim() ?? '';
  const commitmentEnd = portal.commitmentEndDate?.trim() ?? '';
  const deliveryDate = isPreCommitted && commitmentStart && commitmentEnd
    ? `${formatDisplayDate(commitmentStart)} → ${formatDisplayDate(commitmentEnd)}`
    : formatDisplayDate(portal.deliveryDate);

  return {
    poNumber: portal.poNumber,
    documentKind: portal.documentKind,
    isPreCommitted,
    orderDate: formatDisplayDate(portal.orderDate),
    deliveryDate,
    deliveryDateHeading: isPreCommitted ? 'Commitment Period' : undefined,
    company: company
      ? {
          name: company.name,
          address: formatAddress([
            company.addressLine1,
            company.addressLine2,
            [company.city, company.stateProvince, company.postcode].filter(Boolean).join(', '),
          ]),
          brn: company.brn,
          gstTin: company.gstTin,
          phone: company.phone,
          email: company.email,
        }
      : { name: '—', address: '' },
    companyLogo: company?.logoBase64
      ? {
          contentType: company.logoContentType,
          base64: company.logoBase64,
        }
      : null,
    deliveryLocations: portal.deliveryLocations.map(loc => ({
      name: loc.name,
      address: formatAddress([
        loc.addressLine1,
        loc.addressLine2,
        [loc.city, loc.stateProvince, loc.postcode].filter(Boolean).join(', '),
      ]),
      logo: loc.logoBase64
        ? {
            contentType: loc.logoContentType,
            base64: loc.logoBase64,
          }
        : null,
    })),
    vendor: {
      name: vendor.name,
      address: formatAddress([vendor.address, [vendor.city, vendor.state].filter(Boolean).join(', ')]),
      brn: vendor.brn,
      contact: [
        vendor.contactPerson && vendor.contactPosition
          ? `${vendor.contactPerson} (${vendor.contactPosition})`
          : vendor.contactPerson,
        vendor.mobile,
        vendor.email,
      ].filter(Boolean).join('\n'),
    },
    items,
    orderTotal,
    taxTotal,
    totalAmount: orderTotal + taxTotal,
    initiatedBy: portal.initiatedBy,
    approvedBy: portal.approvedBy,
    termsAndConditions: '',
  };
}
