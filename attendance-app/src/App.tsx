import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import {
  canCreateOperatorOrder,
  canCreateSalesOrder,
  canViewStockHub,
  canViewVendorOrders,
} from './auth/permissions'
import { isClockProduct } from './clockMode'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { Shell, type NavItem } from './components/Shell'
import { MillstoneLoader } from './components/MillstoneLoader'
import { LoginPage } from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { EnrollBiometricPage } from './pages/EnrollBiometricPage'
import { ProfilePage } from './pages/ProfilePage'
import { SharePoPage } from './pages/SharePoPage'
import { OperatorHomePage } from './pages/operator/HomePage'
import { OperatorOrderDetailPage } from './pages/operator/OrderDetailPage'
import { OperatorNewOrderPage } from './pages/operator/NewOrderPage'
import { OperatorStockHubPage } from './pages/operator/StockHubPage'
import { OperatorStockPage } from './pages/operator/StockPage'
import { OperatorStockDetailPage } from './pages/operator/StockDetailPage'
import { OperatorStockNewPage } from './pages/operator/StockNewPage'
import { OperatorWastagePage } from './pages/operator/WastagePage'
import { OperatorWastageDetailPage } from './pages/operator/WastageDetailPage'
import { OperatorTransferPage } from './pages/operator/TransferPage'
import { OperatorTransferDetailPage } from './pages/operator/TransferDetailPage'
import { VendorHomePage } from './pages/vendor/HomePage'
import { VendorOrderDetailPage } from './pages/vendor/OrderDetailPage'
import { VendorNewOrderPage } from './pages/vendor/NewOrderPage'
import { SalesOrderReviewPage } from './pages/vendor/SalesOrderReviewPage'
import { ManualOrderLookupPage } from './pages/vendor/ManualOrderLookupPage'
import { NotifyRedirectPage } from './pages/NotifyRedirectPage'
import { ClockPage } from './pages/attendance/ClockPage'

function RoleHomeRedirect() {
  const { usageRole, loading } = useAuth()
  if (loading) {
    return (
      <div className="page-center">
        <MillstoneLoader label="Loading…" />
      </div>
    )
  }
  if (isClockProduct()) {
    return <Navigate to="/clock" replace />
  }
  return <Navigate to={usageRole === 'vendor' ? '/vendor' : '/operator'} replace />
}

function AppShell() {
  const { usageRole, hasPermission } = useAuth()

  if (isClockProduct()) {
    return (
      <Shell
        nav={[{ to: '/clock', label: 'Clock', icon: 'clock' }]}
        attendanceLocal
      />
    )
  }

  const operatorNav: NavItem[] = [
    { to: '/operator', label: 'Home', icon: 'home' },
    { to: '/clock', label: 'Clock', icon: 'clock' },
    ...(canCreateOperatorOrder(hasPermission)
      ? [{ to: '/operator/new-order', label: 'New Order', icon: 'newOrder' as const }]
      : []),
    ...(canViewStockHub(hasPermission)
      ? [{ to: '/operator/stock', label: 'Stock', icon: 'stock' as const }]
      : []),
  ]

  const vendorNav: NavItem[] = [
    { to: '/vendor', label: 'Home', icon: 'home' },
    { to: '/clock', label: 'Clock', icon: 'clock' },
    ...(canCreateSalesOrder(hasPermission)
      ? [{ to: '/vendor/new-order', label: 'New Sales Order', icon: 'sales' as const }]
      : []),
    ...(canViewVendorOrders(hasPermission)
      ? [{ to: '/vendor/lookup', label: 'Lookup', icon: 'lookup' as const }]
      : []),
  ]

  return <Shell nav={usageRole === 'vendor' ? vendorNav : operatorNav} />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/enroll-biometric" element={<EnrollBiometricPage />} />
      {/* Public printable PO / sales document (WhatsApp / Create PDF link) */}
      <Route path="/share/po" element={<SharePoPage />} />
      <Route path="/s/:id" element={<SharePoPage />} />
      {/* FCM notification deep link — works before / after login */}
      <Route path="/notify" element={<NotifyRedirectPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<RoleHomeRedirect />} />

        <Route element={<AppShell />}>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="clock" element={<ClockPage />} />

          {isClockProduct() ? (
            <>
              <Route path="operator/*" element={<Navigate to="/clock" replace />} />
              <Route path="vendor/*" element={<Navigate to="/clock" replace />} />
            </>
          ) : (
            <>
              <Route path="operator" element={<OperatorHomePage />} />
              <Route path="operator/orders/:id" element={<OperatorOrderDetailPage />} />
              <Route path="operator/new-order" element={<OperatorNewOrderPage />} />
              <Route path="operator/stock" element={<OperatorStockHubPage />} />
              <Route path="operator/stock/wastage" element={<OperatorWastagePage />} />
              <Route
                path="operator/stock/wastage/:id"
                element={<OperatorWastageDetailPage />}
              />
              <Route path="operator/stock/transfer" element={<OperatorTransferPage />} />
              <Route
                path="operator/stock/transfer/:id"
                element={<OperatorTransferDetailPage />}
              />
              <Route path="operator/stock/inventory" element={<OperatorStockPage />} />
              <Route path="operator/stock/new" element={<OperatorStockNewPage />} />
              <Route path="operator/stock/:id" element={<OperatorStockDetailPage />} />

              <Route path="vendor" element={<VendorHomePage />} />
              <Route path="vendor/orders/:id" element={<VendorOrderDetailPage />} />
              <Route path="vendor/new-order" element={<VendorNewOrderPage />} />
              <Route path="vendor/new-order/review" element={<SalesOrderReviewPage />} />
              <Route path="vendor/lookup" element={<ManualOrderLookupPage />} />
            </>
          )}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
