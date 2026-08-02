import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(__dirname, '../..')

export function log(msg) {
  console.log(msg)
}

export function fail(msg) {
  console.error(`FAIL: ${msg}`)
  process.exitCode = 1
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

export function run(cmd, args, opts = {}) {
  const cwd = opts.cwd || REPO_ROOT
  log(`$ ${cmd} ${args.join(' ')}`)
  const res = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(opts.env || {}) },
    shell: false,
  })
  if (res.stdout?.trim()) process.stdout.write(res.stdout)
  if (res.stderr?.trim()) process.stderr.write(res.stderr)
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${res.status}`)
  }
  return res
}

export function changedFiles(baseRef) {
  const attempts = [
    ['diff', '--name-only', `${baseRef}...HEAD`],
    ['diff', '--name-only', `${baseRef}`, 'HEAD'],
    ['diff', '--name-only', 'HEAD~1', 'HEAD'],
  ]
  for (const args of attempts) {
    const res = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' })
    if (res.status === 0) {
      const files = (res.stdout || '')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
      if (files.length > 0 || args[2]?.includes('HEAD~')) return files
    }
  }
  return []
}

export async function fetchJson(url, init) {
  const res = await fetch(url, init)
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { res, body, text }
}

export function requireLiveBase() {
  const base = (process.env.DEPLOY_SIM_BASE_URL
    || process.env.VITE_API_URL
    || process.env.LIVE_URL
    || 'https://bisync-cloud-389272498937.asia-southeast1.run.app').replace(/\/$/, '')
  return base
}

export function clientNodeModulesReady() {
  return existsSync(path.join(REPO_ROOT, 'client/node_modules'))
}
