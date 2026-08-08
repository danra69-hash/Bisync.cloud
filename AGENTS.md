# AGENTS.md

## Cursor Cloud specific instructions

Bisync.cloud is a polyglot app: a **React 19 + Vite** client (`client/`), an **ASP.NET Core 10** Web API (`src/Bisync.Api/`), and **PostgreSQL 16**. Standard setup/run commands live in `README.md`; the notes below only cover Cursor-Cloud-specific caveats. The dependency-refresh update script (`npm --prefix client ci` + `dotnet restore`) runs automatically on VM startup — do not duplicate it here.

### Toolchain / environment
- `.NET 10 SDK` is installed under `~/.dotnet` (not system-wide). `~/.bashrc` adds it to `PATH` and sets `DOTNET_ROOT`, so interactive shells get `dotnet` automatically. Non-interactive contexts may need `"$HOME/.dotnet/dotnet"`.
- Node.js 22 is preinstalled. The client uses **oxlint** (`npm --prefix client run lint`); lint currently reports warnings only (no errors).

### PostgreSQL (must be running before the API)
- Postgres 16 is installed natively (NOT via Docker — the repo's `docker compose`/`.ps1` scripts are Windows-oriented and unused here). Data persists in the VM snapshot.
- Role `bisync` / password `bisync` (superuser), databases `bisync`, `bisync_archive`, `bisync_audit`. Connection strings in `src/Bisync.Api/appsettings.Development.json` point at `localhost:5432`.
- If Postgres is not running after a fresh VM boot, start it with: `sudo pg_ctlcluster 16 main start`.
- The API also provisions per-company tenant databases at runtime (`Tenancy:ProvisionCompanyDatabases: true`), which is why `bisync` needs superuser/createdb.

### IMPORTANT: seed the DB from the SQL dump, do not boot the API on a truly empty DB
- On a completely empty `bisync` database, startup seeding crashes: `ConfigurationSeeder` assigns all three "Bisync …" companies the same 4-letter `Code` (`BISY`) and hits a duplicate-key on `IX_Companies_Code`. This is a pre-existing seeder limitation, not an environment problem.
- The intended dev bring-up is to restore the committed dumps first (they already contain the companies, so the seeder skips inserting them). Restore once (data then persists in the snapshot):
  ```bash
  PGPASSWORD=bisync psql -h localhost -U bisync -d bisync         -v ON_ERROR_STOP=1 -f src/Bisync.Api/bisync-postgres-latest.sql
  PGPASSWORD=bisync psql -h localhost -U bisync -d bisync_archive -v ON_ERROR_STOP=1 -f src/Bisync.Api/bisync-archive-postgres-latest.sql
  ```
  (If you must reset, `DROP`/`CREATE DATABASE bisync` first, then re-restore.)

### Running the services (dev)
- API: `cd src/Bisync.Api && dotnet run` → http://localhost:5299 (health: `/api/health`). Runs in Development with `DEV_CONSOLE_ENABLED=true`.
- Client: `cd client && npm run dev` → http://localhost:5173 (Vite proxies `/api` → `:5299`, so the API must be up for data).
- Run each as a long-lived process (e.g. tmux); they are not one-shot.

### App usage caveats (UI testing)
- Login is against seeded `AppUsers`. Seeded users have no password hash, so any of them log in with password **`Pass@123`** (e.g. `james.dubois@bisync.cloud`). `james.dubois@bisync.cloud` has full RMS/Revenue-Management access.
- The client keeps navigation and list data **in memory**: a hard reload (F5) resets routing back to the Overview dashboard, and list views (e.g. Vendors) do **not** auto-refresh after a create. To see a newly created record, reload the page (or re-login) and re-navigate via the sidebar.
- Newly created vendors land in the **"Available"** vendors tab, not "Engaged".
- The Overview dashboard shows zeros until a company/location is selected in the top bar; this is expected, not a bug.

### Tests
- API build/verify: `dotnet build src/Bisync.Api/Bisync.Api.csproj` (CI also curls `/api/health` after `dotnet run`).
- Client build: `npm --prefix client run build`.
- The Node calc tests (`npm --prefix client run test:split-use`, `test:yield-loss`) import `.ts` directly and fail on Node 22 unless type-stripping is enabled. Run them with: `NODE_OPTIONS="--experimental-strip-types --no-warnings" node --test scripts/split-use-calculation.test.mjs` (and `yield-loss-calculation.test.mjs`).
- Structure-ownership check (enforced in CI): `node scripts/verify-structure-ownership.mjs`.
