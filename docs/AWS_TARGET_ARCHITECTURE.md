# Bisync AWS target architecture (5,000 tenancy)

**Status:** Binding target for product/engineering.  
**GCP Cloud Run / Cloud SQL today:** development and test only.  
**Goal:** The current build’s API, DB structure, and tenancy model must already match this AWS end state so migration is a **hosting cutover**, not a redesign.

## Scale definition

“5,000 tenancy” means planning capacity for up to:

- **~5,000 companies (tenants)** on the SaaS control plane, and/or  
- **~5,000 locations** across those tenants,

with POS, inventory, HR/payroll adjacency, platform AI, and **accounting** on the same platform.

## Binding decisions

| Decision | Choice | Why |
|---|---|---|
| Cloud | **AWS** `ap-southeast-1` (Prod + identical UAT) | Matches regional footprint; see cost estimate PDF |
| Compute | **ECS Fargate** behind **ALB** (+ CloudFront/WAF) | Stateless API/SPA container already fits |
| Database | **Aurora PostgreSQL** + **RDS Proxy** | Managed Postgres, pooling, Multi-AZ |
| Default tenant data placement | **Shared / sharded operational DBs**, not 1 DB per company | 5,000 physical DBs is not operable on Aurora either |
| Dedicated company DB | **Enterprise opt-in only** | Keep `CompanyOperationalDbProvisioner` for large tenants |
| Location isolation | **LIST partitions** by `LocationExternalId` (keep) | Proven for inventory hot tables |
| Identity | **Control-plane only** + **JWT** (not spoofable headers) | Required for multi-tenant SaaS |
| Accounting | **Same tenant placement** as ops data; separate schema/tables; **async posting** | Avoid dual-write spaghetti at POS close |
| Cache / async | **ElastiCache Redis** + **outbox** workers | Scale read paths and reliable integration |

## Target topology

```text
                    Route53 / ACM / CloudFront / WAF
                                    │
                                   ALB
                                    │
                         ECS Fargate (API + SPA)
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            Control-plane DB   Operational      Archive DBs
            (identity,         shards           (per shard /
             TenantConnections, (many companies  dedicated)
             billing)           per DB +
                                location
                                partitions)
                    │
                    ├── RDS Proxy (pooling)
                    ├── Secrets Manager
                    ├── S3 (assets, exports, AI corpus)
                    ├── Bedrock + OpenSearch (AI)
                    └── Redis + outbox workers
```

## Data placement model (required for 5,000)

### Control plane (always one logical DB)

- `AppUsers`, auth/sessions, companies, locations registry, subscriptions  
- `TenantConnections` (placement registry)  
- Sales CRM / Dev Console platform surfaces  
- Never store high-volume POS/inventory/accounting journals here long-term  

### Operational plane (default for new tenants)

1. **Shared** — all SMB tenants in `bisync` (or `bisync_ops`) with mandatory `CompanyId` filters (and future RLS).  
2. **Shard** — `bisync_s_{nnn}` databases; each holds many companies; company assigned at signup via registry.  
3. **Dedicated** — `bisync_c_{companyId}` only for enterprise / compliance / noisy neighbors.

Location LIST partitions apply **inside** whichever operational DB the company uses.

### Archive plane

- Shared archive for shared/shard tenants, or `{db}_archive` for dedicated.

## API / tenancy contract (must stay cloud-agnostic)

- Resolve tenant from **authenticated principal** (JWT claims: `sub`, `company_id`, roles).  
- `X-Bisync-Company-Id` may remain as a **dev/test convenience**, never as sole production auth.  
- Path-based control-plane routing stays (auth, companies, locations, health, platform tools).  
- Operational APIs always scoped by resolved `CompanyId` (+ location where applicable).  
- Connection resolution via `ITenantConnectionResolver` only — no GCP socket paths in app code.

## Accounting merge (design now, implement modularly)

Accounting is not a page stub bolted after AWS. Schema and posting contracts must land in this build:

| Concern | Rule |
|---|---|
| Tenancy | Journals/CoA/AP/AR live in the **same operational placement** as the company |
| Boundaries | `accounting` schema or clearly prefixed tables; no POS controllers writing GL rows directly |
| Integration | POS close, COGS, payroll, AP → **outbox / integration events** → accounting projector |
| External books | Optional Xero/QB connectors consume the same posting events |
| Close / lock | Period locks enforced in accounting module, checked by posting API |

## What GCP is allowed to be

- Small Cloud Run / Cloud SQL for **feature development and demos**  
- Same container image, same schema patchers, same tenancy flags  
- **Not** the capacity or networking model for 5,000  

## Success criteria (“ready to move”)

The build is AWS-ready when:

1. Tenant placement supports Shared / Shard / Dedicated without API rewrites.  
2. Schema changes **fan out** to every operational DB in the registry.  
3. Auth is token-based and company scope cannot be spoofed.  
4. Outbox exists for cross-module and accounting posts.  
5. Config is env-driven (`ConnectionStrings`, `DB_PASSWORD`, `Tenancy:*`) with no hard dependency on `/cloudsql/...` in application logic.  
6. Accounting module boundaries and posting events are defined in code/docs before GL UI is finished.

See also: `docs/AWS_MIGRATION_READINESS.md`, `docs/SAAS_DB_TENANCY.md`.
