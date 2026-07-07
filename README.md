# Bisync.cloud

Hospitality operations platform — restaurant dashboard, revenue management, inventory, and vendor workflows.

**Design source:** [Figma Make — Bisync.cloud](https://www.figma.com/make/QgoQ4Z3lguzeuUlJU7ycoe/Bisync.cloud)

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Backend | ASP.NET Core 10 Web API |
| Database | PostgreSQL 16 (Entity Framework Core + Npgsql) |
| Dev | localhost API `:5299` + client `:5173` |

## Quick start (localhost)

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (for PostgreSQL)

### 0. Start PostgreSQL

```powershell
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` with databases `bisync` and `bisync_archive` (user/password: `bisync`/`bisync`).

### 1. Start the API

```powershell
cd src/Bisync.Api
dotnet run
```

API: http://localhost:5299/api/health

### 2. Start the client

```powershell
cd client
npm install
npm run dev
```

App: http://localhost:5173

The Vite dev server proxies `/api` to the backend.

### One-command dev (PowerShell)

```powershell
.\scripts\dev.ps1
```

### Publish database backups

PostgreSQL data lives in the Docker volume `bisync_pg_data`. Back up with `pg_dump`:

```powershell
docker exec bisync-postgres pg_dump -U bisync bisync > backup-bisync.sql
```

For production, configure `ConnectionStrings__DefaultConnection` and `ConnectionStrings__ArchiveConnection` via environment variables (e.g. Cloud SQL).

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/locations` | Restaurant locations & metrics |
| GET | `/api/menu` | Menu performance |
| GET | `/api/vendors` | Vendor list |
| GET | `/api/purchaseorders` | Active purchase orders |
| GET | `/api/inventory/alerts` | Low-stock alerts |
| GET | `/api/revenue?period=week` | Revenue trend data |
| GET | `/api/progress` | Development milestones |

## Development progress

Progress is tracked in the database (`DevelopmentMilestones` table) and exposed via `/api/progress`. See [PROGRESS.md](./PROGRESS.md) for the full roadmap.

GitHub Actions automatically updates `PROGRESS.md` on each push to `main`.

## Project structure

```
Bisync.cloud/
├── client/                 # React frontend (from Figma Make)
├── src/Bisync.Api/         # C# Web API + EF Core
│   ├── Controllers/
│   ├── Data/
│   └── Models/
├── scripts/                # Local dev helpers
├── .github/workflows/      # CI + progress automation
└── PROGRESS.md             # Living development tracker
```

## Figma import

The UI is based on the Figma Make export (React + Tailwind + shadcn). The full design prototype includes:

- Operations dashboard (KPIs, revenue charts, menu performance)
- Revenue Management (Smart Ingredient, vendors, purchase orders)
- Point-of-Sales modules
- Multi-location filtering

The current client implements the dashboard shell connected to the live API. Extend by porting additional screens from the Figma Make source.

## License

Proprietary — Bisync.cloud
