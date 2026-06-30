import type { Vendor, VendorContact, EngageVendorContact } from '../api';

export type EditableVendorContact = VendorContact & { id: string };

function readContactString(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function readContactBool(raw: Record<string, unknown>, ...keys: string[]): boolean {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'boolean') return value;
  }
  return false;
}

export function createContactId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function parseVendorContacts(vendor: Pick<Vendor, 'contactsJson'>): VendorContact[] {
  if (!vendor.contactsJson || vendor.contactsJson.trim() === '' || vendor.contactsJson === '[]') {
    return [];
  }
  try {
    const parsed = JSON.parse(vendor.contactsJson) as Record<string, unknown>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c, index) => ({
      id: readContactString(c, 'id', 'Id') || `saved-${index}`,
      name: readContactString(c, 'name', 'Name'),
      position: readContactString(c, 'position', 'Position'),
      mobile: readContactString(c, 'mobile', 'Mobile'),
      email: readContactString(c, 'email', 'Email'),
      isDefault: readContactBool(c, 'isDefault', 'IsDefault'),
    })).filter(c => c.name || c.mobile || c.email);
  } catch {
    return [];
  }
}

export function contactsForEngageModal(vendor: Vendor): EditableVendorContact[] {
  const saved = parseVendorContacts(vendor);
  if (saved.length > 0) {
    return saved.map((c, index) => ({
      ...c,
      id: c.id ?? `saved-${index}`,
    }));
  }

  return [{
    id: createContactId(),
    name: vendor.contactPerson ?? '',
    position: vendor.contactPosition ?? '',
    mobile: vendor.mobile ?? '',
    email: vendor.email ?? '',
    isDefault: true,
  }];
}

export function getDefaultVendorContact(vendor: Vendor): VendorContact | null {
  const contacts = parseVendorContacts(vendor);
  if (contacts.length > 0) {
    return contacts.find(c => c.isDefault) ?? contacts[0];
  }
  if (!vendor.contactPerson && !vendor.mobile && !vendor.email) return null;
  return {
    id: 'primary',
    name: vendor.contactPerson ?? '',
    position: vendor.contactPosition ?? '',
    mobile: vendor.mobile ?? '',
    email: vendor.email ?? '',
    isDefault: true,
  };
}

export function toEngageContactPayload(contacts: EditableVendorContact[]): EngageVendorContact[] {
  return contacts.map(({ name, position, mobile, email, isDefault }) => ({
    name: name.trim(),
    position: position.trim(),
    mobile: mobile.trim(),
    email: email.trim(),
    isDefault,
  }));
}
