import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { RegisterPage } from '../features/register/ui/RegisterPage'
import { FloorPlanPage } from '../features/order/ui/FloorPlanPage'
import {
  CashierCheckoutPage,
  DispatchPage,
  DrawerPage,
  SplitCheckPage,
  TipsPage,
  VoidsPage,
} from '../features/cashier/ui/CashierPages'
import {
  BdsPage,
  BohSettingsPage,
  CdsPage,
  EodPage,
  KdsPage,
  PermissionsPage,
  ReportsPage,
  RoutingPage,
  TimeClockPage,
} from '../features/boh/ui/BohPages'
import {
  KioskHomePage,
  KioskMenuPage,
  KioskPayPage,
} from '../features/kiosk/ui/KioskPages'

type Props = {
  /** Internal MemoryRouter start path (e.g. /order/floor, /boh/kds). */
  initialEntry?: string
}

/** Bisync POS shell for embed in Bisync.cloud (MemoryRouter — no URL takeover). */
export function BisyncPosApp({ initialEntry = '/order/floor' }: Props) {
  return (
    <MemoryRouter initialEntries={[initialEntry || '/order/floor']}>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/order/floor" replace />} />

          <Route path="/order" element={<Navigate to="/order/floor" replace />} />
          <Route path="/order/floor" element={<FloorPlanPage />} />
          <Route path="/order/floor/edit" element={<FloorPlanPage />} />
          <Route path="/order/register" element={<RegisterPage />} />
          {/* Reservations list lives in the home side rail below Home. */}
          <Route path="/order/reservations" element={<Navigate to="/order/floor" replace />} />
          {/* Waitlist list + join QR live in the home side rail. */}
          <Route path="/order/waitlist" element={<Navigate to="/order/floor" replace />} />

          <Route path="/cashier" element={<CashierCheckoutPage />} />
          <Route path="/cashier/split" element={<SplitCheckPage />} />
          <Route path="/cashier/tips" element={<TipsPage />} />
          <Route path="/cashier/drawer" element={<DrawerPage />} />
          <Route path="/cashier/dispatch" element={<DispatchPage />} />
          <Route path="/cashier/voids" element={<VoidsPage />} />

          <Route path="/kiosk" element={<KioskHomePage />} />
          <Route path="/kiosk/menu" element={<KioskMenuPage />} />
          <Route path="/kiosk/pay" element={<KioskPayPage />} />

          <Route path="/boh/kds" element={<KdsPage />} />
          <Route path="/boh/bds" element={<BdsPage />} />
          <Route path="/boh/cds" element={<CdsPage />} />
          <Route path="/boh/routing" element={<RoutingPage />} />
          <Route path="/boh/time-clock" element={<TimeClockPage />} />
          <Route path="/boh/reports" element={<ReportsPage />} />
          <Route path="/boh/permissions" element={<PermissionsPage />} />
          <Route path="/boh/eod" element={<EodPage />} />
          <Route path="/boh/settings" element={<BohSettingsPage />} />
          <Route path="/pos/setup" element={<Navigate to="/boh/settings" replace />} />

          <Route path="*" element={<Navigate to="/order/floor" replace />} />
        </Routes>
      </AppShell>
    </MemoryRouter>
  )
}

export default BisyncPosApp
