# Calorie Estimation Engine — Technical Specification

**For:** multi-site fitness chain, 100+ mostly unconnected machines per site, custom build
**Scope:** how to turn "member used machine X with weight W for R reps × S sets" into a calorie number that survives scrutiny
**Status:** reference design + working Python implementation (`calorie_engine.py`)

---

## 0. The one thing to decide before you write any code

You are building two different products and they have different accuracy ceilings:

| | Cardio machines | Strength machines |
|---|---|---|
| Published, validated equations exist | **Yes** — ACSM metabolic equations | **No** — ACSM publishes nothing for resistance training |
| Inputs you can actually capture | Speed, grade, watts, time | Weight, reps, sets, time |
| Realistic accuracy | ±7–15% | **±25–30% at best** |
| Can you defend the number publicly | Yes, cite ACSM GETP | Only if anchored to the Compendium |

The trap: treating these as one problem and shipping a single "calories burned" number with the same visual weight. Cardio you can nearly do properly. Strength you fundamentally cannot — and the honest design decision is to build that limitation into the UI rather than hide it.

**Recommendation:** store gross and net separately, store a confidence level and an uncertainty band alongside every estimate, and display ranges rather than point estimates for strength work.

---

## 1. Where the data comes from

### Use these

| Source | What for | Licensing |
|---|---|---|
| **[2024 Adult Compendium of Physical Activities](https://pacompendium.com/)** (Herrmann et al., *J Sport Health Sci* 2024) | MET values for every activity, incl. resistance training codes | Free, publicly published, cite the paper. This is your citable anchor. |
| **ACSM's Guidelines for Exercise Testing and Prescription (GETP)** | Metabolic equations for treadmill, cycle, arm cycle, stepping | Buy the book. Equations themselves are facts, widely reproduced. |
| **[Concept2 published formulas](https://www.concept2.com/indoor-rowers/training/calculators/calorie-calculator)** | Rowing watts→kcal + body mass correction | Published openly by C2 |
| **[free-exercise-db](https://github.com/yuhonas/free-exercise-db)** | ~800 exercises, JSON, names/muscles/equipment | **Public domain** — safest starting point for your exercise catalogue |
| **[wger](https://github.com/wger-project/wger)** | Exercise DB + reference schema | AGPL-3.0 — fine for reference/data, careful about linking code |

### Do not use

- **The machine console's own calorie number.** Ellipticals overestimate by roughly **2.8×** against indirect calorimetry (~228 displayed vs ~100 measured over 30 min). Steppers are similar. If you ever integrate connected cardio, take speed/watts/grade from the console and compute yourself.
- **Commercial exercise APIs** for the calorie values — they almost universally use the broken `work ÷ 0.22` formula described in §6.

---

## 2. Identifying 100+ unconnected machines

This is the part that actually determines whether the product works, and it's a logistics problem more than a software one.

### Tagging scheme

Put a **QR code + NFC tag** on every station. QR because every phone reads it with no app; NFC because a tap is two seconds faster and members will do it more often.

```
Payload:  https://gym.example/s/{site}/{station}
Example:  https://gym.example/s/KL02/A17
```

Encode **site + station**, not the exercise. The station→exercise mapping lives in your database so you can re-map when equipment moves — which it will, constantly.

Physical spec that matters in practice:
- Laminated or acrylic-encased, screwed or riveted — adhesive fails within months on sweaty painted steel
- Mount at eye level *from the seated/using position*, not standing
- 40–50 mm QR minimum; anything smaller fails in gym lighting
- Print the station code in human-readable text too, so a broken tag degrades to manual entry rather than to nothing

### Data model

```
site
  └─ station                (physical position on the floor)
       ├─ station_code      "A17"  — printed on the tag, stable
       ├─ equipment_id      → equipment_model
       └─ status            active | maintenance | retired

equipment_model             (the product, shared across all sites)
  ├─ manufacturer, model, year
  ├─ modality               selectorized | plate_loaded | free_weight | cardio
  ├─ exercise_id            → exercise
  ├─ stack_increments_kg    [5, 10, 15, ...]     for selectorized
  ├─ lever_ratio            e.g. 1.6             cam/lever correction
  ├─ carriage_mass_kg       e.g. 12.5            leg press sled, Smith bar
  └─ effective_rom_m        calibrated, see §6

exercise
  ├─ name, primary_muscle
  ├─ met_code               Compendium code
  ├─ default_rom_m
  ├─ bodymass_fraction      0.85 for squat, 0 for bench — mass you also lift
  └─ energy_slope           kcal per kJ concentric work (calibration param)
```

**The `lever_ratio` and `carriage_mass_kg` fields are not optional.** A leg press marked "180 kg" is not 180 kg of resistance — there's a sled mass and a sled angle. A cammed lat pulldown's plate-stack travel is not the handle travel. Without these your work calculations are wrong by 30–60% and, worse, wrong *inconsistently between machines*, which members notice.

Budget one afternoon per site to physically measure ROM and record stack increments for every station. There is no published table you can substitute for this — I looked. It doesn't exist.

### Multi-site architecture

- `equipment_model` is **global**; `station` is **per-site**. Buy 12 identical leg presses, calibrate the model once.
- Station codes only need to be unique within a site — `{site_code}/{station_code}` is the global key.
- Member profile, calibration constants, and MET tables replicate to every site. Session logs write locally and sync up.
- **Sites must work offline.** Gym internet fails. Queue writes locally, reconcile on reconnect, and make the calorie calc run client-side so the member sees a number immediately.
- Version your calculation engine and stamp `engine_version` on every stored session. When you recalibrate — and you will — you need to know which sessions used which constants, and whether you're going to retroactively restate members' history. (Recommendation: don't. Freeze historical numbers, apply new constants going forward.)

### Logging UX

The realistic failure mode is not bad math, it's members not logging. Design for a **10-second interaction**:

1. Tap/scan the station tag
2. App pre-fills weight and reps from this member's last session on this station
3. Member confirms, or adjusts with big +/− buttons on the stack increments
4. One tap to log the set; rest timer starts automatically

Never present a free-text weight field. Selectorized machines have known increments — show those. Pre-filling from history means a typical set is one tap.

---

## 3. Cardio — ACSM metabolic equations

All return **gross** VO₂ in ml·kg⁻¹·min⁻¹ (the `+3.5` is the resting term).

| Modality | Equation | Valid range |
|---|---|---|
| Walking | `VO₂ = 0.1·S + 1.8·S·G + 3.5` | 50–100 m/min (1.9–3.7 mph) |
| Running | `VO₂ = 0.2·S + 0.9·S·G + 3.5` | > 134 m/min (> 5 mph) |
| Leg cycle | `VO₂ = 1.8·W/M + 7` | 300–1200 kg·m/min (50–200 W) |
| Arm cycle | `VO₂ = 3.0·W/M + 3.5` | 150–750 kg·m/min (25–125 W) |
| Stepping | `VO₂ = 0.2·f + 2.394·H·f + 3.5` | 12–30 steps/min; H 0.04–0.40 m |

`S` = speed m/min · `G` = **fractional** grade · `W` = work rate kg·m/min · `M` = body mass kg · `f` = steps/min · `H` = step height m

**`G` must be a decimal fraction.** 5% grade is `0.05`, not `5`. This is the single most common bug in gym software using these equations and it inflates results by ~20×.

Conversions: 1 mph = 26.8224 m/min · 1 W = 6.1183 kg·m/min

### No ACSM equation exists for these

**Rowing** — use Concept2's published model:
```
kcal/hr displayed by PM  = 4 × watts + 300
true kcal/hr             = displayed − 300 + 1.714 × body weight in POUNDS
```
The 300 is C2's baseline for a 175 lb (79.5 kg) reference athlete — note `1.714 × 175 = 300` exactly, which confirms pounds. Verified in the implementation: a 79.4 kg athlete at 200 W for an hour returns 1100 kcal, matching C2 exactly.

**Elliptical** — Dalleck & Kravitz 2007 exists (`VO₂ = 3.5 + 0.15·C + 1.22·R − 0.11·M`, R²=0.783, SEE 2.8) but its resistance term is an **arbitrary machine-specific ordinal**. Level 8 on a Life Fitness is not level 8 on a Precor. Not portable — either calibrate per model or fall back to Compendium METs (5.0 moderate / 9.0 vigorous).

**Stair treadmill** — Compendium code 02065 = 9.3 METs. The ACSM stepping equation does *not* apply; it assumes a step-down phase that a stair climber doesn't have.

### Engineering warnings

1. **Steady state only.** All of these assume aerobic steady state. Invalid for the first 2–3 minutes and invalid for intervals/HIIT. Flag or gate.
2. **Enforce validity ranges.** Clamp or warn — never silently extrapolate. The 3.7–5.0 mph walk/run **dead zone** needs an explicit policy (I default to walking below 4.0 mph, running above, flagged medium-confidence).
3. Published error is ~7%, but independent validation found the walking equation overestimates measured VO₂ by ~12%, and the running equation by 14.6% in trained athletes. Treat ±10–15% as realistic.

---

## 4. VO₂ → calories, and gross vs net

```
VO₂_abs (L/min) = VO₂ (ml/kg/min) × body mass (kg) / 1000
kcal/min        = VO₂_abs × 5.0
```

**Don't RER-adjust.** The caloric equivalent of O₂ ranges 4.686 (pure fat) to 5.047 (pure carbohydrate) — a total spread of ±3.7%, far below the 7–15% error already in the equations. Adjusting for an RER you can't measure is false precision. Use 5.0 flat.

### Gross vs net — the most consequential product decision

The equations produce **gross** (including resting metabolism). The industry is split:

| Convention | Who uses it |
|---|---|
| **Gross** | Cardio machine consoles, Concept2 PM, ACSM equations, Compendium METs |
| **Net** | Apple Watch / Garmin / Fitbit "Active Calories", MyFitnessPal exercise entries |

**Do this:**
1. Compute and store **gross** (native output)
2. Display **gross** on kiosks/consoles — matches hardware and member expectation
3. Export **net** to any nutrition or TDEE integration
4. Expose **both** fields in your API, explicitly labelled

Failing step 3 is the classic double-counting bug: a member whose TDEE already includes RMR, who adds gross exercise calories, over-counts by ~1.2 kcal/min (~72 kcal/hr) — enough to erase a modest deficit over a week.

### RMR — use Mifflin-St Jeor

```
Men:    RMR = 9.99·mass_kg + 6.25·height_cm − 4.92·age + 5
Women:  RMR = 9.99·mass_kg + 6.25·height_cm − 4.92·age − 161
```

Graded **"Strong"** by the Academy of Nutrition and Dietetics for RMR estimation, using **actual** body weight. ~70% of estimates land within 10% of measured.

Do **not** default to Harris-Benedict — only 39–64% within 10% in obese populations, and it overestimates ~5% in modern cohorts because it's calibrated on a 1919 sample.

If you have **validated** body composition (DXA, BodPod — not a cheap bioimpedance scale), use Katch-McArdle instead: `RMR = 370 + 21.6 × lean_mass_kg`. It's better when LBM is measured accurately and *worse* than Mifflin when LBM is guessed.

**A refinement worth taking:** the flat `3.5 ml/kg/min` MET baseline overestimates true resting VO₂ for older, heavier, female and less-fit members. Subtract an individualised RMR instead of a flat 3.5. In the worked example, an 80 kg 35-year-old man has a resting VO₂ of 3.03, not 3.5 — a 13% difference that compounds across every session.

---

## 5. Strength — the honest situation

**There is no ACSM equation for resistance training.** The three-tier design below reflects what the literature actually supports.

### Tier 1 (ship this): Compendium METs

```
kcal = MET × body_mass_kg × session_hours
```

| Code | MET | Description |
|---|---|---|
| 02054 | 3.5 | Resistance training, multiple exercises, 8–15 reps at varied resistance |
| 02052 | 5.0 | Squats, deadlift, slow or explosive effort |
| 02050 | 6.0 | Power lifting / body building, vigorous effort |
| 02055 | 5.8 | Circuit, reciprocal supersets |
| 02056 | 3.0 | Bodyweight resistance, general |
| 02057 | 6.5 | Bodyweight resistance, high intensity |
| 02058 | 9.8 | Kettlebell swings |

**Duration must be total session time including inter-set rest.** The MET values were derived from whole-session measurement, not time-under-tension. Using TUT instead is the most common implementation error in this space and it under-reports by roughly 3×.

Zero controversy, directly citable, defensible to anyone. **Its weakness is exactly what your members will complain about:** a 40 kg bench and a 140 kg bench return an identical number.

### Tier 2 (your differentiator): MET anchor × bounded work modifier

Keep the Compendium value as the anchor — it's what you cite. Apply volume load as a *bounded, damped modifier* on top:

```
work_kJ   = Σ (weight_kg + bodymass_fraction × member_kg) × 9.80665 × ROM_m × reps / 1000
ratio     = (work_kJ / session_min) / REF_WORK_KJ_PER_MIN
modifier  = clamp(ratio ^ 0.5,  0.70,  1.45)
kcal      = MET_baseline × modifier
```

Three deliberate design choices, each with a reason:

- **Concentric only — do not multiply displacement by 2.** Caruso et al. (2003) found ~3,600 J of additional eccentric work at *zero* additional net caloric cost (series elastic recoil). Dudley et al. (1991) agrees. Products that double displacement are inflating results.
- **Damped (square root), not linear.** Reis & Scott (2016) showed efficiency is *not* constant across the load–rep continuum — work rises faster than energy cost as load increases. A raw linear term over-rewards heavy low-rep work.
- **Clamped to 0.70–1.45.** The work model is unvalidated. Bounding it means it can differentiate loads (which members want) without letting an unvalidated model run away from the defensible baseline.

In the verified implementation this produces a **1.7× spread** between an 11×10 @ 40 kg session and an 11×10 @ 120 kg session over the same 45 minutes — meaningful differentiation, bounded risk.

Justification for work-proportionality at all: Knausenberger et al. (2014) found near-perfect correlation between concentric work and total energy cost per set — deadlift r = 0.997, squat r = 0.977, incline press r = 0.947. **But the slopes are exercise-specific**, which is precisely why a single universal efficiency constant fails.

### Tier 3 (if you capture body composition): Lytle et al. 2019

Published in *Medicine & Science in Sports & Exercise* — ACSM's own journal, so the strongest provenance available:

```
net kcal = 0.874·height_cm − 0.596·age − 1.016·fat_mass_kg
         + 1.638·lean_mass_kg + 2.461·(TV × 10) − 110.742
```
where TV = total volume = sets × reps × weight. R² = 0.773, SEE = 28.5 kcal.

⚠️ **Verify the TV coefficient scaling against the printed paper before shipping.** Secondary sources disagree on the exponent (`× 10` vs `× 10⁻³`) and I could not resolve it from freely available sources. Get the PDF.

Requires fat and lean mass — viable if you run InBody scans at signup, not from a web form.

### EPOC

Add a **flat +15%** of session expenditure, disclosed as an assumption.

Farinatti et al. (2013), reviewing the literature, found EPOC ranging 4.1 to 114 kcal across studies, typically **30–60 kcal per session** — roughly 15–30% of a 200 kcal session. Load increases EPOC magnitude but not duration; volume matters more than intensity.

Do not model EPOC per-user. The between-condition differences in the literature are often under 10 kcal, which the review's own authors concede "may seem very small from a practical perspective."

---

## 6. The mistake almost everyone makes

You will find this formula in dozens of blog posts, several commercial APIs, and probably in whatever competitor you're benchmarking against:

```
kcal = (mass × g × distance × reps × 2) / 0.22 / 4184     ← WRONG, twice over
```

Two independent errors:

1. **The 20–25% efficiency figure is from cycle ergometry**, not lifting. Böning et al. (2017) — the authoritative review — gives net efficiency 22–26% for *cycling*; the range across modalities runs from 1–2% (archery) to ~50% (running). There is no published gross mechanical efficiency constant for resistance training, and back-calculating from measured calorimetry (Reis et al. 2017) puts the real figure at **6–13%**.

2. **The ×2 for eccentric is wrong**, per Caruso 2003 above.

These two errors partially cancel — double the work, quadruple the efficiency — which is *why the formula appears to work*. Do not rely on that coincidence; it fails asymmetrically across exercises and loads.

The implementation's independent check: the calibrated slope of 2.3 kcal/kJ implies **10.4% gross mechanical efficiency**, landing squarely inside the 6–13% literature band. That's a genuine cross-validation, not a fit.

### Range of motion: the real blocker

**No normative table of per-exercise displacement values exists.** Every study that needed displacement measured it per participant with a linear position transducer or instrumented machine. The few published anchors:

| Exercise | Displacement | Source |
|---|---|---|
| Bench press (80% 1RM) | 0.395 ± 0.055 m | Dorrell et al. 2018 |
| Deadlift (80% 1RM) | 0.557 ± 0.034 m | Dorrell et al. 2018 |
| Horizontal leg press | 0.355 ± 0.056 m | Gorostiaga et al. 2010 |

Also unaccounted for by `m·g·d`: body segment mass in squats/lunges/pull-ups (dominant for bodyweight work), acceleration and inertia, isometric stabiliser work, and the fact that ROM *shrinks with fatigue* (Gorostiaga measured 35.5 → 34.3 cm within a single set).

**This is why §2 says to physically measure ROM per equipment model.** It's a one-afternoon-per-site job and there's no shortcut.

---

## 7. Accuracy — what you can honestly claim

| Claim | Supported? |
|---|---|
| "±10–15% on cardio machines" | Yes, with in-range inputs at steady state |
| "±25–30% per strength session" | Yes — this is the realistic ceiling |
| "Accurate per-set calorie counts" | **No.** Do not display per-set calories to two significant figures |
| "More accurate than a fitness tracker" | Yes, defensibly — wearables show 15–57% MAPE during resistance training and generally *under*estimate |

Context worth knowing: indirect calorimetry, the reference standard everything is validated against, **misses the anaerobic contribution** — which Scott et al. put at over 40% of energy expenditure during resistance work. So every published equation is calibrated against a reference that is itself biased low. Nobody in this field has a clean answer.

### UI consequences

- Display **ranges**, not point estimates, for strength: "180–260 kcal"
- Round aggressively — nothing finer than 10 kcal
- Put "estimate" in the label, not buried in a tooltip
- Never show per-set calories as a headline number
- Store the confidence level with every session so you can filter low-confidence data out of aggregate reporting

### Calibration plan

The constants in the implementation are **seeds, not answers**. Once you have a few thousand sessions:

1. Recalibrate `REF_WORK_KJ_PER_MIN` to your own median session — it's currently a placeholder
2. Recalibrate per-exercise `energy_slope` values against your actual member population
3. If you can afford it, run 20–30 members through indirect calorimetry at a sports science lab. A single validation study against your own equipment and members is worth more than every paper cited here, and it's the only thing that lets you make an accuracy claim in marketing without exposure.

---

## 8. Build order

1. **Equipment catalogue + station tagging.** Nothing works without this and it's the long pole — physical measurement across 6+ sites.
2. **Tier 1 MET engine + ACSM cardio.** Correct, defensible, shippable. Get it in members' hands.
3. **Logging UX.** Optimise ruthlessly for the 10-second interaction. This determines adoption, and adoption determines whether any of the math matters.
4. **Tier 2 work modifier.** Ship behind a flag, compare against Tier 1 for a quarter before making it the default.
5. **Calibration study.** Once you have volume.

Ordering strength-first is the common mistake — it's the hardest problem, the least defensible science, and the least differentiating until logging adoption is solved.

---

## Sources

**Compendium & METs**
- [2024 Adult Compendium of Physical Activities](https://pacompendium.com/adult-compendium/) — Herrmann SD et al., *J Sport Health Sci* 2024;13(1):6–12
- [Conditioning Exercise MET codes](https://pacompendium.com/conditioning-exercise/)
- [Corrected METs](https://pacompendium.com/corrected-mets/)
- [Byrne et al. 2005 — Metabolic equivalent: one size does not fit all](https://journals.physiology.org/doi/full/10.1152/japplphysiol.00023.2004)

**ACSM equations**
- [ACSM's Guidelines for Exercise Testing and Prescription](https://acsm.org/education-resources/books/guidelines-exercise-testing-prescription/)
- [Texas Tech — ACSM Metabolic Calculations (PDF)](https://www.depts.ttu.edu/ksm/_documents/grad/acsm_comps/6c-23-2013_HFI_Metabolic_Calculations.pdf)
- [Accuracy of the ACSM Walking Metabolic Equation (WKU)](https://digitalcommons.wku.edu/cgi/viewcontent.cgi?article=3509&context=ijesab)
- [Latin & Berg — accuracy of the ACSM stair-stepping equation](https://pubmed.ncbi.nlm.nih.gov/11581567/)
- [Accuracy of the ACSM cycle ergometry equation](https://pubmed.ncbi.nlm.nih.gov/1549019/)

**Rowing / elliptical**
- [Concept2 Calorie Calculator](https://www.concept2.com/indoor-rowers/training/calculators/calorie-calculator) · [Watts Calculator](https://www.concept2.com/training/watts-calculator)
- [Dalleck & Kravitz 2007 — elliptical metabolic equation](https://pubmed.ncbi.nlm.nih.gov/17688126/)
- [Elliptical machine vs indirect calorimetry — 2.8× overestimate](https://www.exercmed.org/journal/view.php?doi=10.26644%2Fem.2018.008)

**Resistance training energy expenditure**
- [Methods to Assess Energy Expenditure of Resistance Exercise — scoping review, *Sports Med* 2024](https://link.springer.com/article/10.1007/s40279-024-02047-8)
- [Reis et al. 2017 — energy cost of isolated resistance exercises, *PLOS ONE*](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0181311)
- [Lytle et al. 2019 — Predicting EE of an acute resistance bout, *MSSE*](https://pubmed.ncbi.nlm.nih.gov/30768553/)
- [Robergs et al. 2007 — EE during bench press and squat, *JSCR*](https://journals.lww.com/nsca-jscr/Abstract/2007/02000/ENERGY_EXPENDITURE_DURING_BENCH_PRESS_AND_SQUAT.23.aspx)
- [Knausenberger et al. 2014 — total energy cost of five resistance exercises](https://wnus.usz.edu.pl/cejssm/en/issue/22/article/175/)
- [Scott & Earnest 2011 — RE energy expenditure with fatigue (PDF)](https://www.asep.org/asep/asep/JEPonlineFebruary2011ChristopherScott.pdf)
- [Reis & Scott 2016 — Modeling the total energy costs of resistance exercise](https://doaj.org/article/9af76f96b12d433bbbb917d67dbde1e2)
- [Caruso et al. 2003 — eccentric actions and net caloric cost](https://pubmed.ncbi.nlm.nih.gov/12930185/)
- [Dudley et al. 1991 — eccentric actions and metabolic cost](https://pubmed.ncbi.nlm.nih.gov/1898305/)
- [Böning et al. 2017 — The efficiency of muscular exercise](https://www.germanjournalsportsmedicine.com/archive/archive-2017/heft-9/the-efficiency-of-muscular-exercise/)
- [Farinatti et al. 2013 — resistance training variables and EPOC](https://www.hindawi.com/journals/isrn/2013/825026/)
- [Gorostiaga et al. 2010 — anaerobic EE and mechanical efficiency, leg press](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0013486)
- [Dorrell et al. 2018 — linear positional transducer validity (ROM data)](https://researchportal.port.ac.uk/en/publications/validity-and-reliability-of-a-linear-positional-transducer-across/)

**RMR**
- [Academy of Nutrition and Dietetics — RMR determination guideline](https://www.andeal.org/template.cfm?template=guide_summary&key=621)
- [Mifflin et al. 1990, *Am J Clin Nutr*](https://ajcn.nutrition.org/article/S0002-9165(23)16698-6/fulltext)

**Datasets**
- [free-exercise-db (public domain)](https://github.com/yuhonas/free-exercise-db)
- [wger (AGPL-3.0)](https://github.com/wger-project/wger)
