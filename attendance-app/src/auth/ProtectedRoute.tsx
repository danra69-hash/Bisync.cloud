import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { MillstoneLoader } from '../components/MillstoneLoader'

export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="page-center">
        <MillstoneLoader label="Loading session…" />
      </div>
    )
  }

  if (!session?.access_token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
