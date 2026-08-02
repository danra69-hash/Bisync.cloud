import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/** Mirrors Overview Total Client distinct key + detail sort (latest → oldest). */
function clientKey(row) {
  if (row.company?.trim()) return row.company.trim().toLowerCase()
  if (row.brand?.trim()) return row.brand.trim().toLowerCase()
  return null
}

function countTotalClients(rows) {
  const keys = new Set()
  for (const row of rows) {
    const key = clientKey(row)
    if (key) keys.add(key)
  }
  return keys.size
}

function sortMs(row) {
  const raw = row.lastContactDate || row.dateCreated
  if (!raw) return 0
  const ms = Date.parse(raw)
  return Number.isNaN(ms) ? 0 : ms
}

function sortLatestFirst(rows) {
  return [...rows].sort((a, b) => sortMs(b) - sortMs(a))
}

describe('Sales Module Overview Total Client + detail sort', () => {
  it('counts distinct clients by company (fallback brand)', () => {
    const rows = [
      { company: 'Acme', brand: 'A' },
      { company: 'acme', brand: 'B' },
      { company: '', brand: 'Solo Brand' },
      { company: 'Beta', brand: 'B' },
      { company: '', brand: '' },
    ]
    assert.equal(countTotalClients(rows), 3)
  })

  it('sorts detail rows by interaction date then created date, latest first', () => {
    const rows = [
      { id: 1, lastContactDate: '2026-07-01', dateCreated: '2026-06-01' },
      { id: 2, lastContactDate: null, dateCreated: '2026-07-10' },
      { id: 3, lastContactDate: '2026-07-15', dateCreated: '2026-01-01' },
      { id: 4, lastContactDate: null, dateCreated: null },
    ]
    assert.deepEqual(
      sortLatestFirst(rows).map(r => r.id),
      [3, 2, 1, 4],
    )
  })
})
