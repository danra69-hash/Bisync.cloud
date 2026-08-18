/**
 * Home hosts Team chat on the far left; header bell opens chat popup.
 * RMS landing is dashboard-only (no chat rail / Chat reopen button).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = fs.readFileSync(path.join(root, 'client/src/components/home/HomePage.tsx'), 'utf8');
const desktopCard = fs.readFileSync(
  path.join(root, 'client/src/components/home/HomeDesktopDownloadCard.tsx'),
  'utf8',
);
const updateNotice = fs.readFileSync(
  path.join(root, 'client/src/components/home/DesktopUpdateNotice.tsx'),
  'utf8',
);
const rms = fs.readFileSync(path.join(root, 'client/src/components/revenue/RevMgmtLandingPage.tsx'), 'utf8');
const bell = fs.readFileSync(path.join(root, 'client/src/components/layout/NotificationBell.tsx'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'client/src/components/chat/PlatformTeamChatPanel.tsx'), 'utf8');
const popup = fs.readFileSync(path.join(root, 'client/src/components/chat/PlatformTeamChatPopup.tsx'), 'utf8');

assert.match(home, /PlatformTeamChatPanel/, 'Home must host Team chat panel');
assert.match(home, /lg:w-\[min\(20rem/, 'Home chat must sit in a left rail');
assert.match(home, /HomeDesktopDownloadCard/, 'Download Desktop App sits with chat rail');
assert.match(home, /HomeDeviceUnlockCard/, 'Device unlock sits under Chat above desktop download');
assert.match(home, /DesktopUpdateNotice/, 'Home shows desktop update notice after login');
assert.match(
  home,
  /HomeDeviceUnlockCard[\s\S]*desktop-download/,
  'Device unlock appears above Download Desktop App in left rail',
);
assert.match(home, /p-2\.5 sm:p-3/, 'module cards must be reduced in size');
assert.doesNotMatch(home, /home\.messages\.title/, 'placeholder Messages block removed in favor of Team chat');
assert.match(desktopCard, /DESKTOP_DOWNLOADS/, 'download card uses shared desktop download list');
assert.match(
  fs.readFileSync(path.join(root, 'client/src/data/desktopLauncher.ts'), 'utf8'),
  /Bisync\.cloud-Desktop-Windows\.zip/,
  'desktop launcher data links Windows zip',
);
assert.match(
  fs.readFileSync(path.join(root, 'client/src/data/desktopLauncher.ts'), 'utf8'),
  /Bisync\.cloud-Desktop-macOS\.zip/,
  'desktop launcher data links macOS zip',
);
assert.doesNotMatch(
  fs.readFileSync(path.join(root, 'client/src/data/desktopLauncher.ts'), 'utf8'),
  /Bisync\.cloud-Desktop-Linux\.zip/,
  'Linux desktop download removed',
);
assert.match(updateNotice, /fetchDesktopLauncherVersion/, 'update notice loads desktop version manifest');
assert.match(
  fs.readFileSync(path.join(root, 'client/src/data/desktopLauncher.ts'), 'utf8'),
  /version\.json/,
  'desktop launcher data points at version.json',
);

assert.doesNotMatch(rms, /PlatformTeamChatPanel/, 'RMS landing must not host Team chat panel');
assert.doesNotMatch(rms, /PlatformTeamChatReopenFab/, 'RMS landing must not show Chat reopen button');
assert.match(rms, /OverviewDashboard/, 'RMS landing shows overview dashboard');

assert.match(bell, /PlatformTeamChatPopup/, 'notification bell must open chat popup');
assert.match(bell, /setChatOpen\(true\)/, 'bell click opens chat');
assert.match(popup, /Team chat/, 'popup titles Team chat');
assert.match(panel, /TeamChatsLanding/, 'panel reuses Team chat functions only');

const chats = fs.readFileSync(path.join(root, 'client/src/modules/hr/TeamChatsLanding.tsx'), 'utf8');
const compose = fs.readFileSync(path.join(root, 'client/src/modules/hr/TeamChatComposeModals.tsx'), 'utf8');
assert.match(chats, /openCompose\('menu'\)/, 'Chat + opens compose menu');
assert.match(compose, /Group chat/, 'compose menu includes Group chat');
assert.match(compose, /Project/, 'compose menu includes Project');
assert.match(compose, /Name of the Project/, 'project form asks for project name');
assert.match(compose, /Target Completion Date/, 'project form asks for target date');
assert.match(compose, /Progress Task Bar/, 'project form shows progress task bar');

console.log('platform-team-chat-home-rms.test.mjs: ok');
