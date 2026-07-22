import type {
  SalesModuleAppointment,
  SalesModuleBrand,
  SalesModuleContact,
  SalesModuleCustomer,
  UpsertSalesModuleAppointmentPayload,
  UpsertSalesModuleCustomerPayload,
} from '../api';

export const SALES_MODULE_STATUSES = [
  'Prospect',
  'Engaged',
  'Active',
  'Inactive',
  'Closed',
] as const;

export type SalesModuleStatus = (typeof SALES_MODULE_STATUSES)[number];

export function blankSalesContact(): SalesModuleContact {
  return {
    id: crypto.randomUUID().slice(0, 8),
    name: '',
    position: '',
    email: '',
    mobile: '',
  };
}

export function blankSalesBrand(): SalesModuleBrand {
  return { name: '', count: 1 };
}

export function formatBrandsCell(brands: SalesModuleBrand[] | undefined): string {
  if (!brands?.length) return '—';
  return brands.map(b => b.name).filter(Boolean).join(', ') || '—';
}

export function formatBrandCountsCell(brands: SalesModuleBrand[] | undefined): string {
  if (!brands?.length) return '—';
  return brands
    .filter(b => b.name.trim())
    .map(b => `${b.name.trim()}: ${b.count}`)
    .join(' · ') || '—';
}

export function formatContactsNames(contacts: SalesModuleContact[] | undefined): string {
  if (!contacts?.length) return '—';
  return contacts.map(c => c.name).filter(Boolean).join(', ') || '—';
}

export function formatContactsPositions(contacts: SalesModuleContact[] | undefined): string {
  if (!contacts?.length) return '—';
  return contacts.map(c => c.position || '—').join(', ');
}

export function formatContactsEmails(contacts: SalesModuleContact[] | undefined): string {
  if (!contacts?.length) return '—';
  return contacts.map(c => c.email || '—').join(', ');
}

export function formatContactsMobiles(contacts: SalesModuleContact[] | undefined): string {
  if (!contacts?.length) return '—';
  return contacts.map(c => c.mobile || '—').join(', ');
}

export function toCustomerPayload(
  form: UpsertSalesModuleCustomerPayload,
): UpsertSalesModuleCustomerPayload {
  return {
    ...form,
    companyName: form.companyName.trim(),
    brands: form.brands.filter(b => b.name.trim()).map(b => ({
      name: b.name.trim(),
      count: Math.max(0, Number(b.count) || 0),
    })),
    contacts: form.contacts.filter(c => c.name.trim()).map(c => ({
      ...c,
      name: c.name.trim(),
      position: c.position.trim(),
      email: c.email.trim(),
      mobile: c.mobile.trim(),
    })),
    lastDiscussionBrief: form.lastDiscussionBrief.trim(),
    locationCount: Math.max(0, Number(form.locationCount) || 0),
    hunterName: (form.hunterName ?? '').trim(),
    farmerName: (form.farmerName ?? '').trim(),
    status: form.status.trim() || 'Prospect',
  };
}

export type { SalesModuleAppointment, SalesModuleCustomer, UpsertSalesModuleAppointmentPayload };
