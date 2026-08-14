import path from 'node:path'
import { run, log, REPO_ROOT } from '../lib.mjs'

log('pulse domain unit tests')
run('node', ['--test', 'pulse/scripts/pulse-domain.test.mjs'])

log('pulse web production build')
run('npm', ['run', 'build'], { cwd: path.join(REPO_ROOT, 'pulse/web') })

console.log('pre-pulse: ok')
