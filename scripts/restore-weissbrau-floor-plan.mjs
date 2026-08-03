#!/usr/bin/env node
/**
 * Restore the Weissbrau Pavilion POS floor plan to the live API.
 *
 * Usage:
 *   node scripts/restore-weissbrau-floor-plan.mjs
 *   BASE_URL=https://... node scripts/restore-weissbrau-floor-plan.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const base = (process.env.BASE_URL || 'https://bisync-cloud-389272498937.asia-southeast1.run.app').replace(/\/$/, '')
const companyId = Number(process.env.COMPANY_ID || 5)
const locations = (process.env.LOCATIONS || 'weissbrau-pavilion-kuala-lumpur,weissbrau-pavilion')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const layout = JSON.parse(
  readFileSync(resolve(root, 'data/floor-plans/weissbrau-pavilion-kuala-lumpur.json'), 'utf8'),
)
const seats = layout.tables.reduce((n, t) => n + (Number(t.seats) || 0), 0)

console.log(`Restoring Weissbrau floor plan → ${base}`)
console.log(`  tables=${layout.tables.length} zones=${layout.zones.length} seats≈${seats}`)

for (const locationExternalId of locations) {
  const res = await fetch(`${base}/api/pos/floor-plan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyId,
      locationExternalId,
      layoutJson: JSON.stringify(layout),
      force: true,
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(`FAIL ${locationExternalId}: ${res.status} ${text}`)
    process.exitCode = 1
    continue
  }
  const body = JSON.parse(text)
  const saved = JSON.parse(body.layoutJson)
  console.log(`OK  ${locationExternalId}: ${saved.tables.length} tables @ ${body.updatedAt}`)
}

if (process.exitCode) process.exit(process.exitCode)

// Verify nested layoutJson (do not grep the outer API envelope).
const primary = locations[0]
const check = await fetch(
  `${base}/api/pos/floor-plan?companyId=${companyId}&locationExternalId=${encodeURIComponent(primary)}`,
)
if (!check.ok) {
  console.error(`VERIFY FAIL: GET floor-plan HTTP ${check.status}`)
  process.exit(1)
}
const checked = await check.json()
const verified = JSON.parse(checked.layoutJson || '{}')
const ids = (verified.tables || []).map((t) => t.id)
if (!ids.includes('p01') || !(verified.tables || []).some((t) => t.label === 'P1')) {
  console.error('VERIFY FAIL: Pavilion tables missing (expected p01 / P1)')
  process.exit(1)
}
if (ids.includes('t1') && verified.tables.length === 8) {
  console.error('VERIFY FAIL: stock T1–T8 demo detected')
  process.exit(1)
}
console.log(`Verified ${primary}: ${verified.tables.length} tables (Pavilion)`)
