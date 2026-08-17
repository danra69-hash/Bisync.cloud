import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appSrc = readFileSync(join(root, 'mobile/App.tsx'), 'utf8');
const membersSrc = readFileSync(join(root, 'mobile/src/screens/MembersScreen.tsx'), 'utf8');
const stampsSrc = readFileSync(join(root, 'mobile/src/screens/MemberStampsScreen.tsx'), 'utf8');
const scanSrc = readFileSync(join(root, 'mobile/src/screens/ScanScreen.tsx'), 'utf8');
const trainingSrc = readFileSync(join(root, 'mobile/src/screens/TrainingScreen.tsx'), 'utf8');
const routes = readFileSync(join(root, 'api/src/mobile-routes.mjs'), 'utf8');

test('coach tabs use Member and Attendance instead of Calendar/Packages', () => {
  assert.match(appSrc, /name="Member"/);
  assert.match(appSrc, /name="Attendance"/);
  assert.match(appSrc, /isCoach \?[\s\S]*Member[\s\S]*Calendar/);
  assert.match(appSrc, /AttendanceScreen/);
});

test('Members list shows purchased vs used sessions', () => {
  assert.match(membersSrc, /members\/coaching/);
  assert.match(membersSrc, /sessionsPurchased/);
  assert.match(membersSrc, /sessionsUsed/);
  assert.match(membersSrc, /MemberStamps/);
});

test('stamp page opens camera scan for available stamp', () => {
  assert.match(stampsSrc, /purpose: 'coachStamp'/);
  assert.match(stampsSrc, /stampIndex/);
  assert.match(scanSrc, /attendance\/stamp\/coach-scan/);
  assert.match(scanSrc, /Start training/);
});

test('training supports equipment and auto-start after stamp', () => {
  assert.match(trainingSrc, /\/api\/mobile\/equipment/);
  assert.match(trainingSrc, /autoStart/);
  assert.match(trainingSrc, /weight/);
  assert.match(trainingSrc, /reps/);
});

test('API members/coaching and coach-scan endpoints exist', () => {
  assert.match(routes, /\/members\/coaching/);
  assert.match(routes, /\/attendance\/stamp\/coach-scan/);
  assert.match(routes, /PULSEMEMBER/);
  assert.match(routes, /memberQr/);
});
