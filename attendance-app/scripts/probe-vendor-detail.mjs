/**
 * Probe VendorOrder/{id} shape for line items.
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
const body = new URLSearchParams({
  client_id: env.VITE_CLIENT_ID,
  grant_type: 'password',
  username: process.env.PROBE_USER || 'ms@cubevalue.com',
  password: process.env.PROBE_PASS || '12345678',
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
const id = Number(process.argv[2] || 26473)
const r = await fetch(`${api}/VendorOrder/${id}`, { headers: h })
const j = await r.json()
const e = j.entity || j.Entity || j
console.log('id', id, 'http', r.status)
console.log('keys', e && typeof e === 'object' ? Object.keys(e) : typeof e)
const details = e?.orderDetails || e?.OrderDetails || e?.vendorOrderDetails
console.log('detailsLen', Array.isArray(details) ? details.length : null)
if (Array.isArray(details) && details[0]) {
  console.log('line0keys', Object.keys(details[0]))
  console.log('line0', JSON.stringify(details[0]).slice(0, 350))
}
console.log('head', JSON.stringify(e).slice(0, 600))
