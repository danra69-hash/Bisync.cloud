#!/usr/bin/env node
/**
 * Deploy simulation gate.
 *
 * Pre-deploy (local / CI / before Cloud Build):
 *   node scripts/run-deploy-simulation.mjs --phase=pre
 *   node scripts/run-deploy-simulation.mjs --phase=pre --base=origin/master
 *   node scripts/run-deploy-simulation.mjs --phase=pre --all
 *
 * Post-deploy (against live Cloud Run):
 *   DEPLOY_SIM_BASE_URL=https://… node scripts/run-deploy-simulation.mjs --phase=post
 *
 * Exit 0 only when every selected suite passes. Any throw fails the deploy gate.
 */
import { selectSuites } from './deploy-simulation/registry.mjs'
import { changedFiles, log, run, REPO_ROOT } from './deploy-simulation/lib.mjs'

function parseArgs(argv) {
  const out = {
    phase: 'pre',
    base: process.env.DEPLOY_SIM_BASE || 'origin/master',
    all: false,
  }
  for (const arg of argv) {
    if (arg === '--all') out.all = true
    else if (arg.startsWith('--phase=')) out.phase = arg.slice('--phase='.length)
    else if (arg.startsWith('--base=')) out.base = arg.slice('--base='.length)
    else if (arg === '--help' || arg === '-h') out.help = true
  }
  if (out.phase !== 'pre' && out.phase !== 'post') {
    throw new Error(`--phase must be pre or post (got ${out.phase})`)
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(`Usage:
  node scripts/run-deploy-simulation.mjs --phase=pre [--base=origin/master] [--all]
  DEPLOY_SIM_BASE_URL=https://… node scripts/run-deploy-simulation.mjs --phase=post [--all]
`)
    return
  }

  const files = args.all ? ['*'] : changedFiles(args.base)
  log(`Deploy simulation · phase=${args.phase} · base=${args.base}`)
  log(`Changed files (${args.all ? 'ALL' : files.length}):`)
  for (const f of (args.all ? ['*'] : files).slice(0, 40)) log(`  - ${f}`)
  if (!args.all && files.length > 40) log(`  … +${files.length - 40} more`)

  const suites = selectSuites(args.all ? ['*'] : files, args.phase)
  if (suites.length === 0) {
    log('No suites selected — nothing to simulate.')
    return
  }

  log(`Suites (${suites.length}):`)
  for (const s of suites) log(`  • ${s.id} — ${s.title}`)

  const failures = []
  for (const suite of suites) {
    log('')
    log(`===== ${suite.id} =====`)
    try {
      const [cmd, ...cmdArgs] = suite.run.split(' ')
      // suite.run is "node path/to/file.mjs"
      run(cmd, cmdArgs, { cwd: REPO_ROOT })
      log(`PASS ${suite.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`FAIL ${suite.id}: ${msg}`)
      failures.push(suite.id)
    }
  }

  log('')
  if (failures.length) {
    console.error(`Deploy simulation FAILED (${failures.length}): ${failures.join(', ')}`)
    process.exit(1)
  }
  log('Deploy simulation PASSED')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
