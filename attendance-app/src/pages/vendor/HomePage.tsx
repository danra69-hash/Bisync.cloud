import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { canViewVendorOrders } from '../../auth/permissions'
import { listVendorOrders, vendorStatusChips } from '../../api/vendorOrders'
import { StatusChips } from '../../components/StatusChips'
import { OrderCard } from '../../components/OrderCard'
import { PermissionDenied } from '../../components/PermissionDenied'

const DEFAULT_CHIP = vendorStatusChips[0].key

function isChipKey(value: string | null): value is string {
  return !!value && vendorStatusChips.some((c) => c.key === value)
}

export function VendorHomePage() {
  const { token, hasPermission } = useAuth()
  const canView = canViewVendorOrders(hasPermission)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const changedStatus = searchParams.get('changed')

  const [chipKey, setChipKey] = useState<string>(() =>
    isChipKey(tabParam) ? tabParam : DEFAULT_CHIP,
  )
  const [banner, setBanner] = useState<string | null>(null)

  useEffect(() => {
    if (isChipKey(tabParam) && tabParam !== chipKey) setChipKey(tabParam)
  }, [tabParam, chipKey])

  useEffect(() => {
    if (!changedStatus) return
    setBanner(changedStatus)
    const next = new URLSearchParams(searchParams)
    next.delete('changed')
    setSearchParams(next, { replace: true })
  }, [changedStatus, searchParams, setSearchParams])

  const statuses = useMemo(
    () => vendorStatusChips.find((c) => c.key === chipKey)?.statuses || [],
    [chipKey],
  )

  const query = useQuery({
    queryKey: ['vendor-orders', chipKey, token],
    enabled: !!token && canView,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => listVendorOrders(token!, [...statuses], 1, 50),
  })

  function selectChip(key: string) {
    setBanner(null)
    setChipKey(key)
    if (key === DEFAULT_CHIP) {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ tab: key }, { replace: true })
    }
  }

  return (
    <div className="stack">
      <div>
        <h2 style={{ margin: '0 0 4px' }}>Orders</h2>
        <p className="muted" style={{ margin: 0 }}>
          Vendor sales &amp; inbound Cloud customer POs
        </p>
      </div>

      {!canView ? (
        <PermissionDenied
          title="Orders unavailable"
          message="Vendor order view permission is required."
        />
      ) : (
        <>
      <StatusChips
        chips={vendorStatusChips}
        activeKey={chipKey}
        onChange={selectChip}
      />

      {banner && <p className="muted">{banner}</p>}

      {chipKey === 'new' && (
        <p className="muted" style={{ margin: 0 }}>
          <strong>To Approve</strong> needs internal approval.{' '}
          <strong>To Accept</strong> is waiting for the client (PDF link) or is
          an inbound Cloud customer PO.
        </p>
      )}
      {chipKey === 'active' && (
        <p className="muted" style={{ margin: 0 }}>
          Accepted sales orders and POs in progress.
        </p>
      )}
      {chipKey === 'delivered' && (
        <p className="muted" style={{ margin: 0 }}>
          Client has received the order.
        </p>
      )}

      {query.isLoading && <p className="muted">Loading orders…</p>}
      {query.isError && (
        <p className="error-text">
          {(query.error as Error).message || 'Failed to load orders'}
        </p>
      )}

      <div className="order-list">
        {(query.data || []).map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onClick={() => navigate(`/vendor/orders/${order.id}`)}
          />
        ))}
      </div>

      {!query.isLoading && (query.data || []).length === 0 && (
        <p className="muted">No orders in this status.</p>
      )}
        </>
      )}
    </div>
  )
}
