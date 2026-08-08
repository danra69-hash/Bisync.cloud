import test from 'node:test'
import assert from 'node:assert/strict'
import { prorateAnnualLeaveForOperatingYear, roundToHalfDay } from '../client/src/modules/hr/leaveTenureRules.ts'

test('annual leave operating-year pro-rata', async t => {
  await t.test('rounds to nearest half day', () => {
    assert.equal(roundToHalfDay(16.333), 16.5)
    assert.equal(roundToHalfDay(14), 14)
    assert.equal(roundToHalfDay(10.24), 10)
  })

  await t.test('prior-year join keeps full entitlement', () => {
    const asOf = new Date(Date.UTC(2026, 7, 8))
    assert.equal(prorateAnnualLeaveForOperatingYear(28, '2025-03-15', asOf), 28)
  })

  await t.test('July join in current year is half of 28', () => {
    const asOf = new Date(Date.UTC(2026, 7, 8))
    assert.equal(prorateAnnualLeaveForOperatingYear(28, '2026-07-01', asOf), 14)
  })

  await t.test('June join in current year is 7/12 of 28 → 16.5', () => {
    const asOf = new Date(Date.UTC(2026, 7, 8))
    assert.equal(prorateAnnualLeaveForOperatingYear(28, '2026-06-26', asOf), 16.5)
  })

  await t.test('future join yields zero', () => {
    const asOf = new Date(Date.UTC(2026, 7, 8))
    assert.equal(prorateAnnualLeaveForOperatingYear(28, '2026-12-31', asOf), 0)
  })
})
