import type { NavItem } from './revenueManagement'

/** Path ↔ shell nav mapping for deep links (e.g. /hr → Human Resources). */
const NAV_PATHS: Array<{ path: string; nav: NavItem }> = [
  { path: '/hr', nav: 'Human Resources' },
  { path: '/human-resources', nav: 'Human Resources' },
  { path: '/revenue', nav: 'Revenue Management' },
  { path: '/rms', nav: 'Revenue Management' },
  { path: '/pos', nav: 'Point-of-Sales' },
  { path: '/point-of-sales', nav: 'Point-of-Sales' },
  { path: '/accounting', nav: 'Accounting' },
  { path: '/admin/system-configuration', nav: 'System Configuration' },
  { path: '/system-configuration', nav: 'System Configuration' },
  { path: '/', nav: 'Home' },
  { path: '/home', nav: 'Home' },
]

export function navItemFromPath(pathname: string): NavItem | null {
  const normalized = (pathname.replace(/\/+$/, '') || '/').toLowerCase()
  const hit = NAV_PATHS.find(row => row.path === normalized)
  return hit?.nav ?? null
}

export function pathFromNavItem(nav: NavItem): string {
  const hit = NAV_PATHS.find(row => row.nav === nav && row.path !== '/home')
  if (hit) return hit.path === '/' ? '/' : hit.path
  return '/'
}
