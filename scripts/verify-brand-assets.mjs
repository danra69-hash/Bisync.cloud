#!/usr/bin/env node
/**
 * Brand / favicon ship integrity verifier.
 *
 * Fails when scaffolding or legacy marks can leak into source or a built SPA:
 * - Banned Vite/React template assets under client/
 * - Favicon missing the official Bisync chain mark (#F37021)
 * - Favicon / SVGs containing legacy purple marks (#863bff / #aa3bff)
 * - Unused Vite scaffolding (icons.svg, App.css, vite.svg, react.svg, hero.png)
 * - PDF logo fallback still using purple Vite RGB
 * - index.html favicon link not cache-busted to the current favicon content hash
 * - Built dist/ (via --dist) still containing scaffolding or wrong favicon
 * - Tracked src/Bisync.Api/wwwroot/ publish output in git
 *
 * Usage:
 *   node scripts/verify-brand-assets.mjs
 *   node scripts/verify-brand-assets.mjs --dist client/dist
 */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
function argValue(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}
const distArg = argValue('--dist');

const BRAND_ORANGE = '#F37021';
const LEGACY_PURPLE = '#863bff';
const CHAIN_PATHS = [
  'M48 7H24a15 15 0 0 0 0 30h24',
  'M32 7h24a15 15 0 0 1 0 30H32',
];

const BANNED_REL_PATHS = [
  'client/src/assets/vite.svg',
  'client/src/assets/react.svg',
  'client/src/assets/hero.png',
  'client/public/vite.svg',
  'client/public/react.svg',
  'client/public/icons.svg',
  'client/src/App.css',
];

const BANNED_CONTENT_SNIPPETS = [
  { id: 'legacy-purple', re: /#863bff/i, hint: 'old purple Vite favicon color' },
  { id: 'vite-template-purple', re: /#aa3bff/i, hint: 'Vite/Figma template purple (#aa3bff)' },
  { id: 'vite-logo-title', re: /vite-logo-title|aria-labelledby="vite-logo|<title[^>]*>\s*Vite\s*<\/title>/i, hint: 'Vite template logo' },
  { id: 'react-atom', re: /iconify--logos.*react|fill="#00D8FF"/i, hint: 'React template logo' },
  { id: 'vite-starter-css', re: /\.hero\s*\{[\s\S]*\.vite\s*\{|#next-steps|#docs\b/i, hint: 'Vite starter App.css residue' },
  { id: 'legacy-purple-rgb', re: /setFillColor\(\s*134\s*,\s*59\s*,\s*255\s*\)/, hint: 'PDF fallback still uses purple Vite RGB' },
];

const errors = [];

function fail(message) {
  errors.push(message);
}

function abs(relPath) {
  return path.join(repoRoot, relPath);
}

function exists(relPath) {
  return fs.existsSync(abs(relPath));
}

function read(relPath) {
  return fs.readFileSync(abs(relPath), 'utf8');
}

function sha1(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 10);
}

function gitTracked(relPath) {
  try {
    const out = execSync(`git ls-files -- "${relPath}"`, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

function walkFiles(absDir, out = []) {
  if (!fs.existsSync(absDir)) return out;
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'bin', 'obj', '.git'].includes(entry.name)) continue;
      walkFiles(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

// ── 1. Banned scaffolding files ──────────────────────────────────────────────
for (const rel of BANNED_REL_PATHS) {
  if (exists(rel)) {
    fail(`Banned scaffolding asset must not exist: ${rel}`);
  }
}

// ── 2. Official favicon ──────────────────────────────────────────────────────
const faviconRel = 'client/public/favicon.svg';
if (!exists(faviconRel)) {
  fail(`Missing required favicon: ${faviconRel}`);
} else {
  const favicon = read(faviconRel);
  if (!favicon.includes(BRAND_ORANGE)) {
    fail(`Favicon must use Bisync brand orange ${BRAND_ORANGE}`);
  }
  if (favicon.toLowerCase().includes(LEGACY_PURPLE)) {
    fail(`Favicon must not contain legacy purple ${LEGACY_PURPLE}`);
  }
  for (const d of CHAIN_PATHS) {
    if (!favicon.includes(d)) {
      fail(`Favicon missing official Bisync chain path: ${d}`);
    }
  }

  const expectedV = sha1(favicon);
  const indexHtml = read('client/index.html');
  const iconHrefs = [...indexHtml.matchAll(/rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/gi)]
    .map(m => m[1]);
  if (iconHrefs.length === 0) {
    fail('client/index.html must declare a favicon <link rel="icon" ...>');
  }
  for (const href of iconHrefs) {
    if (!href.startsWith('/favicon.svg?v=')) {
      fail(`Favicon link must be cache-busted (/favicon.svg?v=…), got: ${href}`);
      continue;
    }
    const v = href.slice('/favicon.svg?v='.length);
    if (v !== expectedV) {
      fail(
        `Favicon cache-bust mismatch: index.html has ?v=${v} but favicon.svg sha1 is ${expectedV}. ` +
          `Update client/index.html after changing favicon.svg.`,
      );
    }
  }
}

// ── 3. Ban legacy signatures in public + src SVG/HTML ────────────────────────
const scanRoots = ['client/public', 'client/src', 'client/index.html'];
for (const root of scanRoots) {
  const full = abs(root);
  const files = fs.existsSync(full) && fs.statSync(full).isDirectory()
    ? walkFiles(full).filter(f => /\.(svg|html|tsx|ts|jsx|js|css)$/i.test(f))
    : exists(root) ? [full] : [];
  for (const file of files) {
    const rel = path.relative(repoRoot, file).replaceAll('\\', '/');
    // Official mark source of truth may mention legacy only in comments — still ban color codes.
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const banned of BANNED_CONTENT_SNIPPETS) {
      if (banned.re.test(text)) {
        fail(`${rel}: contains banned brand signature (${banned.hint})`);
      }
    }
  }
}

// ── 4. wwwroot must never be committed ───────────────────────────────────────
if (gitTracked('src/Bisync.Api/wwwroot')) {
  fail('src/Bisync.Api/wwwroot/ is tracked in git — SPA publish output must not be committed');
}

// ── 5. Built dist (only when --dist is passed, e.g. CI after npm run build) ───
const distRel = distArg;
if (distRel) {
  const distRoot = distRel.replaceAll('\\', '/').replace(/\/$/, '');
  const distFaviconRel = `${distRoot}/favicon.svg`;
  const distIndexRel = `${distRoot}/index.html`;
  if (!exists(distFaviconRel)) {
    fail(`Built SPA missing favicon: ${distFaviconRel}`);
  } else {
    const srcFav = read(faviconRel);
    const distFav = read(distFaviconRel);
    if (srcFav !== distFav) {
      fail(`${distFaviconRel} does not match ${faviconRel}`);
    }
    if (!distFav.includes(BRAND_ORANGE) || distFav.toLowerCase().includes(LEGACY_PURPLE)) {
      fail(`${distFaviconRel} is not the official Bisync chain favicon`);
    }
  }
  if (!exists(distIndexRel)) {
    fail(`Built SPA missing index.html: ${distIndexRel}`);
  } else {
    const distIndex = read(distIndexRel);
    if (!/favicon\.svg\?v=/.test(distIndex)) {
      fail(`${distIndexRel} must reference cache-busted /favicon.svg?v=…`);
    }
    if (distIndex.toLowerCase().includes(LEGACY_PURPLE)) {
      fail(`${distIndexRel} contains legacy purple mark`);
    }
  }
  for (const banned of ['vite.svg', 'react.svg', 'hero.png', 'icons.svg']) {
    const p = `${distRoot}/${banned}`;
    if (exists(p)) {
      fail(`Built SPA must not include scaffolding asset: ${p}`);
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
if (errors.length) {
  console.error('Brand asset verification FAILED:\n');
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(`\n${errors.length} error(s).`);
  process.exit(1);
}

console.log('Brand asset verification OK');
console.log(`  favicon: ${faviconRel} (${BRAND_ORANGE} chain mark)`);
if (distRel) console.log(`  dist:    ${distRel}`);
process.exit(0);
