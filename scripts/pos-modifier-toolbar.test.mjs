import test from 'node:test'
import assert from 'node:assert/strict'

// Mirrors client/src/data/posCatalog.ts + posModifierGroups.ts attach/toolbar rules.

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

function groupsMatchName(a, b) {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
}

function groupsMatchPosLabel(a, b) {
  return normalizePosGroupLabel(a || '') === normalizePosGroupLabel(b || '')
}

function attachmentMatchesProduct(attachment, product) {
  const category = (attachment.targetProductCategory || '').trim()
  const group = (attachment.targetProductGroup || '').trim()
  const productId = attachment.targetProductId != null && Number(attachment.targetProductId) > 0
    ? Number(attachment.targetProductId)
    : null
  const type = (attachment.targetType || '').trim().toLowerCase()

  if (!category && !group && productId == null) return false

  if (productId != null) {
    if (Number(product.id) !== productId) return false
  } else if (type === 'product') {
    return false
  }

  if (group) {
    if (!groupsMatchPosLabel(group, product.group)) return false
  } else if (type === 'product-group' && !category) {
    return false
  }

  if (category) {
    if (!groupsMatchName(category, product.category)) return false
  } else if (type === 'category') {
    return false
  }

  return true
}

function resolveAttachedModifierGroups(all, product, kind) {
  return all
    .filter(g => g.active)
    .filter(g => !kind || g.kind === kind)
    .filter(g => (g.attachments ?? []).some(a => attachmentMatchesProduct(a, product)))
    .sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name))
}

function resolveToolbarModifierGroups(all, kind, product) {
  if (product) {
    return resolveAttachedModifierGroups(all, product, kind).map(g => g.name)
  }
  return all.filter(g => g.active && g.kind === kind).map(g => g.name)
}

const glassForTower = {
  id: 1,
  name: 'Glass for Tower',
  kind: 'beverage',
  active: true,
  sequence: 1,
  attachments: [
    { targetType: 'product-group', targetProductGroup: 'Draft Beer', targetProductCategory: '' },
  ],
}

const earlGreyMod = {
  id: 2,
  name: 'Tea Strength',
  kind: 'beverage',
  active: true,
  sequence: 2,
  attachments: [
    { targetType: 'product', targetProductId: 99, targetProductGroup: '', targetProductCategory: '' },
  ],
}

const all = [glassForTower, earlGreyMod]

test('Draft Beer attach matches Draught Beer product on register', () => {
  const draught = { id: 10, group: 'Draught Beer', category: 'Beverage' }
  const names = resolveToolbarModifierGroups(all, 'beverage', draught)
  assert.deepEqual(names, ['Glass for Tower'])
})

test('Earl Grey only sees beverage modifiers attached to it', () => {
  const earlGrey = { id: 99, group: 'Blue Tea', category: 'Beverage' }
  const names = resolveToolbarModifierGroups(all, 'beverage', earlGrey)
  assert.deepEqual(names, ['Tea Strength'])
  assert.ok(!names.includes('Glass for Tower'))
})

test('unattached beverage product gets empty toolbar list (no company-wide dump)', () => {
  const other = { id: 50, group: 'Soft Drink', category: 'Beverage' }
  const names = resolveToolbarModifierGroups(all, 'beverage', other)
  assert.deepEqual(names, [])
})

test('BEER DRAFT synonym matches Draught Beer attach', () => {
  const shandy = { id: 11, group: 'BEER DRAFT', category: 'Beverage' }
  const names = resolveToolbarModifierGroups(all, 'beverage', shandy)
  assert.deepEqual(names, ['Glass for Tower'])
})
