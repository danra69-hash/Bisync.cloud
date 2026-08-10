import test from 'node:test'
import assert from 'node:assert/strict'

function normalizePaymentCode(code) {
  return String(code || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
}

function paymentTenderBehavior(code) {
  const key = normalizePaymentCode(code)
  if (key === 'cash') return 'cash'
  if (
    key === 'entertainment'
    || key === 'duty-meals'
    || key === 'duty-meal'
    || key === 'compliment'
    || key === 'comp'
    || key === 'non-revenue'
  ) {
    return 'entertainment'
  }
  return 'other'
}

function paymentMethodForApi(code) {
  const key = normalizePaymentCode(code)
  if (!key) return 'cash'
  if (key === 'cash') return 'cash'
  if (key === 'card-emv' || key === 'card' || key === 'credit-card' || key === 'emv' || key === 'emv-chip') {
    return 'credit-card'
  }
  if (key === 'tap' || key === 'tap-to-pay') return 'credit-card'
  if (key === 'qr' || key === 'qr-pay') return 'qr-pay'
  if (key === 'gift-card' || key === 'giftcard') return 'gift-card'
  if (paymentTenderBehavior(key) === 'entertainment') return 'entertainment'
  return key
}

function buildTenderOptions(paymentTypes, entertainmentTypes) {
  const activePayments = paymentTypes
    .filter(t => t.active !== false)
    .slice()
    .sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name))
  const options = []
  if (activePayments.length > 0) {
    for (const row of activePayments) {
      const code = (row.code || '').trim()
      const key = normalizePaymentCode(code)
      if (options.some(o => o.key === key)) continue
      options.push({
        key,
        code,
        name: row.name,
        behavior: paymentTenderBehavior(code),
      })
    }
  } else {
    options.push(
      { key: 'cash', code: 'CASH', name: 'Cash', behavior: 'cash' },
      { key: 'card-emv', code: 'CARD-EMV', name: 'EMV Chip', behavior: 'other' },
    )
  }
  const hasEntertainment = options.some(o => o.behavior === 'entertainment')
  const activeEnt = entertainmentTypes.filter(t => t.active !== false)
  if (!hasEntertainment && activeEnt.length > 0) {
    options.push({
      key: 'entertainment',
      code: 'ENTERTAINMENT',
      name: 'Entertainment',
      behavior: 'entertainment',
    })
  }
  return options
}

test('redone POS Config payment types drive tender buttons (not hardcoded only)', () => {
  const options = buildTenderOptions(
    [
      { code: 'CASH', name: 'Cash Counter', sequence: 1, active: true },
      { code: 'DUITNOW', name: 'DuitNow QR', sequence: 2, active: true },
      { code: 'OLD-CARD', name: 'Old Card', sequence: 3, active: false },
    ],
    [],
  )
  assert.deepEqual(
    options.map(o => o.name),
    ['Cash Counter', 'DuitNow QR'],
  )
  assert.equal(paymentMethodForApi('DUITNOW'), 'duitnow')
  assert.equal(paymentMethodForApi('CARD-EMV'), 'credit-card')
})

test('inactive payment types are excluded; entertainment appended when configured', () => {
  const options = buildTenderOptions(
    [{ code: 'CASH', name: 'Cash', sequence: 1, active: true }],
    [{ code: 'STAFF', name: 'Staff meal', active: true }],
  )
  assert.equal(options.length, 2)
  assert.equal(options[1].behavior, 'entertainment')
})

test('empty payment config falls back to built-in tenders', () => {
  const options = buildTenderOptions([], [])
  assert.ok(options.some(o => o.key === 'cash'))
  assert.ok(options.some(o => o.key === 'card-emv'))
})
