import assert from 'node:assert/strict'

function lineIdentity(line) {
  return line.lineKey ?? `pid:${line.productId}`
}

function takeUnfiredLines(lines, firedQtyByLine) {
  const nextFired = {}
  const toFire = []
  for (const line of lines) {
    const id = lineIdentity(line)
    const already = Math.max(0, firedQtyByLine[id] ?? 0)
    const qty = line.quantity
    nextFired[id] = qty
    const delta = qty - already
    if (delta > 0) toFire.push({ ...line, quantity: delta })
  }
  return { toFire, nextFiredQtyByLine: nextFired }
}

const first = takeUnfiredLines(
  [{ productId: '1', quantity: 2 }, { productId: '2', lineKey: 'line-a', quantity: 1 }],
  {},
)
assert.equal(first.toFire.length, 2)
assert.equal(first.toFire[0].quantity, 2)
assert.deepEqual(first.nextFiredQtyByLine, { 'pid:1': 2, 'line-a': 1 })

const second = takeUnfiredLines(
  [{ productId: '1', quantity: 3 }, { productId: '2', lineKey: 'line-a', quantity: 1 }],
  first.nextFiredQtyByLine,
)
assert.equal(second.toFire.length, 1)
assert.equal(second.toFire[0].productId, '1')
assert.equal(second.toFire[0].quantity, 1)

const third = takeUnfiredLines(
  [{ productId: '1', quantity: 3 }, { productId: '2', lineKey: 'line-a', quantity: 1 }],
  second.nextFiredQtyByLine,
)
assert.equal(third.toFire.length, 0)

console.log('open-checks.test.mjs: ok')
