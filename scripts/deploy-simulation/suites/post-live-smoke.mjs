import { assert, fetchJson, requireLiveBase, log } from '../lib.mjs'

const base = requireLiveBase()
log(`Live base: ${base}`)

const health = await fetchJson(`${base}/api/health`)
assert(health.res.ok, `health HTTP ${health.res.status}`)
assert(health.body?.status === 'healthy', 'health status not healthy')

const index = await fetch(`${base}/`, { headers: { 'Cache-Control': 'no-cache' } })
assert(index.ok, `SPA index HTTP ${index.status}`)
const html = await index.text()
assert(/<!doctype html>/i.test(html), 'SPA index is not HTML')
const asset = html.match(/\/assets\/index-[^"]+\.js/)?.[0]
assert(asset, 'SPA index asset missing')

const jsRes = await fetch(`${base}${asset}`)
assert(jsRes.ok, `SPA asset HTTP ${jsRes.status}`)
const js = await jsRes.text()
assert(js.length > 1000, 'SPA asset unexpectedly small')

const pos = await fetch(`${base}/POS`, { headers: { 'Cache-Control': 'no-cache' } })
assert(pos.ok, `/POS HTTP ${pos.status}`)
const posHtml = await pos.text()
assert(/<!doctype html>/i.test(posHtml), '/POS is not HTML')

console.log('post-live-smoke: ok')
