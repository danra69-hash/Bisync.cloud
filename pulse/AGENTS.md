# Pulse — agent guide

Pulse is a **standalone** fitness membership product under `pulse/`. It is **not** Bisync. Prefer changing files only under `pulse/` unless the task clearly needs shared root scripts (e.g. `scripts/deploy-simulation/`).

| | Value |
|---|---|
| Live web | https://pulse-cloud-etx3n2bf5q-as.a.run.app |
| mobile.pulse | https://pulse-cloud-etx3n2bf5q-as.a.run.app/m/ |
| CD branch | `pulse` (workflow `deploy-pulse.yml`) |
| Cloud Run | `pulse-cloud` |
| Demo password | `pulse123` |
| Mobile PIN | `1234` |

**Demo logins:** `admin@pulse.club`, `coach@pulse.club`, `sam.nguyen@email.com` (subscriber), `dra@cubevalue.com` (superuser).

---

## Cursor Cloud specific instructions

### Speed defaults (mandatory unless the user overrides)

Cloud Agents must optimize for **short wall-clock time**. Most Pulse prompts should finish in minutes, not tens of minutes.

**Default loop for Pulse work:**

1. Implement the change under `pulse/`
2. Run **targeted** checks only (see below)
3. Commit + push the feature branch + open/update PR into `pulse`
4. Stop — do **not** run full pre-sim, Expo rebuild loops, or browser/`computerUse` demos unless required below

**Do by default**

- Prefer API smoke (`curl` login + one endpoint) over GUI for mobile/API changes
- Prefer `node --test pulse/scripts/*.test.mjs` (or a single new regression file) over full suite rebuilds
- One logical commit per prompt when possible; avoid rebuild → click → rebuild loops
- Keep the PR focused; do not expand scope into unrelated Pulse areas

**Do not do by default**

- Full `node scripts/run-deploy-simulation.mjs --phase=pre` on every small UI/copy/nav tweak
- Expo `build:web` more than once per prompt (only if `pulse/mobile/` changed and you need a compile check)
- `computerUse` / RecordScreen / long `/m/` click-through demos
- Re-seeding the DB, killing unrelated processes, or reinstalling deps unless broken
- Waiting on live Cloud Run deploys unless the user asked to verify production

**User shortcuts**

- `/no-test` or “no testing” → skip all tests and demos; still commit/push if code changed
- “Skip pre-sim” / “skip deploy” → code + targeted unit tests only
- “API smoke only” → curl proofs, no browser
- “Full gate” / “ship to pulse” / “merge ready” → run full pre-sim before saying it is ready to merge

### When full pre-sim **is** required

Run:

```bash
node scripts/run-deploy-simulation.mjs --phase=pre --base=origin/pulse
```

only when **any** of these is true:

- User explicitly asks for full gate / merge-ready / deploy verification
- You are about to merge or push directly to **`pulse`**
- The change spans many Pulse areas and targeted tests cannot cover it

CD on `pulse` still runs the full gate in GitHub Actions. Day-to-day agent PRs should not re-run that entire gate locally unless asked.

### When manual `/m/` UI testing **is** required

Only if the user asks for a walkthrough, screenshot, or video of mobile UI.

Otherwise prove mobile changes with:

- `npm run build:web` once in `pulse/mobile/` (compile check), and/or
- API smoke against local `PULSE_API_PORT` (default `5400`) or live base URL

React Native Web + `computerUse` is slow and flaky — do not use it as the default verifier.

### Local services (Cloud Agent VM)

```bash
# API (Postgres must be up)
cd pulse/api && npm run dev          # http://127.0.0.1:5400

# Admin web
cd pulse/web && npm run dev

# Mobile (Expo). Hosted build is also served at /m from the API/Docker image after export.
cd pulse/mobile && npm run build:web
```

Health: `GET /api/health`  
Mobile coach login: `POST /api/mobile/auth/login` with `{ "email":"coach@pulse.club","password":"pulse123","as":"coach" }`

### Branch / PR conventions

- Feature branches: `cursor/<descriptive-name>-6079` off **`pulse`**
- Open draft PRs into **`pulse`** (not `master`)
- Do not merge to `pulse` unless the user asks; CD deploys from `pulse`

### Layout reminder

- `pulse/api` — Express + Postgres
- `pulse/web` — admin portal (Vite)
- `pulse/mobile` — mobile.pulse (Expo → `/m/`)
- Shared deploy sim registration: `scripts/deploy-simulation/registry.mjs` (`pre-pulse`)

Keep `pulse/mobile/AGENTS.md` as the Expo version pointer; put Pulse product/agent workflow rules here.
