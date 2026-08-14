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
| API | Node.js (Express) + JSON persistence |
| Admin desktop | Electron |

## Quick start

```bash
# API (port 5400)
cd pulse/api && npm install && npm run dev

# Team web (port 5401) — proxies /api → API
cd pulse/web && npm install && npm run dev

# Admin desktop (loads web with surface=admin)
cd pulse/desktop && npm install && npm run dev
```

Demo logins (password `pulse123` for all):

| Email | Role |
|-------|------|
| `admin@pulse.club` | Admin |
| `mgmt@pulse.club` | Management |
| `accounting@pulse.club` | Accounting |
| `coach@pulse.club` | Fitness Coach |
| `sales@pulse.club` | Sales |

## Design

Hallmark: genre **modern-minimal** · theme **Cobalt** · app shell **Workbench**.
See `design.md`.
