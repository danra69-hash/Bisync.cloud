# AGENTS.md

## Cursor Cloud specific instructions

Bisync.cloud is a hospitality operations platform with two dev services. Standard setup/run commands live in `README.md`; this section only captures non-obvious caveats for cloud agents.

### Services

| Service | Location | Run (dev) | URL |
|---------|----------|-----------|-----|
| Backend API (ASP.NET Core 10 + EF Core/SQLite) | `src/Bisync.Api` | `dotnet run` | http://localhost:5299 (health: `/api/health`) |
| Frontend (React 19 + Vite) | `client` | `npm run dev` | http://localhost:5173 |

The Vite dev server proxies `/api` to the API at `:5299` (see `client/vite.config.ts`), so run both services for full functionality.

### Toolchain

- The **.NET 10 SDK** is required and is preinstalled in the VM snapshot at `/usr/share/dotnet` (symlinked to `/usr/local/bin/dotnet`). It is a system dependency and is intentionally NOT part of the update script.
- Node.js 22 is preinstalled. The update script runs `npm ci` for `client`.

### Non-obvious gotchas

- **Startup ALTER TABLE errors are expected.** On boot the API runs `SchemaPatcher`/HR startup which issues idempotent `ALTER TABLE ... ADD COLUMN` statements; when columns already exist the log shows many `fail: Microsoft.EntityFrameworkCore.Database.Command ... Failed executing DbCommand ... ALTER TABLE` lines. These are caught and non-fatal — the API still reaches `Now listening on: http://localhost:5299`.
- **Database is auto-created and seeded** on API startup (`EnsureCreatedAsync` + seeders in `Program.cs`) into `src/Bisync.Api/bisync.db`. No manual migration step is needed. Deleting that file resets to seed data on next run.
- **Login credentials (seeded):** super admin `dra@cubevalue.com` / `12345678`. Other seeded `*@bisync.cloud` users have no password hash and accept the default password `Pass@123`.
- **Company scope required for some data:** vendor/purchase-order screens show "Select a company in the header to load activity..." until a company is chosen from the header dropdown; select one before expecting vendor data to load or create actions to work.
- **`npm run lint` (oxlint) currently exits 1** due to a pre-existing `react-hooks/rules-of-hooks` error in `client/src/AppRoot.tsx` (plus warnings). This is existing code, not an environment problem.
- The `scripts/*.ps1` helpers and `.cursor/rules/deploy-after-changes.mdc` target Windows PowerShell + GCP Cloud Run deployment; they are not needed to run the app locally in this Linux VM.
