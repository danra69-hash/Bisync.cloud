import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { useLocationFilter } from '../../auth/LocationProvider'
import {
  canApproveWastage,
  canViewOperatorOrders,
} from '../../auth/permissions'
import {
  listOperatorOrders,
  operatorStatusChips,
} from '../../api/operatorOrders'
import { listPendingWastage } from '../../api/wastage'
import { StatusChips } from '../../components/StatusChips'
import { OrderCard } from '../../components/OrderCard'
import { PermissionDenied } from '../../components/PermissionDenied'
import type { OrderSummary } from '../../types'

const DEFAULT_CHIP = operatorStatusChips[0].key

function isChipKey(value: string | null): value is string {
  return !!value && operatorStatusChips.some((c) => c.key === value)
}

function formatWastageAmount(raw?: string) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

function lineCountLabel(order: OrderSummary) {
  const raw = order.noOfProduct
  if (raw == null || String(raw).trim() === '') return undefined
  const n = Number(raw)
  if (Number.isFinite(n)) {
    return `${n} line item${n === 1 ? '' : 's'}`
  }
  return `${raw} line item(s)`
}

export function OperatorHomePage() {
  const { token, hasPermission } = useAuth()
  const { selectedLocationId } = useLocationFilter()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const changedStatus = searchParams.get('changed')
  const changedId = searchParams.get('id')

  const [chipKey, setChipKey] = useState<string>(() =>
    isChipKey(tabParam) ? tabParam : DEFAULT_CHIP,
  )
  const [statusBanner, setStatusBanner] = useState<string | null>(null)

  const canViewOrders = canViewOperatorOrders(hasPermission)
  const canSeeWastageApproval = canApproveWastage(hasPermission)

  // Keep chip in sync with ?tab= (used after Approve / Reject)
  useEffect(() => {
    if (isChipKey(tabParam) && tabParam !== chipKey) {
      setChipKey(tabParam)
    }
  }, [tabParam, chipKey])

  useEffect(() => {
    if (!changedStatus) return
    const tabLabel =
      tabParam === 'received'
        ? 'Received'
        : tabParam === 'consolidated'
          ? 'Consolidated'
          : tabParam === 'active'
            ? 'Active PO'
            : tabParam === 'toApprove'
              ? 'To Approve'
              : 'orders'
    setStatusBanner(
      changedId
        ? `PO #${changedId} · ${changedStatus} · ${tabLabel}`
        : `${changedStatus} · ${tabLabel}`,
    )
    const next = new URLSearchParams(searchParams)
    next.delete('changed')
    next.delete('id')
    setSearchParams(next, { replace: true })
  }, [changedStatus, changedId, tabParam, searchParams, setSearchParams])

  const statuses = useMemo(
    () => operatorStatusChips.find((c) => c.key === chipKey)?.statuses || [],
    [chipKey],
  )

  const query = useQuery({
    queryKey: ['operator-orders', chipKey, token, selectedLocationId],
    enabled: !!token && canViewOrders,
    staleTime: 30_000,
    refetchOnMount: true,
    queryFn: async () => {
      const result = await listOperatorOrders(token!, [...statuses], 1, 50)

      const byCreatedOn = <T extends OrderSummary>(
        orders: T[],
        direction: 'oldest' | 'newest',
      ) =>
        [...orders].sort((a, b) => {
          const aTime = Date.parse(a.createdOn || '') || 0
          const bTime = Date.parse(b.createdOn || '') || 0
          if (aTime !== bTime) {
            return direction === 'oldest' ? aTime - bTime : bTime - aTime
          }
          return direction === 'oldest' ? a.id - b.id : b.id - a.id
        })

      // To Approve: oldest first (work queue). Active/Received/etc: newest first
      // so a just-approved PO appears at the top of Active PO.
      const direction = chipKey === 'toApprove' ? 'oldest' : 'newest'

      let orders = byCreatedOn(result.orders, direction)

      // After Approve/Receive, pin the moved PO to the top even if the list API
      // is briefly stale or the PO falls outside the first page.
      const pin = qc.getQueryData<OrderSummary>([
        'operator-orders-pin',
        chipKey,
      ])
      if (
        pin &&
        (chipKey === 'active' ||
          chipKey === 'received' ||
          chipKey === 'consolidated')
      ) {
        orders = [pin, ...orders.filter((o) => o.id !== pin.id)]
        qc.removeQueries({ queryKey: ['operator-orders-pin', chipKey] })
      }

      return { ...result, orders }
    },
  })

  const pendingWastage = useQuery({
    queryKey: ['wastage-pending-approvals', token, selectedLocationId],
    enabled:
      !!token &&
      canSeeWastageApproval &&
      (chipKey === 'toApprove' || !canViewOrders),
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => listPendingWastage(token!, selectedLocationId),
  })

  function selectChip(key: string) {
    setStatusBanner(null)
    setChipKey(key)
    if (key === DEFAULT_CHIP) {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ tab: key }, { replace: true })
    }
  }

  const orders = query.data?.orders || []
  const wastageRows = pendingWastage.data || []
  const emptyToApprove =
    chipKey === 'toApprove' &&
    !query.isLoading &&
    !(canSeeWastageApproval && pendingWastage.isLoading) &&
    orders.length === 0 &&
    wastageRows.length === 0

  return (
    <div className="stack">
      <div>
        <h2 style={{ margin: '0 0 4px' }}>Orders</h2>
        <p className="muted" style={{ margin: 0 }}>
          Operator purchase pipeline
        </p>
      </div>

      {!canViewOrders && !canSeeWastageApproval ? (
        <PermissionDenied
          title="Orders unavailable"
          message="Your account does not have order list or approval permissions."
        />
      ) : (
        <>
      {statusBanner && (
        <p className="muted" style={{ margin: 0 }}>
          {statusBanner}
        </p>
      )}

      {canViewOrders && (
      <StatusChips
        chips={operatorStatusChips}
        activeKey={chipKey}
        onChange={selectChip}
      />
      )}

      {!canViewOrders && canSeeWastageApproval && (
        <p className="muted" style={{ margin: 0 }}>
          Purchase order list is hidden — showing wastage approvals only.
        </p>
      )}

      {chipKey === 'toApprove' && (
        <p className="muted" style={{ margin: 0 }}>
          Oldest POs and pending wastage are listed for approval.
        </p>
      )}

      {query.isLoading && <p className="muted">Loading orders…</p>}
      {query.isError && (
        <p className="error-text">
          {(query.error as Error).message || 'Failed to load orders'}
        </p>
      )}

      {(chipKey === 'toApprove' || !canViewOrders) && canSeeWastageApproval && (
        <div className="stack" style={{ gap: 8 }}>
          <strong style={{ fontSize: '0.92rem' }}>Wastage to approve</strong>
          {pendingWastage.isLoading && (
            <p className="muted" style={{ margin: 0 }}>
              Loading wastage…
            </p>
          )}
          {pendingWastage.isError && (
            <p className="error-text" style={{ margin: 0 }}>
              {(pendingWastage.error as Error).message ||
                'Failed to load pending wastage'}
            </p>
          )}
          <div className="order-list">
            {wastageRows.map((row) => (
              <article
                key={`wastage-${row.id}`}
                className="card order-card"
                onClick={() =>
                  navigate(`/operator/stock/wastage/${row.id}`, {
                    state: { fromToApprove: true },
                  })
                }
              >
                <div className="order-card-row">
                  <strong>Wastage #{row.id}</strong>
                  <span className="badge">{row.status || 'Pending'}</span>
                </div>
                <div className="muted" style={{ fontSize: '11px', marginTop: 2 }}>
                  {row.reason
                    ? `Reason: ${row.reason}`
                    : 'Needs wastage approval'}
                </div>
                <div className="order-card-row muted">
                  <span>{row.createdBy || '—'}</span>
                  <span>{row.roleCode || ''}</span>
                </div>
                <div className="order-card-row">
                  <span className="muted">{row.date || ''}</span>
                  <strong>{formatWastageAmount(row.amount)}</strong>
                </div>
              </article>
            ))}
          </div>
          {!pendingWastage.isLoading && wastageRows.length === 0 && (
            <p className="muted" style={{ margin: 0 }}>
              No pending wastage.
            </p>
          )}
        </div>
      )}

      {chipKey === 'toApprove' && canViewOrders && (
        <strong style={{ fontSize: '0.92rem' }}>Purchase orders</strong>
      )}

      {canViewOrders && (
      <div className="order-list">
        {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              subtitle={
                chipKey === 'toApprove' ? lineCountLabel(order) : undefined
              }
              onClick={() =>
                navigate(`/operator/orders/${order.id}`, { state: { order } })
              }
            />
        ))}
      </div>
      )}

      {emptyToApprove && (
        <p className="muted">Nothing waiting for approval.</p>
      )}
      {canViewOrders &&
        chipKey !== 'toApprove' &&
        !query.isLoading &&
        orders.length === 0 && (
        <p className="muted">No orders in this status.</p>
      )}
        </>
      )}
    </div>
  )
}
