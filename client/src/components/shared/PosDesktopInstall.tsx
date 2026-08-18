/**
 * Desktop install / fullscreen chrome was removed from POS Test and /POS.
 * Kept as a no-op export so any stale import cannot resurface the toolbar.
 */
export function PosDesktopInstall(_props: {
  variant?: 'toolbar' | 'card'
  companyId?: number | null
  locationId?: string
  kioskMode?: boolean
  onKioskChange?: (active: boolean) => void
}) {
  return null
}
