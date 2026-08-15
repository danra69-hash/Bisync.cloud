# Pulse — Fitness Membership Platform

Standalone fitness-center operations platform — **completely separate from Bisync.cloud** hospitality development and deploy.

| | Bisync | Pulse |
|---|---|---|
| Cloud Run service | `bisync-cloud` | `pulse-cloud` |
| Workflow | `.github/workflows/deploy.yml` | `.github/workflows/deploy-pulse.yml` |
| Image | `…/bisync/bisync-cloud` | `…/bisync/pulse-cloud` |
| Database | `bisync` (+ archives) | `pulse` only |
| CI | `.github/workflows/ci.yml` | `.github/workflows/ci-pulse.yml` |

Pulse path changes do **not** trigger Bisync CI/CD (`paths-ignore`).

## Stack

| Layer | Technology |
|-------|------------|
| Team web | React 19 + TypeScript + Vite |
| API | Node.js (Express) + PostgreSQL 16 |
| Admin desktop | Electron |
| Cloud | Cloud Run + Cloud SQL (`pulse` DB) |

## Local quick start

```bash
# Postgres (creates pulse DB)
docker compose up -d

cd pulse/api && npm install && npm run seed && npm run dev   # :5400
cd pulse/web && npm install && npm run dev                   # :5401
```

Demo password: `pulse123` (`admin@pulse.club`, `coach@pulse.club`, …).

## Cloud deploy (separate from Bisync)

Automatic: merge/push to `master` that touches `pulse/**` → **Deploy Pulse** workflow.

Manual:
1. GitHub → Actions → **Deploy Pulse** → Run workflow
2. Requires the same repo variables as Bisync CD (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`)
3. Creates Cloud SQL database `pulse` if missing, builds `pulse/Dockerfile`, deploys service `pulse-cloud`

Local image check:

```bash
docker build -f pulse/Dockerfile -t pulse-cloud .
docker run --rm -p 8080:8080 \
  -e PULSE_DATABASE_URL=postgresql://bisync:bisync@host.docker.internal:5432/pulse \
  pulse-cloud
```

## Design

Hallmark: modern-minimal · Cobalt · Workbench — see `design.md`.
