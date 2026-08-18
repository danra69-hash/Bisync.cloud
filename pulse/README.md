# Pulse — Fitness Membership Platform

**Completely separate from Bisync** — own GCP project, Cloud Run, Cloud SQL, CD branch (`pulse`), and GitHub variables (`PULSE_GCP_*`).

| | Bisync | Pulse |
|---|---|---|
| GCP project | Bisync project | **New** Pulse project |
| Cloud Run | `bisync-cloud` | `pulse-cloud` |
| Deploy branch | `master` | **`pulse`** |
| Workflow | `deploy.yml` | `deploy-pulse.yml` |

## Multi-tenancy

Pulse is **company → location** scoped:

- Staff belong to one or more companies (role per company).
- Coaches/Sales may be limited to specific locations; Admin/Management/Accounting see all locations in their company.
- API sends `X-Pulse-Company-Id` and optional `X-Pulse-Location-Id`.
- Demo seed: **Pulse Fitness** (Downtown + Westside) and **Atlas Fit** (Harbor).

Demo logins (password `pulse123`): `admin@pulse.club`, `mgmt@pulse.club`, `coach@pulse.club`, `sales@pulse.club`, `accounting@pulse.club`, plus `admin@atlas.fit` for the second company.

## Local

```bash
docker compose up -d
cd pulse/api && npm install && npm run seed && npm run dev
cd pulse/web && npm install && npm run dev
```

## Cloud (standalone)

Follow **[`DEPLOY.md`](./DEPLOY.md)**:

1. Create a **new** GCP project in Console (not Bisync’s)
2. Run `./pulse/scripts/setup-gcp.sh --project=YOUR_PULSE_PROJECT_ID`
3. Push this code to the **`pulse`** branch (or Actions → Deploy Pulse)

Live URL appears in the Deploy Pulse job summary after first successful deploy.

## Design

See `design.md`.
