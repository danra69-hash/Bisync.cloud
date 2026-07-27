/**
 * One-off diagnostic: probe order detail endpoints.
 * Reads VITE_* from web/.env — do not commit credentials.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(root, '..', '.env')
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)

const api = 'http://localhost:5174/mobile-api'
const tokenUrl = 'http://localhost:5174/identity/connect/token'
const user = process.env.PROBE_USER || 'ms@cubevalue.com'
const pass = process.env.PROBE_PASS || '12345678'

const body = new URLSearchParams({
  client_id: env.VITE_CLIENT_ID,
  grant_type: 'password',
  username: user,
  password: pass,
  client_secret: env.VITE_CLIENT_SECRET,
})

const tokRes = await fetch(tokenUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
})
const tok = await tokRes.json()
if (!tok.access_token) {
  console.error('token failed', tokRes.status)
  process.exit(1)
}
const h = { Authorization: `Bearer ${tok.access_token}` }

async function get(p) {
  const r = await fetch(`${api}/${p}`, { headers: h })
  const text = await r.text()
  return { path: p, status: r.status, len: text.length, head: text.slice(0, 220) }
}

const failId = Number(process.argv[2] || 99187)
const okId = Number(process.argv[3] || 62387)

async function post(p, bodyObj) {
  const r = await fetch(`${api}/${p}`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyObj),
  })
  const text = await r.text()
  return { path: p, status: r.status, head: text.slice(0, 280) }
}

console.log(
  'listByPo',
  JSON.stringify(
    await post('OperatorOrder/List', {
      pageSize: 5,
      pageIndex: 1,
      purchaseOrderNumber: 'PO-202506001122',
      status: ['Requested'],
    }),
  ),
)

for (const p of [
  `OperatorOrder/OrderChangeHistory/${failId}`,
  `OperatorOrder/Changes/${failId}`,
  `OperatorOrder/${failId}/Changes`,
  `OperatorOrder/History/${failId}`,
  `OperatorOrder/OrderLog/${failId}`,
]) {
  console.log(JSON.stringify(await get(p)))
}

const paths = [
  `Operatororder/${failId}`,
  `OperatorOrder/CopyPO/${failId}`,
  `VendorOrder/${failId}`,
  `Operatororder/${okId}`,
]

for (const p of paths) {
  console.log(JSON.stringify(await get(p)))
}

console.log('retry fail id')
for (let i = 0; i < 3; i++) {
  console.log(i, JSON.stringify(await get(`Operatororder/${failId}`)))
}

// Save working full entity shape sample size
const okFull = await (await fetch(`${api}/Operatororder/${okId}`, { headers: h })).json()
console.log('okEntityKeys', Object.keys(okFull.entity || {}))
console.log('okHasDetails', Array.isArray(okFull.entity?.orderDetails), okFull.entity?.orderDetails?.length)
