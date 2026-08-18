import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  defaultBusinessHours,
  hasConfiguredBusinessHours,
  parseBusinessHoursJson,
  resolveOfficeHoursForDate,
  serializeBusinessHours,
  validateBusinessHours,
} from '../client/src/data/companyBusinessHours.ts'

describe('company business hours', () => {
  it('defaults Mon–Fri open and weekend closed', () => {
    const hours = defaultBusinessHours()
    assert.equal(hours.monday.closed, false)
    assert.equal(hours.monday.openFrom, '09:00')
    assert.equal(hours.monday.openTo, '18:00')
    assert.equal(hours.saturday.closed, true)
    assert.equal(hours.sunday.closed, true)
  })

  it('round-trips serialize/parse', () => {
    const json = serializeBusinessHours(defaultBusinessHours())
    assert.equal(hasConfiguredBusinessHours(json), true)
    const parsed = parseBusinessHoursJson(json)
    assert.equal(parsed.friday.openFrom, '09:00')
    assert.equal(parsed.sunday.closed, true)
  })

  it('resolves office expectation by weekday', () => {
    const json = serializeBusinessHours(defaultBusinessHours())
    // 2026-08-03 is a Monday
    const mon = resolveOfficeHoursForDate(json, '2026-08-03')
    assert.ok(mon)
    assert.equal(mon.closed, false)
    assert.equal(mon.openFrom, '09:00')
    assert.equal(mon.openTo, '18:00')
    // 2026-08-08 is a Saturday
    const sat = resolveOfficeHoursForDate(json, '2026-08-08')
    assert.ok(sat)
    assert.equal(sat.closed, true)
  })

  it('validates partial from/to', () => {
    const hours = defaultBusinessHours()
    hours.tuesday = { openFrom: '09:00', openTo: '', closed: false }
    assert.match(validateBusinessHours(hours) ?? '', /Tue/)
  })
})
