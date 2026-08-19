# AWS migration readiness (build must be ready before hosting)

This checklist is the gate for “we can lift Bisync to AWS for 5,000 tenancy without redesigning APIs/DB.”  
Target architecture: `docs/AWS_TARGET_ARCHITECTURE.md`.

Legend: **Done** / **In progress** / **Required before AWS Prod** / **AWS account work** (infra only).

## A. Tenancy & data plane

| Item | Status | Notes |
|---|---|---|
| Control-plane vs operational routing | Done | `Program.cs` path allow-list + `ITenantConnectionResolver` |
| Location LIST partitions on hot inventory tables | Done | Keep on AWS |
| `TenantConnections` registry | Done | Extend with placement/shard fields |
| Default **not** 1-DB-per-company for all tenants | Required | Dedicated = enterprise opt-in; Shared/Shard = default for 5k |
| Shard assignment at company create | Required | Registry picks `bisync_s_{nnn}` |
| Schema migration **fan-out** to all ops DBs | In progress | `TenantSchemaMigrationService` — must run on every deploy |
| PostgreSQL RLS by `CompanyId` (shared/shard) | Required | Defense in depth beyond app filters |
| RDS Proxy–compatible connections | Required | No session-sticky features; pooled Npgsql |

## B. Auth & API

| Item | Status | Notes |
|---|---|---|
| Header tenancy (`X-Bisync-*`) | Dev only | Acceptable on GCP test; **not** Prod AWS sole auth |
| JWT (or equivalent) with `company_id` claim | Required | Bind user ↔ company; stop spoofable headers in Prod |
| Platform admin vs tenant roles | Partial | Keep; enforce on every mutating API |
| Idempotent public APIs for POS sync | Required | Prepare for offline/outbox clients at scale |
| Cloud-agnostic connection config | Mostly done | App uses env connection strings; GCP socket only in deploy scripts |

## C. Async, cache, jobs

| Item | Status | Notes |
|---|---|---|
| Integration outbox table | In progress | Foundation for accounting + POS + webhooks |
| Outbox dispatcher worker | Required | ECS service or scheduled worker |
| Redis for session/cache/rate-limit | Required before 5k load | Interface now; ElastiCache on AWS |
| Rollups/archives not O(N) blocking HTTP | Required | Queue-based fan-out |

## D. Accounting (merge without post-host rewrite)

| Item | Status | Notes |
|---|---|---|
| Module shell / nav | Partial | UI placeholder exists |
| CoA / journal / period tables in ops DB | Required | Same placement as company |
| Posting API + outbox contracts | Required | POS/COGS/payroll emit events |
| External connector adapters | Later | Xero/QB consume same events |

## E. Hosting (AWS account — not app redesign)

| Item | Status | Notes |
|---|---|---|
| ECS Fargate + ALB + CloudFront + WAF | AWS account | Same container image |
| Aurora PostgreSQL + RDS Proxy | AWS account | |
| Secrets Manager, ECR, Route53, ACM | AWS account | |
| Identical UAT + Prod | AWS account | |
| Observability (CloudWatch) | AWS account | |

## F. Explicit non-goals for the app codebase

- Do **not** encode `/cloudsql/` or GCP project IDs in runtime business logic.  
- Do **not** assume Cloud Run instance counts.  
- Do **not** add accounting by writing GL rows inside every POS controller.  
- Do **not** plan 5,000 `CREATE DATABASE` calls as the default onboarding path.

## Exit criteria for “ready to host on AWS”

1. New tenants default to Shared or Shard placement.  
2. Deploy pipeline runs schema fan-out across registry.  
3. Prod auth path is JWT-bound to company.  
4. Outbox + accounting posting contract merged (even if GL UI is incomplete).  
5. Load test plan exists for 5k locations (POS sync + inventory + reporting + AI).  
6. Cutover runbook: export GCP Postgres → Aurora, swap DNS, dual-run optional.
