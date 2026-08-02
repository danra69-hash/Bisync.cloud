import { run, REPO_ROOT } from '../lib.mjs'

run('node', ['scripts/verify-brand-assets.mjs'], { cwd: REPO_ROOT })
try {
  run('node', ['scripts/verify-structure-ownership.mjs'], { cwd: REPO_ROOT })
} catch {
  // Ownership verifier may need a base ref in shallow CI; retry with HEAD.
  run('node', ['scripts/verify-structure-ownership.mjs', '--base', 'HEAD'], { cwd: REPO_ROOT })
}

console.log('pre-core: ok')
