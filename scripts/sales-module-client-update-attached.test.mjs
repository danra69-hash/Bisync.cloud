import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/**
 * Mirrors Client Update member scope: when a Sales Team member is selected,
 * list all attached clients (tagged companies + existing rows), not period changes.
 */
function companyKey(name) {
  return String(name ?? '').trim().toLowerCase()
}

function mergeAttachedClients(existingRows, taggedCompanies, memberId, memberName) {
  const byCompany = new Map()
  for (const row of existingRows) {
    if (row.salesTeamMemberId !== memberId
      && companyKey(row.hunter) !== companyKey(memberName)) {
      continue
    }
    const key = companyKey(row.company)
    if (!key) continue
    if (!byCompany.has(key)) byCompany.set(key, row)
  }

  const seeded = []
  for (const company of taggedCompanies) {
    const key = companyKey(company.name)
    if (!key || byCompany.has(key)) continue
    const row = {
      id: -(company.id),
      salesTeamMemberId: memberId,
      hunter: memberName,
      company: company.name.trim(),
      brand: '',
      seeded: true,
    }
    byCompany.set(key, row)
    seeded.push(row)
  }

  return {
    rows: [...byCompany.values()].sort((a, b) =>
      companyKey(a.company).localeCompare(companyKey(b.company))),
    seededCount: seeded.length,
  }
}

describe('Client Update attached clients for Sales Team member', () => {
  it('includes tagged companies missing from Client Update rows', () => {
    const result = mergeAttachedClients(
      [
        { id: 1, salesTeamMemberId: 9, hunter: 'Alex', company: 'Acme', brand: 'A' },
        { id: 2, salesTeamMemberId: 8, hunter: 'Other', company: 'Other Co', brand: '' },
      ],
      [
        { id: 10, name: 'Acme' },
        { id: 11, name: 'Beta Foods' },
        { id: 12, name: '  Gamma  ' },
      ],
      9,
      'Alex',
    )
    assert.equal(result.seededCount, 2)
    assert.deepEqual(
      result.rows.map(r => r.company),
      ['Acme', 'Beta Foods', 'Gamma'],
    )
  })

  it('keeps existing member Client Update rows even when company is not tagged', () => {
    const result = mergeAttachedClients(
      [{ id: 3, salesTeamMemberId: 9, hunter: 'Alex', company: 'Legacy Lead', brand: '' }],
      [],
      9,
      'Alex',
    )
    assert.equal(result.seededCount, 0)
    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0].company, 'Legacy Lead')
  })
})
