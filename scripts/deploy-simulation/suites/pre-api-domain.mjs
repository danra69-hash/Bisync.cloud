import { existsSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { REPO_ROOT, run, log } from '../lib.mjs'

const focused = [
  'scripts/split-use-calculation.test.mjs',
  'scripts/yield-loss-calculation.test.mjs',
  'scripts/stockcard-lifo-average.test.mjs',
  'scripts/open-checks.test.mjs',
  'scripts/fifo-batch-pcu-sync.test.mjs',
  'scripts/stockcard-credit-note-outbound.test.mjs',
  'scripts/stockcard-bbq-cn-inbound-visibility.test.mjs',
  'scripts/stockcard-bbq-never-drop-inbound.test.mjs',
  'scripts/stockcard-universal-du-pcu-parity.test.mjs',
  'scripts/product-list-ginger-ale-visibility.test.mjs',
  'scripts/my-order-engaged-vendors-filter.test.mjs',
  'scripts/precommitted-my-order-drawdown.test.mjs',
  'scripts/precommitted-drawdown-line-indicators.test.mjs',
  'scripts/precommitted-received-qty-reflect.test.mjs',
  'scripts/precommitted-accepted-drawdown.test.mjs',
  'scripts/pr-summary-view-by-detail.test.mjs',
  'scripts/stockcard-whole-receive-inbound.test.mjs',
  'scripts/stock-inbound-step1-bbq.mjs',
  'scripts/credit-note-outbound-residual.mjs',
  'scripts/active-purchase-buckets.mjs',
  'scripts/precommitted-po-pdf-label.mjs',
]

for (const rel of focused) {
  if (!existsSync(path.join(REPO_ROOT, rel))) {
    log(`skip missing ${rel}`)
    continue
  }
  run('node', ['--experimental-strip-types', '--test', rel], { cwd: REPO_ROOT })
}

const hasDotnet = spawnSync('dotnet', ['--info'], { encoding: 'utf8' }).status === 0
if (hasDotnet) {
  run('dotnet', ['build', 'src/Bisync.Api/Bisync.Api.csproj', '-c', 'Release', '-v', 'q'], {
    cwd: REPO_ROOT,
  })
} else {
  log('dotnet not available — skipping API compile simulation (CI build-api covers this)')
}

console.log('pre-api-domain: ok')
