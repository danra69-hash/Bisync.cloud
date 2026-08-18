# Calorie estimation engine (reference)

Ported into Pulse for inspection under **Training → Ref & Library**.

| File | Role |
|---|---|
| `SPEC.md` | Technical specification (source design) |
| `calorie_engine.py` | Original Python reference + verification harness |
| `../../web/src/lib/calorieEngine.ts` | TypeScript port used by the admin web library UI |
| `../../web/src/pages/TrainingCalorieLibrary.tsx` | Inspect UI (overview / playground / catalogue / sources) |

**Not wired** into `POST /api/training` calorie fields or mobile session logging yet.
