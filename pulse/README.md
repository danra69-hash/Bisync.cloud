# Pulse — Fitness Membership Platform

Standalone fitness-center operations platform (separate from Bisync.cloud hospitality).

**Surfaces**
- **Team webapp** (`pulse/web`) — Management, Accounting, Fitness Coach, Sales
- **Admin desktop** (`pulse/desktop`) — Electron shell locked to Admin surface

**Domains**
- Team roles & access
- Membership CRM (members, payments, invoices, promotion scheduler)
- Trainer appointments
- Fitness equipment
- Training sessions (equipment usage + activity types)

## Stack

| Layer | Technology |
|-------|------------|
| Team web | React 19 + TypeScript + Vite + CSS tokens |
| API | Node.js (Express) + **PostgreSQL 16** |
| Admin desktop | Electron |

Default DB URL: `postgresql://bisync:bisync@127.0.0.1:5432/pulse`  
Override with `PULSE_DATABASE_URL` or `DATABASE_URL`.

## Quick start

### 0. PostgreSQL

From repo root (same Docker Postgres as Bisync):

```bash
docker compose up -d
```

Creates / uses database `pulse` (init SQL + API auto-create on first boot).

### 1. API (port 5400)

```bash
cd pulse/api
npm install
npm run seed          # migrate + seed (safe to re-run)
npm run dev
```

### 2. Team web (port 5401)

```bash
cd pulse/web
npm install
npm run dev
```

Vite proxies `/api` → API.

### 3. Admin desktop (optional)

```bash
cd pulse/desktop
npm install
npm run dev
```

## Demo logins

Password `pulse123` for all:

| Email | Role |
|-------|------|
| `admin@pulse.club` | Admin |
| `mgmt@pulse.club` | Management |
| `accounting@pulse.club` | Accounting |
| `coach@pulse.club` | Fitness Coach |
| `sales@pulse.club` | Sales |

Reset demo data: `cd pulse/api && npm run seed:force`

## Design

Hallmark: genre **modern-minimal** · theme **Cobalt** · app shell **Workbench**.  
See `design.md`.
