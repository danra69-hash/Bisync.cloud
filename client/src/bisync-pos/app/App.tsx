import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { RegisterPage } from '../features/register/ui/RegisterPage'
import { FloorPlanPage } from '../features/order/ui/FloorPlanPage'
import { FeaturePage } from '../features/common/FeaturePage'
import {
  CashierCheckoutPage,
  DispatchPage,
  DrawerPage,
  SplitCheckPage,
  TipsPage,
  VoidsPage,
} from '../features/cashier/ui/CashierPages'
import {
  BohSettingsPage,
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

/** Bisync POS shell for embed in Bisync.cloud (MemoryRouter — no URL takeover). */
export function BisyncPosApp() {
  return (
    <MemoryRouter initialEntries={['/order/floor']}>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/order/floor" replace />} />

          <Route path="/order" element={<Navigate to="/order/floor" replace />} />
          <Route path="/order/floor" element={<FloorPlanPage />} />
          <Route path="/order/floor/edit" element={<FloorPlanPage />} />
          <Route path="/order/register" element={<RegisterPage />} />
          <Route
            path="/order/reservations"
            element={
              <FeaturePage
                crumb="Order / Reservations"
                title="Reservations"
                subtitle="Assign parties to tables and hand off to seated service."
              >
                <div className="panel-grid">
                  <div className="panel-card">
                    <h3>Tonight · 7:30</h3>
                    <p>Chen party of 4 — waiting for T6</p>
                  </div>
                  <div className="panel-card">
                    <h3>Tonight · 8:00</h3>
                    <p>Patel party of 2 — confirmed</p>
                  </div>
                </div>
              </FeaturePage>
            }
          />

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
          <Route path="/boh/routing" element={<RoutingPage />} />
          <Route path="/boh/time-clock" element={<TimeClockPage />} />
          <Route path="/boh/reports" element={<ReportsPage />} />
          <Route path="/boh/permissions" element={<PermissionsPage />} />
          <Route path="/boh/eod" element={<EodPage />} />
          <Route path="/boh/settings" element={<BohSettingsPage />} />

          <Route path="*" element={<Navigate to="/order/floor" replace />} />
        </Routes>
      </AppShell>
    </MemoryRouter>
  )
}

export default BisyncPosApp
