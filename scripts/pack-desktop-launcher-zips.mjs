/**
 * Rebuild Home-page desktop launcher zips from source folders.
 * Reads version.json, stamps DESKTOP_VERSION into bat/vbs/command, then zips.
 *
 *   node scripts/pack-desktop-launcher-zips.mjs
 *   DESKTOP_VERSION=1.2.0 node scripts/pack-desktop-launcher-zips.mjs
 */
import { readFile, rm, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desk = path.join(root, 'client/public/downloads/bisync-desktop');
const winDir = path.join(desk, 'windows');
const macDir = path.join(desk, 'mac');
const winZip = path.join(desk, 'Bisync.cloud-Desktop-Windows.zip');
const macZip = path.join(desk, 'Bisync.cloud-Desktop-macOS.zip');
const versionPath = path.join(desk, 'version.json');

async function packWithZipCli(sourceDir, outZip, files) {
  await rm(outZip, { force: true });
  execFileSync('zip', ['-j', '-9', outZip, ...files.map(f => path.join(sourceDir, f))], {
    stdio: 'inherit',
  });
}

function stampVersion(text, version) {
  return text
    .replace(/set "DESKTOP_VERSION=[^"]*"/g, `set "DESKTOP_VERSION=${version}"`)
    .replace(/desktopVersion = "[^"]*"/g, `desktopVersion = "${version}"`)
    .replace(/DESKTOP_VERSION="[^"]*"/g, `DESKTOP_VERSION="${version}"`);
}

let versionInfo = {
  version: process.env.DESKTOP_VERSION || '1.1.0',
  releasedAt: new Date().toISOString(),
  notes: 'Desktop launcher update',
  windowsZip: '/downloads/bisync-desktop/Bisync.cloud-Desktop-Windows.zip',
  macZip: '/downloads/bisync-desktop/Bisync.cloud-Desktop-macOS.zip',
};
try {
  const existing = JSON.parse(await readFile(versionPath, 'utf8'));
  versionInfo = {
    ...existing,
    ...versionInfo,
    version: process.env.DESKTOP_VERSION || existing.version || versionInfo.version,
    notes: existing.notes || versionInfo.notes,
  };
} catch {
  /* fresh */
}

const version = String(versionInfo.version).trim();
versionInfo.version = version;
versionInfo.releasedAt = new Date().toISOString();

const batPath = path.join(winDir, 'Bisync.cloud.bat');
const vbsPath = path.join(winDir, 'Install-Desktop-Shortcut.vbs');
const icoPath = path.join(winDir, 'Bisync.cloud.ico');
const macCommand = path.join(macDir, 'Bisync.cloud.command');

for (const p of [batPath, vbsPath, icoPath]) {
  try {
    await readFile(p);
  } catch {
    throw new Error(`Missing Windows desktop source: ${p}`);
  }
}

await writeFile(batPath, stampVersion(await readFile(batPath, 'utf8'), version), 'utf8');
await writeFile(vbsPath, stampVersion(await readFile(vbsPath, 'utf8'), version), 'utf8');

await packWithZipCli(winDir, winZip, [
  'Bisync.cloud.bat',
  'Bisync.cloud.ico',
  'Install-Desktop-Shortcut.vbs',
]);
console.log('Wrote', winZip, `(v${version})`);

try {
  let macText = await readFile(macCommand, 'utf8');
  macText = stampVersion(macText, version);
  await writeFile(macCommand, macText, 'utf8');
  await chmod(macCommand, 0o755).catch(() => {});
  await packWithZipCli(macDir, macZip, ['Bisync.cloud.command']);
  console.log('Wrote', macZip, `(v${version})`);
} catch {
  console.warn('macOS launcher source missing — skipped', macCommand);
}

await writeFile(versionPath, `${JSON.stringify(versionInfo, null, 2)}\n`, 'utf8');
console.log('Wrote', versionPath);

await writeFile(
  path.join(desk, 'README.txt'),
  `Bisync.cloud — Desktop app downloads
====================================

Current launcher version: ${version}
Manifest: /downloads/bisync-desktop/version.json

Public downloads (linked from the Home page, under Team chat):

  Bisync.cloud-Desktop-Windows.zip
    1. Unzip
    2. Double-click Install-Desktop-Shortcut.vbs  (creates Desktop shortcut with Bisync logo)
       — or run Bisync.cloud.bat (creates the shortcut, then opens the app)
    3. Use the Desktop / Start Menu “Bisync.cloud” shortcut thereafter
    4. After platform updates, Home shows a desktop update notice after login

  Bisync.cloud-Desktop-macOS.zip    — open Bisync.cloud.command
    (right-click → Open the first time)

Linux desktop packages are not offered.

Bump / rebuild:
  DESKTOP_VERSION=1.2.0 node scripts/pack-desktop-launcher-zips.mjs
`,
  'utf8',
);
console.log('Updated README.txt');
