import type { Bisync101Module } from '../types';

export const rmsCatalogModule: Bisync101Module = {
  id: 'rms-catalog',
  title: 'RMS · Catalog, Vendors & Sales',
  blurb: 'Components, vendors, products, customers, sales orders, and operational reports.',
  icon: 'package',
  tasks: [
    {
      id: 'rms-create-component',
      title: 'Create a component (ingredient)',
      summary: 'Add a unique component under the company with UOM, group, and identity rules.',
      durationLabel: '~40 sec',
      whereInApp: 'Revenue Management → Component → My Component',
      clipFile: 'rms-create-component.webm',
      steps: [
        {
          title: 'Open My Component',
          detail: 'Go to Component → My Component (ingredient).',
          hotspot: { x: 8, y: 22, w: 20, h: 8, label: 'Components' },
        },
        {
          title: 'New component',
          detail: 'Click New. Enter a normalized name (letters, digits, spaces, hyphen). Names are unique per company.',
          hotspot: { x: 55, y: 26, w: 40, h: 40, label: 'Edit panel' },
        },
        {
          title: 'Component ID',
          detail: 'The API assigns `{COMPANY}-{XXXX}` (e.g. BISY-A001). Treat it as immutable after create.',
          hotspot: { x: 55, y: 30, w: 40, h: 10, label: 'Component ID' },
        },
        {
          title: 'Save',
          detail: 'Save so the component is available for recipes, POs, and inventory.',
          hotspot: { x: 78, y: 88, w: 14, h: 8, label: 'Save' },
        },
      ],
      tips: ['Configure UOM hierarchy under Component Config before complex ordering.'],
    },
    {
      id: 'rms-component-config',
      title: 'Configure component UOM & hierarchy',
      summary: 'Set delivery / recipe / inventory units and groups.',
      durationLabel: '~30 sec',
      whereInApp: 'Revenue Management → Component → Component Config',
      clipFile: 'rms-component-config.webm',
      steps: [
        {
          title: 'Open Component Config',
          detail: 'Navigate to Component → Component Config.',
          hotspot: { x: 8, y: 30, w: 20, h: 8, label: 'Config' },
        },
        {
          title: 'Maintain UOM lists',
          detail: 'Add or remove My UOM options and hierarchy groups used across the company.',
          hotspot: { x: 28, y: 26, w: 60, h: 45, label: 'UOM / groups' },
        },
        {
          title: 'Save changes',
          detail: 'Persist so order and recipe screens pick up the new units.',
          hotspot: { x: 78, y: 88, w: 14, h: 8, label: 'Save' },
        },
      ],
    },
    {
      id: 'rms-vendor-products',
      title: 'Maintain vendors and vendor products',
      summary: 'Engage vendors, set delivery days, and manage product prices.',
      durationLabel: '~40 sec',
      whereInApp: 'Revenue Management → Vendors → Vendor List & Products',
      clipFile: 'rms-vendor-products.webm',
      steps: [
        {
          title: 'Open Vendor List',
          detail: 'Go to Vendors → Vendor List & Products.',
          hotspot: { x: 8, y: 22, w: 20, h: 8, label: 'Vendors' },
        },
        {
          title: 'Create or open a vendor',
          detail: 'Add vendor profile, policy tag (e.g. halal), and engaged locations.',
          hotspot: { x: 55, y: 26, w: 40, h: 35, label: 'Vendor' },
        },
        {
          title: 'Manage products',
          detail: 'Open vendor products to set delivery packages, prices, and component links.',
          hotspot: { x: 55, y: 55, w: 40, h: 25, label: 'Products' },
        },
      ],
    },
    {
      id: 'rms-compare-price',
      title: 'Compare vendor prices',
      summary: 'Side-by-side price comparison before ordering.',
      durationLabel: '~20 sec',
      whereInApp: 'Revenue Management → Vendors → Compare Price',
      clipFile: 'rms-compare-price.webm',
      steps: [
        {
          title: 'Open Compare Price',
          detail: 'Under Vendors, open Compare Price.',
          hotspot: { x: 8, y: 30, w: 20, h: 8, label: 'Compare' },
        },
        {
          title: 'Select item / vendors',
          detail: 'Pick the component or product and review competing delivery prices.',
          hotspot: { x: 28, y: 26, w: 60, h: 45, label: 'Comparison' },
        },
      ],
    },
    {
      id: 'rms-products',
      title: 'Maintain sellable products & recipes',
      summary: 'Create menu/B2B products and attach component recipes.',
      durationLabel: '~40 sec',
      whereInApp: 'Revenue Management → Products',
      clipFile: 'rms-products.webm',
      steps: [
        {
          title: 'Open Products',
          detail: 'Go to Products → Products.',
          hotspot: { x: 8, y: 22, w: 18, h: 8, label: 'Products' },
        },
        {
          title: 'Edit product',
          detail: 'Set name, category, and sellable flags. Open recipe to attach components and quantities.',
          hotspot: { x: 55, y: 26, w: 40, h: 45, label: 'Product detail' },
        },
        {
          title: 'Save',
          detail: 'Save so POS/menu and production can use the product.',
          hotspot: { x: 78, y: 88, w: 14, h: 8, label: 'Save' },
        },
      ],
    },
    {
      id: 'rms-sales-order',
      title: 'Create a sales order',
      summary: 'Sell to a B2B customer from a production/CK location.',
      durationLabel: '~40 sec',
      whereInApp: 'Revenue Management → Sales → Sales Order',
      clipFile: 'rms-sales-order.webm',
      steps: [
        {
          title: 'Open Sales Order',
          detail: 'Go to Sales → Sales Order (visible for supply-side business types).',
          hotspot: { x: 8, y: 22, w: 18, h: 8, label: 'Sales Order' },
        },
        {
          title: 'Pick customer & lines',
          detail: 'Select customer, production location, products/promotions, and quantities.',
          hotspot: { x: 28, y: 26, w: 60, h: 45, label: 'SO cart' },
        },
        {
          title: 'Submit & share',
          detail: 'Submit the SO and share the portal/PDF with the customer as needed.',
          hotspot: { x: 72, y: 82, w: 18, h: 10, label: 'Submit' },
        },
      ],
    },
    {
      id: 'rms-customer-list',
      title: 'Maintain B2B customers',
      summary: 'Create customers and contacts used on sales orders.',
      durationLabel: '~25 sec',
      whereInApp: 'Revenue Management → Sales → Customer List',
      clipFile: 'rms-customer-list.webm',
      steps: [
        {
          title: 'Open Customer List',
          detail: 'Navigate to Sales → Customer List.',
          hotspot: { x: 8, y: 30, w: 18, h: 8, label: 'Customers' },
        },
        {
          title: 'Add customer',
          detail: 'Enter company name, address, BRN, and default contacts.',
          hotspot: { x: 55, y: 28, w: 40, h: 40, label: 'Customer' },
        },
        {
          title: 'Save',
          detail: 'Save so the customer appears in Sales Order.',
          hotspot: { x: 78, y: 88, w: 14, h: 8, label: 'Save' },
        },
      ],
    },
    {
      id: 'rms-reports',
      title: 'Run an RMS report',
      summary: 'Export operational reports such as purchase summary or COGS audit.',
      durationLabel: '~25 sec',
      whereInApp: 'Revenue Management → Reports',
      clipFile: 'rms-reports.webm',
      steps: [
        {
          title: 'Open Reports',
          detail: 'In the RMS sidebar, open Reports and pick a report (e.g. Detailed Purchase Summary, COGS Audit).',
          hotspot: { x: 8, y: 70, w: 18, h: 8, label: 'Reports' },
        },
        {
          title: 'Set filters',
          detail: 'Choose company, locations, and date range.',
          hotspot: { x: 28, y: 16, w: 60, h: 12, label: 'Filters' },
        },
        {
          title: 'Run / export',
          detail: 'Generate the grid and download PDF/Excel when offered.',
          hotspot: { x: 72, y: 16, w: 18, h: 10, label: 'Export' },
        },
      ],
    },
  ],
};
