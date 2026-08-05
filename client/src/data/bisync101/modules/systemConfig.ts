import type { Bisync101Module } from '../types';

export const systemConfigModule: Bisync101Module = {
  id: 'system-config',
  title: 'System Configuration',
  blurb: 'Companies, locations, logos, access rights, and audit trail for the platform.',
  icon: 'settings',
  tasks: [
    {
      id: 'sc-create-company',
      title: 'Create or edit a company',
      summary: 'Maintain the legal entity, address, logo, modules, and outbound email.',
      durationLabel: '~40 sec',
      whereInApp: 'System Configuration → Companies',
      clipFile: 'sc-create-company.webm',
      steps: [
        {
          title: 'Open Companies',
          detail: 'Go to System Configuration and open the Companies tab.',
          hotspot: { x: 8, y: 18, w: 18, h: 8, label: 'Companies' },
        },
        {
          title: 'Add or open a company',
          detail: 'Click New Company, or click a row to open the detail panel.',
          hotspot: { x: 78, y: 16, w: 14, h: 8, label: 'New' },
        },
        {
          title: 'Fill identity & address',
          detail: 'Enter company name, BRN/GST as required, country, and address fields.',
          hotspot: { x: 55, y: 28, w: 40, h: 30, label: 'Profile' },
        },
        {
          title: 'Upload company logo',
          detail: 'Use Company Logo (PNG/JPEG/WebP/GIF/SVG up to 1 MB). This logo appears on purchase-order PDFs.',
          hotspot: { x: 55, y: 38, w: 40, h: 16, label: 'Logo' },
        },
        {
          title: 'Save',
          detail: 'Save the panel. The company appears in the header Company dropdown for entitled users.',
          hotspot: { x: 78, y: 88, w: 14, h: 8, label: 'Save' },
        },
      ],
      tips: [
        'Company Code is assigned automatically and stays unique.',
        'Enable only the platform modules this company should use.',
      ],
    },
    {
      id: 'sc-create-location',
      title: 'Create a location (outlet)',
      summary: 'Add an operating site under a company, with contacts, hours, and optional location logo.',
      durationLabel: '~45 sec',
      whereInApp: 'System Configuration → Locations',
      clipFile: 'sc-create-location.webm',
      steps: [
        {
          title: 'Open Locations',
          detail: 'In System Configuration, open the Locations tab.',
          hotspot: { x: 8, y: 26, w: 18, h: 8, label: 'Locations' },
        },
        {
          title: 'New Location',
          detail: 'Click New Location. Select the parent company first.',
          hotspot: { x: 78, y: 16, w: 14, h: 8, label: 'New' },
        },
        {
          title: 'Address & contacts',
          detail: 'Enter name, address, principal contact, and optional secondary contact.',
          hotspot: { x: 55, y: 30, w: 40, h: 28, label: 'Details' },
        },
        {
          title: 'Optional location logo',
          detail: 'Upload a Location Logo when this brand mark differs from the company logo (used on PO PDFs for that outlet).',
          hotspot: { x: 55, y: 42, w: 40, h: 14, label: 'Location logo' },
        },
        {
          title: 'Opening hours & save',
          detail: 'Set opening hours / delivery windows if needed, then Save.',
          hotspot: { x: 78, y: 88, w: 14, h: 8, label: 'Save' },
        },
      ],
    },
    {
      id: 'sc-access-control',
      title: 'Grant user access',
      summary: 'Create users and assign company/location access and module rights.',
      durationLabel: '~40 sec',
      whereInApp: 'System Configuration → Access Control',
      clipFile: 'sc-access-control.webm',
      steps: [
        {
          title: 'Open Access Control',
          detail: 'Select the Access Control tab under System Configuration.',
          hotspot: { x: 8, y: 34, w: 18, h: 8, label: 'Access' },
        },
        {
          title: 'Invite or edit a user',
          detail: 'Add a user with email, role, and linked company. Assign location IDs they may operate.',
          hotspot: { x: 55, y: 28, w: 40, h: 36, label: 'User panel' },
        },
        {
          title: 'Save access',
          detail: 'Save so the user can activate (if new) and see only permitted modules and outlets.',
          hotspot: { x: 78, y: 88, w: 14, h: 8, label: 'Save' },
        },
      ],
      tips: ['Least privilege: grant only the locations and modules each person needs.'],
    },
    {
      id: 'sc-audit-trail',
      title: 'Review the audit trail',
      summary: 'Inspect who changed configuration and operational records.',
      durationLabel: '~20 sec',
      whereInApp: 'System Configuration → Audit Trail',
      clipFile: 'sc-audit-trail.webm',
      steps: [
        {
          title: 'Open Audit Trail',
          detail: 'Open the Audit Trail tab.',
          hotspot: { x: 8, y: 42, w: 18, h: 8, label: 'Audit' },
        },
        {
          title: 'Filter events',
          detail: 'Filter by date, user, or entity type to find a change.',
          hotspot: { x: 30, y: 18, w: 50, h: 12, label: 'Filters' },
        },
        {
          title: 'Inspect a row',
          detail: 'Open a row to see before/after detail where available.',
          hotspot: { x: 30, y: 36, w: 60, h: 30, label: 'Events' },
        },
      ],
    },
  ],
};
