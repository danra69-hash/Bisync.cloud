import test from 'node:test'
import assert from 'node:assert/strict'

// Lightweight mirror of client/src/data/posCatalog.ts normalizePosGroupLabel
function normalizePosGroupLabel(group) {
  const trimmed = String(group || '').trim()
  if (!trimmed) return 'General'
  const key = trimmed.toLowerCase().replace(/\s+/g, ' ')
  if (
    key === 'beer draft'
    || key === 'draft beer'
    || key === 'draught beer'
    || key === 'draft'
    || key === 'draught'
  ) {
    return 'Draught Beer'
  }
  if (key === 'bottle beer' || key === 'bottled beer' || key === 'beer bottle') {
    return 'Bottled Beer'
  }
  return trimmed
}

function productMatchesPosGroupFilter(productGroup, filterGroup) {
  if (!filterGroup || filterGroup === 'All') return true
  return normalizePosGroupLabel(productGroup || '') === normalizePosGroupLabel(filterGroup)
}

test('BEER DRAFT and Draught Beer are the same filter bucket', () => {
  assert.equal(normalizePosGroupLabel('BEER DRAFT'), 'Draught Beer')
  assert.equal(normalizePosGroupLabel('Beer Draft'), 'Draught Beer')
  assert.equal(normalizePosGroupLabel('Draught Beer'), 'Draught Beer')
  assert.equal(normalizePosGroupLabel('Draft Beer'), 'Draught Beer')
  assert.equal(productMatchesPosGroupFilter('Draught Beer', 'BEER DRAFT'), true)
  assert.equal(productMatchesPosGroupFilter('BEER DRAFT', 'Draught Beer'), true)
  assert.equal(productMatchesPosGroupFilter('Bottled Beer', 'BEER DRAFT'), false)
})

test('selecting Beer Draft includes Shandy and Carlsberg Glass', () => {
  const products = [
    { name: 'Shandy', group: 'BEER DRAFT' },
    { name: 'Carlsberg (Glass)', group: 'Draught Beer' },
    { name: 'Budweiser 355ml', group: 'Bottled Beer' },
  ]
  const filtered = products.filter(p => productMatchesPosGroupFilter(p.group, 'Beer Draft'))
  assert.deepEqual(filtered.map(p => p.name).sort(), ['Carlsberg (Glass)', 'Shandy'])
})
