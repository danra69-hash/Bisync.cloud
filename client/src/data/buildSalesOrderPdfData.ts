import type { B2bCustomer, Company, LocationConfig } from '../api';
import type { PurchaseOrderPdfData } from './generatePurchaseOrderPdf';
import {
  DEFAULT_TAX_RATE,
  formatCompanyAddress,
  formatLocationAddress,
} from './purchaseOrderFormat';
import { formatCustomerAddress, getDefaultContact, parseB2bCustomerContacts } from './customerListData';

export type SalesOrderCartLine = {
  key: string;
  productId: number;
  productAliasId: number | null;
  /** When set, this line is an active combo promotion pack. */
  promotionId?: number | null;
  productName: string;
  deliveryUom: string;
  quantity: number;
  unitPrice: number;
  locationExternalId: string;
};

export function buildSalesOrderPdfData(params: {
  soNumber: string;
  company: Company;
  customer: B2bCustomer;
  productionLocation: LocationConfig | null;
  lines: SalesOrderCartLine[];
  orderDateLabel: string;
  deliveryDateLabel: string;
  initiatedBy: string;
  approvedBy: string;
  taxRate?: number;
}): PurchaseOrderPdfData {
  const taxRate = params.taxRate ?? DEFAULT_TAX_RATE;
  const contact = getDefaultContact(parseB2bCustomerContacts(params.customer));
  const items = params.lines.map(line => {
    const lineSubtotal = line.quantity * line.unitPrice;
    const taxAmount = lineSubtotal * taxRate;
    return {
      name: line.productName,
      deliveryUnit: line.deliveryUom,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxAmount,
      lineTotal: lineSubtotal + taxAmount,
    };
  });
  const orderTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxTotal = items.reduce((sum, item) => sum + item.taxAmount, 0);

  return {
    poNumber: params.soNumber,
    documentKind: 'sales_order',
    orderDate: params.orderDateLabel,
    deliveryDate: params.deliveryDateLabel,
    countryCode: params.company.countryCode,
    company: {
      name: params.company.name,
      address: formatCompanyAddress(params.company),
      brn: params.company.brn || undefined,
      gstTin: params.company.gstTin || undefined,
      phone: params.company.phone || undefined,
      email: params.company.email || undefined,
    },
    deliveryLocations: params.productionLocation
      ? [{
          name: params.productionLocation.name,
          address: formatLocationAddress(params.productionLocation),
        }]
      : [],
    vendor: {
      name: params.customer.companyName,
      address: formatCustomerAddress(params.customer),
      brn: params.customer.brn || undefined,
      phone: params.customer.phone || undefined,
      email: params.customer.email || undefined,
      contact: contact?.name
        ? `${contact.name}${contact.position ? ` (${contact.position})` : ''}`
        : undefined,
    },
    items,
    orderTotal,
    taxTotal,
    totalAmount: orderTotal + taxTotal,
    initiatedBy: params.initiatedBy,
    approvedBy: params.approvedBy,
    termsAndConditions: '',
  };
}
