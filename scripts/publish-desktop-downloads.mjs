/**
 * Copy built Electron installers into client/public/downloads/bisync-desktop
 * for public Home-page download links.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = path.join(root, 'desktop/release');
const outDir = path.join(root, 'client/public/downloads/bisync-desktop');

const copies = [
  {
    from: 'Bisync.cloud-Setup-1.0.0.exe',
    to: 'Bisync.cloud-Desktop-Windows.exe',
  },
  {
    from: 'Bisync.cloud-1.0.0.AppImage',
    to: 'Bisync.cloud-Desktop-Linux.AppImage',
  },
];

fs.mkdirSync(outDir, { recursive: true });

let copied = 0;
for (const item of copies) {
  const src = path.join(releaseDir, item.from);
  const dest = path.join(outDir, item.to);
  if (!fs.existsSync(src)) {
    console.warn(`skip (missing): ${item.from}`);
    continue;
  }
  fs.copyFileSync(src, dest);
  if (item.to.endsWith('.AppImage')) fs.chmodSync(dest, 0o755);
  console.log(`copied ${item.from} -> downloads/bisync-desktop/${item.to}`);
  copied += 1;
}

if (copied === 0) {
  console.error('No installers found. Build first: cd desktop && npm run dist:win && npm run dist:linux');
  process.exit(1);
}

console.log(`publish-desktop-downloads.mjs: ok (${copied} file(s))`);
