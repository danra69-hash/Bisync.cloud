import type { Bisync101Module } from '../types';

export const accountingModule: Bisync101Module = {
  id: 'accounting',
  title: 'Accounting',
  blurb:
    'Company-level payroll and ops→finance bridges. Statutory books (journals, COA, AP/AR) follow the Accounting architecture roadmap.',
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
          hotspot: { x: 8, y: 40, w: 18, h: 8, label: 'Accounting' },
        },
        {
          title: 'Select Payroll tab',
          detail: 'Stay on Payroll (default). Choose company context from the header and open the pay period.',
          hotspot: { x: 28, y: 16, w: 50, h: 10, label: 'Payroll' },
        },
        {
          title: 'Review & export',
          detail: 'Check totals against attendance/leave, then export or hand off to finance as configured.',
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
          hotspot: { x: 28, y: 14, w: 40, h: 8, label: 'Ops → Finance' },
        },
        {
          title: 'Run COGS Audit',
          detail: 'In Revenue Management → Reports → COGS Audit, select the month.',
          hotspot: { x: 8, y: 78, w: 18, h: 8, label: 'COGS Audit' },
        },
        {
          title: 'Export for finance',
          detail: 'Export the summary your accountant needs for the period close. Books/GL posting is roadmap.',
          hotspot: { x: 78, y: 16, w: 14, h: 8, label: 'Export' },
        },
      ],
    },
    {
      id: 'ac-books-roadmap',
      title: 'Understand Books roadmap',
      summary: 'Open Accounting → Books to see phased ledger / AP / AR delivery aligned to the architecture doc.',
      durationLabel: '~15 sec',
      whereInApp: 'Accounting → Books',
      clipFile: 'ac-books-roadmap.webm',
      steps: [
        {
          title: 'Open Books',
          detail: 'In Accounting, select the Books tab.',
          hotspot: { x: 40, y: 14, w: 20, h: 8, label: 'Books' },
        },
        {
          title: 'Read phases',
          detail:
            'Phase B foundations (journals/TB), Phase C COA + SLA from ops events, Phase D localisation packs.',
          hotspot: { x: 28, y: 28, w: 55, h: 35, label: 'Roadmap' },
        },
      ],
      tips: ['Do not enable reserved GL/AP/AR access-control tasks until those APIs ship.'],
    },
  ],
};
