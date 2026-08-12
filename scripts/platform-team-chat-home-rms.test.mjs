/**
 * Home + RMS landing host Team chat on the far left; header bell opens chat popup.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = fs.readFileSync(path.join(root, 'client/src/components/home/HomePage.tsx'), 'utf8');
const rms = fs.readFileSync(path.join(root, 'client/src/components/revenue/RevMgmtLandingPage.tsx'), 'utf8');
const bell = fs.readFileSync(path.join(root, 'client/src/components/layout/NotificationBell.tsx'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'client/src/components/chat/PlatformTeamChatPanel.tsx'), 'utf8');
const popup = fs.readFileSync(path.join(root, 'client/src/components/chat/PlatformTeamChatPopup.tsx'), 'utf8');

assert.match(home, /PlatformTeamChatPanel/, 'Home must host Team chat panel');
assert.match(home, /lg:w-\[min\(20rem/, 'Home chat must sit in a left rail');
assert.match(home, /p-2\.5 sm:p-3/, 'module cards must be reduced in size');
assert.doesNotMatch(home, /home\.messages\.title/, 'placeholder Messages block removed in favor of Team chat');

assert.match(rms, /PlatformTeamChatPanel/, 'RMS landing must host Team chat panel');
assert.match(rms, /lg:flex-row/, 'RMS landing chat on far left');

assert.match(bell, /PlatformTeamChatPopup/, 'notification bell must open chat popup');
assert.match(bell, /setChatOpen\(true\)/, 'bell click opens chat');
assert.match(popup, /Team chat/, 'popup titles Team chat');
assert.match(panel, /TeamChatsLanding/, 'panel reuses Team chat functions only');

console.log('platform-team-chat-home-rms.test.mjs: ok');
