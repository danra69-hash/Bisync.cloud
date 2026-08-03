import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/** Mirrors client/src/data/posStationLinks.ts URL builder. */

function buildPosStationUrl(entry, companyId, locationExternalId, origin = 'https://example.test') {
  const path = { pos: '/POS', kds: '/KDS', bds: '/BDS', cds: '/CDS' }[entry] || '/POS'
  const params = new URLSearchParams({
    c: String(companyId),
    l: locationExternalId,
  })
  return `${origin}${path}?${params.toString()}`
}

describe('POS external webapp deep links', () => {
  it('embeds company and location for phone/tablet open', () => {
    const url = buildPosStationUrl('pos', 12, 'weissbrau-pavilion')
    assert.equal(url, 'https://example.test/POS?c=12&l=weissbrau-pavilion')
  })

  it('maps KDS/BDS/CDS paths', () => {
    assert.match(buildPosStationUrl('kds', 1, 'loc-a'), /\/KDS\?c=1&l=loc-a$/)
    assert.match(buildPosStationUrl('bds', 1, 'loc-a'), /\/BDS\?c=1&l=loc-a$/)
    assert.match(buildPosStationUrl('cds', 1, 'loc-a'), /\/CDS\?c=1&l=loc-a$/)
  })
})
