import path from 'node:path'
import { existsSync } from 'node:fs'
import { run, log, REPO_ROOT } from '../lib.mjs'

const apiDir = path.join(REPO_ROOT, 'pulse/api')
const webDir = path.join(REPO_ROOT, 'pulse/web')

function ensureNpmInstall(dir, label) {
  const modules = path.join(dir, 'node_modules')
  // Always install in CI (no node_modules); reuse locally when present.
  if (!existsSync(modules)) {
    log(`npm ci (${label})`)
    const lock = path.join(dir, 'package-lock.json')
    if (existsSync(lock)) run('npm', ['ci'], { cwd: dir })
    else run('npm', ['install'], { cwd: dir })
  } else {
    log(`npm deps already present (${label})`)
  }
}

ensureNpmInstall(apiDir, 'pulse/api')
ensureNpmInstall(webDir, 'pulse/web')

log('pulse domain unit tests')
run('node', ['--test', 'pulse/scripts/pulse-domain.test.mjs'])

log('mobile.pulse domain unit tests')
run('node', ['--test', 'pulse/scripts/mobile-domain.test.mjs'])

log('pulse web production build')
run('npm', ['run', 'build'], { cwd: webDir })

console.log('pre-pulse: ok')
