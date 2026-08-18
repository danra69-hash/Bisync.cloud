import { useMemo, useState } from 'react';
import {
  ENGINE_META,
  EXERCISE_SLOPES,
  Intensity,
  armErgometer,
  cycleErgometer,
  elliptical,
  estimateBand,
  formatEstimate,
  metActivity,
  rmrKcalDay,
  rmrVo2,
  rower,
  sessionTotal,
  stairClimber,
  stepper,
  strengthLytle,
  strengthMet,
  strengthWorkBased,
  treadmill,
  type Estimate,
  type IntensityKey,
  type MemberProfile,
  type SetRecord,
  type Sex,
} from '../lib/calorieEngine';

type LibraryPane = 'overview' | 'playground' | 'catalogue' | 'sources';

const DEFAULT_MEMBER: MemberProfile = {
  bodyMassKg: 80,
  heightCm: 178,
  ageYears: 35,
  sex: 'M',
  leanMassKg: null,
};

const DEMO_SETS: SetRecord[] = [
  { exerciseId: 'bench_press', weightKg: 80, reps: 10 },
  { exerciseId: 'bench_press', weightKg: 80, reps: 10 },
  { exerciseId: 'bench_press', weightKg: 80, reps: 8 },
  { exerciseId: 'lat_pulldown', weightKg: 65, reps: 12 },
  { exerciseId: 'lat_pulldown', weightKg: 65, reps: 12 },
  { exerciseId: 'lat_pulldown', weightKg: 65, reps: 10 },
  { exerciseId: 'leg_press', weightKg: 180, reps: 12 },
  { exerciseId: 'leg_press', weightKg: 180, reps: 12 },
  { exerciseId: 'leg_press', weightKg: 180, reps: 10 },
  { exerciseId: 'biceps_curl', weightKg: 20, reps: 12 },
  { exerciseId: 'biceps_curl', weightKg: 20, reps: 12 },
];

type CardioMode =
  | 'treadmill'
  | 'cycle'
  | 'arm'
  | 'stepper'
  | 'rower'
  | 'elliptical'
  | 'stair'
  | 'met';

function EstimateCard({ title, estimate }: { title: string; estimate: Estimate | null }) {
  if (!estimate) {
    return (
      <div className="panel" style={{ margin: 0 }}>
        <div className="panel-head">
          <h2>{title}</h2>
        </div>
        <div className="panel-body muted">No estimate (missing inputs).</div>
      </div>
    );
  }
  const [lo, hi] = estimateBand(estimate);
  return (
    <div className="panel" style={{ margin: 0 }}>
      <div className="panel-head">
        <h2>{title}</h2>
        <span className={`badge ${estimate.confidence === 'high' ? 'ok' : ''}`}>
          {estimate.confidence}
        </span>
      </div>
      <div className="panel-body form-grid">
        <div>
          <div className="muted" style={{ fontSize: '0.78rem' }}>
            Net (active) · range
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 600 }}>
            ~{Math.round(estimate.netKcal / 10) * 10} kcal
          </div>
          <div className="muted">
            {lo}–{hi} kcal (±{(estimate.uncertaintyPct * 100).toFixed(0)}%)
          </div>
        </div>
        <div className="form-grid two">
          <div>
            <div className="muted" style={{ fontSize: '0.78rem' }}>
              Gross
            </div>
            <div>{Math.round(estimate.grossKcal)} kcal</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: '0.78rem' }}>
              Method
            </div>
            <div style={{ fontSize: '0.85rem' }}>{estimate.method}</div>
          </div>
        </div>
        {estimate.warnings.length ? (
          <ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem' }}>
            {estimate.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
        <code style={{ fontSize: '0.72rem', wordBreak: 'break-all' }}>{formatEstimate(estimate)}</code>
      </div>
    </div>
  );
}

export function TrainingCalorieLibrary() {
  const [pane, setPane] = useState<LibraryPane>('overview');
  const [member, setMember] = useState<MemberProfile>(DEFAULT_MEMBER);
  const [cardioMode, setCardioMode] = useState<CardioMode>('treadmill');
  const [minutes, setMinutes] = useState(30);
  const [speedMph, setSpeedMph] = useState(3.4);
  const [gradePct, setGradePct] = useState(5);
  const [watts, setWatts] = useState(150);
  const [stepsPerMin, setStepsPerMin] = useState(20);
  const [stepHeightM, setStepHeightM] = useState(0.2);
  const [met, setMet] = useState(5);
  const [intensityKey, setIntensityKey] = useState<IntensityKey>('LIGHT');
  const [sessionMinutes, setSessionMinutes] = useState(45);
  const [applyEpoc, setApplyEpoc] = useState(true);

  const cardioEstimate = useMemo(() => {
    switch (cardioMode) {
      case 'treadmill':
        return treadmill(member, speedMph, gradePct, minutes);
      case 'cycle':
        return cycleErgometer(member, watts, minutes);
      case 'arm':
        return armErgometer(member, watts, minutes);
      case 'stepper':
        return stepper(member, stepsPerMin, stepHeightM, minutes);
      case 'rower':
        return rower(member, watts, minutes);
      case 'elliptical':
        return elliptical(member, minutes, { met });
      case 'stair':
        return stairClimber(member, minutes);
      case 'met':
        return metActivity(member, met, minutes);
      default:
        return null;
    }
  }, [
    cardioMode,
    member,
    minutes,
    speedMph,
    gradePct,
    watts,
    stepsPerMin,
    stepHeightM,
    met,
  ]);

  const strengthT1 = useMemo(
    () => strengthMet(member, Intensity[intensityKey], sessionMinutes),
    [member, intensityKey, sessionMinutes],
  );
  const strengthT2 = useMemo(
    () => strengthWorkBased(member, DEMO_SETS, sessionMinutes, Intensity[intensityKey]),
    [member, intensityKey, sessionMinutes],
  );
  const strengthT3 = useMemo(() => strengthLytle(member, DEMO_SETS), [member]);

  const mixed = useMemo(
    () =>
      sessionTotal(
        member,
        [
          treadmill(member, 3.5, 2, 10),
          strengthWorkBased(member, DEMO_SETS, 40, Intensity.LIGHT),
          cycleErgometer(member, 120, 15),
        ],
        applyEpoc,
      ),
    [member, applyEpoc],
  );

  const lightVsHeavy = useMemo(() => {
    const light = strengthWorkBased(
      member,
      Array.from({ length: 11 }, () => ({ exerciseId: 'bench_press', weightKg: 40, reps: 10 })),
      45,
    );
    const heavy = strengthWorkBased(
      member,
      Array.from({ length: 11 }, () => ({ exerciseId: 'bench_press', weightKg: 120, reps: 10 })),
      45,
    );
    return { light, heavy, ratio: heavy.netKcal / Math.max(light.netKcal, 1e-6) };
  }, [member]);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="eyebrow">Training · reference</p>
          <h1>Calorie engine</h1>
          <p>
            Ported reference library ({ENGINE_META.version}). {ENGINE_META.status}. Inspect methods,
            catalogue, and playground estimates before wiring into session logging.
          </p>
        </div>
      </div>

      <div className="training-subnav" role="tablist" aria-label="Calorie library panes">
        {(
          [
            ['overview', 'Overview'],
            ['playground', 'Playground'],
            ['catalogue', 'Catalogue'],
            ['sources', 'Sources'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={pane === id}
            className={`chip${pane === id ? ' is-active' : ''}`}
            onClick={() => setPane(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {pane === 'overview' ? (
        <div className="grid-2">
          <section className="panel">
            <div className="panel-head">
              <h2>Accuracy ceilings</h2>
            </div>
            <div className="panel-body form-grid">
              <p className="muted" style={{ margin: 0 }}>
                Cardio and strength are different products. Do not give them the same visual weight
                as a single precise “calories burned” number.
              </p>
              <div className="form-grid two">
                <div>
                  <div className="muted" style={{ fontSize: '0.78rem' }}>
                    Cardio
                  </div>
                  <div>{ENGINE_META.accuracy.cardio}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: '0.78rem' }}>
                    Strength
                  </div>
                  <div>{ENGINE_META.accuracy.strength}</div>
                </div>
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                <li>Store gross + net separately; export net to nutrition/TDEE.</li>
                <li>Show ranges for strength; round to 10 kcal; label as estimate.</li>
                <li>Never headline per-set calories to two significant figures.</li>
                <li>Stamp engine_version on stored sessions when wired.</li>
              </ul>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>What is ported</h2>
            </div>
            <div className="panel-body form-grid">
              <p style={{ margin: 0 }}>
                Module: <code>pulse/web/src/lib/calorieEngine.ts</code>
              </p>
              <p className="muted" style={{ margin: 0 }}>
                Spec + original Python live under <code>pulse/docs/calorie-engine/</code> for review.
                This tab does not write calories into Training sessions yet.
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                <li>ACSM treadmill / cycle / arm / stepper</li>
                <li>Concept2 rower · Compendium elliptical / stair</li>
                <li>Strength Tier 1 MET · Tier 2 work modifier · Tier 3 Lytle</li>
                <li>Mifflin–St Jeor RMR · session EPOC (+15%)</li>
              </ul>
            </div>
          </section>
          <EstimateCard title="Demo mixed session (warm-up + lift + cool-down)" estimate={mixed} />
          <section className="panel">
            <div className="panel-head">
              <h2>Load discrimination (Tier 2)</h2>
            </div>
            <div className="panel-body form-grid">
              <p className="muted" style={{ margin: 0 }}>
                Same 45 min, 11×10 bench — MET-only would return 1.00×. Work modifier must spread load.
              </p>
              <div className="form-grid two">
                <div>
                  <div className="muted" style={{ fontSize: '0.78rem' }}>
                    40 kg
                  </div>
                  <div>{Math.round(lightVsHeavy.light.netKcal)} kcal net</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: '0.78rem' }}>
                    120 kg
                  </div>
                  <div>{Math.round(lightVsHeavy.heavy.netKcal)} kcal net</div>
                </div>
              </div>
              <div>
                Ratio <strong>{lightVsHeavy.ratio.toFixed(2)}×</strong>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {pane === 'playground' ? (
        <div className="grid-2">
          <section className="panel">
            <div className="panel-head">
              <h2>Member profile</h2>
            </div>
            <div className="panel-body form-grid">
              <div className="form-grid two">
                <label className="field">
                  <span>Body mass (kg)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={member.bodyMassKg}
                    onChange={(e) =>
                      setMember({ ...member, bodyMassKg: Number(e.target.value) || 0 })
                    }
                  />
                </label>
                <label className="field">
                  <span>Height (cm)</span>
                  <input
                    type="number"
                    value={member.heightCm}
                    onChange={(e) =>
                      setMember({ ...member, heightCm: Number(e.target.value) || 0 })
                    }
                  />
                </label>
                <label className="field">
                  <span>Age</span>
                  <input
                    type="number"
                    value={member.ageYears}
                    onChange={(e) =>
                      setMember({ ...member, ageYears: Number(e.target.value) || 0 })
                    }
                  />
                </label>
                <label className="field">
                  <span>Sex</span>
                  <select
                    value={member.sex}
                    onChange={(e) => setMember({ ...member, sex: e.target.value as Sex })}
                  >
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </label>
                <label className="field">
                  <span>Lean mass kg (optional · Lytle / Katch)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={member.leanMassKg ?? ''}
                    placeholder="blank = Mifflin"
                    onChange={(e) =>
                      setMember({
                        ...member,
                        leanMassKg: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                RMR {Math.round(rmrKcalDay(member))} kcal/day · resting VO₂{' '}
                {rmrVo2(member).toFixed(2)} ml/kg/min (vs flat 3.5)
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Cardio inputs</h2>
            </div>
            <div className="panel-body form-grid">
              <label className="field">
                <span>Modality</span>
                <select
                  value={cardioMode}
                  onChange={(e) => setCardioMode(e.target.value as CardioMode)}
                >
                  <option value="treadmill">Treadmill (ACSM)</option>
                  <option value="cycle">Leg cycle (ACSM)</option>
                  <option value="arm">Arm cycle (ACSM)</option>
                  <option value="stepper">Stepper (ACSM)</option>
                  <option value="rower">Rower (Concept2)</option>
                  <option value="elliptical">Elliptical (Compendium MET)</option>
                  <option value="stair">Stair treadmill (02065)</option>
                  <option value="met">Generic MET</option>
                </select>
              </label>
              <label className="field">
                <span>Minutes</span>
                <input
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value) || 0)}
                />
              </label>
              {cardioMode === 'treadmill' ? (
                <div className="form-grid two">
                  <label className="field">
                    <span>Speed (mph)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={speedMph}
                      onChange={(e) => setSpeedMph(Number(e.target.value) || 0)}
                    />
                  </label>
                  <label className="field">
                    <span>Grade (%)</span>
                    <input
                      type="number"
                      step="0.5"
                      value={gradePct}
                      onChange={(e) => setGradePct(Number(e.target.value) || 0)}
                    />
                  </label>
                </div>
              ) : null}
              {cardioMode === 'cycle' || cardioMode === 'arm' || cardioMode === 'rower' ? (
                <label className="field">
                  <span>Watts</span>
                  <input
                    type="number"
                    value={watts}
                    onChange={(e) => setWatts(Number(e.target.value) || 0)}
                  />
                </label>
              ) : null}
              {cardioMode === 'stepper' ? (
                <div className="form-grid two">
                  <label className="field">
                    <span>Steps / min</span>
                    <input
                      type="number"
                      value={stepsPerMin}
                      onChange={(e) => setStepsPerMin(Number(e.target.value) || 0)}
                    />
                  </label>
                  <label className="field">
                    <span>Step height (m)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={stepHeightM}
                      onChange={(e) => setStepHeightM(Number(e.target.value) || 0)}
                    />
                  </label>
                </div>
              ) : null}
              {cardioMode === 'elliptical' || cardioMode === 'met' ? (
                <label className="field">
                  <span>MET</span>
                  <input
                    type="number"
                    step="0.1"
                    value={met}
                    onChange={(e) => setMet(Number(e.target.value) || 0)}
                  />
                </label>
              ) : null}
            </div>
          </section>

          <EstimateCard title="Cardio estimate" estimate={cardioEstimate} />

          <section className="panel">
            <div className="panel-head">
              <h2>Strength (demo sets)</h2>
            </div>
            <div className="panel-body form-grid">
              <div className="form-grid two">
                <label className="field">
                  <span>Intensity (Compendium)</span>
                  <select
                    value={intensityKey}
                    onChange={(e) => setIntensityKey(e.target.value as IntensityKey)}
                  >
                    {(Object.keys(Intensity) as IntensityKey[]).map((k) => (
                      <option key={k} value={k}>
                        {k} — {Intensity[k].met} MET ({Intensity[k].code})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Session minutes (incl. rest)</span>
                  <input
                    type="number"
                    value={sessionMinutes}
                    onChange={(e) => setSessionMinutes(Number(e.target.value) || 0)}
                  />
                </label>
              </div>
              <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={applyEpoc}
                  onChange={(e) => setApplyEpoc(e.target.checked)}
                />
                <span>Include +15% EPOC on mixed session demo</span>
              </label>
              <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                Demo volume: {DEMO_SETS.reduce((s, x) => s + x.weightKg * x.reps, 0)} kg ·{' '}
                {DEMO_SETS.length} sets (fixed sample from the Python verification harness).
              </p>
            </div>
          </section>

          <EstimateCard title="Tier 1 — MET only" estimate={strengthT1} />
          <EstimateCard title="Tier 2 — MET × work modifier" estimate={strengthT2} />
          <EstimateCard title="Tier 3 — Lytle (needs lean mass)" estimate={strengthT3} />
          <EstimateCard title="Mixed session total" estimate={mixed} />
        </div>
      ) : null}

      {pane === 'catalogue' ? (
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Exercise slopes (Tier 2 seeds)</h2>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Exercise</th>
                    <th>ROM (m)</th>
                    <th>kcal / kJ</th>
                    <th>Body-mass frac</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(EXERCISE_SLOPES).map(([id, ex]) => (
                    <tr key={id}>
                      <td>
                        <code>{id}</code>
                      </td>
                      <td>{ex.romM.toFixed(3)}</td>
                      <td>{ex.kcalPerKj.toFixed(2)}</td>
                      <td>{ex.bodymassFrac.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>Compendium intensity codes</h2>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Code</th>
                    <th>MET</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(Intensity) as IntensityKey[]).map((k) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{Intensity[k].code}</td>
                      <td>{Intensity[k].met}</td>
                      <td>{Intensity[k].desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {pane === 'sources' ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Cited anchors</h2>
          </div>
          <div className="panel-body form-grid">
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {ENGINE_META.sources.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="muted" style={{ margin: 0 }}>
              Full citations, anti-patterns (<code>work ÷ 0.22</code>), station tagging, and build
              order: <code>pulse/docs/calorie-engine/SPEC.md</code>. Original Python verification:{' '}
              <code>pulse/docs/calorie-engine/calorie_engine.py</code>.
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Public exports for wiring later: <code>treadmill</code>, <code>cycleErgometer</code>,{' '}
              <code>rower</code>, <code>strengthMet</code>, <code>strengthWorkBased</code>,{' '}
              <code>sessionTotal</code>, …
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
