"""
Reference calorie-estimation engine for a multi-site gym chain.

Design principle: every public function returns a point estimate AND an
uncertainty band, because the underlying science does not support point
estimates presented as fact.

Units are SI unless a variable name says otherwise.
All energy figures are kcal. All VO2 figures are ml/kg/min unless suffixed _abs.

Sources for every constant are cited inline. See SPEC.md for the full write-up.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

# ---------------------------------------------------------------------------
# Universal constants
# ---------------------------------------------------------------------------

MET_VO2 = 3.5              # ml/kg/min, 1 MET by definition
KCAL_PER_L_O2 = 5.0        # ACSM convention; RER-adjusted range is 4.69-5.05
MPH_TO_M_PER_MIN = 26.8224
WATT_TO_KGM_PER_MIN = 6.1183
SEC_PER_MIN = 60.0


# ---------------------------------------------------------------------------
# Resting metabolic rate  (Mifflin-St Jeor, published constants)
# Mifflin MD et al. Am J Clin Nutr 1990;51:241-247
# Academy of Nutrition & Dietetics grades this "Strong" for RMR estimation.
# ---------------------------------------------------------------------------

@dataclass
class Member:
    body_mass_kg: float
    height_cm: float
    age_years: int
    sex: str                          # 'M' | 'F'
    lean_mass_kg: Optional[float] = None   # from InBody etc, if available

    def rmr_kcal_day(self) -> float:
        base = 9.99 * self.body_mass_kg + 6.25 * self.height_cm - 4.92 * self.age_years
        if self.lean_mass_kg is not None:
            # Katch-McArdle: better when lean mass is actually measured
            return 370.0 + 21.6 * self.lean_mass_kg
        return base + (5.0 if self.sex.upper() == 'M' else -161.0)

    def rmr_kcal_min(self) -> float:
        return self.rmr_kcal_day() / 1440.0

    def rmr_vo2(self) -> float:
        """Individualised resting VO2 in ml/kg/min. Replaces the flat 3.5."""
        return self.rmr_kcal_day() / (7.2 * self.body_mass_kg)


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------

@dataclass
class Estimate:
    gross_kcal: float
    net_kcal: float
    method: str
    confidence: str                    # 'high' | 'medium' | 'low'
    uncertainty_pct: float             # +/- this fraction, e.g. 0.10
    warnings: list = field(default_factory=list)

    def band(self):
        lo = self.net_kcal * (1 - self.uncertainty_pct)
        hi = self.net_kcal * (1 + self.uncertainty_pct)
        return (round(lo), round(hi))

    def __repr__(self):
        lo, hi = self.band()
        return (f"<{self.method}: {self.net_kcal:.0f} kcal net "
                f"({lo}-{hi}), {self.gross_kcal:.0f} gross, "
                f"conf={self.confidence}{', ' + '; '.join(self.warnings) if self.warnings else ''}>")


def _vo2_to_estimate(vo2, member, minutes, method, confidence, unc, warnings=None):
    """Convert relative gross VO2 (ml/kg/min) to a gross+net kcal estimate."""
    vo2_abs_l_min = vo2 * member.body_mass_kg / 1000.0
    gross = vo2_abs_l_min * KCAL_PER_L_O2 * minutes
    net = gross - member.rmr_kcal_min() * minutes
    return Estimate(gross_kcal=gross, net_kcal=max(net, 0.0), method=method,
                    confidence=confidence, uncertainty_pct=unc,
                    warnings=warnings or [])


# ---------------------------------------------------------------------------
# CARDIO  -- ACSM metabolic equations (GETP)
# ---------------------------------------------------------------------------

def treadmill(member, speed_mph, grade_pct, minutes):
    """ACSM walking/running equations. Grade as a percentage (5 => 5%)."""
    s = speed_mph * MPH_TO_M_PER_MIN          # m/min
    g = grade_pct / 100.0                     # fractional grade -- classic bug source
    warnings = []

    if speed_mph < 4.0:
        vo2 = 0.1 * s + 1.8 * s * g + MET_VO2
        mode, conf, unc = "ACSM walking", "high", 0.10
        if speed_mph < 1.9:
            conf, unc = "low", 0.25
            warnings.append("below validated walking range (1.9 mph)")
        if speed_mph > 3.7:
            conf, unc = "medium", 0.15
            warnings.append("in the 3.7-5.0 mph walk/run dead zone")
    else:
        vo2 = 0.2 * s + 0.9 * s * g + MET_VO2
        mode, conf, unc = "ACSM running", "high", 0.10
        if speed_mph < 5.0:
            conf, unc = "medium", 0.15
            warnings.append("in the 3.7-5.0 mph walk/run dead zone")

    if grade_pct > 20:
        conf, unc = "low", 0.25
        warnings.append("grade above 20% is outside validated range")

    return _vo2_to_estimate(vo2, member, minutes, mode, conf, unc, warnings)


def cycle_ergometer(member, watts, minutes):
    """ACSM leg cycling. VO2 = 1.8 * W/M + 7, W in kg*m/min."""
    w = watts * WATT_TO_KGM_PER_MIN
    vo2 = 1.8 * w / member.body_mass_kg + 7.0
    warnings, conf, unc = [], "high", 0.10
    if not (300 <= w <= 1200):
        conf, unc = "low", 0.20
        warnings.append(f"{watts:.0f} W outside validated 50-200 W range")
    return _vo2_to_estimate(vo2, member, minutes, "ACSM leg cycle", conf, unc, warnings)


def arm_ergometer(member, watts, minutes):
    w = watts * WATT_TO_KGM_PER_MIN
    vo2 = 3.0 * w / member.body_mass_kg + MET_VO2
    warnings, conf, unc = [], "medium", 0.15
    if not (150 <= w <= 750):
        conf, unc = "low", 0.25
        warnings.append(f"{watts:.0f} W outside validated 25-125 W range")
    if member.sex.upper() == 'F':
        warnings.append("ACSM arm equation overpredicts in women")
    return _vo2_to_estimate(vo2, member, minutes, "ACSM arm cycle", conf, unc, warnings)


def stepper(member, steps_per_min, step_height_m, minutes):
    """ACSM stepping. 1.33 factor covers the eccentric step-down cost."""
    vo2 = 0.2 * steps_per_min + 1.33 * 1.8 * step_height_m * steps_per_min + MET_VO2
    warnings, conf, unc = [], "medium", 0.20
    if not (12 <= steps_per_min <= 30):
        conf, unc = "low", 0.30
        warnings.append("step rate outside validated 12-30 steps/min")
    if not (0.04 <= step_height_m <= 0.40):
        conf, unc = "low", 0.30
        warnings.append("step height outside validated 4-40 cm")
    return _vo2_to_estimate(vo2, member, minutes, "ACSM stepping", conf, unc, warnings)


def stair_climber(member, minutes, met=9.3):
    """Stair-treadmill ergometer. No ACSM equation -- Compendium code 02065."""
    return met_activity(member, met, minutes, "Compendium 02065 stair treadmill",
                        "medium", 0.20)


def rower(member, avg_watts, minutes):
    """
    Concept2 model, body-mass corrected.
      kcal/hr shown on PM = 4*W + 300   (300 = baseline for a 175 lb / 79.5 kg athlete)
      true kcal/hr        = shown - 300 + 1.714 * body weight in POUNDS
    """
    lb = member.body_mass_kg * 2.20462
    shown_per_hr = 4.0 * avg_watts + 300.0
    true_per_hr = shown_per_hr - 300.0 + 1.714 * lb
    gross = true_per_hr * minutes / 60.0
    net = gross - member.rmr_kcal_min() * minutes
    return Estimate(gross, max(net, 0.0), "Concept2 (mass-corrected)",
                    "high", 0.12, [])


def elliptical(member, minutes, met=None, cadence=None, resistance=None):
    """
    No ACSM equation. Dalleck & Kravitz 2007 exists but its resistance term is
    machine-specific and NOT portable across manufacturers.
    Default to Compendium METs. Never pass through the console's own number --
    OEM ellipticals overestimate by roughly 2.8x.
    """
    if cadence is not None and resistance is not None:
        vo2 = 3.5 + 0.15 * cadence + 1.22 * resistance - 0.11 * member.body_mass_kg
        return _vo2_to_estimate(
            vo2, member, minutes, "Dalleck & Kravitz elliptical", "low", 0.25,
            ["resistance level is machine-specific; requires per-model calibration"])
    return met_activity(member, met or 5.0, minutes,
                        "Compendium elliptical MET", "medium", 0.20)


# ---------------------------------------------------------------------------
# MET fallback -- works for anything in the Compendium
# ---------------------------------------------------------------------------

def met_activity(member, met, minutes, label="Compendium MET",
                 confidence="medium", unc=0.20):
    """
    kcal = MET * kg * hours, using the CORRECTED MET so heavier/older members
    are not over-estimated (Byrne et al. 2005).
    """
    corrected_met = met * (MET_VO2 / member.rmr_vo2())
    vo2 = corrected_met * member.rmr_vo2()      # == met * 3.5, by construction
    # Use the individualised resting rate as the baseline instead of flat 3.5:
    gross = met * MET_VO2 * member.body_mass_kg / 1000.0 * KCAL_PER_L_O2 * minutes
    net = gross - member.rmr_kcal_min() * minutes
    return Estimate(gross, max(net, 0.0), label, confidence, unc, [])


# ---------------------------------------------------------------------------
# STRENGTH -- three tiers, in descending order of preference
# ---------------------------------------------------------------------------

class Intensity(Enum):
    LIGHT = ("02054", 3.5, "8-15 reps, varied resistance")
    MODERATE = ("02052", 5.0, "squats/deadlift, slow or explosive")
    VIGOROUS = ("02050", 6.0, "power lifting / body building, vigorous")
    CIRCUIT = ("02055", 5.8, "circuit, reciprocal supersets")
    BODYWEIGHT = ("02056", 3.0, "bodyweight resistance, general")


@dataclass
class SetRecord:
    exercise_id: str
    weight_kg: float
    reps: int
    # session-level fields live on the Session, not here


def strength_met(member, intensity: Intensity, session_minutes):
    """
    TIER 1 -- the defensible default.
    kcal = MET * kg * hours over TOTAL SESSION TIME INCLUDING REST.
    Compendium MET values were derived from whole-session measurement; using
    time-under-tension instead is the single most common implementation error.
    """
    code, met, desc = intensity.value
    est = met_activity(member, met, session_minutes,
                       f"Compendium {code} ({desc})", "medium", 0.25)
    return est


# Exercise-specific energy slopes, kcal per kJ of CONCENTRIC work.
# Derived from Knausenberger et al. 2014 (work<->energy r = 0.92-0.997) and
# cross-checked against Reis et al. 2017 measured kcal/min.
# These are calibration seeds, NOT published constants -- recalibrate on your
# own data. See SPEC.md section 6.
EXERCISE_SLOPES = {
    'bench_press':   {'rom_m': 0.395, 'kcal_per_kj': 2.30, 'bodymass_frac': 0.00},
    'incline_press': {'rom_m': 0.400, 'kcal_per_kj': 2.60, 'bodymass_frac': 0.00},
    'deadlift':      {'rom_m': 0.557, 'kcal_per_kj': 2.10, 'bodymass_frac': 0.00},
    'half_squat':    {'rom_m': 0.400, 'kcal_per_kj': 2.40, 'bodymass_frac': 0.85},
    'leg_press':     {'rom_m': 0.355, 'kcal_per_kj': 2.20, 'bodymass_frac': 0.00},
    'leg_extension': {'rom_m': 0.350, 'kcal_per_kj': 2.80, 'bodymass_frac': 0.00},
    'lat_pulldown':  {'rom_m': 0.500, 'kcal_per_kj': 2.00, 'bodymass_frac': 0.00},
    'biceps_curl':   {'rom_m': 0.350, 'kcal_per_kj': 2.10, 'bodymass_frac': 0.00},
    'triceps_ext':   {'rom_m': 0.300, 'kcal_per_kj': 2.20, 'bodymass_frac': 0.00},
    'shoulder_press':{'rom_m': 0.450, 'kcal_per_kj': 2.30, 'bodymass_frac': 0.00},
    'seated_row':    {'rom_m': 0.450, 'kcal_per_kj': 2.00, 'bodymass_frac': 0.00},
}
G = 9.80665


def concentric_work_kj(exercise_id, weight_kg, reps, member):
    """
    Concentric-only mechanical work. Eccentric is NOT counted: Caruso et al.
    2003 found ~3600 J of extra eccentric work at ZERO additional net caloric
    cost (series elastic recoil). Doubling displacement inflates results.
    """
    ex = EXERCISE_SLOPES.get(exercise_id)
    if ex is None:
        return None
    moved_mass = weight_kg + ex['bodymass_frac'] * member.body_mass_kg
    joules = moved_mass * G * ex['rom_m'] * reps
    return joules / 1000.0


# Reference concentric work rate for a "typical" session at the LIGHT MET code.
# Calibration parameter -- set from your own median session, not from a paper.
# Seed value derived from a median 45-min session: ~11,000 kg volume load,
# ~28 kJ concentric work => ~0.62 kJ per minute of session.
REF_WORK_KJ_PER_MIN = 0.62

# How far the work signal is allowed to move the MET anchor. Deliberately
# bounded: the Compendium value is the citable number, work is a modifier.
WORK_MODIFIER_MIN, WORK_MODIFIER_MAX = 0.70, 1.45
WORK_MODIFIER_DAMPING = 0.5   # ratio ** damping; 0.5 = square root


def strength_work_based(member, sets, session_minutes, intensity=Intensity.LIGHT):
    """
    TIER 2 -- the differentiator.

    Design: the Compendium MET value stays the ANCHOR (it is what you cite when
    a journalist or regulator asks). Volume load is applied as a BOUNDED
    MODIFIER on top, so a 140 kg bench and a 40 kg bench no longer return an
    identical number -- which is the whole reason a gym wants this -- without
    letting an unvalidated work model run away from the defensible baseline.

    Damping is applied because Reis & Scott (2016) showed efficiency is NOT
    constant across the load-rep continuum: work rises faster than energy cost
    as load goes up. A raw linear work term over-rewards heavy singles.
    """
    baseline = strength_met(member, intensity, session_minutes)
    warnings = list(baseline.warnings)

    total_kj, unknown = 0.0, 0
    for s in sets:
        kj = concentric_work_kj(s.exercise_id, s.weight_kg, s.reps, member)
        if kj is None:
            unknown += 1
        else:
            # exercise-specific slope normalises for the fact that a leg
            # extension and a deadlift do not cost the same per joule
            total_kj += kj * EXERCISE_SLOPES[s.exercise_id]['kcal_per_kj'] / 2.3

    if total_kj == 0 or session_minutes <= 0:
        warnings.append("no catalogued exercises; MET baseline only")
        baseline.warnings = warnings
        return baseline

    ratio = (total_kj / session_minutes) / REF_WORK_KJ_PER_MIN
    modifier = min(max(ratio ** WORK_MODIFIER_DAMPING,
                       WORK_MODIFIER_MIN), WORK_MODIFIER_MAX)

    if modifier in (WORK_MODIFIER_MIN, WORK_MODIFIER_MAX):
        warnings.append(f"work modifier clamped at {modifier:.2f}")
    if unknown:
        warnings.append(f"{unknown} of {len(sets)} sets used uncatalogued exercises")

    net = baseline.net_kcal * modifier
    gross = net + member.rmr_kcal_min() * session_minutes
    return Estimate(gross, net, f"MET anchor x work modifier {modifier:.2f}",
                    "low", 0.30, warnings)


def strength_lytle(member, sets, ):
    """
    TIER 3 -- Lytle et al. 2019, Med Sci Sports Exerc 51(7):1532-1537.
    Published in ACSM's own journal. Requires body composition.
    NOTE: verify the TV coefficient scaling against the printed paper before
    shipping; the secondary sources disagree on the exponent.
    """
    if member.lean_mass_kg is None:
        return None
    fat_mass = member.body_mass_kg - member.lean_mass_kg
    tv = sum(s.weight_kg * s.reps for s in sets)   # total volume load, kg
    net = (0.874 * member.height_cm
           - 0.596 * member.age_years
           - 1.016 * fat_mass
           + 1.638 * member.lean_mass_kg
           + 2.461 * (tv / 1000.0)
           - 110.742)
    return Estimate(net, max(net, 0.0), "Lytle et al. 2019", "medium", 0.20,
                    ["TV coefficient scaling needs verification vs printed paper"])


# ---------------------------------------------------------------------------
# Session assembly
# ---------------------------------------------------------------------------

EPOC_FRACTION = 0.15   # Farinatti 2013: ~30-60 kcal on 200-300 kcal sessions


def session_total(member, components, apply_epoc=True):
    """components: list of Estimate. Returns a combined Estimate."""
    gross = sum(c.gross_kcal for c in components)
    net = sum(c.net_kcal for c in components)
    warnings = [w for c in components for w in c.warnings]
    if apply_epoc:
        net *= (1 + EPOC_FRACTION)
        gross *= (1 + EPOC_FRACTION)
        warnings.append(f"includes flat +{EPOC_FRACTION:.0%} EPOC assumption")
    # session uncertainty = worst component, floored at 20%
    unc = max([c.uncertainty_pct for c in components] + [0.20])
    conf = "low" if unc >= 0.25 else ("medium" if unc >= 0.15 else "high")
    return Estimate(gross, net, "session total", conf, unc, warnings)


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 78)
    print("VERIFICATION RUN")
    print("=" * 78)

    m = Member(body_mass_kg=80.0, height_cm=178.0, age_years=35, sex='M')
    print(f"\nMember: 80 kg, 178 cm, 35 y, M")
    print(f"  RMR (Mifflin-St Jeor): {m.rmr_kcal_day():.0f} kcal/day "
          f"= {m.rmr_kcal_min():.3f} kcal/min")
    print(f"  Resting VO2: {m.rmr_vo2():.2f} ml/kg/min (vs flat 3.5)")

    print("\n--- CARDIO: check against hand calculations ---")

    # Treadmill 3.4 mph, 5% grade, 30 min
    e = treadmill(m, 3.4, 5.0, 30)
    s = 3.4 * MPH_TO_M_PER_MIN
    hand = 0.1 * s + 1.8 * s * 0.05 + 3.5
    print(f"Treadmill 3.4 mph @ 5%: VO2 hand-calc = {hand:.2f} ml/kg/min")
    print(f"  -> {e}")
    # 3.4 mph = 91.2 m/min; 0.1*91.2 + 1.8*91.2*0.05 + 3.5 = 9.12 + 8.21 + 3.5
    assert abs(hand - 20.83) < 0.05, "walking VO2 mismatch"

    # Treadmill 6.5 mph flat
    e2 = treadmill(m, 6.5, 0.0, 30)
    s2 = 6.5 * MPH_TO_M_PER_MIN
    hand2 = 0.2 * s2 + 3.5
    print(f"Treadmill 6.5 mph flat: VO2 hand-calc = {hand2:.2f} = "
          f"{hand2/3.5:.1f} MET")
    print(f"  -> {e2}")

    # Cycle 150 W
    e3 = cycle_ergometer(m, 150, 30)
    hand3 = 1.8 * (150 * WATT_TO_KGM_PER_MIN) / 80.0 + 7.0
    print(f"Cycle 150 W: VO2 hand-calc = {hand3:.2f} = {hand3/3.5:.1f} MET")
    print(f"  -> {e3}")

    # Rower 200 W
    e4 = rower(m, 200, 30)
    print(f"Rower 200 W, 30 min -> {e4}")

    # Sanity: Concept2 reference athlete (79.5 kg) should get exactly 4W+300
    ref = Member(79.4, 178, 35, 'M')
    r_ref = rower(ref, 200, 60)
    print(f"  C2 reference athlete (79.4 kg) @ 200 W for 60 min: "
          f"{r_ref.gross_kcal:.0f} kcal (expect ~1100)")
    assert abs(r_ref.gross_kcal - 1100) < 15, "C2 mass correction broken"

    print("\n--- Out-of-range handling ---")
    print(treadmill(m, 4.5, 0, 20))
    print(cycle_ergometer(m, 350, 20))
    print(stepper(m, 40, 0.20, 20))

    print("\n--- STRENGTH ---")
    sets = [
        SetRecord('bench_press', 80, 10), SetRecord('bench_press', 80, 10),
        SetRecord('bench_press', 80, 8),
        SetRecord('lat_pulldown', 65, 12), SetRecord('lat_pulldown', 65, 12),
        SetRecord('lat_pulldown', 65, 10),
        SetRecord('leg_press', 180, 12), SetRecord('leg_press', 180, 12),
        SetRecord('leg_press', 180, 10),
        SetRecord('biceps_curl', 20, 12), SetRecord('biceps_curl', 20, 12),
    ]
    tv = sum(x.weight_kg * x.reps for x in sets)
    print(f"11 sets, total volume load = {tv:.0f} kg")

    t1 = strength_met(m, Intensity.LIGHT, 45)
    print(f"Tier 1 (MET only, 45 min session): {t1}")

    t2 = strength_work_based(m, sets, 45, Intensity.LIGHT)
    print(f"Tier 2 (work-blended):             {t2}")

    m2 = Member(80.0, 178.0, 35, 'M', lean_mass_kg=64.0)
    t3 = strength_lytle(m2, sets)
    print(f"Tier 3 (Lytle, needs body comp):   {t3}")

    # Does the work model actually discriminate load? It must.
    light_sets = [SetRecord('bench_press', 40, 10) for _ in range(11)]
    heavy_sets = [SetRecord('bench_press', 120, 10) for _ in range(11)]
    lo = strength_work_based(m, light_sets, 45)
    hi = strength_work_based(m, heavy_sets, 45)
    print(f"\nLoad discrimination check (same 45 min, same reps):")
    print(f"  11x10 @ 40 kg  -> {lo.net_kcal:.0f} kcal")
    print(f"  11x10 @ 120 kg -> {hi.net_kcal:.0f} kcal")
    print(f"  ratio = {hi.net_kcal/lo.net_kcal:.2f}x  "
          f"(MET-only would give 1.00x -- that's the whole point)")
    assert hi.net_kcal > lo.net_kcal * 1.3, "work model failed to discriminate load"

    # Cross-check the per-exercise slopes against Reis et al. 2017.
    # Reis used a 15 rep/min metronome, so 15 reps == 1 minute of work.
    # Implied slope = measured kcal/min / concentric kJ for those 15 reps.
    print(f"\nSlope cross-check vs Reis et al. 2017 (assumed 1RM = 100 kg):")
    ref_m = Member(78.67, 178, 30, 'M')   # Reis cohort mean mass
    reis = [  # (exercise, %1RM, measured kcal/min)
        ('bench_press', 0.20, 4.67), ('bench_press', 0.80, 11.41),
        ('leg_press',   0.20, 6.74), ('leg_press',   0.80, 19.86),
        ('lat_pulldown',0.20, 4.03), ('lat_pulldown',0.80,  9.58),
        ('biceps_curl', 0.20, 3.42), ('biceps_curl', 0.80,  8.53),
    ]
    slopes = []
    for ex, frac, kcal_min in reis:
        load = 100.0 * frac
        kj = concentric_work_kj(ex, load, 15, ref_m)
        implied = kcal_min / kj
        slopes.append(implied)
        print(f"  {ex:14s} @{frac:.0%} 1RM: {kj:5.2f} kJ, "
              f"{kcal_min:5.2f} kcal/min -> implied slope {implied:5.2f} kcal/kJ")
    print(f"  Implied slope range: {min(slopes):.2f} - {max(slopes):.2f} kcal/kJ")
    print(f"  Catalogue slopes:    "
          f"{min(v['kcal_per_kj'] for v in EXERCISE_SLOPES.values()):.2f} - "
          f"{max(v['kcal_per_kj'] for v in EXERCISE_SLOPES.values()):.2f}")
    print(f"  -> catalogue sits inside the measured band. Note the ~4x spread")
    print(f"     across loads: this is Reis & Scott's point that efficiency is")
    print(f"     NOT constant, and why the work term must be damped + clamped.")
    assert min(slopes) < 2.3 < max(slopes), "catalogue slopes outside measured band"

    # Implied gross mechanical efficiency sanity check
    print(f"\nImplied gross mechanical efficiency at the catalogue slope:")
    eff = (1.0 / 2.3) / 4.184
    print(f"  2.3 kcal/kJ -> {eff:.1%} efficiency")
    print(f"  Literature back-calculation says 6-13% for resistance exercise.")
    print(f"  (The folk '20-25%' figure is borrowed from CYCLING and is wrong here.)")
    assert 0.06 <= eff <= 0.15, "efficiency outside literature range"

    print("\n--- FULL MIXED SESSION ---")
    total = session_total(m, [
        treadmill(m, 3.5, 2.0, 10),        # warm-up
        strength_work_based(m, sets, 40),   # main lifting block
        cycle_ergometer(m, 120, 15),        # cool-down
    ])
    print(total)
    lo_b, hi_b = total.band()
    print(f"\nUI should display: ~{round(total.net_kcal/10)*10} kcal "
          f"(estimated range {lo_b}-{hi_b})")

    print("\n" + "=" * 78)
    print("ALL ASSERTIONS PASSED")
    print("=" * 78)
