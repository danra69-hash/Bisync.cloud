import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ModeProvider, usePosMode } from '../core/modes/ModeProvider'
import { ConfigProvider } from '../core/config/ConfigProvider'
import type { PosMode } from '../core/modes/types'
import { HomeBar } from './HomeBar'
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

function AppShellInner({ children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  useModeFromPath()

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
      <HomeBar />
      <TopBar
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
      />
      <div className="app-shell__body">
        <div className="app-shell__main">{children}</div>
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
