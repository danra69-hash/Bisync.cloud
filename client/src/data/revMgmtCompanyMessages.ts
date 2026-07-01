export type CompanyMessage = {
  id: string;
  title: string;
  body: string;
  postedAt: string;
  priority?: 'normal' | 'important';
  companyId?: number | null;
};

export const REV_MGMT_COMPANY_MESSAGES: CompanyMessage[] = [
  {
    id: 'msg-1',
    title: 'Weekend inventory count',
    body: 'All outlets must complete a full stock take by Sunday 6 PM. Submit variances through Inventory → Batch & Stock Adjustment.',
    postedAt: '2025-06-28T09:00:00',
    priority: 'important',
  },
  {
    id: 'msg-2',
    title: 'Updated delivery window',
    body: 'Premium Meats Co. has moved morning deliveries to 7:30–9:00 AM. Receiving teams please update SOP checklists.',
    postedAt: '2025-06-27T14:30:00',
    priority: 'normal',
  },
  {
    id: 'msg-3',
    title: 'New vendor onboarding',
    body: 'Fine Truffle Imports is now approved for black truffle and seasonal fungi. Compare Price is live for tagged components.',
    postedAt: '2025-06-26T11:15:00',
    priority: 'normal',
  },
  {
    id: 'msg-4',
    title: 'PO approval reminder',
    body: 'Purchase orders above RM 5,000 require manager approval before vendor dispatch. Check pending orders daily.',
    postedAt: '2025-06-25T08:45:00',
    priority: 'important',
  },
];

export function getCompanyMessages(companyId: number | null): CompanyMessage[] {
  return REV_MGMT_COMPANY_MESSAGES.filter(
    m => m.companyId == null || m.companyId === companyId,
  ).sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}
