import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePosSessionOptional } from '../../../core/session/PosSessionContext'
import {
  cancelQrOrder,
  fetchOpenQrOrders,
  notifyQrOrderChanged,
  QR_ORDER_CHANGED_EVENT,
  type PosQrOrder,
} from '../domain/qrOrder'
import { acceptQrOrderToStations } from '../domain/qrOrderStations'
import { IncomingQrOrderModal } from './IncomingQrOrderModal'

/**
 * Polls open guest QR orders and pops a review modal on the main POS screen.
 * Accept sends to Bar/Kitchen; Reject cancels. Skipped on the QR Order board
 * (that page has its own list actions).
 */
export function IncomingQrOrderHost() {
  const session = usePosSessionOptional()
  const { pathname } = useLocation()
  const companyId = session?.companyId ?? 0
  const locationId = session?.locationId ?? ''
  const boardOpen = pathname.startsWith('/boh/qr-order')

  const [orders, setOrders] = useState<PosQrOrder[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (companyId <= 0 || !locationId || boardOpen) {
      setOrders([])
      return
    }
    try {
      const rows = await fetchOpenQrOrders(companyId, locationId)
      setOrders(rows.slice().sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)))
    } catch {
      /* keep last good list while offline */
    }
  }, [companyId, locationId, boardOpen])

  useEffect(() => {
    void refresh()
    const onChange = () => void refresh()
    window.addEventListener(QR_ORDER_CHANGED_EVENT, onChange)
    window.addEventListener('storage', onChange)
    const poll = window.setInterval(() => void refresh(), 4000)
    return () => {
      window.removeEventListener(QR_ORDER_CHANGED_EVENT, onChange)
      window.removeEventListener('storage', onChange)
      window.clearInterval(poll)
    }
  }, [refresh])

  const active = useMemo(() => orders[0] ?? null, [orders])

  async function handleAccept() {
    if (!active || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await acceptQrOrderToStations(active)
      if (!result.ok) {
        setError(result.error || 'Could not accept order.')
        return
      }
      notifyQrOrderChanged()
      setOrders(prev => prev.filter(o => o.id !== active.id))
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleReject() {
    if (!active || busy) return
    setBusy(true)
    setError(null)
    try {
      await cancelQrOrder(active.id)
      notifyQrOrderChanged()
      setOrders(prev => prev.filter(o => o.id !== active.id))
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reject order.')
    } finally {
      setBusy(false)
    }
  }

  if (!active || boardOpen) return null

  return (
    <IncomingQrOrderModal
      order={active}
      queueCount={orders.length}
      busy={busy}
      error={error}
      onAccept={() => void handleAccept()}
      onReject={() => void handleReject()}
    />
  )
}
