import type { ReactNode } from 'react'
import type { PosMode } from './types'

export type NavItem = {
  to: string
  label: string
  end?: boolean
  badge?: string
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

export const MODE_NAV: Record<PosMode, NavGroup[]> = {
  order: [
    {
      title: 'Service',
      items: [
        { to: '/order/register', label: 'Register', end: true },
        { to: '/order/floor', label: 'Floor Plan', end: true },
        { to: '/order/reservations', label: 'Reservations' },
      ],
    },
    {
      title: 'Setup',
      items: [
        { to: '/order/floor/edit', label: 'Edit Floor Plan' },
      ],
    },
  ],
  cashier: [
    {
      title: 'Front Counter',
      items: [
        { to: '/cashier', label: 'Checkout', end: true },
        { to: '/cashier/split', label: 'Split Check' },
        { to: '/cashier/tips', label: 'Tips & Gratuity' },
      ],
    },
    {
      title: 'Cash & Dispatch',
      items: [
        { to: '/cashier/drawer', label: 'Cash Drawer' },
        { to: '/cashier/dispatch', label: 'Takeout & Delivery' },
        { to: '/cashier/voids', label: 'Discounts & Voids' },
      ],
    },
  ],
  kiosk: [
    {
      title: 'Self Service',
      items: [
        { to: '/kiosk', label: 'Start Order', end: true },
        { to: '/kiosk/menu', label: 'Browse Menu' },
        { to: '/kiosk/pay', label: 'Pay' },
      ],
    },
  ],
  boh: [
    {
      title: 'Kitchen',
      items: [
        { to: '/boh/kds', label: 'Kitchen Display (KDS)', end: true },
        { to: '/boh/bds', label: 'Bar Display (BDS)' },
        { to: '/boh/cds', label: 'Customer Display (CDS)' },
        { to: '/boh/routing', label: 'Order Routing' },
      ],
    },
    {
      title: 'Management',
      items: [
        { to: '/boh/time-clock', label: 'Time Clock' },
        { to: '/boh/reports', label: 'Reports & Analytics' },
        { to: '/boh/permissions', label: 'User Permissions' },
        { to: '/boh/settings', label: 'Settings' },
      ],
    },
  ],
}

/** Icon keys resolved in Sidebar — keeps nav config serializable. */
export type NavIconKey =
  | 'order'
  | 'floor'
  | 'floorEdit'
  | 'calendar'
  | 'modifiers'
  | 'eightySix'
  | 'checkout'
  | 'split'
  | 'tips'
  | 'drawer'
  | 'dispatch'
  | 'voids'
  | 'kiosk'
  | 'kioskMenu'
  | 'kioskPay'
  | 'kds'
  | 'bds'
  | 'cds'
  | 'routing'
  | 'clock'
  | 'reports'
  | 'permissions'
  | 'settings'

export const NAV_ICONS: Record<string, NavIconKey> = {
  '/order/register': 'order',
  '/order/floor': 'floor',
  '/order/floor/edit': 'floorEdit',
  '/order/reservations': 'calendar',
  '/cashier': 'checkout',
  '/cashier/split': 'split',
  '/cashier/tips': 'tips',
  '/cashier/drawer': 'drawer',
  '/cashier/dispatch': 'dispatch',
  '/cashier/voids': 'voids',
  '/kiosk': 'kiosk',
  '/kiosk/menu': 'kioskMenu',
  '/kiosk/pay': 'kioskPay',
  '/boh/kds': 'kds',
  '/boh/bds': 'bds',
  '/boh/cds': 'cds',
  '/boh/routing': 'routing',
  '/boh/time-clock': 'clock',
  '/boh/reports': 'reports',
  '/boh/permissions': 'permissions',
  '/boh/settings': 'settings',
}

export type IconMap = Record<NavIconKey, ReactNode>
