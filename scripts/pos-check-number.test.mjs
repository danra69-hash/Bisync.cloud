import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/** Mirrors client/src/bisync-pos/features/register/domain/checkNumber.ts */

function nextPosCheckNumber(random = Math.random) {
  return Math.floor(100000 + random() * 900000)
}

function formatPosCheckNumber(checkNumber) {
  const n = Math.trunc(Math.abs(Number(checkNumber)))
  if (!Number.isFinite(n)) return '000000'
  return String(n).padStart(6, '0').slice(-6)
}

describe('POS check numbers are 6 digits', () => {
  it('nextPosCheckNumber stays in 100000–999999', () => {
    for (const r of [0, 0.5, 0.999999]) {
      const n = nextPosCheckNumber(() => r)
      assert.ok(n >= 100000 && n <= 999999, String(n))
      assert.equal(String(n).length, 6)
    }
  })

  it('formatPosCheckNumber pads legacy 4-digit checks', () => {
    assert.equal(formatPosCheckNumber(1042), '001042')
    assert.equal(formatPosCheckNumber(248731), '248731')
  })
})
