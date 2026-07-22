export const SALES_DIARY_ACTIVITY_TYPES = ['Status Change', 'Sales Call'] as const;
export type SalesDiaryActivityType = (typeof SALES_DIARY_ACTIVITY_TYPES)[number];

export const SALES_DIARY_STATUSES = [
  'Prospect',
  'Proposed',
  'In Nego',
  'Sales Order',
  'Invoiced',
  'Paid',
  'Activated',
  'KIV',
  'Rejected',
] as const;
export type SalesDiaryStatus = (typeof SALES_DIARY_STATUSES)[number];

export const SALES_DIARY_CONTACT_TYPES = [
  'Cold Call',
  'Email Blast',
  'Follow up Call',
  'Follow up Visit',
  'Follow Up email',
  'Sales Meeting',
  'Demo Meeting',
  'Follow Up Meeting',
  'Online Presentation',
  'Offline Presentation',
  'Training',
  'Retraining',
  'Post Meeting',
  'Regular Catch Up',
] as const;
export type SalesDiaryContactType = (typeof SALES_DIARY_CONTACT_TYPES)[number];

export type SalesDiaryContactPerson = {
  name: string;
  position: string;
};

export function blankDiaryContact(): SalesDiaryContactPerson {
  return { name: '', position: '' };
}

export function contactTypeSkipsTaggedCompany(contactType: string): boolean {
  return contactType === 'Cold Call' || contactType === 'Email Blast';
}

export function todayDateInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
