# Deploy Pulse (standalone GCP)

Pulse must **not** share Bisync’s GCP project, Cloud SQL, Artifact Registry, or `master` deploy pipeline.

| Resource | Bisync | Pulse |
|----------|--------|-------|
| GCP project | `project-8d670aa9-f439-44d9-8e1` | **new** project (you create) |
| Cloud Run | `bisync-cloud` | `pulse-cloud` |
| Cloud SQL | `bisync-pg` | `pulse-pg` |
| Database | `bisync` | `pulse` |
| Registry | `…/bisync/bisync-cloud` | `…/pulse/pulse-cloud` |
| Git branch for CD | `master` | **`pulse`** only |
| GitHub workflow | `deploy.yml` | `deploy-pulse.yml` |
| GitHub vars | `GCP_*` | `PULSE_GCP_*` |

---

## 1. Create a new GCP project (Console)

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Project picker → **New Project**
3. Name: `Pulse Fitness Cloud`
4. Suggested project ID: `pulse-fitness-cloud` (must be globally unique — add a suffix if taken)
5. Place it under the same org/folder as Bisync if you want billing/org policy inheritance
6. **Link a billing account** (required for Cloud Run + Cloud SQL)

Do **not** reuse `project-8d670aa9-f439-44d9-8e1`.

---

## 2. Bootstrap from your machine

### Windows (PowerShell)

```powershell
# Go to your clone of the repo (NOT C:\WINDOWS\system32)
cd C:\path\to\Bisync.cloud
git fetch origin
git checkout pulse
git pull origin pulse

gcloud auth login

# Replace with YOUR real project id from Console (not the placeholder text)
powershell -ExecutionPolicy Bypass -File .\pulse\scripts\setup-gcp.ps1 -ProjectId pulse-fitness-cloud
```

### Mac / Linux / Git Bash

```bash
cd /path/to/Bisync.cloud
./pulse/scripts/setup-gcp.sh --project=pulse-fitness-cloud
```

This creates Pulse-only: APIs, Artifact Registry `pulse`, Cloud SQL `pulse-pg`, DB `pulse`, secret `pulse-db-password`, WIF + deploy SA, and GitHub variables:

- `PULSE_GCP_PROJECT_ID`
- `PULSE_GCP_WORKLOAD_IDENTITY_PROVIDER`
- `PULSE_GCP_SERVICE_ACCOUNT`
- `PULSE_GCP_REGION`

---

## 3. Release branch (not Bisync master)

```bash
git fetch origin
git checkout -B pulse origin/cursor/pulse-fitness-membership-6079   # or current Pulse tip
git push -u origin pulse
```

Pushing to **`pulse`** (with `pulse/**` changes) runs **Deploy Pulse**.  
Bisync **`master` does not deploy Pulse**.

Manual: GitHub → Actions → **Deploy Pulse** → Run workflow (select branch `pulse`).

---

## 4. Live URL

After a successful Deploy Pulse run, the job summary prints:

`PULSE_LIVE_URL=https://pulse-cloud-….run.app`

Or:

```bash
gcloud run services describe pulse-cloud \
  --project=YOUR_PULSE_PROJECT_ID \
  --region=asia-southeast1 \
  --format='value(status.url)'
```
