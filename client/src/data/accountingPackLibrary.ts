/** Accounting localisation packs for Dev Console Ref & Library (wire later except MY active in Books). */

import frameworkMd from './accountingPacks/framework.md?raw';
import malaysiaMd from './accountingPacks/malaysia.md?raw';
import singaporeMd from './accountingPacks/singapore.md?raw';
import australiaMd from './accountingPacks/australia.md?raw';
import indonesiaMd from './accountingPacks/indonesia.md?raw';
import thailandMd from './accountingPacks/thailand.md?raw';
import unitedStatesMd from './accountingPacks/united-states.md?raw';
import backlogMd from './accountingPacks/delivery-backlog.md?raw';

export const ACCOUNTING_PACKS_REVISED_DATE = '2026-08-17';
export const ACCOUNTING_PACKS_LIBRARY_TITLE = 'Accounting localisation packs';

export type AccountingPackRef = {
  id: string;
  title: string;
  status: 'active' | 'reference';
  market: string;
  summary: string;
  markdown: string;
};

export const ACCOUNTING_PACK_REFS: AccountingPackRef[] = [
  {
    id: 'acc-framework',
    title: 'Localisation pack framework',
    status: 'reference',
    market: 'All',
    summary: 'Eleven capabilities, zero country conditionals. Read before any country pack.',
    markdown: frameworkMd,
  },
  {
    id: 'acc-my',
    title: 'Pack: Malaysia (active)',
    status: 'active',
    market: 'MY',
    summary: 'MyInvois clearance, SST non-recoverable, in-country records. Wired into Books.',
    markdown: malaysiaMd,
  },
  {
    id: 'acc-sg',
    title: 'Pack: Singapore (reference)',
    status: 'reference',
    market: 'SG',
    summary: 'InvoiceNow/Peppol, GST recoverable. Wire later from Dev Console library.',
    markdown: singaporeMd,
  },
  {
    id: 'acc-au',
    title: 'Pack: Australia (reference)',
    status: 'reference',
    market: 'AU',
    summary: 'BAS, PAYG, Peppol B2G. DSP accreditation calendar. Wire later.',
    markdown: australiaMd,
  },
  {
    id: 'acc-id',
    title: 'Pack: Indonesia (reference)',
    status: 'reference',
    market: 'ID',
    summary: 'Coretax, PPN, PPh, external numbering. Wire later.',
    markdown: indonesiaMd,
  },
  {
    id: 'acc-th',
    title: 'Pack: Thailand (reference)',
    status: 'reference',
    market: 'TH',
    summary: 'e-Tax CII, VAT tax point on payment for services. Wire later.',
    markdown: thailandMd,
  },
  {
    id: 'acc-us',
    title: 'Pack: United States (reference)',
    status: 'reference',
    market: 'US',
    summary: 'Sales tax, 1099. Wire later.',
    markdown: unitedStatesMd,
  },
  {
    id: 'acc-backlog',
    title: 'Delivery backlog (epics)',
    status: 'reference',
    market: 'All',
    summary: 'EPIC-1…14 sequencing from upstream Accounting package.',
    markdown: backlogMd,
  },
];
