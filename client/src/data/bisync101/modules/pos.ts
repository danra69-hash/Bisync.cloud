import type { Bisync101Module } from '../types';

export const posModule: Bisync101Module = {
  id: 'pos',
  title: 'Point-of-Sales',
  blurb: 'Menus, modifiers, promotions, devices, and the live POS / KDS / CDS stations.',
  icon: 'store',
  tasks: [
    {
      id: 'pos-menu',
      title: 'Build a POS menu',
      summary: 'Arrange sellable products into menu categories for the floor.',
      durationLabel: '~35 sec',
      whereInApp: 'Point-of-Sales → POS Menu',
      clipFile: 'pos-menu.webm',
      steps: [
        {
          title: 'Open POS Menu',
          detail: 'From Point-of-Sales, open POS Menu.',
          hotspot: { x: 20, y: 14, w: 12, h: 8, label: 'POS Menu' },
        },
        {
          title: 'Organize categories',
          detail: 'Create or reorder categories and place products on the menu board.',
          hotspot: { x: 25, y: 28, w: 60, h: 45, label: 'Menu board' },
        },
        {
          title: 'Publish',
          detail: 'Save so registers and QR order pick up the latest menu.',
          hotspot: { x: 78, y: 88, w: 14, h: 8, label: 'Save' },
        },
      ],
    },
    {
      id: 'pos-modifiers',
      title: 'Configure modifier groups',
      summary: 'Define add-ons and forced choices for menu items.',
      durationLabel: '~30 sec',
      whereInApp: 'Point-of-Sales → POS Modifier Group',
      clipFile: 'pos-modifiers.webm',
      steps: [
        {
          title: 'Open Modifier Group',
          detail: 'Open POS Modifier Group from the POS bar.',
          hotspot: { x: 32, y: 14, w: 16, h: 8, label: 'Modifiers' },
        },
        {
          title: 'Create a group',
          detail: 'Name the group, set min/max selections, and add modifier options with prices.',
          hotspot: { x: 55, y: 28, w: 40, h: 40, label: 'Group' },
        },
        {
          title: 'Attach to products',
          detail: 'Link the group to menu products that should prompt for modifiers.',
          hotspot: { x: 55, y: 60, w: 40, h: 16, label: 'Attach' },
        },
      ],
    },
    {
      id: 'pos-promotions',
      title: 'Schedule a promotion',
      summary: 'Time-box combos or discounts for POS and sales.',
      durationLabel: '~30 sec',
      whereInApp: 'Point-of-Sales → Promotion Scheduler',
      clipFile: 'pos-promotions.webm',
      steps: [
        {
          title: 'Open Promotion Scheduler',
          detail: 'Open Promotion Scheduler from the POS bar (also available under RMS Sales).',
          hotspot: { x: 48, y: 14, w: 16, h: 8, label: 'Promotions' },
        },
        {
          title: 'Define the offer',
          detail: 'Set name, products/combo, price, and active date/time window.',
          hotspot: { x: 55, y: 28, w: 40, h: 40, label: 'Promotion' },
        },
        {
          title: 'Activate',
          detail: 'Save so stations honor the schedule automatically.',
          hotspot: { x: 78, y: 88, w: 14, h: 8, label: 'Save' },
        },
      ],
    },
    {
      id: 'pos-config-devices',
      title: 'Configure POS & devices',
      summary: 'Set POS options and register kitchen/display devices on the LAN.',
      durationLabel: '~40 sec',
      whereInApp: 'Point-of-Sales → POS Config / Device Management',
      clipFile: 'pos-config-devices.webm',
      steps: [
        {
          title: 'POS Config',
          detail: 'Open POS Config to set register behaviour, printers, and outlet options.',
          hotspot: { x: 64, y: 14, w: 12, h: 8, label: 'POS Config' },
        },
        {
          title: 'Device Management',
          detail: 'Open Device Management to pair KDS/CDS/BDS hosts and check LAN health.',
          hotspot: { x: 76, y: 14, w: 14, h: 8, label: 'Devices' },
        },
        {
          title: 'Activate a station',
          detail: 'On the device, open /POS, /KDS, or /CDS and complete station activation for the location.',
          hotspot: { x: 30, y: 40, w: 40, h: 30, label: 'Station' },
        },
      ],
    },
    {
      id: 'pos-take-order',
      title: 'Take an order on POS',
      summary: 'Ring a table or counter order through to kitchen displays.',
      durationLabel: '~35 sec',
      whereInApp: 'Standalone /POS (or POS Test)',
      clipFile: 'pos-take-order.webm',
      steps: [
        {
          title: 'Open the register',
          detail: 'Launch the POS app for the location (floor plan or quick order).',
          hotspot: { x: 20, y: 20, w: 60, h: 40, label: 'Register' },
        },
        {
          title: 'Add items',
          detail: 'Tap menu items, apply modifiers, and set quantities.',
          hotspot: { x: 25, y: 30, w: 35, h: 40, label: 'Menu' },
        },
        {
          title: 'Send / pay',
          detail: 'Send to kitchen (KDS) and complete payment when ready. Guest displays update on CDS when configured.',
          hotspot: { x: 70, y: 78, w: 20, h: 12, label: 'Pay / Send' },
        },
      ],
    },
  ],
};
