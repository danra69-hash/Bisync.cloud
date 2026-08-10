import test from 'node:test'
import assert from 'node:assert/strict'

// Mirrors client openChecks applyOpenCheckOccupancy / purgeEmptyOpenChecks rules.

function labelsMatch(a, b) {
  const norm = (v) =>
    String(v || '')
      .trim()
      .toLowerCase()
      .replace(/^table\s+/i, '')
      .replace(/\s+/g, ' ')
  return norm(a) === norm(b) && norm(a) !== ''
}

function applyOpenCheckOccupancy(plan, checks) {
  const live = checks.filter(c => (c.lines?.length ?? 0) > 0)
  if (live.length === 0) return plan
  let changed = false
  const tables = plan.tables.map(table => {
    const check =
      live.find(c => c.tableId === table.id)
      ?? live.find(c => labelsMatch(c.tableLabel, table.label))
    if (!check) return table
    if (table.status === 'ordered' && table.orderId === check.orderId) return table
    changed = true
    return {
      ...table,
      status: 'ordered',
      orderId: check.orderId,
      openedAt: table.openedAt || check.updatedAt,
    }
  })
  return changed ? { ...plan, tables } : plan
}

test('empty-looking table 14 is marked ordered when residual open check has lines', () => {
  const plan = {
    tables: [
      { id: 't-14', label: '14', status: 'open', orderId: undefined },
      { id: 't-2', label: '2', status: 'open' },
    ],
  }
  const checks = [
    {
      tableId: 't-14',
      tableLabel: '14',
      orderId: 'chk-224455',
      lines: [
        { productId: '1', quantity: 1 },
        { productId: '2', quantity: 1 },
      ],
      updatedAt: '2026-08-10T01:00:00.000Z',
    },
  ]
  const next = applyOpenCheckOccupancy(plan, checks)
  assert.equal(next.tables[0].status, 'ordered')
  assert.equal(next.tables[0].orderId, 'chk-224455')
  assert.equal(next.tables[1].status, 'open')
})

test('empty open-check shells do not occupy a free table', () => {
  const plan = {
    tables: [{ id: 't-14', label: '14', status: 'open' }],
  }
  const checks = [
    { tableId: 't-14', tableLabel: '14', orderId: 'chk-1', lines: [], updatedAt: '2026-08-10T01:00:00.000Z' },
  ]
  const next = applyOpenCheckOccupancy(plan, checks)
  assert.equal(next.tables[0].status, 'open')
})

test('label match recovers occupancy when table id changed but label matches', () => {
  const plan = {
    tables: [{ id: 't-new-14', label: 'Table 14', status: 'open' }],
  }
  const checks = [
    {
      tableId: 't-old-14',
      tableLabel: '14',
      orderId: 'chk-99',
      lines: [{ productId: '9', quantity: 2 }],
      updatedAt: '2026-08-10T01:00:00.000Z',
    },
  ]
  const next = applyOpenCheckOccupancy(plan, checks)
  assert.equal(next.tables[0].status, 'ordered')
  assert.equal(next.tables[0].orderId, 'chk-99')
})
