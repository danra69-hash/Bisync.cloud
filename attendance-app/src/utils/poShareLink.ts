/**
 * App-hosted PO share links — printable A4 purchase order document.
 *
 * CopyPO / GetPOClipboard return Cloud `admin.bisync.cloud/PODetail/…` URLs, but
 * those keys expire (page shows “doesn't exist or expired”). Share the
 * printable `/share/po?d=…` document on this app instead.
 */

import type { OrderDetail, OrderLine } from '../types'

export type PoShareLine = {
  name: string
  code?: string
  qty: number
  deliveryUnit?: string
  price?: number
  tax?: number
  subtotal?: number
}

export type PoSharePayload = {
  v: 1
  kind: 'po' | 'sales'
  poNumber?: string
  orderId?: number
  vendorName?: string
  vendorTel?: string
  vendorEmail?: string
  vendorFax?: string
  outletName?: string
  companyName?: string
  billingAddress?: string
  deliveryAddress?: string
  tel?: string
  email?: string
  brn?: string
  gstNo?: string
  poDate?: string
  deliveryDate?: string
  preferredDeliveryDate?: string
  remarks?: string
  subTotal?: number
  tax?: number
  deliveryCharge?: number
  discount?: number
  grandTotal?: number
  lines: PoShareLine[]
}

const URL_RE = /https?:\/\/[^\s<>"']+/gi

/** Prefer Bisync PODetail links; otherwise the last http(s) URL in the blob. */
export function extractPoShareLink(raw: unknown): string | null {
  if (raw == null) return null

  if (typeof raw === 'object') {
    const row = raw as Record<string, unknown>
    const direct =
      row.url ?? row.link ?? row.shareUrl ?? row.poLink ?? row.pdfUrl ?? row.value
    if (typeof direct === 'string' && /^https?:\/\//i.test(direct.trim())) {
      return direct.trim()
    }
    const nested = row.entity ?? row.Entity ?? row.data ?? row.Data
    if (nested != null && nested !== raw) {
      return extractPoShareLink(nested)
    }
  }

  const text = String(raw)
  if (!text.trim()) return null

  if (/^https?:\/\//i.test(text.trim()) && !/\s/.test(text.trim())) {
    return text.trim()
  }

  const matches = text.match(URL_RE) || []
  if (matches.length === 0) return null

  const cleaned = matches.map((u) => u.replace(/[),.;]+$/g, ''))
  const detail = cleaned.find((u) => /\/PODetail\//i.test(u))
  return detail || cleaned[cleaned.length - 1] || null
}

function toShareLines(lines: OrderLine[] | undefined): PoShareLine[] {
  return (lines || []).map((line) => {
    const qty = Number(line.productQuantity ?? 0)
    const price = Number(line.productPrice ?? 0)
    const sub =
      line.subtotal != null
        ? Number(line.subtotal)
        : Number.isFinite(qty * price)
          ? qty * price
          : undefined
    return {
      name: line.productName || 'Item',
      code: line.productCode,
      qty: Number.isFinite(qty) ? qty : 0,
      deliveryUnit: line.deliveryPackage || line.uom || undefined,
      price: Number.isFinite(price) ? price : undefined,
      tax:
        line.tax != null && Number.isFinite(Number(line.tax))
          ? Number(line.tax)
          : undefined,
      subtotal: sub != null && Number.isFinite(sub) ? sub : undefined,
    }
  })
}

export function orderToPoSharePayload(
  order: OrderDetail,
  kind: 'po' | 'sales' = 'po',
): PoSharePayload {
  const lines = toShareLines(order.orderDetails)
  const linesTotal = lines.reduce((sum, l) => sum + (l.subtotal ?? 0), 0)
  return {
    v: 1,
    kind,
    poNumber: order.poNumber,
    orderId: order.id,
    vendorName: order.vendorName || order.supplier,
    vendorTel: order.vendorTel,
    vendorEmail: order.vendorEmail,
    vendorFax: order.vendorFax,
    outletName: order.outletName || order.outlet,
    companyName: order.operatorCompanyName || order.orderFrom,
    billingAddress: order.billingAddress,
    deliveryAddress: order.deliveryAddress,
    tel: order.tel,
    email: order.email,
    brn: order.brn,
    gstNo: order.gstNo,
    poDate: order.poDate,
    deliveryDate: order.deliveryDate,
    preferredDeliveryDate:
      order.preferDeliveryDate || order.deliveryDate || order.shippingDate,
    remarks: order.remarks,
    subTotal: order.subTotal,
    tax: order.tax,
    deliveryCharge: order.deliveryCharge,
    discount: order.totalDiscount,
    grandTotal:
      order.grandTotal ??
      order.total ??
      (Number.isFinite(linesTotal) ? linesTotal : undefined),
    lines,
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(encoded: string) {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function encodePoSharePayload(payload: PoSharePayload): string {
  const json = JSON.stringify(payload)
  return bytesToBase64Url(new TextEncoder().encode(json))
}

export function decodePoSharePayload(encoded: string): PoSharePayload | null {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(encoded))
    const data = JSON.parse(json) as PoSharePayload
    if (!data || data.v !== 1 || !Array.isArray(data.lines)) return null
    return data
  } catch {
    return null
  }
}

export function buildAppPoShareUrl(
  origin: string,
  payload: PoSharePayload,
): string {
  const base = origin.replace(/\/+$/, '')
  // Legacy embedded payload — prefer createShareDocumentUrl() for short /s/:id links.
  return `${base}/share/po?d=${encodeURIComponent(encodePoSharePayload(payload))}`
}

/**
 * Store the printable document and return a short clickable URL (`/s/:id`).
 * Falls back to embedded `?d=` if share storage is unavailable.
 */
export async function createShareDocumentUrl(
  payload: PoSharePayload,
  origin = typeof window !== 'undefined' ? window.location.origin : '',
): Promise<string> {
  if (!origin) throw new Error('Share origin is unavailable')
  const base = origin.replace(/\/+$/, '')
  try {
    const res = await fetch(`${base}/share-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const data = (await res.json()) as { id?: string; url?: string }
      if (typeof data.url === 'string' && data.url.trim()) return data.url.trim()
      if (typeof data.id === 'string' && data.id.trim()) {
        return `${base}/s/${data.id.trim()}`
      }
    }
  } catch {
    /* fall through to embedded payload */
  }
  return buildAppPoShareUrl(base, payload)
}

/** Build a stable printable document URL from live order detail. */
export async function buildOrderDocumentShareUrl(
  order: OrderDetail,
  kind: 'po' | 'sales' = 'po',
  origin = typeof window !== 'undefined' ? window.location.origin : '',
): Promise<string> {
  if (!origin) throw new Error('Share origin is unavailable')
  return createShareDocumentUrl(orderToPoSharePayload(order, kind), origin)
}

/** True when a URL is a Bisync Cloud PODetail page (often expires). */
export function isCloudPoDetailUrl(url?: string | null): boolean {
  return !!url && /\/PODetail\//i.test(url)
}

/** True when URL is our durable short document link. */
export function isShortShareUrl(url?: string | null): boolean {
  return !!url && /\/s\/[A-Za-z0-9_-]{6,32}\/?$/i.test(url)
}

/** Short WhatsApp / clipboard message: label + short document link. */
export function buildPoPdfShareMessage(opts: {
  poNumber?: string | null
  orderId?: string | number | null
  link: string
  kind?: 'po' | 'sales'
}) {
  const kind = opts.kind === 'sales' ? 'Sales order' : 'Purchase order'
  const label = opts.poNumber
    ? `${kind} ${opts.poNumber}`
    : opts.orderId != null
      ? `${kind} #${opts.orderId}`
      : kind
  // Bare short URL on its own line so WhatsApp auto-links it.
  return `${label}\n${opts.link}`
}

/** Display dates like Flutter CopyPO: 21 Oct 2023 */
export function formatPoDate(value?: string | null) {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  // Already human (e.g. 23-Oct-2023)
  if (/[A-Za-z]/.test(trimmed) && !trimmed.includes('T')) return trimmed
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return trimmed
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
