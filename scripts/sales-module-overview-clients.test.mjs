import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/** Mirrors Overview Total Client distinct key + detail sort. */
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

function normalizeToken(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
}

function isStatusChange(row) {
  const status = normalizeToken(row.status)
  const contact = normalizeToken(row.contactType)
  return status === 'UPDATED' || contact === 'STATUS UPDATE' || contact.includes('STATUS UPDATE')
}

function isInteraction(row) {
  return Boolean(row.contactType?.trim())
}

function isNewLead(row) {
  return normalizeToken(row.status) === 'LEAD'
}

function sortPriority(row) {
  if (isStatusChange(row)) return 0
  if (isInteraction(row)) return 1
  if (isNewLead(row)) return 2
  return 3
}

function sortMs(row) {
  const raw = row.lastContactDate || row.dateCreated
  if (!raw) return 0
  const ms = Date.parse(raw)
  return Number.isNaN(ms) ? 0 : ms
}

/** One row per client; prefer status change → interaction → new lead, then latest date. */
function dedupeClientsSorted(rows) {
  const best = new Map()
  const orphans = []
  for (const row of rows) {
    const key = clientKey(row)
    if (!key) {
      orphans.push(row)
      continue
    }
    const prev = best.get(key)
    if (!prev) {
      best.set(key, row)
      continue
    }
    const pri = sortPriority(row) - sortPriority(prev)
    if (pri < 0
      || (pri === 0 && sortMs(row) > sortMs(prev))
      || (pri === 0 && sortMs(row) === sortMs(prev) && row.id > prev.id)) {
      best.set(key, row)
    }
  }
  return [...best.values(), ...orphans].sort(
    (a, b) => sortPriority(a) - sortPriority(b) || sortMs(b) - sortMs(a) || b.id - a.id,
  )
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

  it('sorts detail rows: status change → interaction → new lead → other', () => {
    const rows = [
      { id: 1, company: 'A', status: 'LEAD', contactType: '', lastContactDate: '2026-07-20' },
      { id: 2, company: 'B', status: '', contactType: 'CALL', lastContactDate: '2026-07-10' },
      { id: 3, company: 'C', status: 'UPDATED', contactType: '', lastContactDate: '2026-07-01' },
      { id: 4, company: 'D', status: '', contactType: '', lastContactDate: '2026-07-25' },
      { id: 5, company: 'E', status: 'UPDATED', contactType: 'STATUS UPDATE', lastContactDate: '2026-07-15' },
    ]
    assert.deepEqual(
      dedupeClientsSorted(rows).map(r => r.id),
      [5, 3, 2, 1, 4],
    )
  })

  it('dedupes full client list keeping best priority row per client', () => {
    const rows = [
      { id: 1, company: 'Acme', status: 'LEAD', contactType: '', lastContactDate: '2026-07-20' },
      { id: 2, company: 'Acme', status: 'UPDATED', contactType: '', lastContactDate: '2026-07-01' },
      { id: 3, company: 'Beta', contactType: 'CALL', lastContactDate: null, dateCreated: '2026-07-15' },
    ]
    assert.deepEqual(
      dedupeClientsSorted(rows).map(r => r.id),
      [2, 3],
    )
  })
})
