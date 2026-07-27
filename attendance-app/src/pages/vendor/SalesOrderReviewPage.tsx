import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthProvider'
import { canCreateSalesOrder } from '../../auth/permissions'
import { PermissionDenied } from '../../components/PermissionDenied'
import {
  checkoutVendorCart,
  getVendorAddresses,
  getVendorCart,
  getVendorOrder,
  vendorNeedsIssueApproval,
} from '../../api/vendorOrders'
import { QtyStepper } from '../../components/QtyStepper'
import { deliveryUomOf, ProductMeta, recipeUomOf } from '../../components/ProductMeta'
import {
  cartTotal,
  clearSalesCart,
  loadSalesCart,
  saveSalesCart,
  saveSalesOrder,
  type SalesCartLine,
  type SavedSalesOrder,
} from '../../data/salesCart'
import {
  buildOrderDocumentShareUrl,
  buildPoPdfShareMessage,
  createShareDocumentUrl,
  isCloudPoDetailUrl,
  isShortShareUrl,
  type PoSharePayload,
} from '../../utils/poShareLink'

function money(value?: number) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
  }).format(Number(value))
}

function extractOrderId(data: unknown): number | null {
  if (data == null) return null
  if (typeof data === 'number') return data
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const id = obj.id ?? obj.orderId ?? obj.OrderId
    if (typeof id === 'number') return id
    if (typeof id === 'string' && Number.isFinite(Number(id))) return Number(id)
  }
  return null
}

function savedOrderDocumentUrl(order: SavedSalesOrder): Promise<string> {
  const payload: PoSharePayload = {
    v: 1,
    kind: 'sales',
    orderId: Number.isFinite(Number(order.id)) ? Number(order.id) : undefined,
    companyName: order.clientName,
    outletName: order.clientName,
    poDate: order.createdAt,
    grandTotal: order.total,
    lines: order.lines.map((line) => {
      const qty = Number(line.quantity) || 0
      const price = Number(line.price) || 0
      return {
        name: line.productName || 'Item',
        qty,
        deliveryUnit: line.deliveryPackage || line.uom || undefined,
        price,
        subtotal: qty * price,
      }
    }),
  }
  return createShareDocumentUrl(payload)
}

export function SalesOrderReviewPage() {
  const { token, hasPermission } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const clientId = Number(params.get('clientId'))
  const clientName = params.get('clientName') || `Client ${clientId}`
  const isDemo = params.get('demo') === '1'
  const canSales = canCreateSalesOrder(hasPermission)
  const needsApproval = vendorNeedsIssueApproval(hasPermission)

  const [lines, setLines] = useState<SalesCartLine[]>(() =>
    Number.isFinite(clientId) ? loadSalesCart(clientId) : [],
  )
  const [savedOrder, setSavedOrder] = useState<SavedSalesOrder | null>(null)
  const [shareLink, setShareLink] = useState<string>('')
  const [message, setMessage] = useState<string | null>(null)
  const [pipelineStatus, setPipelineStatus] = useState<string | null>(null)

  const addresses = useQuery({
    queryKey: ['vendor-addresses', clientId, token],
    enabled: !!token && Number.isFinite(clientId) && !isDemo,
    queryFn: () => getVendorAddresses(token!, clientId),
  })

  const liveCart = useQuery({
    queryKey: ['vendor-cart', clientId, token],
    enabled: !!token && Number.isFinite(clientId) && !isDemo,
    queryFn: () => getVendorCart(token!, clientId),
  })

  const defaultAddressId = useMemo(() => {
    const list = addresses.data || []
    const preferred = list.find((a) => a.isDefault) || list[0]
    return preferred?.id ?? preferred?.addressId ?? 0
  }, [addresses.data])

  const total = useMemo(() => cartTotal(lines), [lines])

  function updateLineQty(productId: number, quantity: number) {
    setLines((prev) => {
      const next =
        quantity <= 0
          ? prev.filter((l) => l.productId !== productId)
          : prev.map((l) =>
              l.productId === productId ? { ...l, quantity } : l,
            )
      if (Number.isFinite(clientId)) saveSalesCart(clientId, next)
      return next
    })
  }

  const confirmSave = useMutation({
    mutationFn: async () => {
      if (!Number.isFinite(clientId)) throw new Error('Missing client')
      if (lines.length === 0) throw new Error('Cart is empty')

      if (isDemo) {
        const id = `SO-DEMO-${Date.now()}`
        const order: SavedSalesOrder = {
          id,
          clientId,
          clientName,
          lines,
          total,
          createdAt: new Date().toISOString(),
          demo: true,
          status: needsApproval ? 'Saved' : 'Submitted',
        }
        saveSalesOrder(order)
        clearSalesCart(clientId)
        return {
          order,
          apiStatus: needsApproval ? 'PendingVendorReview' : 'WaitingForAccepted',
        }
      }

      if (!defaultAddressId) throw new Error('No delivery address for this client')
      const cartVendorDetails = Array.isArray(liveCart.data)
        ? liveCart.data
        : liveCart.data
          ? [liveCart.data]
          : []

      const checkoutData = await checkoutVendorCart(token!, {
        outletId: clientId,
        billingAddressId: 0,
        deliveryAddressId: Number(defaultAddressId),
        cartVendorDetails,
      })

      const apiOrderId = extractOrderId(checkoutData)
      let apiStatus = needsApproval ? 'PendingVendorReview' : 'WaitingForAccepted'
      let shareUrl: string | undefined

      if (apiOrderId != null) {
        let detail = null
        try {
          detail = await getVendorOrder(token!, apiOrderId)
          if (detail.status) apiStatus = detail.status
        } catch {
          /* keep inferred status */
        }

        const normalized = (apiStatus || '').toLowerCase().replace(/\s+/g, '')
        const canShareNow =
          !needsApproval &&
          normalized !== 'pendingvendorreview'

        if (canShareNow) {
          if (detail) {
            shareUrl = await buildOrderDocumentShareUrl(detail, 'sales')
          } else {
            shareUrl = await savedOrderDocumentUrl({
              id: String(apiOrderId),
              clientId,
              clientName,
              lines,
              total,
              createdAt: new Date().toISOString(),
              demo: false,
            })
          }
        }
      }

      const id = apiOrderId != null ? String(apiOrderId) : `SO-${Date.now()}`
      const order: SavedSalesOrder = {
        id,
        clientId,
        clientName,
        lines,
        total,
        createdAt: new Date().toISOString(),
        demo: false,
        status: 'Saved',
        shareUrl,
      }
      saveSalesOrder(order)
      clearSalesCart(clientId)
      return { order, apiStatus }
    },
    onSuccess: async ({ order, apiStatus }) => {
      setSavedOrder(order)
      setLines([])
      setPipelineStatus(apiStatus)
      await qc.invalidateQueries({ queryKey: ['vendor-cart', clientId] })
      await qc.invalidateQueries({ queryKey: ['vendor-orders'] })

      const normalized = (apiStatus || '').toLowerCase().replace(/\s+/g, '')
      const awaitingInternal =
        normalized === 'pendingvendorreview' ||
        (needsApproval && normalized !== 'waitingforaccepted')

      // Prefer short durable /s/:id links — Cloud PODetail keys expire.
      let link = order.shareUrl || ''
      if (isCloudPoDetailUrl(link) || (!isShortShareUrl(link) && /share\/po\?d=/i.test(link))) {
        link = ''
      }
      if (!awaitingInternal && !link) {
        try {
          if (Number.isFinite(Number(order.id))) {
            const detail = await getVendorOrder(token!, Number(order.id))
            link = await buildOrderDocumentShareUrl(detail, 'sales')
          } else {
            link = await savedOrderDocumentUrl(order)
          }
          const withLink = { ...order, shareUrl: link }
          saveSalesOrder(withLink)
          setSavedOrder(withLink)
        } catch {
          link = await savedOrderDocumentUrl(order)
          const withLink = { ...order, shareUrl: link }
          saveSalesOrder(withLink)
          setSavedOrder(withLink)
        }
      }
      setShareLink(link)

      if (awaitingInternal) {
        setMessage(
          'Sales order created under New as To Approve. After an approver confirms, open the order to Copy link or send via WhatsApp.',
        )
        return
      }

      setMessage(
        link
          ? 'Sales order created. Copy the PDF link or send via WhatsApp to the customer.'
          : 'Sales order created. Use Copy link or WhatsApp to send it to the customer.',
      )
    },
    onError: (err) => setMessage((err as Error).message),
  })

  function markSubmitted(order: SavedSalesOrder, how: 'copy' | 'whatsapp') {
    const next: SavedSalesOrder = { ...order, status: 'Submitted' }
    saveSalesOrder(next)
    setSavedOrder(next)
    setMessage(
      how === 'copy'
        ? 'PDF link copied — send it to the customer'
        : 'WhatsApp opened with the PDF link',
    )
    void qc.invalidateQueries({ queryKey: ['vendor-orders'] })
  }

  async function resolveShortLink() {
    if (!savedOrder) throw new Error('Confirm & save the order first')
    if (shareLink && isShortShareUrl(shareLink) && !isCloudPoDetailUrl(shareLink)) {
      return shareLink
    }
    let link = ''
    if (token && Number.isFinite(Number(savedOrder.id))) {
      try {
        const detail = await getVendorOrder(token, Number(savedOrder.id))
        link = await buildOrderDocumentShareUrl(detail, 'sales')
      } catch {
        link = await savedOrderDocumentUrl(savedOrder)
      }
    } else {
      link = await savedOrderDocumentUrl(savedOrder)
    }
    setShareLink(link)
    return link
  }

  async function copyLink() {
    if (!savedOrder) {
      setMessage('Confirm & save the order first')
      return
    }

    try {
      const link = await resolveShortLink()
      const withLink = { ...savedOrder, shareUrl: link }
      try {
        await navigator.clipboard.writeText(link)
        markSubmitted(withLink, 'copy')
      } catch {
        markSubmitted(withLink, 'copy')
        setMessage(`Link ready — copy manually: ${link}`)
      }
    } catch (err) {
      setMessage((err as Error).message || 'Failed to create link')
    }
  }

  async function forwardWhatsApp() {
    if (!savedOrder) {
      setMessage('Confirm & save the order first')
      return
    }

    try {
      const link = await resolveShortLink()
      const text = buildPoPdfShareMessage({
        orderId: savedOrder.id,
        link,
        kind: 'sales',
      })
      markSubmitted({ ...savedOrder, shareUrl: link }, 'whatsapp')
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    } catch (err) {
      setMessage((err as Error).message || 'Failed to open WhatsApp')
    }
  }

  const awaitingInternalApproval =
    pipelineStatus === 'PendingVendorReview' ||
    ((pipelineStatus || '').toLowerCase().replace(/\s+/g, '') ===
      'pendingvendorreview')

  const canShareToCustomer = !!savedOrder && !awaitingInternalApproval

  if (!canSales) {
    return (
      <div className="stack">
        <PermissionDenied
          title="Sales review unavailable"
          message="Sales permission is required to review and submit sales orders."
        />
        <Link className="btn btn-secondary" to="/vendor">
          Back
        </Link>
      </div>
    )
  }

  if (!Number.isFinite(clientId)) {
    return (
      <div className="stack">
        <p className="error-text">Missing client. Start from New Sales Order.</p>
        <Link className="btn btn-secondary" to="/vendor/new-order">
          Back
        </Link>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="order-card-row">
        <div>
          <h2 style={{ margin: '0 0 4px' }}>Sales Order Review</h2>
          <p className="muted" style={{ margin: 0 }}>
            {clientName}
            {isDemo ? ' · Demo cart' : ''}
          </p>
        </div>
        <Link className="btn btn-ghost" to="/vendor/new-order">
          ← Keep shopping
        </Link>
      </div>

      <div className="card stack">
        <h3 style={{ margin: 0 }}>Order lines</h3>
        {lines.length === 0 && !savedOrder && (
          <p className="muted">Cart is empty.</p>
        )}
        {lines.map((line) => (
          <div className="order-card-row" key={line.productId}>
            <div>
              <ProductMeta
                name={line.productName}
                deliveryUom={deliveryUomOf(line)}
                recipeUom={line.recipeUom || recipeUomOf(line)}
                parStock={line.parStock}
                onHand={line.quantityOnHand}
                extra={money(line.price)}
              />
            </div>
            <div className="stack" style={{ justifyItems: 'end' }}>
              <QtyStepper
                value={line.quantity}
                disabled={!!savedOrder || confirmSave.isPending}
                onChange={(next) => updateLineQty(line.productId, next)}
              />
              <strong>{money(line.price * line.quantity)}</strong>
            </div>
          </div>
        ))}

        {(lines.length > 0 || savedOrder) && (
          <div className="order-card-row" style={{ marginTop: 8 }}>
            <strong>Total</strong>
            <strong>{money(savedOrder?.total ?? total)}</strong>
          </div>
        )}
      </div>

      {savedOrder && (
        <div className="card stack">
          <div className="order-card-row">
            <strong>Order {savedOrder.id}</strong>
            <span className="badge">
              {awaitingInternalApproval
                ? 'To Approve'
                : pipelineStatus
                  ? 'To Accept'
                  : savedOrder.status || 'Saved'}
            </span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {awaitingInternalApproval
              ? 'Waiting for internal approval. After approval, open this order to Copy link or WhatsApp the customer.'
              : 'Send a printable PDF link to the customer with Copy link or WhatsApp.'}
          </p>
          {shareLink && (
            <p className="muted" style={{ margin: 0, wordBreak: 'break-all' }}>
              <a href={shareLink} target="_blank" rel="noreferrer">
                {shareLink}
              </a>
            </p>
          )}
        </div>
      )}

      <div className="actions">
        {!savedOrder && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={confirmSave.isPending || lines.length === 0}
            onClick={() => confirmSave.mutate()}
          >
            {confirmSave.isPending ? 'Confirming…' : 'Confirm order'}
          </button>
        )}
        {canShareToCustomer && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void copyLink()}
            >
              Copy link
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void forwardWhatsApp()}
            >
              WhatsApp
            </button>
          </>
        )}
        {savedOrder && awaitingInternalApproval && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              navigate(
                Number.isFinite(Number(savedOrder.id))
                  ? `/vendor/orders/${savedOrder.id}`
                  : '/vendor?tab=new',
              )
            }
          >
            Open order
          </button>
        )}
      </div>

      {message && (
        <p className={confirmSave.isError ? 'error-text' : 'muted'}>{message}</p>
      )}

      {savedOrder && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/vendor')}
        >
          Done — back to home
        </button>
      )}
    </div>
  )
}
