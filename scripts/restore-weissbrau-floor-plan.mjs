#!/usr/bin/env node
/**
 * Restore the Weissbrau Pavilion POS floor plan to the live API and
 * purge prior version history so older layouts cannot be restored.
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
const expectedTableCount = layout.tables.length
const expectedLabels = new Set(layout.tables.map((t) => String(t.label || '')))

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

// Purge prior version history so old Pavilion layouts cannot be restored.
for (const locationExternalId of locations) {
  const res = await fetch(
    `${base}/api/pos/floor-plan/versions?companyId=${companyId}&locationExternalId=${encodeURIComponent(locationExternalId)}`,
    { method: 'DELETE' },
  )
  const text = await res.text()
  if (!res.ok) {
    // Older revisions may not have the purge endpoint yet — warn but continue verify.
    console.warn(`WARN clear versions ${locationExternalId}: ${res.status} ${text}`)
    continue
  }
  const body = JSON.parse(text)
  console.log(`Cleared versions ${locationExternalId}: removed=${body.removed ?? 0}`)
}

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
const labels = (verified.tables || []).map((t) => String(t.label || ''))
if (verified.tables?.length !== expectedTableCount) {
  console.error(`VERIFY FAIL: expected ${expectedTableCount} tables, got ${verified.tables?.length ?? 0}`)
  process.exit(1)
}
if (ids.includes('t1') && verified.tables.length === 8) {
  console.error('VERIFY FAIL: stock T1–T8 demo detected')
  process.exit(1)
}
// Must match the committed canonical labels (not the retired P1–P18 patio seed).
for (const label of expectedLabels) {
  if (!labels.includes(label)) {
    console.error(`VERIFY FAIL: missing expected label ${label}`)
    process.exit(1)
  }
}
console.log(`Verified ${primary}: ${verified.tables.length} tables (canonical Weissbrau)`)
