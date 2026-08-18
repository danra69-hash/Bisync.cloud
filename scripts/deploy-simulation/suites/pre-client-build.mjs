import path from 'node:path'
import { clientNodeModulesReady, REPO_ROOT, run, log } from '../lib.mjs'

const clientDir = path.join(REPO_ROOT, 'client')
if (!clientNodeModulesReady()) {
  log('Installing client dependencies…')
  run('npm', ['ci'], { cwd: clientDir })
}

run('npm', ['run', 'build'], { cwd: clientDir })
run('node', ['scripts/verify-brand-assets.mjs', '--dist', 'client/dist'], { cwd: REPO_ROOT })

console.log('pre-client-build: ok')
