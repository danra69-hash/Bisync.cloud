import type { Bisync101Module } from '../types';

export const accountingModule: Bisync101Module = {
  id: 'accounting',
  title: 'Accounting',
  blurb: 'Payroll and finance-facing views that connect HR and operational costs.',
  icon: 'calculator',
  tasks: [
    {
      id: 'ac-payroll',
      title: 'Run payroll overview',
      summary: 'Open Accounting to review payroll inputs tied to HR attendance and pay elements.',
      durationLabel: '~30 sec',
      whereInApp: 'Accounting',
      clipFile: 'ac-payroll.webm',
      steps: [
        {
          title: 'Open Accounting',
          detail: 'From Home or the sidebar, open Accounting (enabled when the company module is on).',
          hotspot: { x: 8, y: 40, w: 18, h: 8, label: 'Accounting' },
        },
        {
          title: 'Select period',
          detail: 'Choose company, location scope, and pay period.',
          hotspot: { x: 28, y: 16, w: 50, h: 10, label: 'Period' },
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
      summary: 'Use RMS COGS Audit and purchase reports as the operational source for accounting.',
      durationLabel: '~25 sec',
      whereInApp: 'RMS → Reports → COGS Audit / Purchase Summary',
      clipFile: 'ac-cogs-bridge.webm',
      steps: [
        {
          title: 'Run COGS Audit',
          detail: 'In Revenue Management → Reports → COGS Audit, select the month.',
          hotspot: { x: 8, y: 78, w: 18, h: 8, label: 'COGS Audit' },
        },
        {
          title: 'Reconcile with inventory',
          detail: 'Compare opening, movements, and closing values to inventory postings.',
          hotspot: { x: 28, y: 28, w: 60, h: 45, label: 'Audit grid' },
        },
        {
          title: 'Export for finance',
          detail: 'Export the summary your accountant needs for the period close.',
          hotspot: { x: 78, y: 16, w: 14, h: 8, label: 'Export' },
        },
      ],
    },
  ],
};
