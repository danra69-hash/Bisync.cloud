/** Mobile.pulse domain helpers — QR attendance + training set validation (no DB). */

export function randomFourDigits(rng = Math.random) {
  return String(Math.floor(rng() * 10000)).padStart(4, '0');
}

/**
 * QR payload: PULSE|{locationId}|{YYYY-MM-DD}|{HH:mm}|{4digit}|{stampId}
 */
export function buildAttendanceQr({ locationId, date, time, random4, stampId }) {
  if (!locationId || !date || !time || !random4 || !stampId) {
    throw new Error('locationId, date, time, random4, stampId required');
  }
  if (!/^\d{4}$/.test(String(random4))) {
    throw new Error('random4 must be 4 digits');
  }
  return ['PULSE', locationId, date, time, random4, stampId].join('|');
}

export function parseAttendanceQr(payload) {
  const parts = String(payload || '').trim().split('|');
  if (parts.length !== 6 || parts[0] !== 'PULSE') {
    return null;
  }
  const [, locationId, date, time, random4, stampId] = parts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  if (!/^\d{4}$/.test(random4)) return null;
  return { locationId, date, time, random4, stampId };
}

export function validateStrengthSet(set) {
  const weight = Number(set.weight);
  const reps = Number(set.reps);
  const setsCount = Number(set.setsCount ?? set.sets_count ?? 1);
  if (!(weight >= 0) || !(reps > 0) || !(setsCount > 0)) {
    return { ok: false, error: 'Strength set requires weight >= 0, reps > 0, sets > 0' };
  }
  return {
    ok: true,
    value: {
      modality: 'strength',
      weight,
      reps,
      setsCount,
      speed: null,
      incline: null,
      durationSec: null,
    },
  };
}

export function validateCardioSet(set) {
  const speed = Number(set.speed);
  const incline = Number(set.incline ?? 0);
  const durationSec = Number(set.durationSec ?? set.duration_sec);
  if (!(speed >= 0) || !(durationSec > 0)) {
    return { ok: false, error: 'Cardio set requires speed >= 0 and durationSec > 0' };
  }
  return {
    ok: true,
    value: {
      modality: 'cardio',
      weight: null,
      reps: null,
      setsCount: 1,
      speed,
      incline,
      durationSec,
    },
  };
}

export function normalizeTrainingSet(input) {
  const modality = String(input.modality || 'strength').toLowerCase();
  if (modality === 'cardio') return validateCardioSet(input);
  return validateStrengthSet(input);
}
