# Bisync.cloud — Development Progress

> Auto-updated by GitHub Actions on push to `main`. Last sync: **2025-06-25**

## Overall: 41%

| Phase | Status | Progress |
|-------|--------|----------|
| Foundation | In progress | 93% |
| Core | In progress | 17% |
| Platform | Not started | 0% |

## Milestones

### Foundation
- [x] **Figma design import** — Imported from [Figma Make](https://www.figma.com/make/QgoQ4Z3lguzeuUlJU7ycoe/Bisync.cloud) (100%)
- [x] **C# API + SQLite database** — ASP.NET Core Web API with EF Core (100%)
- [ ] **Local development environment** — localhost API + React client (80%)

### Core
- [ ] **Dashboard API integration** — Locations, revenue, menu endpoints (40%)
- [ ] **Revenue Management module** — Ingredients, vendors, purchase orders (10%)
- [ ] **Point-of-Sales module** — POS menu, devices, e-invoice (0%)

### Platform
- [ ] **Authentication & multi-tenant** (0%)
- [ ] **Production deployment** (0%)

## What's working locally

- SQLite database with seeded restaurant data from Figma mock
- REST API for locations, menu, vendors, POs, inventory, revenue, progress
- React dashboard consuming live API data
- Development progress tracker API

## Next up

1. Port full Figma Make `App.tsx` screens into modular React components
2. Wire Revenue Management (Smart Ingredient, Vendor List) to API CRUD
3. Add authentication (ASP.NET Identity)
4. Deploy to Azure / containerize
