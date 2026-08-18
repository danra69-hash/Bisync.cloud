import type { Bisync101Module } from '../types';

export const accountingModule: Bisync101Module = {
  id: 'accounting',
  title: 'Accounting',
  blurb:
    'Payroll, ops→finance bridges, and live Bisync Books — chart of accounts, journals, reports, Malaysia packs, and internal subledgers.',
  icon: 'calculator',
  tasks: [
    {
      id: 'ac-payroll',
      title: 'Run payroll overview',
      summary: 'Open Accounting → Payroll to review pay inputs tied to HR attendance and pay elements.',
      durationLabel: '~30 sec',
      whereInApp: 'Accounting → Payroll',
      clipFile: 'ac-payroll.webm',
      steps: [
        {
          title: 'Open Accounting',
          detail: 'From Home or the sidebar, open Accounting (enabled when the company module is on).',
          voiceover: 'Open Accounting from Home or the sidebar when the company module is enabled.',
          hotspot: { x: 8, y: 40, w: 18, h: 8, label: 'Accounting' },
        },
        {
          title: 'Select Payroll tab',
          detail: 'Stay on Payroll (default). Choose company context from the header and open the pay period.',
          voiceover: 'Stay on Payroll, confirm the company in the header, and open the pay period you need.',
          hotspot: { x: 28, y: 16, w: 50, h: 10, label: 'Payroll' },
        },
        {
          title: 'Review & export',
          detail: 'Check totals against attendance/leave, then export or hand off to finance as configured.',
          voiceover: 'Review totals against attendance and leave, then export or hand off to finance.',
          hotspot: { x: 28, y: 32, w: 60, h: 40, label: 'Payroll' },
        },
      ],
      tips: ['Keep HR attendance posted before closing a pay period.'],
    },
    {
      id: 'ac-cogs-bridge',
      title: 'Bridge ops costs to finance',
      summary:
        'Use Accounting → Ops → Finance for the map, then RMS COGS Audit and stock card as the operational source.',
      durationLabel: '~25 sec',
      whereInApp: 'Accounting → Ops → Finance · RMS → COGS Audit',
      clipFile: 'ac-cogs-bridge.webm',
      steps: [
        {
          title: 'Open Ops → Finance',
          detail: 'In Accounting, open the Ops → Finance tab for the live bridge list.',
          voiceover: 'In Accounting, open Ops to Finance for the live bridge list between operations and the ledger.',
          hotspot: { x: 28, y: 14, w: 40, h: 8, label: 'Ops → Finance' },
        },
        {
          title: 'Run COGS Audit',
          detail: 'In Revenue Management → Reports → COGS Audit, select the month.',
          voiceover: 'In Revenue Management Reports, open COGS Audit and pick the month you are closing.',
          hotspot: { x: 8, y: 78, w: 18, h: 8, label: 'COGS Audit' },
        },
        {
          title: 'Export for finance',
          detail: 'Export the summary your accountant needs for the period close. Posting can continue in Books journals.',
          voiceover: 'Export the COGS summary for finance, then continue posting in Books journals when needed.',
          hotspot: { x: 78, y: 16, w: 14, h: 8, label: 'Export' },
        },
      ],
    },
    {
      id: 'ac-books-workspace',
      title: 'Use Bisync Books (COA, journals, reports)',
      summary:
        'Open Accounting → Books for chart of accounts, journals, trial balance, P&L/BS, periods, and Malaysia-first packs.',
      durationLabel: '~40 sec',
      whereInApp: 'Accounting → Books',
      clipFile: 'ac-books-roadmap.webm',
      steps: [
        {
          title: 'Open Books',
          detail: 'In Accounting, select the Books tab to enter the live Books workspace.',
          voiceover: 'Open Accounting, then Books. This is the live Bisync Books workspace — not a roadmap stub.',
          hotspot: { x: 40, y: 14, w: 20, h: 8, label: 'Books' },
        },
        {
          title: 'Chart of accounts & journals',
          detail: 'Maintain the COA, post multi-currency journals with manual FX rates, and keep periods open or closed.',
          voiceover: 'Use the chart of accounts and journals. Transactions can be multi-currency with a manual FX rate into functional currency.',
          hotspot: { x: 28, y: 24, w: 55, h: 30, label: 'COA / Journals' },
        },
        {
          title: 'Reports & Malaysia packs',
          detail: 'Run trial balance, P&L, and balance sheet in functional currency. Malaysia packs cover SST recoverability, roles, and draft SST-02.',
          voiceover: 'Run trial balance, profit and loss, and balance sheet in functional currency. Malaysia packs add SST rules and draft SST-02 returns.',
          hotspot: { x: 28, y: 55, w: 55, h: 25, label: 'Reports' },
        },
        {
          title: 'Internal subledgers',
          detail: 'Use bank matching, AP approval with segregation of duties, payment apply/un-apply, fixed assets, and revenue recognition shells.',
          voiceover: 'Internal Books also covers bank matching, AP approval with segregation of duties, payment applications, fixed assets, and revenue recognition.',
          hotspot: { x: 28, y: 40, w: 55, h: 35, label: 'Subledgers' },
        },
      ],
      tips: [
        'External connectors such as MyInvois, Peppol, live bank feeds, and Customs SST filing remain deferred.',
        'Statements stay in functional currency even when journals are entered in foreign currency.',
      ],
    },
  ],
};
