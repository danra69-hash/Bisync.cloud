import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildSubnetHostList,
  isPrivateIpv4,
  parseIpv4Octets,
} from '../client/src/bisync-pos/features/boh/domain/deviceLanCheck.ts'

describe('device LAN helpers', () => {
  it('accepts RFC1918 private IPv4', () => {
    assert.equal(isPrivateIpv4('192.168.70.131'), true)
    assert.equal(isPrivateIpv4('10.0.0.5'), true)
    assert.equal(isPrivateIpv4('172.16.1.1'), true)
    assert.equal(isPrivateIpv4('8.8.8.8'), false)
    assert.equal(isPrivateIpv4('192.168.70'), false)
  })

  it('builds /24 host list around station IP', () => {
    const subnet = buildSubnetHostList('192.168.70.131')
    assert.ok(subnet)
    assert.equal(subnet.subnetCidr, '192.168.70.0/24')
    assert.equal(subnet.hosts.length, 254)
    assert.equal(subnet.hosts[0], '192.168.70.1')
    assert.equal(subnet.hosts[130], '192.168.70.131')
  })

  it('parses ipv4 octets', () => {
    assert.deepEqual(parseIpv4Octets('192.168.70.131'), [192, 168, 70, 131])
    assert.equal(parseIpv4Octets('bad'), null)
  })
})
