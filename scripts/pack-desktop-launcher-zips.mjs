/**
 * Rebuild Home-page desktop launcher zips from source folders.
 * Windows: bat + ico + Install-Desktop-Shortcut.vbs
 * macOS: command file
 *
 *   node scripts/pack-desktop-launcher-zips.mjs
 */
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desk = path.join(root, 'client/public/downloads/bisync-desktop');
const winDir = path.join(desk, 'windows');
const macDir = path.join(desk, 'mac');
const winZip = path.join(desk, 'Bisync.cloud-Desktop-Windows.zip');
const macZip = path.join(desk, 'Bisync.cloud-Desktop-macOS.zip');

async function packWithZipCli(sourceDir, outZip, files) {
  await rm(outZip, { force: true });
  execFileSync('zip', ['-j', '-9', outZip, ...files.map(f => path.join(sourceDir, f))], {
    stdio: 'inherit',
  });
}

const winFiles = [
  'Bisync.cloud.bat',
  'Bisync.cloud.ico',
  'Install-Desktop-Shortcut.vbs',
];
for (const f of winFiles) {
  const p = path.join(winDir, f);
  try {
    await readFile(p);
  } catch {
    throw new Error(`Missing Windows desktop source: ${p}`);
  }
}

await packWithZipCli(winDir, winZip, winFiles);
console.log('Wrote', winZip);

const macCommand = path.join(macDir, 'Bisync.cloud.command');
try {
  await readFile(macCommand);
  await packWithZipCli(macDir, macZip, ['Bisync.cloud.command']);
  console.log('Wrote', macZip);
} catch {
  console.warn('macOS launcher source missing — skipped', macCommand);
}

await writeFile(
  path.join(desk, 'README.txt'),
  `Bisync.cloud — Desktop app downloads
====================================

Public downloads (linked from the Home page):

  Bisync.cloud-Desktop-Windows.zip
    1. Unzip
    2. Double-click Install-Desktop-Shortcut.vbs  (creates Desktop shortcut with Bisync logo)
       — or run Bisync.cloud.bat (creates the shortcut, then opens the app)
    3. Use the Desktop / Start Menu “Bisync.cloud” shortcut thereafter

  Bisync.cloud-Desktop-macOS.zip    — open Bisync.cloud.command
    (right-click → Open the first time)

Linux desktop packages are not offered.

Rebuild zips after editing windows/ or mac/:
  node scripts/pack-desktop-launcher-zips.mjs
`,
  'utf8',
);
console.log('Updated README.txt');
