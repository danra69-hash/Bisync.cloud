import { existsSync } from 'node:fs'
import path from 'node:path'
import { clientNodeModulesReady, REPO_ROOT, run, log } from '../lib.mjs'

if (!clientNodeModulesReady()) {
  log('Installing client dependencies for POS simulation…')
  run('npm', ['ci'], { cwd: path.join(REPO_ROOT, 'client') })
}

run(
  'npx',
  ['--yes', 'vite-node', '--config', 'vite.config.ts', 'scripts/sim-pos-functions.mts'],
  { cwd: path.join(REPO_ROOT, 'client') },
)

// Existing focused VC form tests
const vcTest = path.join(REPO_ROOT, 'scripts/variable-component-form.test.mjs')
if (existsSync(vcTest)) {
  run('node', ['--test', 'scripts/variable-component-form.test.mjs'], { cwd: REPO_ROOT })
}

const dutyExemptTest = path.join(REPO_ROOT, 'scripts/pos-duty-checkin-exempt.test.mjs')
if (existsSync(dutyExemptTest)) {
  run('node', ['--test', 'scripts/pos-duty-checkin-exempt.test.mjs'], { cwd: REPO_ROOT })
}

const floorSyncTest = path.join(REPO_ROOT, 'scripts/pos-floor-plan-sync.test.mjs')
if (existsSync(floorSyncTest)) {
  run('node', ['--test', 'scripts/pos-floor-plan-sync.test.mjs'], { cwd: REPO_ROOT })
}

const checkNumberTest = path.join(REPO_ROOT, 'scripts/pos-check-number.test.mjs')
if (existsSync(checkNumberTest)) {
  run('node', ['--test', 'scripts/pos-check-number.test.mjs'], { cwd: REPO_ROOT })
}

const stationLinksTest = path.join(REPO_ROOT, 'scripts/pos-station-links.test.mjs')
if (existsSync(stationLinksTest)) {
  run('node', ['--test', 'scripts/pos-station-links.test.mjs'], { cwd: REPO_ROOT })
}

console.log('pre-pos: ok')

