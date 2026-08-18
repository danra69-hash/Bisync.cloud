/**
 * Bisync101 voice-over helper + female voice / full-script coverage.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const voicePath = path.join(root, 'client/src/data/bisync101/voice.ts');
assert.ok(fs.existsSync(voicePath), 'voice.ts must exist');
const voiceSrc = fs.readFileSync(voicePath, 'utf8');
assert.match(voiceSrc, /pickBisync101FemaleVoice/, 'Female voice picker required');
assert.match(voiceSrc, /FEMALE_NAME_RE/, 'Female voice name list required');
assert.match(voiceSrc, /MALE_NAME_RE/, 'Male voices must be excluded');
assert.match(voiceSrc, /splitBisync101SpeechChunks/, 'Long scripts must be chunked');
assert.match(voiceSrc, /estimateBisync101SpeechMs/, 'Speech duration estimate required');

const lesson = fs.readFileSync(
  path.join(root, 'client/src/components/bisync101/Bisync101ScreenLesson.tsx'),
  'utf8',
);
assert.match(lesson, /speakBisync101Step/, 'Screen lesson must speak voice-over');
assert.match(lesson, /estimateBisync101SpeechMs/, 'Lesson timing must wait for full script');
assert.match(lesson, /female voice-over/, 'Badge mentions female voice-over');
assert.match(lesson, /holdVideoForSpeech|speechBusyRef/, 'Must hold playback until speech finishes');
assert.doesNotMatch(lesson, /const STEP_MS = 5600/, 'Fixed 5.6s step must not cut off speech');

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

const {
  bisync101StepVoiceText,
  estimateBisync101SpeechMs,
  pickBisync101FemaleVoice,
  splitBisync101SpeechChunks,
} = await import('../client/src/data/bisync101/voice.ts');

assert.equal(
  bisync101StepVoiceText({ title: 'Hide', detail: 'Collapse the rail.', voiceover: 'Custom line.' }),
  'Custom line.',
);
assert.equal(
  bisync101StepVoiceText({ title: 'Hide', detail: 'Collapse the rail.' }),
  'Hide. Collapse the rail.',
);

assert.ok(estimateBisync101SpeechMs('Short.') >= 2800);
assert.ok(
  estimateBisync101SpeechMs(
    'Select a task, watch the screenshot lesson with voice-over, and follow the numbered steps on the right.',
  ) > 5600,
  'Long scripts need more than the old fixed step window',
);

const chunks = splitBisync101SpeechChunks(
  'First sentence one. Second sentence two. Third sentence three that continues a bit longer for the chunker.',
  40,
);
assert.ok(chunks.length >= 2, 'Chunker splits long narration');
assert.ok(chunks.every(c => c.length > 0));

const female = pickBisync101FemaleVoice([
  { name: 'Google UK English Male', lang: 'en-GB' },
  { name: 'Microsoft David', lang: 'en-US' },
  { name: 'Samantha', lang: 'en-US' },
  { name: 'Google US English', lang: 'en-US' },
]);
assert.equal(female?.name, 'Samantha', 'Must pick Samantha over male voices');

const female2 = pickBisync101FemaleVoice([
  { name: 'Microsoft David', lang: 'en-US' },
  { name: 'Google UK English Female', lang: 'en-GB' },
]);
assert.equal(female2?.name, 'Google UK English Female');

const female3 = pickBisync101FemaleVoice([
  { name: 'Microsoft David', lang: 'en-US' },
  { name: 'Microsoft Mark', lang: 'en-US' },
]);
assert.equal(female3, null, 'No female available → null (caller keeps pitch boost only)');

console.log('bisync101-voiceover-features.test.mjs: ok');
