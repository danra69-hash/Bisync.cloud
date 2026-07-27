import { useIsFetching } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useLocationFilter } from '../auth/LocationProvider'
import { MillstoneLoader } from './MillstoneLoader'

/**
 * Shows the millstone while auth/location bootstrap or first-load queries run.
 * Skips background refetch (status already success) so qty steppers don’t flicker.
 * Overlay uses pointer-events: none in CSS so it never blocks +/- clicks.
 * Hidden on public share/document routes.
 */
export function GlobalLoadingOverlay() {
  const location = useLocation()
  const isPublicDocument =
    location.pathname.startsWith('/share/po') ||
    location.pathname.startsWith('/s/')

  const { loading: authLoading } = useAuth()
  const { loading: locationsLoading } = useLocationFilter()

  const pendingFirstLoad = useIsFetching({
    predicate: (query) =>
      query.state.status === 'pending' &&
      query.state.fetchStatus === 'fetching',
  })

  const busy =
    !isPublicDocument &&
    (authLoading || locationsLoading || pendingFirstLoad > 0)

  if (!busy) return null

  return <MillstoneLoader overlay label="Loading…" />
}
