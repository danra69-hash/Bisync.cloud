# SaaS DB Tenancy

Status of one-DB-per-company + location LIST partitions inside each operational database.

## Phase 1 — Location partitions ✅

- `LocationPartitionService.EnsureLocationListPartitionsAsync` converts hot tables to `PARTITION BY LIST ("LocationExternalId")` when not already partitioned:
  - `InventoryMovements`, `InventoryPurchases`, `ProductProductionLogs`, `WastageEntries`
- Adds/backfills `LocationExternalId` on purchases and production logs from `LocationIdsJson[0]`.
- PK on partitioned parents: `("Id", "LocationExternalId")`. EF models keep `Id` as the key.
- DEFAULT partition + per-location partitions; ensure on location create and at startup.
- See `scripts/sql/phase1-location-partitions.sql` for the documented auto-migrator steps.

## Phase 2 — Control plane registry + resolve connection ✅

- `TenantConnections` registry (empty `ConnectionString` = shared `bisync`).
- `ITenantConnectionResolver` / `TenantConnectionResolver` caches by companyId; resolves operational + archive (`{db}_archive` or `ArchiveConnectionString`).
- `BisyncDbContext` options resolve via company header / `ITenantContext` (auth/health always use shared control plane).
- Identity in `TenantContextMiddleware` always reads AppUsers from the shared connection.

## Phase 3 — Provision company operational DB ✅

- `CompanyOperationalDbProvisioner` creates `bisync_c_{companyId}` + archive DB, runs EnsureCreated + SchemaPatcher, copies Company / Locations / owner AppUser, clears catalog seeds.
- Updates `TenantConnections` with full connection strings (idempotent).
- API: `POST /api/auth/provision-company-db` (`userId` or `companyId`).
- Also attempted from `complete-location-onboarding` if not yet provisioned.
- Client PaymentPage Continue calls provision after profile saves.
- Flag: `Tenancy:ProvisionCompanyDatabases` (default `true` in appsettings / Production).

## Phase 4 — Per-company archive ✅

- Provision creates `bisync_c_{companyId}_archive` and stores `ArchiveConnectionString` / `ArchiveDatabaseName`.
- `StockCardArchiveService.ArchiveAllTenantsAsync` archives shared DB then each provisioned company into its archive (shared archive remains fallback for legacy/empty connection tenants).

## Dev Console rollups ✅

- `TenantRollupService` fans out across shared DB (company-scoped) + each provisioned `TenantConnections.ConnectionString`.
- Snapshots stored in control-plane `TenantRollupSnapshots` (last 30 kept).
- APIs: `GET /api/dev-console/usage` (auto-refresh if &gt;1h), `GET /api/dev-console/rollups`, `POST /api/dev-console/rollups/refresh`.
- UI: System usage dashboard + **Tenant rollups** panel (DB mode, counts, Refresh).

## Limitations

- Existing shared-DB tenants keep working while `ConnectionString` is empty.
- After provision, business APIs with `X-Bisync-Company-Id` route to the company DB; auth stays on control plane.
- Platform-admin tools that expect all data in the shared DB will not see operational rows in provisioned company databases.
- `CREATE DATABASE` requires privileges on the PostgreSQL instance (Cloud SQL user must be allowed to create DBs).
- Partition conversion can take time on large tables; failures are logged and retried on next startup.
