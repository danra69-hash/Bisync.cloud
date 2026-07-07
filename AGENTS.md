# AGENTS.md

## Cursor Cloud specific instructions

Bisync.cloud is a hospitality operations platform. Standard setup/run commands live in `README.md`; this section only captures non-obvious caveats for cloud agents.

### Services

| Service | Location | Run (dev) | URL |
|---------|----------|-----------|-----|
| Frontend (React 19 + Vite) | `client` | `npm run dev` | http://localhost:5173 |
| Backend API — Python (Django REST) | `server` | `../server_venv/bin/python manage.py runserver 127.0.0.1:5299` | http://localhost:5299 (health: `/api/health`) |
| Backend API — .NET (ASP.NET Core 10, original) | `src/Bisync.Api` | `dotnet run` | http://localhost:5299 (health: `/api/health`) |

The Vite dev server proxies `/api` to `:5299` (see `client/vite.config.ts`), so run the frontend plus **one** backend.

### Two backends, one contract (port 5299)

There are two interchangeable backends serving the same `/api/*` JSON contract. Run only one at a time (they bind the same port).

- **Python (Django REST) — `server/`** is the preferred backend. It reads/writes the shared SQLite DB via **unmanaged** models (`server/core/models.py`, `managed = False`), so Django never migrates those tables. The Python venv lives at repo root `server_venv/` (created by the update script). Login verifies passwords with a PBKDF2-HMAC-SHA256 port compatible with the .NET hasher (`server/core/passwords.py`).
- **Scope of the Python port:** auth/login, users, companies, locations (+config), menu, vendors (list/create/engage), ingredients, purchase orders (list/active), vendor product prices, inventory alerts, revenue, progress. This covers login + the Operations Overview dashboard + the vendor flow. NOT yet ported (return 404 and are handled gracefully by the client): notifications, products/product-management, cash purchases, order templates, PO workflow mutations (approve/receive/reconcile), vendor-order portal, and the HR/payroll/accounting modules. Port more by adding a model in `models.py`, a serializer in `serializers.py`, a view in `views.py`, and a route in `urls.py`.
- **.NET (`src/Bisync.Api/`)** is the original backend and remains fully functional; use it if you need an endpoint the Python port doesn't cover yet, or to regenerate/seed the database (see below).

### Toolchain

- The **.NET 10 SDK** is required (for the .NET backend / DB seeding) and is preinstalled in the VM snapshot at `/usr/share/dotnet` (symlinked to `/usr/local/bin/dotnet`). It is a system dependency and is intentionally NOT part of the update script.
- **Python 3.12** is preinstalled; the `python3.12-venv` system package is also installed in the snapshot (required for `python3 -m venv`). The update script creates `server_venv/` and installs `server/requirements.txt`.
- Node.js 22 is preinstalled. The update script runs `npm ci` for `client`.

### Non-obvious gotchas

- **The database file `src/Bisync.Api/bisync.db` is git-tracked and shared by both backends.** It is created and seeded only by the .NET app (`EnsureCreatedAsync` + seeders in `Program.cs`), NOT by Django. If the file is ever missing or you want fresh seed data, run the .NET backend once (`dotnet run` in `src/Bisync.Api`) to regenerate it, then switch back to Django. Any dev writes dirty this tracked file — avoid committing incidental data changes to it (`git checkout -- src/Bisync.Api/bisync.db`).
- **Overview dashboard is intentionally blank until a company is selected** in the top header dropdown (`App.tsx` gates `menu`/`revenue`/`alerts`/`orders` on `selectedCompanyId`). This is expected UX, not a data-loading bug.
- **Seeded numeric columns are stored as TEXT** in SQLite (EF Core decimal handling). The Django serializers cast these to JSON numbers (`server/core/serializers.py:num`); keep that in mind when porting more endpoints.
- **.NET startup ALTER TABLE errors are expected.** When running the .NET backend, boot runs `SchemaPatcher`/HR startup which issues idempotent `ALTER TABLE ... ADD COLUMN` statements; when columns already exist the log shows many `fail: Microsoft.EntityFrameworkCore.Database.Command ... Failed executing DbCommand ... ALTER TABLE` lines. These are caught and non-fatal — the API still reaches `Now listening on: http://localhost:5299`.
- **Login credentials (seeded):** super admin `dra@cubevalue.com` / `12345678`. Other seeded `*@bisync.cloud` users have no password hash and accept the default password `Pass@123`.
- **Company scope required for some data:** vendor/purchase-order screens show "Select a company in the header to load activity..." until a company is chosen from the header dropdown; select one before expecting vendor data to load or create actions to work.
- **`npm run lint` (oxlint) currently exits 1** due to a pre-existing `react-hooks/rules-of-hooks` error in `client/src/AppRoot.tsx` (plus warnings). This is existing code, not an environment problem.
- The `scripts/*.ps1` helpers and `.cursor/rules/deploy-after-changes.mdc` target Windows PowerShell + GCP Cloud Run deployment; they are not needed to run the app locally in this Linux VM.
