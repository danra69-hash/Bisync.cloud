#!/usr/bin/env node
/**
 * Structure ownership verifier.
 *
 * Fails when:
 * - Manifest IDs/routes collide
 * - Declared path/symbol is missing
 * - A new page/controller file is not registered
 * - Compared with a base branch/ref, protected fields (owner, path, symbol, route, kind, id) change
 *
 * Usage:
 *   node scripts/verify-structure-ownership.mjs
 *   node scripts/verify-structure-ownership.mjs --base origin/master
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'ownership', 'structure-ownership.json');

const args = process.argv.slice(2);
function argValue(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}
const baseRef = argValue('--base');
const skipUnregistered = args.includes('--skip-unregistered');
const failOnOwnerChange = !args.includes('--allow-owner-change');

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fileExists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function symbolPresent(content, symbol) {
  if (symbol === 'default') {
    return /export\s+default\b/.test(content);
  }
  const patterns = [
    new RegExp(`export\\s+(?:default\\s+)?function\\s+${symbol}\\b`),
    new RegExp(`export\\s+(?:default\\s+)?class\\s+${symbol}\\b`),
    new RegExp(`export\\s+(?:const|let|var)\\s+${symbol}\\b`),
    new RegExp(`export\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}`),
    new RegExp(`public\\s+class\\s+${symbol}\\b`),
    new RegExp(`class\\s+${symbol}\\b`),
    new RegExp(`function\\s+${symbol}\\b`),
  ];
  return patterns.some(re => re.test(content));
}

function walkFiles(absDir, predicate, out = []) {
  if (!fs.existsSync(absDir)) return out;
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'bin' || entry.name === 'obj') {
        continue;
      }
      walkFiles(full, predicate, out);
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function toPosix(rel) {
  return rel.split(path.sep).join('/');
}

function discoverRequiredFiles() {
  const roots = [
    path.join(repoRoot, 'client', 'src', 'pages'),
    path.join(repoRoot, 'client', 'src', 'components'),
    path.join(repoRoot, 'client', 'src', 'modules'),
    path.join(repoRoot, 'src', 'Bisync.Api', 'Controllers'),
  ];
  const files = [];
  for (const root of roots) {
    walkFiles(root, full => {
      const name = path.basename(full);
      const rel = toPosix(path.relative(repoRoot, full));
      if (rel.startsWith('src/Bisync.Api/Controllers/') && name.endsWith('.cs')) return true;
      if (rel.startsWith('client/src/pages/') && name.endsWith('Page.tsx')) return true;
      if (rel.startsWith('client/src/pages/') && name.endsWith('Gate.tsx')) return true;
      if (rel.startsWith('client/src/components/') && name.endsWith('Page.tsx')) return true;
      if (rel.startsWith('client/src/modules/') && /Module\.tsx$/.test(name)) return true;
      return false;
    }, files);
  }

  // Shells not covered by Page pattern.
  for (const shell of ['client/src/AppRoot.tsx', 'client/src/App.tsx']) {
    if (fileExists(shell)) files.push(path.join(repoRoot, shell));
  }
  return [...new Set(files.map(f => toPosix(path.relative(repoRoot, f))))].sort();
}

function loadBaseManifest(ref) {
  try {
    const raw = execSync(`git show ${ref}:ownership/structure-ownership.json`, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function fingerprint(entry) {
  return {
    id: entry.id,
    kind: entry.kind,
    path: entry.path,
    symbol: entry.symbol,
    route: entry.route,
    owner: entry.owner,
    ownerEmail: entry.ownerEmail,
  };
}

if (!fileExists('ownership/structure-ownership.json')) {
  console.error('Missing ownership/structure-ownership.json');
  process.exit(1);
}

const manifest = readJson(manifestPath);
const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
const policy = manifest.policy ?? {};
const protectedFields = new Set(policy.requireOwnerApprovalFor ?? [
  'owner', 'ownerEmail', 'path', 'symbol', 'route', 'kind', 'id',
]);

if (entries.length === 0) fail('Manifest has no entries.');

const idSet = new Map();
const routeSet = new Map();
const pathSymbolSet = new Map();
const registeredPaths = new Set();

for (const entry of entries) {
  if (!entry?.id) {
    fail('Entry missing id.');
    continue;
  }
  if (!/^dr\.[a-z0-9]+(\.[a-z0-9-]+)+$/.test(entry.id)) {
    fail(`Invalid ownership id format: ${entry.id} (expected dr.<area>.<name>)`);
  }
  if (idSet.has(entry.id)) {
    fail(`Duplicate ownership id: ${entry.id} (${idSet.get(entry.id)} and ${entry.path})`);
  } else {
    idSet.set(entry.id, entry.path);
  }

  if (!entry.path) fail(`${entry.id}: missing path`);
  if (!entry.symbol) fail(`${entry.id}: missing symbol`);
  if (!entry.owner) fail(`${entry.id}: missing owner`);
  if (!entry.ownerEmail) fail(`${entry.id}: missing ownerEmail`);
  if (!entry.kind) fail(`${entry.id}: missing kind`);
  if (!entry.route) fail(`${entry.id}: missing route`);

  if (entry.route) {
    const routeKey = `${entry.kind}:${String(entry.route).toLowerCase()}`;
    if (routeSet.has(routeKey)) {
      fail(`Duplicate route for kind: ${entry.route} used by ${routeSet.get(routeKey)} and ${entry.id}`);
    } else {
      routeSet.set(routeKey, entry.id);
    }
  }

  const psKey = `${entry.path}::${entry.symbol}`;
  if (pathSymbolSet.has(psKey)) {
    fail(`Duplicate path+symbol: ${psKey} (${pathSymbolSet.get(psKey)} and ${entry.id})`);
  } else {
    pathSymbolSet.set(psKey, entry.id);
  }

  registeredPaths.add(entry.path);

  if (!fileExists(entry.path)) {
    fail(`${entry.id}: path does not exist: ${entry.path}`);
    continue;
  }

  const content = readText(entry.path);
  if (!symbolPresent(content, entry.symbol)) {
    fail(`${entry.id}: symbol '${entry.symbol}' not found in ${entry.path}`);
  }
}

if (!skipUnregistered) {
  const discovered = discoverRequiredFiles();
  for (const rel of discovered) {
    if (!registeredPaths.has(rel)) {
      fail(`Unregistered structure file: ${rel}. Add an ownership entry with a unique dr.* id.`);
    }
  }
}

const compareRef = baseRef
  || process.env.OWNERSHIP_BASE_REF
  || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null);

if (compareRef) {
  const baseManifest = loadBaseManifest(compareRef);
  if (!baseManifest) {
    warn(`No ownership manifest at ${compareRef}; skipping base-diff checks (first introduction is OK).`);
  } else {
    const baseById = new Map((baseManifest.entries ?? []).map(e => [e.id, e]));
    for (const entry of entries) {
      const previous = baseById.get(entry.id);
      if (!previous) continue;
      const before = fingerprint(previous);
      const after = fingerprint(entry);
      for (const field of protectedFields) {
        if (before[field] !== after[field]) {
          if (field === 'owner' || field === 'ownerEmail') {
            if (failOnOwnerChange) {
              fail(
                `${entry.id}: protected field '${field}' changed from '${before[field]}' to '${after[field]}'. `
                + 'Owner reassignment requires platform-owner approval.',
              );
            }
          } else if (field === 'path' || field === 'symbol' || field === 'route' || field === 'kind' || field === 'id') {
            fail(
              `${entry.id}: protected structural field '${field}' changed from '${before[field]}' to '${after[field]}'. `
              + 'This override is blocked; create a new id or obtain platform-owner approval to update the manifest.',
            );
          }
        }
      }
      baseById.delete(entry.id);
    }

    for (const [removedId, removed] of baseById) {
      fail(
        `Ownership id removed without migration: ${removedId} (${removed.path}). `
        + 'Removing a registered structure requires platform-owner approval.',
      );
    }
  }
} else {
  warn('No --base / OWNERSHIP_BASE_REF provided; skipping owner-change and removal checks.');
}

if (warnings.length) {
  console.log('Warnings:');
  for (const w of warnings) console.log(`  - ${w}`);
}

if (errors.length) {
  console.error(`\nStructure ownership check FAILED (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error('\nRegister new pages/controllers in ownership/structure-ownership.json with a unique dr.* id.');
  process.exit(1);
}

console.log(`Structure ownership OK · ${entries.length} entries verified.`);
