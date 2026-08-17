import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAttendanceQr,
  parseAttendanceQr,
  randomFourDigits,
  normalizeTrainingSet,
} from '../api/src/mobile-domain.mjs';

test('QR payload encodes location/date/time/4digit/id', () => {
  const payload = buildAttendanceQr({
    locationId: 'loc_dt',
    date: '2026-08-17',
    time: '09:30',
    random4: '0421',
    stampId: 'stamp_1',
  });
  assert.equal(payload, 'PULSE|loc_dt|2026-08-17|09:30|0421|stamp_1');
  const parsed = parseAttendanceQr(payload);
  assert.deepEqual(parsed, {
    locationId: 'loc_dt',
    date: '2026-08-17',
    time: '09:30',
    random4: '0421',
    stampId: 'stamp_1',
  });
});

test('QR parse rejects malformed payloads', () => {
  assert.equal(parseAttendanceQr('NOPE'), null);
  assert.equal(parseAttendanceQr('PULSE|a|bad|09:30|12|x'), null);
  assert.equal(parseAttendanceQr('PULSE|a|2026-08-17|9:30|1234|x'), null);
});

test('randomFourDigits is always 4 digits', () => {
  for (let i = 0; i < 20; i += 1) {
    assert.match(randomFourDigits(() => i / 20), /^\d{4}$/);
  }
});

test('member QR encode/decode', async () => {
  const { buildMemberQr, parseMemberQr } = await import('../api/src/mobile-domain.mjs');
  assert.equal(buildMemberQr('mem_1'), 'PULSEMEMBER|mem_1');
  assert.deepEqual(parseMemberQr('PULSEMEMBER|mem_1'), { memberId: 'mem_1' });
  assert.equal(parseMemberQr('PULSE|x'), null);
});

test('normalizeTrainingSet strength and cardio', () => {
  const s = normalizeTrainingSet({ modality: 'strength', weight: 60, reps: 8, setsCount: 3 });
  assert.equal(s.ok, true);
  const c = normalizeTrainingSet({ modality: 'cardio', speed: 9, incline: 1, durationSec: 300 });
  assert.equal(c.ok, true);
  const bad = normalizeTrainingSet({ modality: 'strength', weight: 60, reps: 0 });
  assert.equal(bad.ok, false);
});
