/**
 * Bisync101 voice-over helper + new feature lesson coverage.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// Load TS helper via experimental strip types is handled by node --experimental-strip-types
const voicePath = path.join(root, 'client/src/data/bisync101/voice.ts');
assert.ok(fs.existsSync(voicePath), 'voice.ts must exist');

const lesson = fs.readFileSync(
  path.join(root, 'client/src/components/bisync101/Bisync101ScreenLesson.tsx'),
  'utf8',
);
assert.match(lesson, /speakBisync101Step/, 'Screen lesson must speak voice-over');
assert.match(lesson, /Volume2/, 'Screen lesson must expose mute/unmute control');
assert.match(lesson, /voice-over/, 'Badge mentions voice-over');

const gettingStarted = fs.readFileSync(
  path.join(root, 'client/src/data/bisync101/modules/gettingStarted.ts'),
  'utf8',
);
assert.match(gettingStarted, /gs-home-chat/, 'Getting Started covers Home chat Hide');
assert.match(gettingStarted, /gs-home-locations-today/, 'Getting Started covers Locations today');

const hr = fs.readFileSync(path.join(root, 'client/src/data/bisync101/modules/hr.ts'), 'utf8');
assert.match(hr, /hr-team-app-home/, 'HR covers Team app Locations today');

const accounting = fs.readFileSync(
  path.join(root, 'client/src/data/bisync101/modules/accounting.ts'),
  'utf8',
);
assert.match(accounting, /ac-books-workspace/, 'Accounting covers live Books workspace');
assert.doesNotMatch(accounting, /Do not enable reserved GL/, 'Stale Books roadmap tip removed');

const types = fs.readFileSync(path.join(root, 'client/src/data/bisync101/types.ts'), 'utf8');
assert.match(types, /voiceover\?:/, 'Step schema includes voiceover');

// Runtime check of voice text helper
const { bisync101StepVoiceText } = await import('../client/src/data/bisync101/voice.ts');
assert.equal(
  bisync101StepVoiceText({ title: 'Hide', detail: 'Collapse the rail.', voiceover: 'Custom line.' }),
  'Custom line.',
);
assert.equal(
  bisync101StepVoiceText({ title: 'Hide', detail: 'Collapse the rail.' }),
  'Hide. Collapse the rail.',
);

console.log('bisync101-voiceover-features.test.mjs: ok');
// silence unused
void require;
