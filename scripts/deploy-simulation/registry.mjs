/**
 * Map changed paths → simulation suites that must pass before/after deploy.
 * Keep this list current when adding major product areas.
 */

/** @typedef {{ id: string, title: string, phase: 'pre' | 'post' | 'both', match: RegExp[], always?: boolean, run: string }} SuiteDef */

/** @type {SuiteDef[]} */
export const SUITES = [
  {
    id: 'pre-core',
    title: 'Core brand + ownership gates',
    phase: 'pre',
    always: true,
    match: [],
    run: 'node scripts/deploy-simulation/suites/pre-core.mjs',
  },
  {
    id: 'pre-unit-scripts',
    title: 'Repo unit simulations (node --test / assert scripts)',
    phase: 'pre',
    always: true,
    match: [],
    run: 'node scripts/deploy-simulation/suites/pre-unit-scripts.mjs',
  },
  {
    id: 'pre-pos',
    title: 'POS catalog / modifiers / Component SWAP simulations',
    phase: 'pre',
    match: [
      /^client\/src\/bisync-pos\//,
      /^client\/src\/components\/revenue\/Pos/,
      /^client\/src\/pages\/PosAppPage/,
      /^client\/src\/data\/pos/,
      /^client\/src\/data\/productVariable/,
      /^client\/src\/data\/productVariableComponent/,
      /^client\/scripts\/sim-/,
      /^src\/Bisync\.Api\/Controllers\/Pos/,
      /^src\/Bisync\.Api\/Models\/PosModifier/,
      /^src\/Bisync\.Api\/Services\/ProductSale/,
    ],
    run: 'node scripts/deploy-simulation/suites/pre-pos.mjs',
  },
  {
    id: 'pre-api-domain',
    title: 'API domain unit simulations (stock / yield / split-use)',
    phase: 'pre',
    match: [
      /^src\/Bisync\.Api\//,
      /^scripts\/(split-use|yield-loss|stockcard)/,
      /^client\/src\/components\/revenue\/Stock/,
    ],
    run: 'node scripts/deploy-simulation/suites/pre-api-domain.mjs',
  },
  {
    id: 'pre-client-build',
    title: 'Client production build (crash-on-compile)',
    phase: 'pre',
    match: [/^client\//],
    run: 'node scripts/deploy-simulation/suites/pre-client-build.mjs',
  },
  {
    id: 'post-live-smoke',
    title: 'Live health + SPA smoke after deploy',
    phase: 'post',
    always: true,
    match: [],
    run: 'node scripts/deploy-simulation/suites/post-live-smoke.mjs',
  },
  {
    id: 'post-pos-live',
    title: 'Live POS Modifier / Component SWAP / catalog APIs',
    phase: 'post',
    match: [
      /^client\/src\/bisync-pos\//,
      /^client\/src\/components\/revenue\/Pos/,
      /^client\/src\/pages\/PosAppPage/,
      /^client\/src\/data\/pos/,
      /^client\/src\/data\/productVariable/,
      /^src\/Bisync\.Api\/Controllers\/Pos/,
      /^src\/Bisync\.Api\/Models\/PosModifier/,
    ],
    // Also run after every deploy so POS regressions are caught early.
    always: true,
    run: 'node scripts/deploy-simulation/suites/post-pos-live.mjs',
  },
]

const FORCE_ALL_PRE = [
  /^scripts\/deploy-simulation\//,
  /^scripts\/run-deploy-simulation\.mjs$/,
  /^\.github\/workflows\/(deploy|ci)\.yml$/,
  /^\.cursor\/rules\/deploy/,
]

export function selectSuites(changedPaths, phase) {
  const paths = (changedPaths.length ? changedPaths : ['*']).map(p => p.replace(/\\/g, '/'))
  const forceAll = paths.includes('*')
    || (phase === 'pre' && paths.some(p => FORCE_ALL_PRE.some(re => re.test(p))))
  return SUITES.filter(suite => {
    if (suite.phase !== phase && suite.phase !== 'both') return false
    if (suite.always || forceAll) return true
    return suite.match.some(re => paths.some(p => re.test(p)))
  })
}
