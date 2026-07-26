/**
 * Verify getOperatorOrder returns line items for known-good and known-bad IDs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, '..', '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

const api = 'http://localhost:5174/mobile-api'
const tokenUrl = 'http://localhost:5174/identity/connect/token'
const body = new URLSearchParams({
  client_id: env.VITE_CLIENT_ID,
  grant_type: 'password',
  username: 'ms@cubevalue.com',
  password: '12345678',
  client_secret: env.VITE_CLIENT_SECRET,
})
const tok = await (
  await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
).json()
const h = { Authorization: `Bearer ${tok.access_token}` }

function unwrap(json) {
  if (json?.success === false || json?.Success === false) {
    throw new Error(json.errorMessage || json.ErrorMessage || 'failed')
  }
  return json.entity ?? json.Entity ?? json.data ?? json
}

function normalizeLine(raw) {
  return {
    productName: raw.productName || raw.ingredientName || raw.name,
    productQuantity: raw.productQuantity ?? raw.quantity,
    productPrice: raw.productPrice ?? raw.price,
    subtotal: raw.subtotal,
  }
}

async function load(id) {
  try {
    const r = await fetch(`${api}/Operatororder/${id}`, { headers: h })
    const j = await r.json()
    if (!r.ok || j.Success === false || j.success === false) throw new Error('op fail')
    const e = unwrap(j)
    return {
      source: 'operator',
      lines: (e.orderDetails || []).map(normalizeLine),
      po: e.poNumber,
    }
  } catch {
    const r = await fetch(`${api}/VendorOrder/${id}`, { headers: h })
    const j = await r.json()
    if (!r.ok || j.Success === false || j.success === false) {
      return { source: 'none', lines: [], po: null, err: j.ErrorMessage || j.errorMessage }
    }
    const e = unwrap(j)
    return {
      source: 'vendor',
      lines: (e.orderDetails || []).map(normalizeLine),
      po: e.ponNumber || e.poNumber,
    }
  }
}

const list = await (
  await fetch(`${api}/OperatorOrder/List`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pageSize: 12,
      pageIndex: 1,
      purchaseOrderNumber: '',
      status: ['Requested'],
    }),
  })
).json()

for (const o of list.entity || []) {
  const result = await load(o.id)
  console.log(
    JSON.stringify({
      id: o.id,
      po: o.purchaseOrderNumber,
      source: result.source,
      lineCount: result.lines.length,
      first: result.lines[0]?.productName || null,
      err: result.err || null,
    }),
  )
}
