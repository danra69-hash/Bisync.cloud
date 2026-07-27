import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { MillstoneLoader } from '../components/MillstoneLoader'

/**
 * Deep link from FCM notification taps.
 * Routes to the right order screen once authenticated (Flutter uses Id + Status).
 */
export function NotifyRedirectPage() {
  const { session, loading, usageRole } = useAuth()
  const [params] = useSearchParams()
  const id = params.get('id')
  const status = params.get('status')

  if (loading) {
    return (
      <div className="page-center">
        <MillstoneLoader label="Opening notification…" />
      </div>
    )
  }

  if (!session?.access_token) {
    const search = params.toString()
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: { pathname: '/notify', search: search ? `?${search}` : '' } }}
      />
    )
  }

  if (!id) {
    return (
      <Navigate
        to={usageRole === 'vendor' ? '/vendor' : '/operator'}
        replace
      />
    )
  }

  // Vendor statuses / vendor session → vendor order; otherwise operator detail.
  const vendorish =
    usageRole === 'vendor' ||
    status === 'PendingVendorReview' ||
    status === 'VendorApproved' ||
    status === 'WaitingForAccepted'

  if (vendorish && usageRole === 'vendor') {
    return <Navigate to={`/vendor/orders/${id}`} replace />
  }

  return <Navigate to={`/operator/orders/${id}`} replace />
}
