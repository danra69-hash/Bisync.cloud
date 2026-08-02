import { readdirSync } from 'node:fs'
import path from 'node:path'
import { run, REPO_ROOT, log } from '../lib.mjs'

const scriptsDir = path.join(REPO_ROOT, 'scripts')
const files = readdirSync(scriptsDir)
  .filter(f => f.endsWith('.test.mjs'))
  .sort()

if (files.length === 0) {
  throw new Error('No scripts/*.test.mjs found')
}

for (const file of files) {
  const full = path.join('scripts', file)
  log(`unit: ${full}`)
  // Some tests import client/*.ts — Node strip-types makes that work without a bundler.
  run('node', ['--experimental-strip-types', '--test', full], { cwd: REPO_ROOT })
}

console.log(`pre-unit-scripts: ok (${files.length} files)`)
