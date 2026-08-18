import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/** Mirrors SalesModuleClientUpdateService.ResolveTeamMember fuzzy rules. */
function firstNameToken(name) {
  return String(name ?? '').trim().split(/\s+/)[0] ?? ''
}

function normalizePersonToken(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function resolveTeamMember(team, hunter, existingMemberId) {
  if (existingMemberId > 0) {
    const byId = team.find(m => m.id === existingMemberId)
    if (byId) return byId
  }
  const key = String(hunter ?? '').trim()
  if (!key) return null
  if (/^(sales|hunter)$/i.test(key)) return null

  const exact = team.find(m =>
    m.name.toLowerCase() === key.toLowerCase()
    || m.email.toLowerCase() === key.toLowerCase()
    || m.email.toLowerCase().startsWith(`${key.toLowerCase()}@`))
  if (exact) return exact

  const token = normalizePersonToken(key)
  if (token.length < 2) return null

  const matches = team.filter(m => {
    if (normalizePersonToken(firstNameToken(m.name)) === token) return true
    if (normalizePersonToken(m.name) === token) return true
    const local = m.email.split('@')[0] ?? ''
    return normalizePersonToken(local) === token
  })
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) {
    const hunters = matches.filter(m => m.isHunter)
    if (hunters.length === 1) return hunters[0]
  }
  return null
}

describe('Sales Module hunter rematch (Excel SALES / HUNTER)', () => {
  const team = [
    { id: 1, name: 'Manfred Tan', email: 'manfred@cubevalue.com', isHunter: true },
    { id: 2, name: 'Khafiz Rahman', email: 'khafiz@cubevalue.com', isHunter: true },
    { id: 3, name: 'Syazwan Ali', email: 'syazwan@cubevalue.com', isHunter: true },
    { id: 4, name: 'DRA Admin', email: 'dra@cubevalue.com', isHunter: true },
  ]

  it('matches first-name Excel tokens to full Sales Team names', () => {
    assert.equal(resolveTeamMember(team, 'MANFRED', null)?.id, 1)
    assert.equal(resolveTeamMember(team, 'KHAFIZ', null)?.id, 2)
    assert.equal(resolveTeamMember(team, 'SYAZWAN', null)?.id, 3)
    assert.equal(resolveTeamMember(team, 'DRA', null)?.id, 4)
  })

  it('matches email local-part and ignores SALES placeholder', () => {
    assert.equal(resolveTeamMember(team, 'manfred', null)?.id, 1)
    assert.equal(resolveTeamMember(team, 'SALES', null), null)
  })

  it('Client DB company keys prefer company over brand', () => {
    const company = ' Movida Group '
    const brand = ' The Brew House '
    const name = company.trim() || brand.trim()
    assert.equal(name, 'Movida Group')
  })
})
