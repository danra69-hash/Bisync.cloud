import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import {
  canEditVendorOrders,
  canViewVendorOrders,
} from '../../auth/permissions'
import { PermissionDenied } from '../../components/PermissionDenied'
import {
  acceptVendorOrder,
  canVendorInternallyApprove,
  getVendorOrder,
  proceedToDo,
  receiveVendorOrder,
  rejectVendorOrder,
  updateVendorOrderQuantity,
  vendorApproveOrder,
  vendorRejectOrder,
} from '../../api/vendorOrders'
import { OrderDetailView } from '../../components/OrderDetail'
import {
  buildOrderDocumentShareUrl,
  buildPoPdfShareMessage,
  isCloudPoDetailUrl,
  isShortShareUrl,
} from '../../utils/poShareLink'
import type { OrderLine } from '../../types'

function normalizeStatus(status?: string) {
  return (status || '').toLowerCase().replace(/\s+/g, '')
}

export function VendorOrderDetailPage() {
  const { id } = useParams()
  const orderId = Number(id)
  const { token, hasPermission, session } = useAuth()
  const canView = canViewVendorOrders(hasPermission)
  const canEdit = canEditVendorOrders(hasPermission)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [shipDate, setShipDate] = useState('')
  const [editableLines, setEditableLines] = useState<OrderLine[]>([])
  const [shareLink, setShareLink] = useState('')
  const [shareMessage, setShareMessage] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['vendor-order', orderId, token],
    enabled: !!token && Number.isFinite(orderId) && canView,
    queryFn: () => getVendorOrder(token!, orderId),
    refetchOnMount: 'always',
    refetchInterval: (q) => {
      const s = normalizeStatus(q.state.data?.status)
      return s === 'waitingforaccepted' ||
        s === 'submitted' ||
        s === 'submittedwithchanges' ||
        s === 'vendorapproved' ||
        s === 'viewed'
        ? 8000
        : false
    },
  })

  useEffect(() => {
    const source = query.data?.orderDetails
    if (!source) {
      setEditableLines([])
      return
    }
    setEditableLines(source.map((l) => ({ ...l })))
  }, [query.data])

  useEffect(() => {
    const s = normalizeStatus(query.data?.status)
    if (s !== 'accepted' && s !== 'toship') return
    void qc.invalidateQueries({ queryKey: ['vendor-orders'] })
  }, [query.data?.status, qc])

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['vendor-order', orderId] })
    await qc.invalidateQueries({ queryKey: ['vendor-orders'] })
  }

  const status = normalizeStatus(query.data?.status)
  const canInternalApprove = canVendorInternallyApprove(
    hasPermission,
    session?.roleName,
  )
  const isToApprove = status === 'pendingvendorreview'
  const linesEditable = isToApprove && canInternalApprove

  function updateLineQty(orderDetailId: number, quantity: number) {
    setEditableLines((prev) =>
      prev.map((line) => {
        if (line.orderDetailId !== orderDetailId) return line
        const price = Number(line.productPrice ?? 0)
        return { ...line, productQuantity: quantity, subtotal: price * quantity }
      }),
    )
  }

  function updateLinePrice(orderDetailId: number, price: number) {
    setEditableLines((prev) =>
      prev.map((line) => {
        if (line.orderDetailId !== orderDetailId) return line
        const qty = Number(line.productQuantity ?? 0)
        return { ...line, productPrice: price, subtotal: qty * price }
      }),
    )
  }

  const accept = useMutation({
    mutationFn: () => acceptVendorOrder(token!, orderId),
    onSuccess: async () => {
      await invalidate()
      navigate(
        `/vendor?tab=active&changed=${encodeURIComponent(
          'Accepted — moved to Active Order',
        )}`,
        { replace: true },
      )
    },
  })
  const reject = useMutation({
    mutationFn: () => rejectVendorOrder(token!, orderId),
    onSuccess: invalidate,
  })
  const approve = useMutation({
    mutationFn: async () => {
      if (editableLines.length > 0) {
        await updateVendorOrderQuantity(token!, orderId, editableLines)
      }
      await vendorApproveOrder(token!, orderId)
    },
    onSuccess: async () => {
      await invalidate()
      setShareMessage(
        'Approved. Initiator can now create the PDF link and forward via WhatsApp (To Accept).',
      )
      const refreshed = await getVendorOrder(token!, orderId).catch(() => null)
      if (refreshed) {
        qc.setQueryData(['vendor-order', orderId, token], refreshed)
      }
    },
  })
  const vReject = useMutation({
    mutationFn: () => vendorRejectOrder(token!, orderId),
    onSuccess: invalidate,
  })
  const proceed = useMutation({
    mutationFn: () => {
      const formatted = shipDate
        ? shipDate.split('-').reverse().join('/')
        : undefined
      return proceedToDo(token!, orderId, formatted)
    },
    onSuccess: invalidate,
  })
  const receive = useMutation({
    mutationFn: () => receiveVendorOrder(token!, orderId),
    onSuccess: async () => {
      await invalidate()
      navigate(
        `/vendor?tab=delivered&changed=${encodeURIComponent(
          'Received — moved to Delivered',
        )}`,
        { replace: true },
      )
    },
  })

  async function resolveShortLink() {
    if (!token) throw new Error('Not signed in')
    const detail = query.data
    if (!detail) throw new Error('Order is still loading')
    if (shareLink && isShortShareUrl(shareLink) && !isCloudPoDetailUrl(shareLink)) {
      return shareLink
    }
    const link = await buildOrderDocumentShareUrl(detail, 'sales')
    setShareLink(link)
    return link
  }

  async function createPdfLink() {
    setShareMessage(null)
    try {
      const link = await resolveShortLink()
      try {
        await navigator.clipboard.writeText(link)
        setShareMessage('PDF link copied — send it to the customer')
      } catch {
        setShareMessage('Link ready — copy it below')
      }
    } catch (err) {
      setShareMessage((err as Error).message || 'Failed to create link')
    }
  }

  async function forwardWhatsApp() {
    setShareMessage(null)
    try {
      const link = await resolveShortLink()
      const text = buildPoPdfShareMessage({
        poNumber: query.data?.poNumber,
        orderId,
        link,
        kind: 'sales',
      })
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
      setShareMessage('WhatsApp opened with the PDF link')
    } catch (err) {
      setShareMessage((err as Error).message || 'Failed to open WhatsApp')
    }
  }

  if (query.isLoading) return <p className="muted">Loading order…</p>
  if (query.isError || !query.data) {
    return (
      <div className="stack">
        <p className="error-text">
          {(query.error as Error)?.message || 'Order not found'}
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
      </div>
    )
  }

  const busy =
    accept.isPending ||
    reject.isPending ||
    approve.isPending ||
    vReject.isPending ||
    proceed.isPending ||
    receive.isPending

  const actionError =
    accept.error ||
    reject.error ||
    approve.error ||
    vReject.error ||
    proceed.error ||
    receive.error

  const showPdfShare =
    status === 'waitingforaccepted' ||
    status === 'vendorapproved' ||
    status === 'viewed' ||
    status === 'submitted' ||
    status === 'submittedwithchanges'

  const showInboundAccept =
    canEdit &&
    (status === 'submitted' ||
      status === 'submittedwithchanges' ||
      status === 'waitingforaccepted')

  if (!canView) {
    return (
      <div className="stack">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <PermissionDenied
          title="Order unavailable"
          message="Vendor order view permission is required."
        />
      </div>
    )
  }

  return (
    <div className="stack">
      <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <OrderDetailView
        order={query.data}
        lines={linesEditable ? editableLines : query.data.orderDetails}
        editableLines={linesEditable}
        onLineQtyChange={updateLineQty}
        onLinePriceChange={updateLinePrice}
        actions={
          <div className="stack" style={{ gap: 10 }}>
            <div className="actions">
              {isToApprove && canInternalApprove && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => approve.mutate()}
                  >
                    {approve.isPending ? 'Approving…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => vReject.mutate()}
                  >
                    {vReject.isPending ? 'Rejecting…' : 'Reject'}
                  </button>
                </>
              )}

              {isToApprove && !canInternalApprove && (
                <p className="muted" style={{ margin: 0 }}>
                  Waiting for an approver. After approval, the initiator is
                  notified to create the PDF link (To Accept).
                </p>
              )}

              {showInboundAccept && !isToApprove && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => accept.mutate()}
                  >
                    {accept.isPending ? 'Accepting…' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => reject.mutate()}
                  >
                    Reject
                  </button>
                </>
              )}

              {canEdit && status === 'accepted' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => proceed.mutate()}
                >
                  Proceed to DO
                </button>
              )}

              {canEdit && status === 'toship' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => receive.mutate()}
                >
                  {receive.isPending ? 'Saving…' : 'Mark received (Delivered)'}
                </button>
              )}
            </div>

            {showPdfShare && !isToApprove && (
              <div className="stack" style={{ gap: 8 }}>
                <p className="muted" style={{ margin: 0 }}>
                  Send a printable PDF link to the customer. They can open it
                  without signing in and use Print / Save PDF.
                </p>
                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => void createPdfLink()}
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void forwardWhatsApp()}
                  >
                    WhatsApp
                  </button>
                </div>
                {shareLink && (
                  <p
                    className="muted"
                    style={{ margin: 0, wordBreak: 'break-all' }}
                  >
                    <a href={shareLink} target="_blank" rel="noreferrer">
                      {shareLink}
                    </a>
                  </p>
                )}
              </div>
            )}

            {status === 'accepted' && (
              <label className="field" style={{ marginBottom: 0 }}>
                <span>Shipping date (for Proceed to DO)</span>
                <input
                  type="date"
                  value={shipDate}
                  onChange={(e) => setShipDate(e.target.value)}
                />
              </label>
            )}
          </div>
        }
      />

      {shareMessage && <p className="muted">{shareMessage}</p>}
      {actionError && (
        <p className="error-text">{(actionError as Error).message}</p>
      )}
    </div>
  )
}
