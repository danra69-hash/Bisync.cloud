# SaaS DB Tenancy

Hybrid tenancy for Bisync SaaS. **AWS / 5,000-tenant target** is documented in `docs/AWS_TARGET_ARCHITECTURE.md` and `docs/AWS_MIGRATION_READINESS.md`.

**Binding rule:** Do not assume one physical database per company for all tenants. Default placement is **shared** or **shard**; **dedicated** (`bisync_c_{id}`) is enterprise opt-in.

## Phase 1 — Location partitions ✅

- `LocationPartitionService.EnsureLocationListPartitionsAsync` converts hot tables to `PARTITION BY LIST ("LocationExternalId")` when not already partitioned:
  - `InventoryMovements`, `InventoryPurchases`, `ProductProductionLogs`, `WastageEntries`
- Adds/backfills `LocationExternalId` on purchases and production logs from `LocationIdsJson[0]`.
- PK on partitioned parents: `("Id", "LocationExternalId")`. EF models keep `Id` as the key.
- DEFAULT partition + per-location partitions; ensure on location create and at startup.
- See `scripts/sql/phase1-location-partitions.sql` for the documented auto-migrator steps.

## Phase 2 — Control plane registry + resolve connection ✅

- `TenantConnections` registry (empty `ConnectionString` = shared `bisync`).
- Fields: `PlacementMode` (`shared` | `shard` | `dedicated`), `ShardId`, database + connection strings.
- `ITenantConnectionResolver` / `TenantConnectionResolver` caches by companyId; resolves operational + archive.
- `BisyncDbContext` options resolve via company header / `ITenantContext` (auth/health always use shared control plane).
- Identity in `TenantContextMiddleware` always reads AppUsers from the shared connection.
- `TenantPlacementService` assigns placement for new companies from `Tenancy:DefaultPlacementMode`.

## Phase 3 — Dedicated company operational DB (enterprise) ✅

- `CompanyOperationalDbProvisioner` creates `bisync_c_{companyId}` + archive DB when enabled.
- Flag: `Tenancy:ProvisionCompanyDatabases` (still true in current GCP test; treat as **opt-in** for AWS 5k).
- Prefer `Tenancy:DefaultPlacementMode` = `shared` or `shard` for scale.

## Phase 4 — Per-company / per-shard archive ✅

- Dedicated provision creates `bisync_c_{companyId}_archive`.
- Shared/shard tenants use shared archive (or `{shard}_archive` when shard DBs are provisioned).

## Phase 5 — Schema fan-out (AWS readiness) ✅ foundation

- `TenantSchemaMigrationService` patches every distinct non-empty operational connection in the registry after deferred startup when `Tenancy:FanOutSchemaMigrations` is true.
- Required so deploys do not leave shard/dedicated DBs schema-drifted.

## Phase 6 — Integration outbox (AWS / accounting readiness) ✅ foundation

- `IntegrationOutbox` table for durable cross-module events (POS close, COGS, payroll → accounting).
- Dispatcher worker still required before high scale.

## Dev Console rollups ✅

- `TenantRollupService` fans out across shared DB + each provisioned connection.
- At 5k tenants this must move to queued workers (see readiness doc).

## Configuration (`Tenancy` section)

| Key | Purpose |
|---|---|
| `ProvisionCompanyDatabases` | Allow dedicated DB provision API / onboarding |
| `DefaultPlacementMode` | `shared` (default) \| `shard` \| `dedicated` |
| `ShardCount` / `ShardDatabasePrefix` | Shard naming `bisync_s_001`… |
| `FanOutSchemaMigrations` | Run schema patch on all registry DBs |
| `SchemaFanOutBatchSize` | Cap per startup pass |

## Limitations

- GCP Cloud Run/SQL sizing is **dev/test only**.
- Header-based company context is not production auth for AWS SaaS (JWT required).
- Shard physical DB provisioning and RLS policies are still to be completed before 5k cutover.
- Accounting GL tables not yet merged; post via outbox contracts when added.
