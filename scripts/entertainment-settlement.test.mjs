import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  discountCentsFromPercent,
  findEntertainmentBlockedProducts,
  findPosConfigBlockedProducts,
  formatDiscountLabel,
  formatEntertainmentPurpose,
} from '../client/src/data/entertainmentSettlement.ts'

describe('entertainment settlement helpers', () => {
  it('blocks exception groups and product ids unless includeAll', () => {
    const cart = [
      { id: 1, name: 'Lager', group: 'Beer' },
      { id: 2, name: 'Burger', group: 'Food' },
      { id: 3, name: 'Wine', group: 'Wine' },
    ]
    const blocked = findEntertainmentBlockedProducts(
      {
        includeAll: false,
        exceptionGroups: ['Wine'],
        exceptionProductIds: [1],
      },
      cart,
    )
    assert.deepEqual(
      blocked.map(p => p.name).sort(),
      ['Lager', 'Wine'],
    )
  })

  it('includeAll overrides exceptions', () => {
    const blocked = findPosConfigBlockedProducts(
      {
        includeAll: true,
        exceptionGroups: ['Wine'],
        exceptionProductIds: [1],
      },
      [{ id: 1, name: 'Lager', group: 'Beer' }],
    )
    assert.equal(blocked.length, 0)
  })

  it('formats purpose with employee and reason', () => {
    const purpose = formatEntertainmentPurpose('STAFF', 'Jane Doe', 'VIP dinner')
    assert.equal(purpose, 'STAFF · Jane Doe — VIP dinner')
  })

  it('computes discount cents from percentage', () => {
    assert.equal(discountCentsFromPercent(10000, 10), 1000)
    assert.equal(discountCentsFromPercent(999, 100), 999)
    assert.equal(discountCentsFromPercent(1000, 0), 0)
  })

  it('formats optional discount label', () => {
    assert.equal(formatDiscountLabel('VIP', 15), 'VIP 15%')
    assert.equal(formatDiscountLabel('VIP', 15, 'Manager courtesy'), 'VIP 15%: Manager courtesy')
  })
})
