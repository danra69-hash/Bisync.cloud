import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  canApproveOperatorOrder,
  canCreateOperatorOrder,
  canViewVendorOrders,
} from '../auth/permissions'
import { useAuth } from '../auth/AuthProvider'
import {
  listOperatorOrders,
} from '../api/operatorOrders'
import {
  canVendorInternallyApprove,
  listVendorOrders,
} from '../api/vendorOrders'
import { showAppNotification } from '../push/showAppNotification'
import type { OrderSummary } from '../types'

type OrderNotice = {
  key: string
  title: string
  message: string
  to: string
  createdOn?: string
}

function normalized(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

function isCreatedByCurrentUser(order: OrderSummary, names: string[]) {
  const creator = normalized(order.createdBy)
  return !!creator && names.some((name) => normalized(name) === creator)
}

function orderLabel(order: OrderSummary) {
  return order.purchaseOrderNumber || `Order #${order.id}`
}

export function OrderNotificationBell() {
  const { token, usageRole, session, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const storageKey = `bisync_order_notice_read_${session?.username || 'account'}`
  const [readKeys, setReadKeys] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'))
    } catch {
      return new Set()
    }
  })
  const previousKeys = useRef<Set<string> | null>(null)

  const currentUserNames = useMemo(
    () => [session?.fullName || '', session?.username || ''].filter(Boolean),
    [session?.fullName, session?.username],
  )

  const canApprovePo = canApproveOperatorOrder(hasPermission)
  const canIssuePo = canCreateOperatorOrder(hasPermission)
  const canApproveSales = canVendorInternallyApprove(
    hasPermission,
    session?.roleName,
  )
  const canSeeSales = canViewVendorOrders(hasPermission)

  const notices = useQuery({
    queryKey: [
      'order-notices',
      usageRole,
      token,
      canApprovePo,
      canIssuePo,
      canApproveSales,
      session?.fullName,
    ],
    enabled: !!token,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<OrderNotice[]> => {
      if (usageRole === 'operator') {
        const statuses = [
          ...(canApprovePo ? ['Requested'] : []),
          ...(canIssuePo ? ['Approved'] : []),
        ]
        if (statuses.length === 0) return []

        const result = await listOperatorOrders(token!, statuses, 1, 50)
        return result.orders.flatMap((order) => {
          const status = normalized(order.status || order.orderStatus)
          if (status === 'requested' && canApprovePo) {
            return [{
              key: `operator:${order.id}:requested`,
              title: 'Purchase order needs approval',
              message: `${orderLabel(order)} was submitted by ${order.createdBy || 'a user'}.`,
              to: `/operator/orders/${order.id}`,
              createdOn: order.createdOn,
            }]
          }
          if (
            status === 'approved' &&
            canIssuePo &&
            isCreatedByCurrentUser(order, currentUserNames)
          ) {
            return [{
              key: `operator:${order.id}:approved`,
              title: 'Purchase order approved',
              message: `${orderLabel(order)} is ready to Issue, Copy link, or WhatsApp the vendor.`,
              to: `/operator/orders/${order.id}`,
              createdOn: order.createdOn,
            }]
          }
          return []
        })
      }

      if (!canSeeSales) return []
      const statuses = [
        ...(canApproveSales ? ['PendingVendorReview'] : []),
        'VendorApproved',
        'WaitingForAccepted',
      ]
      const orders = await listVendorOrders(token!, statuses, 1, 50)
      return orders.flatMap((order) => {
        const status = normalized(order.status || order.orderStatus)
        if (status === 'pendingvendorreview' && canApproveSales) {
          return [{
            key: `vendor:${order.id}:pendingvendorreview`,
            title: 'Sales order needs approval',
            message: `${orderLabel(order)} was submitted by ${order.createdBy || 'a user'}.`,
            to: `/vendor/orders/${order.id}`,
            createdOn: order.createdOn,
          }]
        }
        if (
          (status === 'vendorapproved' || status === 'waitingforaccepted') &&
          isCreatedByCurrentUser(order, currentUserNames)
        ) {
          return [{
            key: `vendor:${order.id}:approved`,
            title: 'Sales order approved',
            message: `${orderLabel(order)} is ready to Copy link or WhatsApp the customer.`,
            to: `/vendor/orders/${order.id}`,
            createdOn: order.createdOn,
          }]
        }
        return []
      })
    },
  })

  const items = useMemo(() => notices.data || [], [notices.data])
  const unread = items.filter((item) => !readKeys.has(item.key))

  useEffect(() => {
    try {
      setReadKeys(new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')))
    } catch {
      setReadKeys(new Set())
    }
    previousKeys.current = null
  }, [storageKey])

  useEffect(() => {
    const keys = new Set(items.map((item) => item.key))
    if (previousKeys.current && 'Notification' in window) {
      for (const item of items) {
        if (
          !previousKeys.current.has(item.key) &&
          !readKeys.has(item.key) &&
          Notification.permission === 'granted'
        ) {
          void showAppNotification({
            title: item.title,
            body: item.message,
            url: item.to,
            tag: item.key,
          })
        }
      }
    }
    previousKeys.current = keys
  }, [items, readKeys])

  function saveRead(next: Set<string>) {
    setReadKeys(next)
    localStorage.setItem(storageKey, JSON.stringify([...next]))
  }

  function markRead(item: OrderNotice) {
    saveRead(new Set([...readKeys, item.key]))
    setOpen(false)
    navigate(item.to)
  }

  async function toggleOpen() {
    setOpen((value) => !value)
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }

  function markAllRead() {
    saveRead(new Set([...readKeys, ...items.map((item) => item.key)]))
  }

  return (
    <div className="notice-bell">
      <button
        type="button"
        className="notice-bell-trigger"
        onClick={() => void toggleOpen()}
        aria-label={`Order notifications${unread.length ? `, ${unread.length} unread` : ''}`}
        aria-expanded={open}
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {unread.length > 0 && (
          <span className="notice-bell-badge">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="notice-menu">
          <div className="notice-menu-header">
            <strong>Order notifications</strong>
            {unread.length > 0 && (
              <button type="button" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          {notices.isLoading && <p className="muted">Checking orders…</p>}
          {notices.error && (
            <p className="error-text">
              {(notices.error as Error).message || 'Could not load notifications'}
            </p>
          )}
          {!notices.isLoading && !notices.error && items.length === 0 && (
            <p className="muted">No approval notices.</p>
          )}

          {items.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`notice-item ${readKeys.has(item.key) ? 'read' : 'unread'}`}
              onClick={() => markRead(item)}
            >
              <span className="notice-item-title">{item.title}</span>
              <span>{item.message}</span>
              {item.createdOn && (
                <time dateTime={item.createdOn}>
                  {new Date(item.createdOn).toLocaleString()}
                </time>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
