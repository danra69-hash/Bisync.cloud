import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ModeProvider, usePosMode } from '../core/modes/ModeProvider'
import { ConfigProvider } from '../core/config/ConfigProvider'
import type { PosMode } from '../core/modes/types'
import { FloorSideNav } from '../features/order/ui/FloorSideNav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import './AppShell.css'

type Props = {
  children: ReactNode
}

export function AppShell({ children }: Props) {
  return (
    <ModeProvider>
      <ConfigProvider>
        <AppShellInner>{children}</AppShellInner>
      </ConfigProvider>
    </ModeProvider>
  )
}

function showsHomeSideNav(pathname: string): boolean {
  // Register and customer display stay full-bleed. Home rail stays on floor,
  // waitlist/reservations, and other BOH pages including EOD.
  if (pathname.startsWith('/order/register')) return false
  if (pathname.startsWith('/boh/cds')) return false
  if (pathname.startsWith('/order/floor')) return true
  if (pathname.startsWith('/order/reservations')) return true
  if (pathname.startsWith('/order/waitlist')) return true
  if (pathname.startsWith('/boh')) return true
  return pathname === '/order' || pathname === '/'
}

function AppShellInner({ children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  useModeFromPath()
  const homeNav = showsHomeSideNav(pathname)

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className={`app-shell${menuOpen ? ' is-menu-open' : ''}`}>
      <TopBar />
      <div className={`app-shell__body${homeNav ? ' has-home-nav' : ''}`}>
        <div className="app-shell__main">{children}</div>
        {homeNav ? (
          <FloorSideNav
            adminOpen={menuOpen}
            onToggleAdmin={() => setMenuOpen(open => !open)}
          />
        ) : null}
      </div>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}

function useModeFromPath() {
  const { pathname } = useLocation()
  const { mode, setMode } = usePosMode()

  useEffect(() => {
    const next: PosMode | null = pathname.startsWith('/cashier')
      ? 'cashier'
      : pathname.startsWith('/kiosk')
        ? 'kiosk'
        : pathname.startsWith('/boh')
          ? 'boh'
          : pathname.startsWith('/order')
            ? 'order'
            : null
    if (next && next !== mode) setMode(next)
  }, [pathname, mode, setMode])
}
