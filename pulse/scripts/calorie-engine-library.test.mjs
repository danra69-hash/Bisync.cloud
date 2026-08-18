import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const engineTs = readFileSync(join(root, 'web/src/lib/calorieEngine.ts'), 'utf8');
const libraryTsx = readFileSync(join(root, 'web/src/pages/TrainingCalorieLibrary.tsx'), 'utf8');
const trainingTsx = readFileSync(join(root, 'web/src/pages/TrainingPage.tsx'), 'utf8');

test('Training has Ref & Library tab wired to calorie library', () => {
  assert.match(trainingTsx, /Ref &amp; Library|Ref & Library/);
  assert.match(trainingTsx, /TrainingCalorieLibrary/);
  assert.match(trainingTsx, /training-ref-library-tab/);
  assert.match(libraryTsx, /Calorie engine/);
  assert.match(libraryTsx, /Playground/);
  assert.match(libraryTsx, /Catalogue/);
});

test('calorieEngine.ts exports ACSM + strength tiers + session total', () => {
  for (const sym of [
    'export function treadmill',
    'export function cycleErgometer',
    'export function rower',
    'export function strengthMet',
    'export function strengthWorkBased',
    'export function strengthLytle',
    'export function sessionTotal',
    'EXERCISE_SLOPES',
    'ENGINE_META',
    'not wired',
  ]) {
    assert.match(engineTs, new RegExp(sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.doesNotMatch(trainingTsx, /strengthWorkBased\(/);
});

test('docs keep original SPEC + Python reference', () => {
  assert.ok(existsSync(join(root, 'docs/calorie-engine/SPEC.md')));
  assert.ok(existsSync(join(root, 'docs/calorie-engine/calorie_engine.py')));
  assert.ok(existsSync(join(root, 'docs/calorie-engine/README.md')));
});

test('Python reference harness still passes when python3 is available', () => {
  const py = spawnSync('python3', [join(root, 'docs/calorie-engine/calorie_engine.py')], {
    encoding: 'utf8',
    timeout: 15000,
  });
  if (py.error && /** @type {NodeJS.ErrnoException} */ (py.error).code === 'ENOENT') {
    return; // skip if no python
  }
  assert.equal(py.status, 0, py.stderr || py.stdout);
  assert.match(py.stdout, /ALL ASSERTIONS PASSED/);
});
