/**
 * Bisync101 screen lessons must play slowly enough to follow,
 * with a larger orange cursor on the animated fallback.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lesson = fs.readFileSync(
  path.join(root, 'client/src/components/bisync101/Bisync101ScreenLesson.tsx'),
  'utf8',
);
const capture = fs.readFileSync(
  path.join(root, 'scripts/capture-bisync101-clips.mjs'),
  'utf8',
);

assert.match(lesson, /STEP_MS = 5600/, 'canvas steps must be slowed');
assert.match(lesson, /INTRO_MS = 1400/, 'intro dwell must be longer');
assert.match(lesson, /VIDEO_PLAYBACK_RATE = 0\.65/, 'recorded clips play slower');
assert.match(lesson, /playbackRate = VIDEO_PLAYBACK_RATE/, 'video element uses slowed rate');
assert.match(lesson, /ctx\.scale\(1\.45, 1\.45\)/, 'cursor is slightly bigger');
assert.match(lesson, /ctx\.fillStyle = ORANGE/, 'cursor fill is brand orange');
assert.match(lesson, /0\.18 \+ 0\.64 \* t/, 'cursor moves slowly across hotspot once per step');

assert.match(capture, /width:26px/, 'capture demo cursor is larger');
assert.match(capture, /background:#F37021/, 'capture demo cursor stays orange');

console.log('bisync101-slower-cursor.test.mjs: ok');
