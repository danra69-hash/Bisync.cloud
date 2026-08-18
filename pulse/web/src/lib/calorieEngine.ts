/**
 * Reference calorie-estimation engine for Pulse (ported from calorie_engine.py).
 *
 * Design: every public function returns a point estimate AND an uncertainty band.
 * Units are SI unless a variable name says otherwise. Energy in kcal; VO₂ in ml/kg/min
 * unless suffixed _abs.
 *
 * Not wired into session logging yet — inspect via Training → Ref & Library.
 * Full write-up: pulse/docs/calorie-engine/SPEC.md
 */

export const MET_VO2 = 3.5;
export const KCAL_PER_L_O2 = 5.0;
export const MPH_TO_M_PER_MIN = 26.8224;
export const WATT_TO_KGM_PER_MIN = 6.1183;

export type Confidence = 'high' | 'medium' | 'low';
export type Sex = 'M' | 'F';

export interface MemberProfile {
  bodyMassKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
  leanMassKg?: number | null;
}

export interface Estimate {
  grossKcal: number;
  netKcal: number;
  method: string;
  confidence: Confidence;
  uncertaintyPct: number;
  warnings: string[];
}

export function rmrKcalDay(m: MemberProfile): number {
  if (m.leanMassKg != null) {
    return 370.0 + 21.6 * m.leanMassKg;
  }
  const base = 9.99 * m.bodyMassKg + 6.25 * m.heightCm - 4.92 * m.ageYears;
  return base + (m.sex.toUpperCase() === 'M' ? 5.0 : -161.0);
}

export function rmrKcalMin(m: MemberProfile): number {
  return rmrKcalDay(m) / 1440.0;
}

/** Individualised resting VO₂ in ml/kg/min (replaces flat 3.5). */
export function rmrVo2(m: MemberProfile): number {
  return rmrKcalDay(m) / (7.2 * m.bodyMassKg);
}

export function estimateBand(e: Estimate): [number, number] {
  const lo = e.netKcal * (1 - e.uncertaintyPct);
  const hi = e.netKcal * (1 + e.uncertaintyPct);
  return [Math.round(lo), Math.round(hi)];
}

export function formatEstimate(e: Estimate): string {
  const [lo, hi] = estimateBand(e);
  const warn = e.warnings.length ? `, ${e.warnings.join('; ')}` : '';
  return `<${e.method}: ${e.netKcal.toFixed(0)} kcal net (${lo}-${hi}), ${e.grossKcal.toFixed(0)} gross, conf=${e.confidence}${warn}>`;
}

function vo2ToEstimate(
  vo2: number,
  member: MemberProfile,
  minutes: number,
  method: string,
  confidence: Confidence,
  unc: number,
  warnings: string[] = [],
): Estimate {
  const vo2AbsLMin = (vo2 * member.bodyMassKg) / 1000.0;
  const gross = vo2AbsLMin * KCAL_PER_L_O2 * minutes;
  const net = gross - rmrKcalMin(member) * minutes;
  return {
    grossKcal: gross,
    netKcal: Math.max(net, 0),
    method,
    confidence,
    uncertaintyPct: unc,
    warnings,
  };
}

export function treadmill(
  member: MemberProfile,
  speedMph: number,
  gradePct: number,
  minutes: number,
): Estimate {
  const s = speedMph * MPH_TO_M_PER_MIN;
  const g = gradePct / 100.0;
  const warnings: string[] = [];
  let vo2: number;
  let mode: string;
  let conf: Confidence;
  let unc: number;

  if (speedMph < 4.0) {
    vo2 = 0.1 * s + 1.8 * s * g + MET_VO2;
    mode = 'ACSM walking';
    conf = 'high';
    unc = 0.1;
    if (speedMph < 1.9) {
      conf = 'low';
      unc = 0.25;
      warnings.push('below validated walking range (1.9 mph)');
    }
    if (speedMph > 3.7) {
      conf = 'medium';
      unc = 0.15;
      warnings.push('in the 3.7-5.0 mph walk/run dead zone');
    }
  } else {
    vo2 = 0.2 * s + 0.9 * s * g + MET_VO2;
    mode = 'ACSM running';
    conf = 'high';
    unc = 0.1;
    if (speedMph < 5.0) {
      conf = 'medium';
      unc = 0.15;
      warnings.push('in the 3.7-5.0 mph walk/run dead zone');
    }
  }

  if (gradePct > 20) {
    conf = 'low';
    unc = 0.25;
    warnings.push('grade above 20% is outside validated range');
  }

  return vo2ToEstimate(vo2, member, minutes, mode, conf, unc, warnings);
}

export function cycleErgometer(member: MemberProfile, watts: number, minutes: number): Estimate {
  const w = watts * WATT_TO_KGM_PER_MIN;
  const vo2 = (1.8 * w) / member.bodyMassKg + 7.0;
  const warnings: string[] = [];
  let conf: Confidence = 'high';
  let unc = 0.1;
  if (!(w >= 300 && w <= 1200)) {
    conf = 'low';
    unc = 0.2;
    warnings.push(`${watts.toFixed(0)} W outside validated 50-200 W range`);
  }
  return vo2ToEstimate(vo2, member, minutes, 'ACSM leg cycle', conf, unc, warnings);
}

export function armErgometer(member: MemberProfile, watts: number, minutes: number): Estimate {
  const w = watts * WATT_TO_KGM_PER_MIN;
  const vo2 = (3.0 * w) / member.bodyMassKg + MET_VO2;
  const warnings: string[] = [];
  let conf: Confidence = 'medium';
  let unc = 0.15;
  if (!(w >= 150 && w <= 750)) {
    conf = 'low';
    unc = 0.25;
    warnings.push(`${watts.toFixed(0)} W outside validated 25-125 W range`);
  }
  if (member.sex.toUpperCase() === 'F') {
    warnings.push('ACSM arm equation overpredicts in women');
  }
  return vo2ToEstimate(vo2, member, minutes, 'ACSM arm cycle', conf, unc, warnings);
}

export function stepper(
  member: MemberProfile,
  stepsPerMin: number,
  stepHeightM: number,
  minutes: number,
): Estimate {
  const vo2 = 0.2 * stepsPerMin + 1.33 * 1.8 * stepHeightM * stepsPerMin + MET_VO2;
  const warnings: string[] = [];
  let conf: Confidence = 'medium';
  let unc = 0.2;
  if (!(stepsPerMin >= 12 && stepsPerMin <= 30)) {
    conf = 'low';
    unc = 0.3;
    warnings.push('step rate outside validated 12-30 steps/min');
  }
  if (!(stepHeightM >= 0.04 && stepHeightM <= 0.4)) {
    conf = 'low';
    unc = 0.3;
    warnings.push('step height outside validated 4-40 cm');
  }
  return vo2ToEstimate(vo2, member, minutes, 'ACSM stepping', conf, unc, warnings);
}

export function metActivity(
  member: MemberProfile,
  met: number,
  minutes: number,
  label = 'Compendium MET',
  confidence: Confidence = 'medium',
  unc = 0.2,
): Estimate {
  // Gross uses standard MET×3.5; net subtracts individualised RMR (Byrne-style correction).
  void (met * (MET_VO2 / rmrVo2(member)));
  const gross = ((met * MET_VO2 * member.bodyMassKg) / 1000.0) * KCAL_PER_L_O2 * minutes;
  const net = gross - rmrKcalMin(member) * minutes;
  return {
    grossKcal: gross,
    netKcal: Math.max(net, 0),
    method: label,
    confidence,
    uncertaintyPct: unc,
    warnings: [],
  };
}

export function stairClimber(member: MemberProfile, minutes: number, met = 9.3): Estimate {
  return metActivity(member, met, minutes, 'Compendium 02065 stair treadmill', 'medium', 0.2);
}

export function rower(member: MemberProfile, avgWatts: number, minutes: number): Estimate {
  const lb = member.bodyMassKg * 2.20462;
  const shownPerHr = 4.0 * avgWatts + 300.0;
  const truePerHr = shownPerHr - 300.0 + 1.714 * lb;
  const gross = (truePerHr * minutes) / 60.0;
  const net = gross - rmrKcalMin(member) * minutes;
  return {
    grossKcal: gross,
    netKcal: Math.max(net, 0),
    method: 'Concept2 (mass-corrected)',
    confidence: 'high',
    uncertaintyPct: 0.12,
    warnings: [],
  };
}

export function elliptical(
  member: MemberProfile,
  minutes: number,
  opts?: { met?: number; cadence?: number; resistance?: number },
): Estimate {
  if (opts?.cadence != null && opts?.resistance != null) {
    const vo2 =
      3.5 + 0.15 * opts.cadence + 1.22 * opts.resistance - 0.11 * member.bodyMassKg;
    return vo2ToEstimate(vo2, member, minutes, 'Dalleck & Kravitz elliptical', 'low', 0.25, [
      'resistance level is machine-specific; requires per-model calibration',
    ]);
  }
  return metActivity(
    member,
    opts?.met ?? 5.0,
    minutes,
    'Compendium elliptical MET',
    'medium',
    0.2,
  );
}

export const Intensity = {
  LIGHT: { code: '02054', met: 3.5, desc: '8-15 reps, varied resistance' },
  MODERATE: { code: '02052', met: 5.0, desc: 'squats/deadlift, slow or explosive' },
  VIGOROUS: { code: '02050', met: 6.0, desc: 'power lifting / body building, vigorous' },
  CIRCUIT: { code: '02055', met: 5.8, desc: 'circuit, reciprocal supersets' },
  BODYWEIGHT: { code: '02056', met: 3.0, desc: 'bodyweight resistance, general' },
} as const;

export type IntensityKey = keyof typeof Intensity;
export type IntensityValue = (typeof Intensity)[IntensityKey];

export interface SetRecord {
  exerciseId: string;
  weightKg: number;
  reps: number;
}

export function strengthMet(
  member: MemberProfile,
  intensity: IntensityValue,
  sessionMinutes: number,
): Estimate {
  return metActivity(
    member,
    intensity.met,
    sessionMinutes,
    `Compendium ${intensity.code} (${intensity.desc})`,
    'medium',
    0.25,
  );
}

export type ExerciseSlope = {
  romM: number;
  kcalPerKj: number;
  bodymassFrac: number;
};

/** Calibration seeds — not published constants. Recalibrate on own data. */
export const EXERCISE_SLOPES: Record<string, ExerciseSlope> = {
  bench_press: { romM: 0.395, kcalPerKj: 2.3, bodymassFrac: 0.0 },
  incline_press: { romM: 0.4, kcalPerKj: 2.6, bodymassFrac: 0.0 },
  deadlift: { romM: 0.557, kcalPerKj: 2.1, bodymassFrac: 0.0 },
  half_squat: { romM: 0.4, kcalPerKj: 2.4, bodymassFrac: 0.85 },
  leg_press: { romM: 0.355, kcalPerKj: 2.2, bodymassFrac: 0.0 },
  leg_extension: { romM: 0.35, kcalPerKj: 2.8, bodymassFrac: 0.0 },
  lat_pulldown: { romM: 0.5, kcalPerKj: 2.0, bodymassFrac: 0.0 },
  biceps_curl: { romM: 0.35, kcalPerKj: 2.1, bodymassFrac: 0.0 },
  triceps_ext: { romM: 0.3, kcalPerKj: 2.2, bodymassFrac: 0.0 },
  shoulder_press: { romM: 0.45, kcalPerKj: 2.3, bodymassFrac: 0.0 },
  seated_row: { romM: 0.45, kcalPerKj: 2.0, bodymassFrac: 0.0 },
};

export const G = 9.80665;
export const REF_WORK_KJ_PER_MIN = 0.62;
export const WORK_MODIFIER_MIN = 0.7;
export const WORK_MODIFIER_MAX = 1.45;
export const WORK_MODIFIER_DAMPING = 0.5;
export const EPOC_FRACTION = 0.15;

export function concentricWorkKj(
  exerciseId: string,
  weightKg: number,
  reps: number,
  member: MemberProfile,
): number | null {
  const ex = EXERCISE_SLOPES[exerciseId];
  if (!ex) return null;
  const movedMass = weightKg + ex.bodymassFrac * member.bodyMassKg;
  const joules = movedMass * G * ex.romM * reps;
  return joules / 1000.0;
}

export function strengthWorkBased(
  member: MemberProfile,
  sets: SetRecord[],
  sessionMinutes: number,
  intensity: IntensityValue = Intensity.LIGHT,
): Estimate {
  const baseline = strengthMet(member, intensity, sessionMinutes);
  const warnings = [...baseline.warnings];

  let totalKj = 0;
  let unknown = 0;
  for (const s of sets) {
    const kj = concentricWorkKj(s.exerciseId, s.weightKg, s.reps, member);
    if (kj == null) {
      unknown += 1;
    } else {
      totalKj += (kj * EXERCISE_SLOPES[s.exerciseId].kcalPerKj) / 2.3;
    }
  }

  if (totalKj === 0 || sessionMinutes <= 0) {
    warnings.push('no catalogued exercises; MET baseline only');
    return { ...baseline, warnings };
  }

  const ratio = totalKj / sessionMinutes / REF_WORK_KJ_PER_MIN;
  const modifier = Math.min(
    Math.max(ratio ** WORK_MODIFIER_DAMPING, WORK_MODIFIER_MIN),
    WORK_MODIFIER_MAX,
  );

  if (modifier === WORK_MODIFIER_MIN || modifier === WORK_MODIFIER_MAX) {
    warnings.push(`work modifier clamped at ${modifier.toFixed(2)}`);
  }
  if (unknown) {
    warnings.push(`${unknown} of ${sets.length} sets used uncatalogued exercises`);
  }

  const net = baseline.netKcal * modifier;
  const gross = net + rmrKcalMin(member) * sessionMinutes;
  return {
    grossKcal: gross,
    netKcal: net,
    method: `MET anchor x work modifier ${modifier.toFixed(2)}`,
    confidence: 'low',
    uncertaintyPct: 0.3,
    warnings,
  };
}

export function strengthLytle(member: MemberProfile, sets: SetRecord[]): Estimate | null {
  if (member.leanMassKg == null) return null;
  const fatMass = member.bodyMassKg - member.leanMassKg;
  const tv = sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
  const net =
    0.874 * member.heightCm -
    0.596 * member.ageYears -
    1.016 * fatMass +
    1.638 * member.leanMassKg +
    2.461 * (tv / 1000.0) -
    110.742;
  return {
    grossKcal: net,
    netKcal: Math.max(net, 0),
    method: 'Lytle et al. 2019',
    confidence: 'medium',
    uncertaintyPct: 0.2,
    warnings: ['TV coefficient scaling needs verification vs printed paper'],
  };
}

export function sessionTotal(
  member: MemberProfile,
  components: Estimate[],
  applyEpoc = true,
): Estimate {
  let gross = components.reduce((s, c) => s + c.grossKcal, 0);
  let net = components.reduce((s, c) => s + c.netKcal, 0);
  const warnings = components.flatMap((c) => c.warnings);
  if (applyEpoc) {
    net *= 1 + EPOC_FRACTION;
    gross *= 1 + EPOC_FRACTION;
    warnings.push(`includes flat +${(EPOC_FRACTION * 100).toFixed(0)}% EPOC assumption`);
  }
  const unc = Math.max(...components.map((c) => c.uncertaintyPct), 0.2);
  const conf: Confidence = unc >= 0.25 ? 'low' : unc >= 0.15 ? 'medium' : 'high';
  void member;
  return {
    grossKcal: gross,
    netKcal: net,
    method: 'session total',
    confidence: conf,
    uncertaintyPct: unc,
    warnings,
  };
}

/** Library metadata for the Ref & Library UI (not used in calc). */
export const ENGINE_META = {
  version: '0.1.0-ref',
  status: 'reference — not wired to training log',
  accuracy: {
    cardio: '±10–15% (in-range, steady state)',
    strength: '±25–30% per session (realistic ceiling)',
  },
  sources: [
    '2024 Adult Compendium of Physical Activities',
    "ACSM's Guidelines for Exercise Testing and Prescription (GETP)",
    'Concept2 calorie / watts model',
    'Mifflin-St Jeor RMR (Academy of Nutrition & Dietetics: Strong)',
  ],
} as const;
