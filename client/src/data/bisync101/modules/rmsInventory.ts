import type { Bisync101Module } from '../types';

export const rmsInventoryModule: Bisync101Module = {
  id: 'rms-inventory',
  title: 'RMS · Production & Inventory',
  blurb: 'Central store production, stock cards, inventory counts, wastage, and transfers.',
  icon: 'warehouse',
  tasks: [
    {
      id: 'rms-production',
      title: 'Run production',
      summary: 'Produce finished or prep items from recipes and deplete components.',
      durationLabel: '~35 sec',
      whereInApp: 'Revenue Management → Operation → Production',
      clipFile: 'rms-production.webm',
      steps: [
        {
          title: 'Open Production',
          detail: 'Go to Operation → Production.',
          hotspot: { x: 8, y: 28, w: 18, h: 8, label: 'Production' },
        },
        {
          title: 'Choose what to produce',
          detail: 'Select the product/recipe, quantity, and production location.',
          hotspot: { x: 30, y: 28, w: 55, h: 35, label: 'Produce form' },
        },
        {
          title: 'Confirm production',
          detail: 'Post production so component stock decreases and finished goods increase per recipe.',
          hotspot: { x: 72, y: 82, w: 18, h: 10, label: 'Post' },
        },
      ],
    },
    {
      id: 'rms-central-store',
      title: 'Use Central Store (to produce / issue)',
      summary: 'Activate store+kitchen flow: requisition, issue to Stock Hold, then produce.',
      durationLabel: '~45 sec',
      whereInApp: 'Revenue Management → Operation → Central Store',
      clipFile: 'rms-central-store.webm',
      steps: [
        {
          title: 'Open Central Store',
          detail: 'Ensure the location is flagged as Central Store / Central Kitchen in location config, then open Central Store.',
          hotspot: { x: 8, y: 36, w: 18, h: 8, label: 'Central Store' },
        },
        {
          title: 'To Produce → requisition',
          detail: 'Create a To Produce list; the system raises a requisition for needed components.',
          hotspot: { x: 30, y: 26, w: 55, h: 20, label: 'To Produce' },
        },
        {
          title: 'Issue to Stock Hold',
          detail: 'Issue reserved stock into Stock Hold for the kitchen.',
          hotspot: { x: 30, y: 48, w: 55, h: 16, label: 'Issue' },
        },
        {
          title: 'Mark Produced',
          detail: 'Complete production so held components deplete and output is recorded.',
          hotspot: { x: 72, y: 82, w: 18, h: 10, label: 'Produced' },
        },
      ],
    },
    {
      id: 'rms-stock-card',
      title: 'Read a stock card',
      summary: 'Inspect movements and balances for a component at a location.',
      durationLabel: '~25 sec',
      whereInApp: 'Revenue Management → Operation → Stock Card',
      clipFile: 'rms-stock-card.webm',
      steps: [
        {
          title: 'Open Stock Card',
          detail: 'Go to Operation → Inventory → Stock Card.',
          hotspot: { x: 8, y: 44, w: 18, h: 8, label: 'Stock Card' },
        },
        {
          title: 'Select component',
          detail: 'Search by name or Component ID (e.g. BISY-A001).',
          hotspot: { x: 30, y: 18, w: 40, h: 10, label: 'Search' },
        },
        {
          title: 'Review movements',
          detail: 'Read receipts, issues, wastage, transfers, and running balance for the period.',
          hotspot: { x: 25, y: 32, w: 65, h: 45, label: 'Movements' },
        },
      ],
    },
    {
      id: 'rms-inventory-count',
      title: 'Perform inventory count',
      summary: 'Enter physical counts and post variances.',
      durationLabel: '~35 sec',
      whereInApp: 'Revenue Management → Operation → Inventory',
      clipFile: 'rms-inventory-count.webm',
      steps: [
        {
          title: 'Open Inventory',
          detail: 'Navigate to Operation → Inventory → Inventory.',
          hotspot: { x: 8, y: 52, w: 18, h: 8, label: 'Inventory' },
        },
        {
          title: 'Enter counts',
          detail: 'Enter counted quantities for each line. Use filters to work by group/storage.',
          hotspot: { x: 25, y: 28, w: 65, h: 45, label: 'Count grid' },
        },
        {
          title: 'Post inventory',
          detail: 'Post so system stock matches physical; shortages/overages update valuation.',
          hotspot: { x: 72, y: 82, w: 18, h: 10, label: 'Post' },
        },
      ],
    },
    {
      id: 'rms-wastage',
      title: 'Record wastage',
      summary: 'Write off spoilage or breakage with a reason.',
      durationLabel: '~25 sec',
      whereInApp: 'Revenue Management → Operation → Wastage',
      clipFile: 'rms-wastage.webm',
      steps: [
        {
          title: 'Open Wastage',
          detail: 'Go to Operation → Inventory → Wastage.',
          hotspot: { x: 8, y: 60, w: 18, h: 8, label: 'Wastage' },
        },
        {
          title: 'Add lines',
          detail: 'Select components, quantities, and wastage reason/code.',
          hotspot: { x: 30, y: 28, w: 55, h: 35, label: 'Wastage lines' },
        },
        {
          title: 'Post',
          detail: 'Post to remove stock and capture COGS/wastage impact.',
          hotspot: { x: 72, y: 82, w: 18, h: 10, label: 'Post' },
        },
      ],
    },
    {
      id: 'rms-transfer',
      title: 'Transfer stock between locations',
      summary: 'Move components from one outlet/store to another.',
      durationLabel: '~30 sec',
      whereInApp: 'Revenue Management → Operation → Transfer',
      clipFile: 'rms-transfer.webm',
      steps: [
        {
          title: 'Open Transfer',
          detail: 'Go to Operation → Inventory → Transfer.',
          hotspot: { x: 8, y: 68, w: 18, h: 8, label: 'Transfer' },
        },
        {
          title: 'Set from / to',
          detail: 'Choose source and destination locations, then add component lines.',
          hotspot: { x: 30, y: 24, w: 55, h: 40, label: 'Transfer' },
        },
        {
          title: 'Send / receive',
          detail: 'Post outbound from source and confirm inbound at destination per your workflow.',
          hotspot: { x: 72, y: 82, w: 18, h: 10, label: 'Post' },
        },
      ],
    },
  ],
};
