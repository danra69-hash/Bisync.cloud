import type { Bisync101Module } from '../types';

export const rmsOrdersModule: Bisync101Module = {
  id: 'rms-orders',
  title: 'RMS · Orders',
  blurb: 'Purchase requests, purchase orders, vendor acceptance, receiving, returns, and credit notes.',
  icon: 'shopping-cart',
  tasks: [
    {
      id: 'rms-create-po',
      title: 'Create a purchase order (My Order)',
      summary: 'Build a cart by vendor, choose delivery location and date, then submit the PO/PR.',
      durationLabel: '~45 sec',
      whereInApp: 'Revenue Management → Operation → My Order',
      clipFile: 'rms-create-po.webm',
      steps: [
        {
          title: 'Open My Order',
          detail: 'In Revenue Management → Operation → Order, open My Order. Confirm company and location in the header.',
          hotspot: { x: 8, y: 22, w: 18, h: 8, label: 'My Order' },
        },
        {
          title: 'Add products to the cart',
          detail: 'Search vendor products, set quantities and delivery units, and add lines. Cart groups by vendor.',
          hotspot: { x: 30, y: 28, w: 55, h: 40, label: 'Catalog / cart' },
        },
        {
          title: 'Review cart & dates',
          detail: 'Open the cart, confirm delivery location(s), preferred delivery date, and signatories.',
          hotspot: { x: 60, y: 20, w: 35, h: 50, label: 'Cart' },
        },
        {
          title: 'Submit & PDF',
          detail: 'Submit to create the PO/PR. Download or open the PDF — it shows your company/location logo and a Powered by Bisync footer.',
          hotspot: { x: 70, y: 82, w: 22, h: 10, label: 'Submit' },
        },
      ],
      tips: [
        'Use Order Template for repeat weekly orders.',
        'Vendors can accept via the share link portal.',
      ],
    },
    {
      id: 'rms-active-purchase',
      title: 'Track active purchases',
      summary: 'Follow PO status from submitted → accepted → receiving → reconciled.',
      durationLabel: '~30 sec',
      whereInApp: 'Revenue Management → Active Purchase (Operation views)',
      clipFile: 'rms-active-purchase.webm',
      steps: [
        {
          title: 'Open the active list',
          detail: 'From Operation / purchase views, open the list of open POs for the selected locations.',
          hotspot: { x: 25, y: 22, w: 60, h: 40, label: 'PO list' },
        },
        {
          title: 'Open a PO',
          detail: 'Click a row to see lines, vendor acceptance, and delivery status.',
          hotspot: { x: 25, y: 30, w: 60, h: 12, label: 'PO row' },
        },
        {
          title: 'Receive goods',
          detail: 'When stock arrives, record receiving quantities so inventory and stock cards update.',
          hotspot: { x: 70, y: 80, w: 20, h: 10, label: 'Receive' },
        },
      ],
    },
    {
      id: 'rms-returnable-goods',
      title: 'Process returnable goods',
      summary: 'Return items against a purchase and keep inventory aligned.',
      durationLabel: '~30 sec',
      whereInApp: 'Revenue Management → Operation → Returnable Goods',
      clipFile: 'rms-returnable-goods.webm',
      steps: [
        {
          title: 'Open Returnable Goods',
          detail: 'Navigate to Operation → Order → Returnable Goods.',
          hotspot: { x: 8, y: 30, w: 18, h: 8, label: 'Returns' },
        },
        {
          title: 'Select source PO / items',
          detail: 'Choose the purchase and the lines/quantities to return.',
          hotspot: { x: 30, y: 28, w: 55, h: 35, label: 'Return lines' },
        },
        {
          title: 'Confirm return',
          detail: 'Submit so stock and documents update for the outlet.',
          hotspot: { x: 72, y: 82, w: 18, h: 10, label: 'Confirm' },
        },
      ],
    },
    {
      id: 'rms-credit-note',
      title: 'Issue a credit note',
      summary: 'Create a credit note against a PO, adjust stock, and cancel cleanly when needed.',
      durationLabel: '~40 sec',
      whereInApp: 'Revenue Management → Operation → Credit Note',
      clipFile: 'rms-credit-note.webm',
      steps: [
        {
          title: 'Open Credit Note',
          detail: 'Under Operation → Order, open Credit Note (below Returnable Goods).',
          hotspot: { x: 8, y: 38, w: 18, h: 8, label: 'Credit Note' },
        },
        {
          title: 'Select the PO',
          detail: 'Pick the purchase order the credit applies to and the lines/values.',
          hotspot: { x: 30, y: 28, w: 55, h: 35, label: 'CN lines' },
        },
        {
          title: 'Post the credit',
          detail: 'Save to post stock outbound / valuation effects. Cancel later only if your role allows — cancel revalues related receipts carefully.',
          hotspot: { x: 72, y: 82, w: 18, h: 10, label: 'Post' },
        },
      ],
    },
    {
      id: 'rms-cash-purchase',
      title: 'Record a cash purchase',
      summary: 'Capture off-cycle purchases with receipt attachment when needed.',
      durationLabel: '~30 sec',
      whereInApp: 'Revenue Management → Operation → Cash Purchase',
      clipFile: 'rms-cash-purchase.webm',
      steps: [
        {
          title: 'Open Cash Purchase',
          detail: 'Go to Operation → Order → Cash Purchase.',
          hotspot: { x: 8, y: 46, w: 18, h: 8, label: 'Cash' },
        },
        {
          title: 'Enter supplier & lines',
          detail: 'Enter vendor/payee, items, quantities, and costs for the outlet.',
          hotspot: { x: 30, y: 28, w: 55, h: 40, label: 'Form' },
        },
        {
          title: 'Attach receipt & save',
          detail: 'Upload a receipt image if required by policy, then save to update inventory.',
          hotspot: { x: 72, y: 82, w: 18, h: 10, label: 'Save' },
        },
      ],
    },
    {
      id: 'rms-order-template',
      title: 'Build an order template',
      summary: 'Save a reusable set of vendor lines for recurring orders.',
      durationLabel: '~25 sec',
      whereInApp: 'Revenue Management → Operation → Order Template',
      clipFile: 'rms-order-template.webm',
      steps: [
        {
          title: 'Open Order Template',
          detail: 'Navigate to Operation → Order → Order Template.',
          hotspot: { x: 8, y: 54, w: 18, h: 8, label: 'Templates' },
        },
        {
          title: 'Compose the template',
          detail: 'Name it, add the usual products/quantities, and save.',
          hotspot: { x: 30, y: 28, w: 55, h: 40, label: 'Template' },
        },
        {
          title: 'Use from My Order',
          detail: 'Later, load the template in My Order to prefill the cart.',
          hotspot: { x: 30, y: 70, w: 40, h: 10, label: 'Load template' },
        },
      ],
    },
  ],
};
