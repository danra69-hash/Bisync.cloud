import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Light simulation of POS Home lock: Team check-in required unless the
 * signed-in platform email is exempt (dra@cubevalue.com).
 */
const EXEMPT = new Set(['dra@cubevalue.com'])

function isPosDutyCheckInExempt(email) {
  if (!email) return false
  return EXEMPT.has(String(email).trim().toLowerCase())
}

function orderingLocked(duty, email) {
  return !duty && !isPosDutyCheckInExempt(email)
}

describe('POS duty check-in exempt (Home lock)', () => {
  it('locks Home when not on duty and user is not exempt', () => {
    assert.equal(orderingLocked(null, 'ms@cubevalue.com'), true)
    assert.equal(orderingLocked(null, null), true)
    assert.equal(orderingLocked(null, ''), true)
  })

  it('unlocks Home for dra@cubevalue.com without Team check-in', () => {
    assert.equal(orderingLocked(null, 'dra@cubevalue.com'), false)
    assert.equal(orderingLocked(null, 'DRA@cubevalue.com'), false)
    assert.equal(orderingLocked(null, '  dra@cubevalue.com  '), false)
  })

  it('stays unlocked when a duty session exists for any user', () => {
    const duty = { employeeId: 1 }
    assert.equal(orderingLocked(duty, 'ms@cubevalue.com'), false)
    assert.equal(orderingLocked(duty, 'dra@cubevalue.com'), false)
  })

  it('source helper module still declares the exempt email', () => {
    const srcPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../client/src/bisync-pos/core/session/posDutyCheckInExempt.ts',
    )
    const src = readFileSync(srcPath, 'utf8')
    assert.match(src, /dra@cubevalue\.com/)
    assert.match(src, /export function isPosDutyCheckInExempt/)
  })
})
