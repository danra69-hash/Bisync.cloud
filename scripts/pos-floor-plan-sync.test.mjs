import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/** Mirrors floorPlanSync conflict rules that caused custom layouts to disappear. */

const STOCK = [
  { id: 't1', label: 'T1', seats: 2, section: 'Patio', shape: 'round', x: 8, y: 20, w: 14, h: 14 },
  { id: 't2', label: 'T2', seats: 4, section: 'Main', shape: 'square', x: 28, y: 10, w: 14, h: 20 },
]

function isStockDefaultFloorPlan(plan) {
  if (!plan?.tables?.length) return false
  if (plan.tables.length !== STOCK.length) return false
  const byId = new Map(STOCK.map(t => [t.id, t]))
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
    )
  })
}

function chooseWinner({ hadScoped, localUpdatedAt, remoteUpdatedAt, local, remote }) {
  if (!remote) return 'push-local'
  const localMs = localUpdatedAt ? Date.parse(localUpdatedAt) : 0
  const remoteMs = remoteUpdatedAt ? Date.parse(remoteUpdatedAt) : 0
  const localIsStock = isStockDefaultFloorPlan(local)
  const remoteIsStock = isStockDefaultFloorPlan(remote)
  const canPushLocal =
    hadScoped
    && localMs > 0
    && (
      (!localIsStock && remoteIsStock)
      || (localMs > remoteMs && !(localIsStock && !remoteIsStock))
    )
  return canPushLocal ? 'push-local' : 'remote-wins'
}

describe('POS floor plan sync — never clobber DB with cold default', () => {
  const custom = {
    tables: [
      { id: 't9', label: 'VIP', seats: 8, section: 'Lounge', shape: 'rect', x: 40, y: 40, w: 20, h: 16 },
    ],
  }
  const stock = { tables: structuredClone(STOCK) }

  it('cold local default loses to custom remote even when local stamp is newer', () => {
    assert.equal(
      chooseWinner({
        hadScoped: false,
        localUpdatedAt: null,
        remoteUpdatedAt: '2026-07-01T00:00:00.000Z',
        local: stock,
        remote: custom,
      }),
      'remote-wins',
    )
  })

  it('stock default with a fresh stamp does not overwrite custom remote', () => {
    assert.equal(
      chooseWinner({
        hadScoped: true,
        localUpdatedAt: '2026-08-03T12:00:00.000Z',
        remoteUpdatedAt: '2026-07-01T00:00:00.000Z',
        local: stock,
        remote: custom,
      }),
      'remote-wins',
    )
  })

  it('intentional newer custom local still pushes over older remote', () => {
    assert.equal(
      chooseWinner({
        hadScoped: true,
        localUpdatedAt: '2026-08-03T12:00:00.000Z',
        remoteUpdatedAt: '2026-07-01T00:00:00.000Z',
        local: custom,
        remote: stock,
      }),
      'push-local',
    )
  })

  it('detects stock default layout', () => {
    assert.equal(isStockDefaultFloorPlan(stock), true)
    assert.equal(isStockDefaultFloorPlan(custom), false)
  })

  it('recovers custom scoped local over newer stock remote (clobber signature)', () => {
    assert.equal(
      chooseWinner({
        hadScoped: true,
        localUpdatedAt: '2026-07-01T00:00:00.000Z',
        remoteUpdatedAt: '2026-08-03T12:00:00.000Z',
        local: custom,
        remote: stock,
      }),
      'push-local',
    )
  })
})
