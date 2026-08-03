/**
 * Mirrors PosFloorPlanGuard stock detection for CI without spinning up .NET tests.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const STOCK = {
  tables: [
    { id: 't1', label: 'T1', seats: 2, status: 'open', section: 'Patio', shape: 'round', x: 8, y: 20, w: 14, h: 14 },
    { id: 't2', label: 'T2', seats: 4, status: 'open', section: 'Main', shape: 'square', x: 28, y: 10, w: 14, h: 20 },
    { id: 't3', label: 'T3', seats: 4, status: 'open', section: 'Main', shape: 'square', x: 48, y: 10, w: 14, h: 20 },
    { id: 't4', label: 'T4', seats: 6, status: 'open', section: 'Main', shape: 'rect', x: 68, y: 8, w: 18, h: 24 },
    { id: 't5', label: 'T5', seats: 2, status: 'open', section: 'Bar', shape: 'oval', x: 10, y: 45, w: 12, h: 18 },
    { id: 't6', label: 'T6', seats: 8, status: 'open', section: 'Private', shape: 'rect', x: 35, y: 42, w: 22, h: 28 },
    { id: 't7', label: 'T7', seats: 4, status: 'open', section: 'Patio', shape: 'square', x: 65, y: 48, w: 14, h: 20 },
    { id: 't8', label: 'T8', seats: 2, status: 'open', section: 'Bar', shape: 'round', x: 10, y: 72, w: 12, h: 12 },
  ],
  zones: [],
}

function isStock(plan) {
  if (!plan?.tables?.length || plan.tables.length !== STOCK.tables.length) return false
  const byId = new Map(STOCK.tables.map(t => [t.id, t]))
  return plan.tables.every(t => {
    const s = byId.get(t.id)
    if (!s) return false
    return (
      t.label === s.label
      && t.seats === s.seats
      && t.section === s.section
      && t.shape === s.shape
      && Math.abs(t.x - s.x) < 0.01
      && Math.abs(t.y - s.y) < 0.01
      && Math.abs(t.w - s.w) < 0.01
      && Math.abs(t.h - s.h) < 0.01
    )
  })
}

test('Weissbrau restore layout is not the stock demo', () => {
  const plan = JSON.parse(
    readFileSync(resolve(root, 'data/floor-plans/weissbrau-pavilion-kuala-lumpur.json'), 'utf8'),
  )
  assert.equal(plan.tables.length, 29)
  assert.equal(plan.zones.length, 4)
  assert.equal(isStock(plan), false)
  assert.ok(plan.tables.some(t => t.label.startsWith('P')))
  assert.ok(plan.tables.some(t => t.label.startsWith('I')))
  assert.ok(plan.tables.some(t => t.label.startsWith('B')))
})

test('stock demo still detects as stock', () => {
  assert.equal(isStock(STOCK), true)
})
