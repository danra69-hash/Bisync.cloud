import { assert, fetchJson, requireLiveBase, log } from '../lib.mjs'

const base = requireLiveBase()
const companyId = Number(process.env.DEPLOY_SIM_COMPANY_ID || 5)
log(`POS live sim · companyId=${companyId} · ${base}`)

const groups = await fetchJson(`${base}/api/pos-modifier-groups?companyId=${companyId}&includeInactive=true`)
assert(groups.res.ok, `pos-modifier-groups HTTP ${groups.res.status}`)
assert(Array.isArray(groups.body), 'pos-modifier-groups must return an array')

for (const g of groups.body) {
  assert(g && typeof g === 'object', 'modifier group row invalid')
  assert(Array.isArray(g.options), `group ${g.id} options missing`)
  for (const o of g.options) {
    assert(o && typeof o.label === 'string', `group ${g.id} has option without label`)
  }
  if (g.kind === 'component-swap') {
    for (const o of g.options) {
      // After inherit, labels should look like Base → Alternate (best-effort).
      if (o.baseComponentName && o.linkedComponentName) {
        assert(
          o.label.includes('→') || o.label.includes(o.baseComponentName),
          `component-swap option ${o.id} label does not describe swap`,
        )
      }
    }
  }
}

const catalog = await fetchJson(
  `${base}/api/pos-modifier-groups/stock-catalog?companyId=${companyId}&kind=component-swap`,
)
assert(catalog.res.ok, `stock-catalog HTTP ${catalog.res.status}`)
assert(Array.isArray(catalog.body?.products), 'stock-catalog.products missing')
assert(Array.isArray(catalog.body?.swapPairs), 'stock-catalog.swapPairs missing')
for (const pair of catalog.body.swapPairs) {
  assert(pair.key && pair.label, 'swapPair missing key/label')
  assert(pair.baseComponentId && pair.linkedComponentId, 'swapPair missing component ids')
  assert(pair.label.includes('→'), `swapPair label should be Base → Alt: ${pair.label}`)
}

const products = await fetchJson(`${base}/api/products?companyId=${companyId}`)
assert(products.res.ok, `products HTTP ${products.res.status}`)
assert(Array.isArray(products.body), 'products must return an array')
const vc = products.body.filter(p => p.isVariableComponent)
log(`Variable Component products: ${vc.length}`)
for (const p of vc) {
  assert(typeof p.variableComponentOptionsJson === 'string' || p.variableComponentOptionsJson == null,
    `product ${p.id} VC json invalid`)
}

const tap = await fetchJson(`${base}/api/pos/test-tap/status?companyId=${companyId}`)
assert(tap.res.ok, `pos test-tap status HTTP ${tap.res.status}`)
assert(tap.body?.ready === true || tap.body?.ready === false, 'test-tap ready flag missing')

// Optional headless /POS pageerror check when Chromium + playwright-core are available.
try {
  const { pathToFileURL } = await import('node:url')
  const candidates = [
    'playwright-core',
    process.env.PLAYWRIGHT_CORE_PATH,
    '/tmp/deploy-sim-pw/node_modules/playwright-core/index.js',
    '/tmp/node_modules/playwright-core/index.js',
  ].filter(Boolean)
  let chromium = null
  let loadErr = null
  for (const spec of candidates) {
    try {
      const mod = spec.includes('/')
        ? await import(pathToFileURL(spec).href)
        : await import(spec)
      chromium = mod.chromium || mod.default?.chromium
      if (chromium) break
    } catch (e) {
      loadErr = e
    }
  }
  if (!chromium) {
    throw loadErr || new Error('playwright-core not found')
  }
  const executable = process.env.CHROME_PATH
    || '/usr/local/bin/google-chrome'
    || '/usr/bin/google-chrome-stable'
  const browser = await chromium.launch({
    executablePath: executable,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-cache'],
  })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.goto(`${base}/POS`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1500)
  await browser.close()
  assert(errors.length === 0, `/POS pageerrors: ${errors.join(' | ')}`)
  log('playwright /POS: no pageerrors')
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  if (/Cannot find module|Cannot find package|playwright|Executable doesn't exist|Failed to launch|not found/i.test(msg)) {
    log(`playwright skipped: ${msg}`)
  } else {
    throw err
  }
}

console.log('post-pos-live: ok')
