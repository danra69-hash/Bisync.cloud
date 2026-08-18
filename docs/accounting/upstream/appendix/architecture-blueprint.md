# Multi-Tenant SaaS Accounting Platform — Architecture Blueprint

**Version** 1.0 · **Date** 17 August 2026 · **Status** Draft for review

**Parameters set for this design**

| Decision input | Value |
|---|---|
| Deliverable | Architecture blueprint (no code yet) |
| Tenancy model | Shared database + `tenant_id` + PostgreSQL Row-Level Security |
| Stack | Python backend |
| Market | Global / multi-country from day one |

---

## 0. Executive summary

You are building a **statutory book of record**, not a CRUD app with money in it. Three properties separate this from ordinary SaaS, and each one is expensive-to-impossible to retrofit:

1. **Immutability.** France's *inaltérabilité* (NF203), Germany's GoBD *Unveränderbarkeit*, Spain's VERI\*FACTU hash chains and Saudi ZATCA's cryptographic stamps all converge on the same requirement: once posted, a record can never be changed, only reversed. A mutable schema cannot be made immutable later.
2. **Multi-book, multi-COA.** A single global chart of accounts with country flags will not survive contact with France's Plan Comptable Général or a customer who needs an IFRS book and a tax book on the same asset. Dual-ledger mapping has to exist in v1.
3. **Tenant isolation that is enforced by the database.** In accounting, a cross-tenant leak is not a bug, it is an existential event.

Everything else — invoicing UI, bank feeds, reporting — is normal software and can be built incrementally.

### The ten decisions this document makes

| # | Decision | One-line rationale |
|---|---|---|
| 1 | Shared Postgres, `tenant_id` everywhere, **RESTRICTIVE RLS + app-layer scoping** | Cheapest to operate, and RLS turns an application bug into zero rows instead of a breach |
| 2 | **Promotable tenancy** via a `tenant_routing` table from day one | ~50 lines now; the difference between promoting a whale and rewriting the app |
| 3 | **Postgres is the ledger.** No TigerBeetle, no event bus between journal and balance | `Σdebits = Σcredits` is a cross-row invariant; keep it inside one ACID transaction |
| 4 | Immutable `journal` + `journal_line`, **dimensions denormalised onto the line**, dual currency amounts | The SAP Universal Journal shape; reports must never join through documents |
| 5 | **Subledger Accounting (SLA) rule engine** — posting rules are tenant data, not code | The only way one codebase serves 20 countries' posting conventions |
| 6 | **Localisation Packs**: country behaviour is a versioned plugin, never an `if country == 'FR'` | You will support ~8 regimes in year one and 30 in year three |
| 7 | **Buy e-invoicing transmission** (Storecove/Fonoa-class aggregator) behind your own abstraction | Becoming a Peppol AP is a business, not a feature; but never let their model be your model |
| 8 | **Django 6.1 → 6.2 LTS** modular monolith + one FastAPI gateway service | Migrations, admin and constraint modelling are the deciding factors, not async throughput |
| 9 | **Transactional outbox** (or Procrastinate) for every side effect of a posting | "Journal committed, task lost" is an unacceptable failure mode in a ledger |
| 10 | Statutory reports served from Postgres; **analytics only** from replica/DuckDB | Never show an auditor a number from an eventually-consistent copy |

### What this costs

A credible v1 (single-country GL + AR/AP + bank rec + one e-invoicing regime, SOC 2-ready) is roughly **4–6 engineers × 9–12 months**. The compliance surface, not the accounting, is what makes it long. Sections 12 and 13 phase it.

---

## 1. Scope and module map

### 1.1 Domain decomposition

```
                    ┌─────────────────────────────────────────┐
                    │           CONTROL PLANE                 │
                    │  tenants · routing · plans · billing    │
                    │  identity · SSO · audit index           │
                    └──────────────────┬──────────────────────┘
                                       │
   ┌───────────────────────────────────┴───────────────────────────────────┐
   │                          APPLICATION PLANE                            │
   │                                                                       │
   │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐          │
   │  │    AR     │  │    AP     │  │  Banking  │  │ Inventory │  subledgers│
   │  │ invoices  │  │   bills   │  │  feeds    │  │  costing  │          │
   │  │ credit N. │  │ payments  │  │  rec.     │  │  layers   │          │
   │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘          │
   │        │              │              │              │                 │
   │  ┌─────┴──────────────┴──────────────┴──────────────┴─────┐          │
   │  │        SUBLEDGER ACCOUNTING (SLA) RULE ENGINE           │          │
   │  │  business event + rule set  →  balanced journal draft   │          │
   │  └────────────────────────────┬───────────────────────────┘          │
   │                               │                                       │
   │  ┌────────────────────────────┴───────────────────────────┐          │
   │  │                  LEDGER CORE (GL)                       │          │
   │  │  journal · journal_line · period · period_balance       │          │
   │  │  numbering · period lock · FX · hash chain              │          │
   │  └────────────────────────────┬───────────────────────────┘          │
   │                               │                                       │
   │  ┌──────────┐  ┌──────────────┴────────┐  ┌──────────────┐           │
   │  │ Reporting│  │  Fixed assets · RevRec │  │ Consolidation│           │
   │  └──────────┘  └───────────────────────┘  └──────────────┘           │
   └───────────────────────────────────────────────────────────────────────┘
                                       │
   ┌───────────────────────────────────┴───────────────────────────────────┐
   │                     COMPLIANCE PLANE (Localisation Packs)             │
   │  tax determination · e-invoice mapping+transmission · statutory COA    │
   │  SAF-T / FEC / JPK exports · archive · numbering rules · rounding      │
   └───────────────────────────────────────────────────────────────────────┘
```

### 1.2 Module boundaries and ownership

| Module | Owns | Must not |
|---|---|---|
| **Ledger core** | journals, lines, periods, balances, numbering, FX posting | Know what an invoice is |
| **SLA engine** | event → account derivation rules | Write to the ledger directly (it emits drafts) |
| **AR / AP** | open items, applications/clearing, aging, dunning | Compute GL account codes itself |
| **Banking** | statement import (CAMT.053, OFX, Plaid-class feeds), matching | Post directly; it raises events |
| **Localisation packs** | per-country tax, format, numbering, archive, export rules | Contain business logic that isn't country-specific |
| **E-invoicing gateway** | outbound/inbound document transmission, retries, clearance state | Assign legal invoice numbers |
| **Reporting** | trial balance, financials, drilldowns, exports | Be the source of a statutory number if replica-served |
| **Control plane** | tenants, users, roles, routing, entitlements, billing | Hold any tenant financial data |

**The single most important boundary:** the SLA engine produces a *balanced journal draft*; the ledger core *validates and seals it*. Nothing else in the system may insert a journal line. Enforce this with a database role separation and a code-owner rule, not a convention.

---

## 2. ADR-001 — Tenancy architecture

**Decision:** shared database, shared schema, `tenant_id` on every tenant table, PostgreSQL RLS as a hard floor, application-layer scoping on top, and a routing layer that allows any tenant to be promoted to a dedicated database or region without application changes.

### 2.1 The three tiers

| Tier | Isolation | Who gets it | Migration path |
|---|---|---|---|
| **Standard** | Shared DB, shared schema, RLS | Default for everyone | — |
| **Dedicated** | Own database, identical schema and RLS | Whales; customers with contractual isolation clauses; anyone whose PITR RTO matters | Logical replication with row filters |
| **Regional** | Own database in a specific region | Data-residency obligations (Saudi Arabia is hard-mandatory; Germany requires notification) | Same mechanism, different region |

RLS stays enabled in dedicated and regional databases too, so exactly one code path exists.

### 2.2 The routing layer (build this first)

A small control-plane database holds:

```sql
CREATE TABLE tenant_routing (
  tenant_id   uuid PRIMARY KEY,
  cluster_key text NOT NULL,          -- resolves to a DSN in config/secrets
  region      text NOT NULL,          -- 'eu-central-1', 'me-south-1', ...
  tier        text NOT NULL,          -- standard | dedicated | regional
  status      text NOT NULL,          -- active | migrating | frozen | suspended
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

Connections are acquired *through* this table (cached, with a short TTL and an invalidation channel). No DSN is ever hardcoded. `status = 'frozen'` is the cutover primitive during promotion: that tenant's writes 503 for the ~30 seconds it takes to verify replication lag and flip the row.

Carry this even while you have one cluster. Retrofitting it later means touching every connection site in the codebase.

### 2.3 The RLS recipe

Roles — three, with strict separation:

```sql
CREATE ROLE app_owner   NOLOGIN;                                    -- owns tables; migrations only
CREATE ROLE app_rw      LOGIN NOSUPERUSER NOCREATEROLE NOBYPASSRLS; -- runtime
CREATE ROLE app_reports LOGIN NOSUPERUSER NOCREATEROLE NOBYPASSRLS; -- replica, SELECT only

ALTER ROLE app_rw      SET statement_timeout = '15s';
ALTER ROLE app_rw      SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE app_rw      SET plan_cache_mode = 'force_custom_plan';   -- see §2.6
ALTER ROLE app_reports SET statement_timeout = '10min';

REVOKE CREATE ON SCHEMA public FROM PUBLIC;                         -- CVE-2018-1058
```

Per tenant table:

```sql
ALTER TABLE journal_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_line FORCE  ROW LEVEL SECURITY;   -- without this, the table owner bypasses

-- Hard floor: RESTRICTIVE policies AND together and cannot be widened by a future
-- engineer adding a permissive `USING (true)` policy.
CREATE POLICY jl_tenant_floor ON journal_line AS RESTRICTIVE
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Restrictive policies only ever SUBTRACT. Every role that needs access needs
-- its own permissive policy, or it sees zero rows.
CREATE POLICY jl_rw ON journal_line FOR ALL    TO app_rw      USING (true) WITH CHECK (true);
CREATE POLICY jl_ro ON journal_line FOR SELECT TO app_reports USING (true);
```

**The trap in that recipe, stated explicitly because it is silent:** with only the `app_rw` permissive policy, `app_reports` returns **zero rows on every table** — and so does `app_owner`, because `FORCE ROW LEVEL SECURITY` binds the owner too. That means every report is empty *and* every Django `RunPython` data migration silently no-ops instead of failing. In a ledger, a data migration that reports success and changes nothing is the worst available outcome. Maintenance and migration paths must either get their own permissive policy or run explicitly with `SET row_security = off`, which errors rather than truncating.

Note also that the CI schema gate in §2.9 ("≥1 policy exists") **passes** this configuration. Extend it to assert reachability per role, not just policy presence.

**The `NULLIF` is not cosmetic.** Widely-circulated advice claims an unset GUC yields `''` which "casts to NULL and fails closed". It does not — `SELECT ''::uuid` raises an error. Worse, behaviour differs between a fresh backend (`current_setting` → `NULL` → 0 rows, silent) and a recycled one that previously served a request (`current_setting` → `''` → **error**). A missing-tenant-context bug therefore produces *zero rows on cold connections and 500s on warm ones* — intermittent, load-dependent, and very hard to reproduce. `NULLIF(..., '')` normalises both to NULL and fails closed consistently.

### 2.4 Leak vectors to close explicitly

| Vector | Result if ignored | Mitigation |
|---|---|---|
| Table owner runs a query | Sees all tenants | `FORCE ROW LEVEL SECURITY`; runtime role is never the owner |
| Superuser / `BYPASSRLS` | Sees all tenants; `FORCE` does not help | Audit `pg_roles` at boot and in CI. Reports of the RDS master user bypassing RLS despite lacking `rolsuper`/`rolbypassrls` are usually explained by **object ownership without `FORCE`** — which the recipe above fixes. Verify empirically; never run app traffic as the master user |
| Views | Execute with the **view owner's** privileges and policies. If the owner has `BYPASSRLS`, or the underlying table lacks `FORCE`, this is a full leak | Mandate `WITH (security_invoker = true)` on every view over a tenant table (PG15+) |
| **Materialised views** | Escape RLS entirely — data is physically copied | Treat as a separate tenant artefact with its own `tenant_id` and policy; refresh under a controlled role |
| `SECURITY DEFINER` functions | Run as owner → full leak; unqualified operators enable code execution | Pin `SET search_path = pg_catalog, pg_temp`; take `tenant_id` as a parameter |
| **Unique constraints** | Constraints bypass RLS *by design* → covert channel (`duplicate key … invoices_number_global` confirms another tenant owns that number, and names the constraint) | Every unique index is tenant-scoped: `UNIQUE (tenant_id, series, fiscal_year, doc_number)` |
| **Foreign keys** | A cross-tenant FK reference is silently possible | Composite FKs including `tenant_id`: `FOREIGN KEY (tenant_id, account_id) REFERENCES account (tenant_id, id)` |
| `LEAKPROOF` functions | `LEAKPROOF` is what makes a qual safe to push **below** the RLS barrier; non-leakproof quals are held above it. The hazard is a function *incorrectly* marked leakproof, which becomes a leak primitive | Only superusers can mark functions leakproof — audit `pg_proc` for non-builtin leakproof entries. (Conversely, non-leakproof predicates can't be pushed into index scans under RLS, causing surprise seq scans) |
| Policy subselects | Stale membership under READ COMMITTED | **Keep policies to a bare column-vs-GUC comparison.** No joins, no subqueries. Authorisation complexity lives in the app |
| `TRUNCATE` | Not subject to RLS at all | Never grant `TRUNCATE` to the runtime role |

Composite FKs including `tenant_id` also pre-position you for Citus sharding, should you ever need it.

### 2.5 Connection pooling — where the real incidents happen

**Rule: set tenant context with `set_config(name, value, is_local => true)` inside an explicit transaction. Never plain `SET`.**

Plain `SET` persists for the life of the *server* connection. Under PgBouncer transaction pooling that connection is handed to the next client at COMMIT — tenant A's context becomes tenant B's. Several widely-read tutorials get this wrong, and some also f-string-interpolate the tenant id into the SQL.

`set_config()` is preferred over `SET LOCAL` for a mundane but decisive reason: `SET LOCAL` is a utility statement and **cannot be parameterised**, so it forces string interpolation. `set_config()` is an ordinary function call that takes a bind parameter. Also note `SET LOCAL` outside a transaction block emits a warning most drivers discard and otherwise *does nothing* — an ORM in autocommit will silently apply no tenant context.

The only supported way to touch tenant data:

```python
_SET_CTX = text("SELECT set_config('app.tenant_id', :tid, true)")

@asynccontextmanager
async def tenant_session(tenant_id: UUID):
    """One request == one transaction. Nothing else may open a session."""
    async with _Session() as s:
        async with s.begin():                      # explicit BEGIN
            await s.execute(_SET_CTX, {"tid": str(tenant_id)})
            yield s
        # COMMIT drops the GUC and returns the connection to the pooler
```

Ban direct session construction with a lint rule. **Background jobs, Celery workers, management commands and data migrations must all go through this wrapper** — that is where leaks live, because everyone remembers to fix the request path.

Because RLS fails *silently* (zero rows), add a loud application-layer guard: a queryset/repository that raises if no tenant context is set, rather than returning an empty page. Silent is correct for security and terrible for debugging; you want both behaviours in their right layers.

PgBouncer configuration:

```ini
pool_mode                 = transaction
max_prepared_statements   = 0     ; see below — pick ONE posture, not both
server_reset_query_always = 0     ; must be 1 if you ever use SET ROLE
```

**Pick one prepared-statement posture and hold it.** Either (a) enable PgBouncer's protocol-level support (`max_prepared_statements = 200`) and keep client-side caching, or (b) disable client-side caching entirely (`statement_cache_size=0` / `prepare_threshold=None`). Because §2.6 independently recommends (b) to defeat cross-tenant plan reuse, **(b) is the recommendation here** — the two requirements compose. Note that `server_reset_query_always = 1` issues `DISCARD ALL`, which deallocates exactly the statements `max_prepared_statements` tracks, so those two settings are mutually antagonistic.

### 2.6 Performance — two things matter, and one is non-obvious

**RLS predicate overhead is negligible; missing indexes are what cost you.** Published benchmarks put RLS overhead in the low single-digit percent at p95, while adding the right index on the same query moved it by one to two orders of magnitude. Treat these figures as directional — they are schema-, load- and version-dependent, and you should reproduce them on your own data before quoting them. The structural point is robust: RLS makes missing indexes much more likely, because the predicate is invisible in your ORM code. Every index leads with `tenant_id`; a bare `(tenant_id)` index is not enough when there is a secondary predicate.

Good news: the planner *does* get per-tenant estimates. `current_setting` is STABLE and is evaluated at plan time, so the RLS predicate becomes an `Index Cond`, not a `Filter`.

**The non-obvious trap: cached plans are per-session, not per-tenant.** With a skewed tenant-size distribution — and accounting always has whales — a plan built while a 600k-row tenant was current gets reused by a 27-row tenant, and vice versa. In a synthetic reproduction on a 1M-row table, the small tenant inheriting the whale's sequential-scan plan ran roughly two to three orders of magnitude slower than it should have, and the reverse direction produced a row estimate off by four orders of magnitude — which becomes a nested loop over 600k rows the moment it drives a join. Exact multiples depend on your data; the failure mode does not.

Note that `plan_cache_mode = force_custom_plan` does **not** rescue the parameterless-prepared-statement case, because Postgres short-circuits to a generic plan before consulting that setting. So:

- `ALTER ROLE app_rw SET plan_cache_mode = 'force_custom_plan'` (role-scoped, not global). Planning typically costs a fraction of a millisecond for OLTP queries — cheap insurance against a pathological tail. Measure it on your workload.
- Prefer disabling client-side prepared-statement caching entirely (`statement_cache_size=0` / `prepare_threshold=None`) — this composes with the PgBouncer requirement anyway.
- Never issue parameterless prepared statements against RLS tables.
- When debugging "this endpoint is sometimes 300× slower for one customer", this is the first suspect. Latency becomes nondeterministic because it depends on which tenant last warmed that backend.

Also: `ALTER TABLE journal_line ALTER COLUMN tenant_id SET STATISTICS 1000;` — a whale-dominated MCV list degrades estimates for everyone.

### 2.7 Partitioning

Adopt `PARTITION BY LIST (tenant_id)` with **named partitions for whales and a DEFAULT partition for the long tail**, on the high-volume tables only (`journal_line`, `journal`, `document`, `audit_log`).

The payoff is operational, not query performance: per-tenant extraction for PITR becomes `pg_dump -t`, and offboarding becomes a partition drop rather than a bloat-generating `DELETE`.

Three gotchas, all of which have bitten people:

- **`tenant_id` must be in every primary key and unique constraint.** You want that anyway (§2.4).
- **RLS must be enabled and forced on partitions individually** — a query issued directly against a partition uses that partition's own RLS state. Make it a CI assertion.
- **Offboarding is a runbook, not a one-liner.** `DETACH PARTITION` on `journal` fails while `journal_line` still references it, and dropping the detached table fails on dependent objects. The order is: detach the `journal_line` partition → drop the cross-partition FK → detach and drop the `journal` partition. The self-referential `reverses_id` FK needs the same treatment. Write and rehearse this.

**Sub-partitioning whales by `RANGE (effective_date)` is tempting but has a real cost:** Postgres requires every unique constraint on a partitioned table to include all partitioning columns, so the primary keys in §3.2 would become `(tenant_id, effective_date, id)` and `(tenant_id, effective_date, journal_id, line_no)` — which cascades into every composite FK. Either accept that shape from day one or skip sub-partitioning; do not plan to add it later.

### 2.8 Operational patterns

**Per-tenant point-in-time recovery** does not exist in a shared database. The accepted pattern is restore-then-extract: restore the cluster to a temporary instance at the target timestamp, extract that tenant's rows, replace the live rows in one transaction, destroy the temp instance. RTO is hours, not minutes.

Two accounting-specific caveats: extract the **full tenant subgraph at one LSN** — a partially-restored double-entry ledger is worse than no restore — and run extraction with `SET row_security = off` so a policy misconfiguration raises an error rather than silently handing the customer a truncated export. Rehearse this quarterly and keep the timing evidence; auditors will ask. This is also the strongest argument for putting regulated customers on the Dedicated tier.

**GDPR erasure vs statutory retention is a genuine conflict**, and the resolution is schema shape. Structure the data so that personal data (contact names, emails, free-text notes, attachments) lives in dedicated, individually-encryptable columns and tables, **separate from ledger facts**. Then Article 17 erasure = destroy the per-tenant/per-subject data key (crypto-shredding, which also reaches historical backups), while the financial records survive their 5–10 year statutory retention. Backups themselves get a documented, bounded retention window (e.g. 35 days) stated in the DPA. Retrofitting this separation is very expensive.

**Promoting a tenant** to a dedicated database: provision the target with identical migrations → `CREATE PUBLICATION ... FOR TABLE x WHERE (tenant_id = '...')` (row filters, PG15+) → wait for lag ≈ 0 → freeze that tenant → verify counts → flip `tenant_routing` → unfreeze → drop the source partition after a soak. **Logical replication never copies sequences or counter state** — reset `doc_counter` on the target before cutover or your invoice numbering collides. For partitioned tables, set `publish_via_partition_root` explicitly; it also determines which row filter applies.

### 2.9 Testing isolation

Four tests per tenant table, generated rather than hand-written:

1. Tenant A set → sees exactly A's rows.
2. No context set → **zero rows, no error**. Run this on both a fresh connection and a recycled one; they behave differently (§2.3).
3. Tenant A inserts with `tenant_id = B` → raises `new row violates row-level security policy`.
4. Tenant A selects B's row by primary key → zero rows, silently.

Plus three CI gates:

- **Schema gate:** fail the build if any table with a `tenant_id` column lacks `relrowsecurity AND relforcerowsecurity` and ≥1 policy, **and additionally assert that each runtime role can actually reach its rows** — policy-presence alone passes the zero-rows-for-`app_reports` misconfiguration in §2.3 (include `relkind = 'p'` partitioned tables; maintain an explicit allowlist for global tables like `fx_rate`). Companion checks: no non-invoker views over tenant tables, no roles with `rolbypassrls`, no non-builtin leakproof functions.
- **Policy-diff gate:** classify policy changes in a migration as SAFE / BREAKING / DANGEROUS and block dangerous ones. `pgrls` does this off the shelf (67 lint rules, pytest plugin, SARIF output, and a Z3-based isolation prover) and is worth adopting rather than building.
- **Cross-tenant fuzzer:** seed two tenants with structurally identical fixtures, replay the full API surface as A capturing every returned id, then replay as B substituting A's ids into every path/body/query parameter. Assert 403/404 or an empty 200 — never a 200 containing A's values. This catches the class RLS cannot: an endpoint legitimately running under a bypass role.

Runtime detection: log the authenticated tenant alongside the `app.tenant_id` actually set, and alert on any divergence or on any query against a tenant table with the GUC unset.

---

## 3. ADR-002 — The ledger core

**Decision:** an immutable, append-only journal in PostgreSQL. No TigerBeetle. No message broker between the journal and derived balances.

### 3.1 Why not TigerBeetle, and when to revisit

TigerBeetle is a serious, well-engineered system — Jepsen's analysis of 0.16.11 found two genuine safety bugs (a merge-join bug dropping query results, and a client timestamp bug) plus seven crashes, and reported findings consistent with its Strong Serializability claim from 0.16.30 onward, praising its resilience to disk faults. It is also a *data plane* for high-volume transfers, explicitly not a general database — fixed 128-byte records, no strings, no ad-hoc query, and its own docs warn that initiating a transfer should not require fetching metadata from a general-purpose database.

An accounting product's posting path is *drenched* in metadata lookups: tax rules, dimension validation, period locks, approval state, FX rates, revenue schedules. And the volume is 10²–10⁴ journals/day/tenant, not millions per second. Adopting it would mean operating two stateful systems and owning the cross-system consistency problem yourself — a new correctness risk in exchange for performance you do not need.

**Revisit if and only if** you build a high-volume money-movement subledger: wallets, card programmes, marketplace payouts, per-second interest accrual. The correct boundary is then *TigerBeetle as a subledger, Postgres as the GL*, with periodic summarised journals posted into the GL.

Likewise, do not put a Kafka-style log between the journal and balances. Event-sourcing buys replay and derived views but costs you transactional cross-aggregate invariants — and `Σdebits = Σcredits` **is** exactly such an invariant. Use event-sourcing-*shaped* storage inside one ACID database: append-only tables plus derived balance tables written in the same transaction.

### 3.2 Core schema

```sql
-- ─── JOURNAL (the sealed document) ─────────────────────────────────────────
CREATE TABLE journal (
  tenant_id        uuid        NOT NULL,
  id               uuid        NOT NULL DEFAULT uuidv7(),   -- k-sortable (PG18+)
  entity_id        uuid        NOT NULL,                    -- legal entity
  ledger_id        uuid        NOT NULL,                    -- primary | tax | ifrs | consol
  journal_type     text        NOT NULL,                    -- SALES | PURCH | BANK | GEN | ELIM
  doc_series       text        NOT NULL,
  fiscal_year      smallint    NOT NULL,
  doc_number       text,                                    -- assigned at POST, never at draft
  effective_date   date        NOT NULL,                    -- accounting date → drives period
  document_date    date        NOT NULL,                    -- original document date
  posted_at        timestamptz,                             -- NULL = draft; non-NULL = sealed
  period_id        uuid        NOT NULL,
  source_module    text        NOT NULL,                    -- AR | AP | BANK | FA | REVREC | SLA
  source_doc_id    uuid,
  reverses_id      uuid,                                    -- storno link (set at creation)
  idempotency_key  text,
  payload_hash     bytea,                                   -- fingerprint of the request
  prev_hash        bytea,                                   -- hash chain within (tenant, series, FY)
  row_hash         bytea,
  created_by       uuid        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, entity_id, period_id)
      REFERENCES fiscal_period (tenant_id, entity_id, id),
  FOREIGN KEY (tenant_id, reverses_id) REFERENCES journal (tenant_id, id)
) PARTITION BY LIST (tenant_id);

CREATE UNIQUE INDEX ON journal (tenant_id, doc_series, fiscal_year, doc_number)
  WHERE doc_number IS NOT NULL;
CREATE UNIQUE INDEX ON journal (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ─── JOURNAL LINE (wide, dimensions denormalised — the Universal Journal shape)
CREATE TABLE journal_line (
  tenant_id         uuid     NOT NULL,
  journal_id        uuid     NOT NULL,
  line_no           smallint NOT NULL,
  account_id        uuid     NOT NULL,
  direction         char(1)  NOT NULL CHECK (direction IN ('D','C')),

  -- amounts: integer minor units + explicit currency, never floats, never MONEY
  txn_currency      char(3)  NOT NULL,
  txn_amount_minor  bigint   NOT NULL CHECK (txn_amount_minor >= 0),
  func_currency     char(3)  NOT NULL,
  func_amount_minor bigint   NOT NULL CHECK (func_amount_minor >= 0),
  fx_rate           numeric(20,10),
  fx_rate_date      date,
  fx_rate_type      text,                    -- spot | average | closing | historical

  -- dimensions, on the line (never encoded in the account code string)
  entity_id         uuid     NOT NULL,
  cost_centre_id    uuid,
  project_id        uuid,
  department_id     uuid,
  partner_entity_id uuid,                    -- SAP "trading partner" → IC elimination
  dimensions        jsonb,                   -- tenant-defined long tail, GIN-indexed
  cashflow_category text,                    -- nullable now; enables direct-method later

  effective_date    date     NOT NULL,       -- copied from journal for index locality
  period_id         uuid     NOT NULL,
  narration         text,

  PRIMARY KEY (tenant_id, journal_id, line_no),
  FOREIGN KEY (tenant_id, journal_id) REFERENCES journal (tenant_id, id),
  FOREIGN KEY (tenant_id, account_id) REFERENCES account (tenant_id, id)
) PARTITION BY LIST (tenant_id);

CREATE INDEX ON journal_line (tenant_id, account_id, effective_date) INCLUDE (direction, func_amount_minor);
CREATE INDEX ON journal_line (tenant_id, entity_id, period_id, account_id);
CREATE INDEX ON journal_line USING gin (dimensions);
CREATE INDEX ON journal_line USING brin (tenant_id, effective_date);   -- tenant-first, per §2.6
```

Design notes worth defending in review:

- **`direction` enum + non-negative amount**, not a signed amount. It makes double-entry semantics explicit, lets you index debits and credits separately, and prevents the "negative debit" class of confusion in reports.
- **Dual amounts on every line.** Transaction currency *and* functional currency, plus the rate and rate type used. Reconstructing functional amounts later from a rate table is a well-known source of irreproducible reports. Presentation currency is derived at report time, not stored.
- **Dimensions as typed columns + a `jsonb` escape hatch.** Encoding dimensions in the account code string (`4000-100-200`) is the number-one legacy trap; it makes every report a string-parsing exercise.
- **`cashflow_category` nullable from day one.** Direct-method cash flow requires tagging at posting time. Adding the column later is easy; back-filling five years of history is not.
- **No `reversed_by_id`.** A "this was later reversed" pointer can only be written *after* the journal is sealed, which is a mutation of a sealed row and invalidates any hash computed over it. Derive the back-link from `reverses_id` on the reversing journal (indexed), or hold it in a separate mutable side table that is explicitly excluded from the canonical hash payload. Document precisely which fields the hash covers.
- **`fiscal_period` is entity-scoped, so the period FK must be too.** A journal carries one `period_id` but lines carry per-line `entity_id` (needed for the intercompany case). Without `entity_id` in the FK, a line's period can point at a different entity's calendar.

### 3.3 The invariants, enforced in the database

```sql
-- Deferred so multi-statement inserts work. DELETE is included deliberately:
-- without it, deleting a line from an unposted journal in a later transaction
-- leaves that journal permanently unbalanced, silently.
CREATE CONSTRAINT TRIGGER journal_balanced
  AFTER INSERT OR UPDATE OR DELETE ON journal_line
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_journal_balanced();
```

There are **two distinct invariants**, and you need both:

| Invariant | Check |
|---|---|
| **Per transaction currency** — the economic statement | `GROUP BY (tenant_id, journal_id, txn_currency)`, `SUM(±txn_amount_minor) = 0` |
| **Whole journal in functional currency** — what makes the trial balance balance | `SUM(±func_amount_minor) = 0` across the journal |

(Where `±` is `CASE direction WHEN 'D' THEN amount ELSE -amount END`.) Grouping by `func_currency` would be a no-op — §3.2 requires it to equal the entity's functional currency, so there is only ever one group.

**Balance per transaction currency, never across currencies.** A journal mixing USD and EUR must balance within each currency separately — there is no universal rate, and cross-currency balancing makes historical rate verification impossible. An FX conversion therefore needs a minimum of four accounts: source + FX clearing in currency A, FX clearing + destination in currency B. Any residual in the FX clearing accounts *is* your trading gain or loss.

Two implementation notes on the trigger: a **zero-line journal never fires a `FOR EACH ROW` trigger at all**, so add a journal-level check at post; and constraint triggers **cannot** be `FOR EACH STATEMENT`, so a 20-line journal runs 20 aggregate scans. Measure this against the p95 < 300 ms target in §8 and, if needed, gate the trigger body on a per-transaction "already checked this journal" set.

Additional DB-level guards:

- Trigger rejecting `UPDATE`/`DELETE` on any line whose journal has `posted_at IS NOT NULL`.
- Line currency validity **cannot be a `CHECK` constraint** — CHECK cannot contain a subquery or reference another table. Either use a trigger, or denormalise `entity.func_currency` onto the line and enforce it with a composite FK, which is consistent with the pattern in §2.4.
- Trigger rejecting inserts whose `effective_date` falls in a closed period (see §3.6).
- Hash chain: `row_hash = sha256(prev_hash || canonical_json(journal + lines))` per `(tenant, series, fiscal_year)`. Cheap, and it converts "our data is immutable" from a claim into something demonstrable to an auditor. France's *inaltérabilité*, Germany's GoBD and Spain's VERI\*FACTU all effectively expect this.

### 3.4 Concurrency

**Read Committed + explicit row locks is the right default for the posting path** — it is what nearly every ERP does. Take deterministic `SELECT ... FOR UPDATE` locks on the specific counter and balance rows.

Use `SERIALIZABLE` only where the invariant spans rows you did not write ("this account must not go negative given all concurrent writers"). SSI adds no new *blocking* — its predicate locks don't block — but serializable transactions still take ordinary row-level write locks and **deadlock exactly like read-committed ones**, so you need a canonical lock order *and* retry on both `40001` and `40P01`. Critically, SSI **must avoid sequential scans**, which escalate to relation-level predicate locks and cause serialisation-failure storms. Mark long reporting transactions `SERIALIZABLE READ ONLY DEFERRABLE` so they take no predicate locks at all.

**Acquire account and counter locks in a canonical order (ascending id) inside a posting.** This is the single highest-value line of code in the posting engine.

### 3.5 Gapless document numbering

Required for invoices and journal entries in France, Italy, Spain, Portugal, Poland, Brazil, India and others — "sequential and without gaps within a fiscal year and series". The requirement is on **documents**, not on internal surrogate keys; never conflate the two.

`SEQUENCE` cannot do this: `nextval()` is non-transactional by design, so a rollback does not return the number. The implementation that works is a counter row locked in the same transaction:

```sql
CREATE TABLE doc_counter (
  tenant_id   uuid     NOT NULL,
  series      text     NOT NULL,
  fiscal_year smallint NOT NULL,
  next_value  bigint   NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, series, fiscal_year)
);

-- Upsert, NOT a bare UPDATE. A bare UPDATE matches zero rows for the first
-- document of a new (tenant, series, fiscal_year); the CTE then yields nothing,
-- the INSERT is a no-op, and THE TRANSACTION COMMITS SUCCESSFULLY. A fiscal
-- year rolls over and postings vanish with no error.
WITH c AS (
  INSERT INTO doc_counter (tenant_id, series, fiscal_year, next_value)
  VALUES ($1, $2, $3, 2)
  ON CONFLICT (tenant_id, series, fiscal_year)
  DO UPDATE SET next_value = doc_counter.next_value + 1
  RETURNING next_value - 1 AS n
)
INSERT INTO journal (tenant_id, doc_series, fiscal_year, doc_number, ...)
SELECT $1, $2, $3,
       -- format()'s width flag pads with SPACES, not zeros: '%06s' yields
       -- 'SALES/2026/     1'. Use lpad() for a legal document number.
       format('%s/%s/%s', $2, $3, lpad(c.n::text, 6, '0')), ...
FROM c;
```

Six operational rules:

1. **Take the number last**, at the very end of the transaction, after all validation, tax calculation and FX lookup. Lock hold time is the whole game. **Never call an external service while holding the counter lock.**
2. **Number at post, not at draft.** Drafts get UUIDs. This eliminates abandoned drafts — the largest source of gaps — at the domain level rather than the database level.
3. Multiple series (per journal, per branch, per POS) are legally acceptable almost everywhere and multiply your concurrency by the number of series.
4. Serialisation is per `(tenant, series, year)`, so multi-tenancy gives you natural sharding — tenant A's numbering never blocks tenant B's. Gapless numbering that would be catastrophic in a single global payments ledger is entirely fine here.
5. **Voided documents keep their number** and are marked cancelled. Deleting is what creates a gap; make deletion impossible post-numbering.
6. **Gapless is necessary but not sufficient — France's PCG and Italy also require chronological recording.** Numbering last makes number order track *commit* order, which diverges from `effective_date` order on backdated posts. Either constrain a series to non-decreasing effective dates, or use per-period series. Decide this per localisation pack; do not discover it during certification.

### 3.6 Periods and locking

```
fiscal_period (tenant_id, id, entity_id, year, period_no, start_date, end_date, status)
  PRIMARY KEY (tenant_id, id)
  UNIQUE (tenant_id, entity_id, id)      -- FK target for journal/journal_line
  UNIQUE (tenant_id, entity_id, year, period_no)
status ∈ { future, open, closing, closed, hard_closed }
```

Three lock tiers, following the best productised reference (Odoo's model):

| Tier | Who can bypass | Use |
|---|---|---|
| **Soft lock** (journal-entries lock date) | Admin, time-boxed per-user exception, audit-logged | Month-end discipline |
| **Tax lock** | Nobody once a return is filed | VAT/GST period protection |
| **Hard lock** | **Nobody, irreversibly** | Statutory inalterability |

Three legitimate behaviours for a retroactive post, offered as tenant policy: **reject** (default, hard-locked); **redirect** — shift `effective_date` to the first open period, keeping the original as `document_date`; **reopen** — soft-closed only, with audit-logged approval, which **must invalidate downstream period snapshots**. That last point is why `period_balance` needs a `dirty`/`recompute_after` marker and a rebuild job. Never let a reopened period leave stale opening balances behind it.

For errors in already-reported periods, IAS 8 distinguishes by materiality. **Material** prior-period errors (IAS 8.41–42) require **retrospective restatement**: restate the comparatives for the period in which the error occurred, or the opening balances of the earliest period presented. Where the ledger period is hard-locked, the mechanical consequence is to book the correction in the current period against retained earnings and carry the restatement of comparatives as **first-class, auditable reporting metadata** — not to silently present the current-period posting as the accounting answer. **Immaterial** errors go through current-period profit or loss. Note this is a genuinely different path from the "reopen" policy option above; both exist, and which applies is a materiality judgement your product should record, not infer.

### 3.7 Balances

Do **not** materialise a single mutable "current balance" scalar. Materialise the ERP-standard cube:

Use **two cubes**, not one. A single cube keyed by a dimension hash approaches line-table cardinality once tenants use the `dimensions` jsonb escape hatch, which defeats the whole point.

```sql
-- (a) TRIAL BALANCE CUBE — account level, no dimensions. This is what serves
--     the trial balance, statutory P&L and balance sheet. Low cardinality.
CREATE TABLE period_balance (
  tenant_id       uuid NOT NULL,
  entity_id       uuid NOT NULL,
  ledger_id       uuid NOT NULL,
  account_id      uuid NOT NULL,
  period_id       uuid NOT NULL,
  txn_currency    char(3) NOT NULL,       -- sub-balance by transaction currency,
  opening_txn_dr  bigint NOT NULL DEFAULT 0,   -- needed for FX revaluation
  opening_txn_cr  bigint NOT NULL DEFAULT 0,
  period_txn_dr   bigint NOT NULL DEFAULT 0,
  period_txn_cr   bigint NOT NULL DEFAULT 0,
  opening_func_dr bigint NOT NULL DEFAULT 0,   -- functional currency: the TB balances here
  opening_func_cr bigint NOT NULL DEFAULT 0,
  period_func_dr  bigint NOT NULL DEFAULT 0,
  period_func_cr  bigint NOT NULL DEFAULT 0,
  is_frozen       boolean NOT NULL DEFAULT false,
  recompute_after timestamptz,
  PRIMARY KEY (tenant_id, entity_id, ledger_id, account_id, period_id, txn_currency)
);

-- (b) DIMENSIONAL CUBE — same grain plus dim_hash, for management reporting
--     and drilldown only. Never the source of a statutory number.
CREATE TABLE period_balance_dim (LIKE period_balance INCLUDING ALL);
ALTER TABLE period_balance_dim ADD COLUMN dim_hash bytea NOT NULL;

-- (c) DIMENSION DICTIONARY — dim_hash must be decodable, or you cannot
--     filter or group by cost centre.
CREATE TABLE dimension_tuple (tenant_id uuid, dim_hash bytea, tuple jsonb,
  PRIMARY KEY (tenant_id, dim_hash));
```

Both cubes carry **both** currency dimensions: the transaction-currency sub-balance is what FX revaluation operates on (§3.8), while the functional-currency figures are what must balance. One amount pair cannot serve both.

Updated incrementally **inside the posting transaction**, fully rebuildable from lines, frozen at period close. Run a **drift-detection job** comparing each cube against the line sum and automatically disabling cache reads for any divergent account. A balance cache that can silently drift in a ledger is a defect generator; treat drift detection as mandatory, not optional.

**The `recompute_after` cascade is broader than reopening.** Any post whose `effective_date` falls in an earlier open period invalidates the *opening* balances of every subsequent period, closed or not. Arm the cascade on effective date, not just on the reopen action.

**Default to deriving the year-end close rather than physically zeroing P&L accounts** — but treat that as a default the localisation pack can override, not a law. France's PCG requires a *clôture* transferring class 6/7 balances into account 12 (Résultat), and those entries appear in the FEC; German SKR03/SKR04 close to GuV and Schlussbilanzkonto. Where a pack requires it, the closing journal is real and irreversible, consistent with the hard lock in §3.6. Add `close_pnl` to the pack capability list in §5.1.

### 3.8 Multi-currency (IAS 21)

| Concept | Where it lives |
|---|---|
| **Transaction currency** | `txn_currency` / `txn_amount_minor` on the line |
| **Functional currency** | `func_currency` / `func_amount_minor` + rate + rate type on the line. **The trial balance must balance in this currency** |
| **Presentation currency** | Derived at report time; stored only in a consolidation ledger |

Measurement rules to implement: monetary items retranslate at the closing rate; non-monetary items at historical cost do **not** retranslate; exchange differences on monetary items go to P&L; translating a foreign operation puts differences in OCI as CTA, not recycled until disposal.

**Unrealised revaluation** posts with *functional-currency amounts only and zero transaction-currency amount* — this preserves the FC sub-balance (you still owe exactly USD 10,000) while adjusting its carrying value. Default to **reversing revaluation** (post at period end, auto-reverse day 1 of the next period); it makes realised-gain computation trivial and is what most mid-market ERPs do.

**Realised gain/loss is emitted by the clearing/matching engine, not the posting engine** — which means open-item clearing must be a first-class subsystem, not a report. A point worth stating explicitly because it is routinely discovered too late.

**Compute it; do not plug it.** Realised FX gain/loss = (settlement rate − booking rate) × foreign-currency amount cleared. It is independently computable and independently verifiable, which is exactly what an auditor tests. If you post whatever makes the entry balance, then a wrong rate, a wrong application amount or a rounding bug lands silently in FX P&L forever. Compute the figure, post it, *then* assert the entry balances — and treat any residual after that as the plug-and-alert case below.

Amount storage: **integer minor units (`bigint`) + explicit ISO 4217 currency**. ISO 4217 defines 0-decimal currencies (JPY, KRW, VND, XAF), 3-decimal ones (KWD, BHD, OMR, TND) and metals with no minor unit. Model `Money = (minor_units, currency)` as a value object; never let a bare integer cross a function boundary. Do not use Postgres's `money` type (locale-dependent, fixed at 2 decimals). `Decimal` belongs on quantities, unit prices, tax rates, FX rates and allocation intermediates — store FX rates at `numeric(20,10)` with an explicit `from_ccy`/`to_ccy` direction, because inverted-rate bugs are endemic.

Rounding: round once, at the last possible moment, with an explicit mode set in policy — **Python's `decimal` defaults to `ROUND_HALF_EVEN`, which surprises accountants** who expect `ROUND_HALF_UP`.

Allocation must be exhaustive — never `round(total/n)` per part, which creates or destroys money. Two defensible algorithms with **different visible results**: Fowler's `Money.allocate()` distributes the remainder sequentially over the first *n* parts, while the largest-remainder (Hare quota) method gives it to the parts with the largest fractional remainders. Same total, different distribution, and a customer comparing line allocations will see the difference. Pick one, document it, and use it everywhere — including ASC 606 standalone-selling-price allocation.

**Where VAT rounding lands — line level vs VAT-category level vs invoice level — is a legal question that differs by jurisdiction**; make it per-jurisdiction configuration, not a constant. Note that the commonly cited "Belgium prohibits line-level rounding" is really a Peppol BIS Billing 3.0 / EN 16931 rule: VAT is calculated and rounded per **VAT breakdown category** (one breakdown per distinct category-code + rate combination), which applies in every Peppol jurisdiction, not just Belgium.

Every ledger needs designated plug accounts: `Rounding difference`, `FX gain/loss — realised`, `FX gain/loss — unrealised`, and `Suspense/clearing`. A posting engine that cannot balance posts to the plug **and raises an alert** — it never silently adjusts a real account.

---

## 4. ADR-003 — Subledger Accounting (SLA) rule engine

**Decision:** how a business event hits the general ledger is **tenant-and-country configuration data**, not application code.

This is the pattern Oracle Fusion and SAP both use, and it is the only realistic way one codebase serves twenty countries' posting conventions plus per-tenant chart customisation.

```
  business event                 rule set (data)                  output
  ─────────────                  ───────────────                  ──────
  "AR invoice posted"     →   for each rule line:            →   balanced
   { entity, customer,           condition (JSONLogic-ish)         journal
     lines[], tax[],             account derivation                 draft
     currency, dims }            dimension derivation
                                 sign / direction
```

Schema sketch:

```
sla_rule_set   (tenant_id, id, event_type, country, entity_id, version, effective_from, status)
sla_rule_line  (tenant_id, rule_set_id, seq, condition_json, account_selector,
                dimension_map_json, direction, amount_source)
```

Properties that make this work rather than becoming a nightmare:

- **Versioned and effective-dated.** A rule set is never edited in place; a new version supersedes it from a date. Reproducing last year's posting requires the rule set that was live then.
- **Every journal records the `rule_set_version_id` that produced it.** When a customer asks "why did this hit account 6210?", the answer is a query, not an archaeology project.
- **Dry-run first.** The engine can produce a draft journal without posting it — this is how you build a "preview accounting entries" screen and how you test rule changes safely.
- **Ships as a seeded default per country**, derived from the localisation pack, which tenants may override. Do not make every tenant author rules from scratch.

Subledger → GL is a one-way, summarised, reconcilable posting. Every subledger has a **control account** in the GL whose balance is provably equal to the subledger's open-item total, verified by a scheduled reconciliation job that is a first-class alerting surface.

### 4.1 AR / AP

- **Open items** (`invoice`, `credit_note`, `payment`, `adjustment`) plus a separate **application/clearing table** (`applied_from_id`, `applied_to_id`, `amount`, `applied_at`, `effective_at`) — many-to-many, partial applications allowed.
- **Aging must be computable as-of a past date**, so the application table is bi-temporal and never deleted; un-applying creates a reversing application row.
- Aging buckets are a report-time parameter, not stored.
- FX realised gain/loss is emitted here (§3.8).

### 4.2 Banking and reconciliation

Four match cardinalities must all be representable from day one: **1:1** (wires, single-invoice payments), **N:1** (card settlement batches, ACH), **1:N** (partial payments, instalments), **N:M** (B2B netting, cross-currency).

Model the match as a **match-group entity** — many statement lines to many ledger items — never as a nullable FK on the statement line. N:M is otherwise unrepresentable and the retrofit is painful.

Matching engine shape: deterministic rules first (exact provider reference, then exact amount+date), then scored candidate generation (amount proximity, date proximity, string similarity on narrative, counterparty history), then a human queue. **Store the rule or score that produced each match** — auditors ask. Use a rolling lookback window with amount tolerance, not exact timestamp equality; settlement timing varies by rail.

Clearing/suspense accounts per rail (`psp:stripe:settlement`, `bank:in-transit`) make gross-vs-net and fee splits ledger-visible. Timing differences **carry forward**; they are not written off.

### 4.3 Inventory, fixed assets, revenue

**Inventory costing** — perpetual, with cost layers for FIFO (`receipt_layer(qty_remaining, unit_cost, received_at)`) or a running `(total_qty, total_value)` pair for weighted average. The concurrency hazard is real: weighted-average cost is a read-modify-write on a hot row per SKU — lock the item-location cost row `FOR UPDATE` or serialise costing per SKU. This is a classic silent-corruption site. Backdated receipts and negative inventory force **cost adjustments**: a delta journal in the *current* period referencing the original. Never rewrite history.

**Fixed assets** — store the *schedule*, not just the balance, and put **`book_id` in the model on day one**. Multiple books per asset (IFRS book, local GAAP book, tax book) with independent methods and lives is a hard requirement in most countries and brutally expensive to retrofit. Changes in useful life are prospective under IAS 8: regenerate the remaining schedule from current NBV, do not restate.

**Revenue recognition (ASC 606 / IFRS 15)** — model three distinct balance-sheet artefacts separately, because engineers habitually collapse them: **contract asset** (revenue recognised, right to consideration conditional on more than time), **receivable** (unconditional right), **contract liability** (deferred revenue). Implement as a subledger with performance obligations, allocated transaction price (using the largest-remainder allocation from §3.8), and a **versioned recognition schedule**. Contract modifications have three possible treatments under ASC 606-10-25-12/13 — separate contract, prospective termination-and-replacement (re-allocating the remaining transaction price), or cumulative catch-up — and the product must be able to express all three, which is precisely why the schedule is versioned rather than mutated.

---

## 5. ADR-004 — Multi-country compliance architecture

**Decision:** every country-specific behaviour lives in a versioned **Localisation Pack**. There is no `if country == "FR"` anywhere in the core.

This is the decision that determines whether adding country nine takes two weeks or two quarters.

### 5.1 Localisation Pack interface

A pack declares, for one jurisdiction:

| Capability | Examples |
|---|---|
| `chart_of_accounts` | France PCG (accounts must begin 1–7; 40xx/41xx require posting profiles), Germany SKR03/SKR04, Spain PGC |
| `tax_rules` | rate lookup, place-of-supply, reverse charge, **rounding level (line vs invoice)**, exemption codes |
| `numbering_rules` | gapless requirement, series conventions, format masks, reset cadence |
| `document_formats` | Factur-X / UBL / CII (FR), XRechnung / ZUGFeRD (DE), FatturaPA (IT), FA(3) (PL), CIUS_RO, CFDI 4.0 (MX), PINT-MY |
| `transmission_channel` | PDP (FR), Peppol 4-corner (BE), Peppol 5-corner (SG, MY), clearance (IT SdI, PL KSeF, RO SPV), PAC (MX), FATOORA (SA) |
| `statutory_exports` | FEC (FR), SAF-T variants (PT/PL/RO/NO/LT/DK/BG/LU/AT), JPK_V7M, GST returns |
| `period_rules` | France: **maximum 2 open fiscal years**; chronology constraints on numbering series |
| `close_pnl` | Whether year-end physically transfers P&L balances (France: class 6/7 → account 12; Germany: → GuV/SBK) or the close is derived |
| `archive_policy` | retention years, storage region, what must be retained (original XML, not a PDF rendering) |
| `certification_artefacts` | NF203 audit event codes, VERI\*FACTU hash chain + QR, ZATCA cryptographic stamp |

Packs are **versioned and effective-dated** exactly like SLA rule sets, because mandates change on fixed dates and you must be able to reproduce how a document was generated in 2027 when auditing it in 2032.

### 5.2 Statutory chart of accounts — the deepest constraint

**Do not build one global COA with country flags.** France and Romania regulate the chart of accounts, trial balance format and general ledger at software level. France's PCG requires main accounts to begin with 1–7 and mandates posting profiles on customer/supplier accounts with manual entry disabled. Local GAAP diverges substantively from IFRS — Italy amortises goodwill rather than impairment-testing it, prohibits revaluation, and recognises only operating leases. EU-endorsed IFRS also *lags* actual IFRS by roughly six months because of the endorsement process.

The architecture is **an internal (IFRS-shaped) chart plus per-country statutory mappings**, with `ledger_id` distinguishing books:

```
account            (tenant_id, id, code, type, normal_balance, currency_policy, ...)
statutory_map      (tenant_id, country, account_id, statutory_code, effective_from, version)
ledger             (tenant_id, id, kind)   -- primary | tax | ifrs | local_gaap | consolidation
```

Retrofitting this is a rewrite. Build it in v1 even if you launch with one country.

### 5.3 E-invoicing — buy transmission, own the semantic model

The landscape as of August 2026, in the order it will hit you:

| Live now | Next 18 months |
|---|---|
| **Italy** SdI (all domestic, FatturaPA v1.9.1) | **France** 1 Sep 2026 — *all* businesses must **receive**; large/mid-size must issue |
| **Belgium** since 1 Jan 2026 (Peppol BIS 3.0 effectively mandatory) | **Germany** issuing >€800k turnover from 1 Jan 2027; all from 1 Jan 2028 |
| **Poland** KSeF >PLN 200m Feb 2026, all others Apr 2026, micro Jan 2027 (FA(3)) | **Spain** VERI\*FACTU 1 Jan 2027 (corporates) / 1 Jul 2027 (rest) |
| **Romania** e-Factura B2B+B2C (CIUS_RO) + SAF-T D406 monthly | **Saudi ZATCA** waves now down to SAR 187,500 — deadline 1 Feb 2027 |
| **Malaysia** MyInvois to RM1m (**Phase 5 cancelled**; below RM1m voluntary) | **UAE** PINT-AE pilot Jul 2026, mandatory >AED 50m Jan 2027 |
| **Germany** receiving obligation since 1 Jan 2025 | **Singapore** GST InvoiceNow phasing to Apr 2031 |
| **India** IRN >₹5 crore; **Mexico** CFDI 4.0; **Brazil** NF-e | **EU ViDA DRR 1 Jul 2030**; **UK** 2029 (design undefined) |

Design consequences:

1. **Model the semantic invoice, bind to syntax at the edge.** EN 16931-1 was formally updated in February 2026 to extend from B2G to B2B and ViDA, adding business terms for IBAN, early-payment discounts, late-payment penalties, corrective-invoice sequential numbering, FX provisions and national/margin VAT schemes. OpenPeppol's planned **BIS 4.0** merges BIS 3.0 and PINT on top of it. **Do not hardcode to BIS 3.0** — carry the new business terms in your model now and treat syntax as a mapping layer.
2. **Buy transmission.** OpenPeppol's own fees are trivial (~€1,050 sign-up + €1,850/yr + €1,500 certification for AP-only at 1–50 employees). The real cost is AS4/SMP engineering, 24/7 uptime obligations, per-country Peppol Authority onboarding (New Zealand requires criminal-record checks on directors and proof of indemnity insurance) and perpetual spec migration. Integrate an API-first aggregator — Storecove and Fonoa are the two that are genuinely developer-first; Avalara, Sovos, Vertex/ecosio, Pagero (now Thomson Reuters) and Comarch are enterprise engagements with 3+ month implementations. **Negotiate an exit clause: raw structured document export and mandate-neutral data**, so re-platforming is possible.
3. **Nobody publishes per-document pricing.** Budget for an RFP with a concrete volume profile by country, not a price list.
4. **Submission is a durable workflow, not a request.** It must retry for days against slow, flaky, legally-consequential government APIs; handle asynchronous clearance callbacks; and **never double-submit a legally-numbered invoice**. This is the single strongest case for Temporal in the whole system (§6.3).
5. **Execution risk is real.** As of July 2026, France had 158 accredited PDPs but only ~40 that could actually send and receive against the directory, and only ~5 emitting e-reporting flows; 1.9 million of 6+ million businesses were registered. The law permits slipping to 1 December 2026 and authorities have confirmed a soft landing through at least January 2027. Build for partial market readiness.

### 5.4 Tax determination

Split the problem in two, and buy the first half:

- **Rate and taxability determination** — ~13,000 US jurisdictions, SaaS taxable in roughly two dozen states (the exact list moves and is worth re-verifying with counsel; California in particular does *not* currently tax SaaS, and claims of a January 2027 change circulate without an enacted statute behind them), plus B2B/B2C differences (Iowa, Maryland, Ohio), home-rule jurisdictions (Colorado, Alabama, Louisiana) and one-offs like Texas's 80/20 rule and Chicago's lease transaction tax. **Buy this.** Options and published pricing: Stripe Tax (0.5%/transaction, no filing), TaxJar ($39–99/mo + ~$50/AutoFile credit), Anrok ($400–1,000/mo, SaaS-specific and best at SaaS taxability), Avalara/Vertex (quote-only, worth it only if you need US sales tax *and* EU VAT *and* e-invoicing from one vendor).
- **Nexus monitoring** — rolling thresholds per state, mostly $100k/200 transactions but $500k in CA/TX/NY (NY also requires 100 transactions, conjunctively), $250k in AL/MS, with **transaction-count thresholds being deleted** (Utah July 2025, Illinois January 2026). Measurement periods differ, and states disagree on whether exempt and marketplace sales count. **This, not rate lookup, is where product bugs create customer liability.**

Wrap whichever vendor you pick behind your own `TaxDetermination` port so the vendor is swappable and so your *own* rounding-level policy (a legal question per jurisdiction) is applied on your side of the boundary.

### 5.5 Statutory exports and audit files

SAF-T is a **general-ledger export, not a VAT export**: it demands that master data (customers, suppliers, products, tax codes, payment methods) and every journal line be retrievable in a normalised structure with stable IDs. If your ledger does not retain source-document linkage and immutable journal IDs, SAF-T generation is impossible after the fact.

| Regime | Cadence |
|---|---|
| Portugal | Monthly, residents and non-residents |
| Poland JPK_V7M | Monthly — **replaced the VAT return** |
| Norway | **Replaced the VAT return** in 2022 |
| Romania D406 | Monthly |
| Denmark | Phased from Jan 2024; Bulgaria phasing over 2026–27 |
| France FEC, Luxembourg FAIA, Austria, Lithuania | On demand at audit |

France's FEC must be in EUR, in French, with a `JournalCode` per voucher series. NF203 additionally defines audit event codes your system must satisfy: sequence changes (10/15), fiscal-year archiving (30), period close (50), year-end close (60), integrity-flaw detection (90), export of accounting entries (180). Build an **audit event taxonomy that covers these codes from the start** — it is a small amount of work in v1 and a certification blocker later.

### 5.6 Retention, archive and residency

| Country | Retention |
|---|---|
| Germany | 8 yrs (invoices, §14b UStG, reduced 2024) / **10 yrs (books, §147 AO)** — sources conflict; **default to 10** |
| France | 10 yrs accounting / 6 yrs tax |
| Italy, Belgium, Poland | 10 yrs |
| Netherlands | 7 yrs (10 for real estate) |
| Spain | 4 yrs tax / 6 yrs accounting |
| Saudi Arabia, Mexico | 5 yrs |

Three hard technical rules: **retain the original structured XML in its original form** (a PDF rendering is non-compliant; for ZUGFeRD/Factur-X the embedded XML counts only if unmodified); **archive the schema files and code lists alongside the XML**, or the document is unparsable in year nine; and **retention clocks generally start at the end of the fiscal year**, not the invoice date.

**Model retention against the party, not the document.** In a cross-border B2B transaction, the seller's obligation follows the seller's Member State and the buyer's follows the buyer's — the same invoice carries two different retention periods.

Residency: **Saudi Arabia is hard localisation** (in-Kingdom storage, NCA cybersecurity compliance). **Germany permits storage abroad but requires notification** of the location and any service provider, full authority access, and GoBD compliance by that provider — with penalties of €2,500–€250,000 plus estimated assessments; paper documents must stay in Germany. The EU generally permits storage in another Member State with online access; storage outside the EU typically requires guaranteed online access, download and use, with several Member States requiring prior notification. Plan for at minimum an EU region and, if you enter KSA, a Saudi region — plus a documented processing-location register you can hand to a German tax office.

---

## 6. ADR-005 — Stack and service architecture

**Decision:** Django 6.1 (moving to 6.2 LTS in April 2027) as a modular monolith, PostgreSQL 18, one FastAPI gateway service, Celery-or-Dramatiq behind `django.tasks` **with a transactional outbox**, Temporal reserved for period close and e-invoicing.

### 6.1 Why Django here specifically

This is not the usual Django-vs-FastAPI debate; three factors decide it for an accounting product:

- **Migrations at scale.** You will accumulate hundreds of migrations across dozens of models with heavy FK graphs over years. Django's dependency graph, squashing, `RunPython(atomic=False)`, `makemigrations --check` in CI and `sqlmigrate` for DBA review are markedly more operationally mature than Alembic's best-effort autogenerate.
- **Constraints as first-class model objects.** `CheckConstraint`, `UniqueConstraint` with `condition`/`nulls_distinct`, and `ExclusionConstraint` map directly onto the DB-enforced accounting invariants in §3.3, and Django 6.0 made constraints participate in the system-check framework.
- **The admin is a real business asset**, not a toy. Support staff need to inspect journals, view audit trails and re-run postings; building that UI from scratch is months.

**The honest cost of this choice — state it before committing.** §3.2 puts a composite primary key on every ledger table and §2.4 mandates composite foreign keys as a leak-vector mitigation. Django's composite-primary-key support does not yet cover the things this design depends on: `ForeignKey` cannot reference a model with a composite primary key (the `ForeignObject` workaround emits no database-level FK), models with composite primary keys cannot be registered in the admin, and Django cannot migrate to or from a composite primary key after table creation. In practice that means:

- Every composite FK in §2.4 and all partitioning DDL in §2.7 is hand-written `RunSQL`, outside the autodetector.
- The admin — the stated business asset — is **unavailable for `journal`, `journal_line` and `period_balance`**, the three tables support most wants to inspect. Budget a purpose-built internal inspection UI, or keep those tables outside the ORM entirely and reach them through the SQL layer described below.

The decision still holds — migrations, constraints and the surrounding ecosystem outweigh it — but it is a real cost, not a footnote, and it partly undercuts reason two above.

Django 6.1 additions that matter here: `FETCH_PEERS` (kills N+1 without manual `prefetch_related`), **`FETCH_RAISE`** (fail loudly on accidental queries — excellent for a posting engine), DB-level `ON DELETE`, `UUID7()` as a database function, and generated-column support on PG18.

**Honest note on async:** Django's ORM is not natively async underneath, and `atomic()` is not async-native. This barely matters — your posting path is DB-and-CPU-bound and transactional, not concurrency-bound. Run it and stop worrying.

**Version plan:** start on **6.1 now**, sit on **6.2 LTS from April 2027** (supported to April 2030). Note Django announced DEP 20 in August 2026: from January 2028 it moves to an annual release cycle, the "LTS" label disappears, and every release gets three years of support. Plan upgrade cadence around that now.

**Django has no built-in RLS support.** Budget ~100 lines of middleware plus a repository wrapper (§2.5), or evaluate the emerging `django-rls-tenants` package. Do **not** use `django-tenants` — it is well maintained but solves schema-per-tenant, which you have explicitly rejected.

### 6.2 Where FastAPI belongs

One separate service, its own repo and deployment: the **e-invoicing / integrations gateway**. It is I/O-bound and fan-out heavy — dozens of country APIs, high concurrency, long-tail latency, webhook ingestion, bank-feed polling. It talks to the ledger over an internal API and never writes journals directly. Pin FastAPI exactly; it is still 0.x.

A defensible refinement inside the monolith: use Django for models, migrations, admin and auth, but **drop to SQLAlchemy Core or raw SQL for the posting engine and reporting queries**, where you need precise control over locking, CTEs and `INSERT ... ON CONFLICT`. Same connection, same transaction. Do not run two ORMs with two migration tools over the same tables. (SQLAlchemy 2.1 is still in beta — 2.0.x is the stable line.)

### 6.3 Background work — the outbox is the important part

**Every side effect of a posting must be enqueued in the same transaction as the posting.** "The journal committed but the task was lost", or "the task ran before the commit was visible", is an unacceptable failure mode in a ledger.

Two ways to get this:

- **Procrastinate** stores the queue in Postgres, so `enqueue()` participates in your posting transaction — transactional-outbox semantics for free. Underrated for exactly this use case; the cost is coupling queue throughput to the primary database.
- **Celery or Dramatiq plus an explicit outbox table** — insert a row in the posting transaction, with a relay process publishing to the broker.

Either is fine. Choosing neither is not. Write against Django 6's `django.tasks` interface so the backend stays swappable.

**Idempotency in workers is not optional.** At-least-once delivery is what all of these give you. Derive a deterministic key from `(tenant, document, operation, period)` and let a unique constraint reject the duplicate.

**Temporal** earns its operational weight in exactly two places, and you should not adopt it before then:

1. **E-invoice submission** — multi-day retries, asynchronous clearance callbacks, exactly-once effect against a legally-numbered document. This is Temporal's ideal shape.
2. **Period close and year-end close** — 14-step processes with human-in-the-loop approvals, durable timers and signals replacing a pile of `status` columns and fix-up cron jobs.

Rule of thumb: *if a process has durable state living in `status` columns plus a cron job that "fixes things up", it wants a workflow engine.* Everything else wants a task queue.

### 6.4 Reporting and analytics — staged

| Stage | When | What |
|---|---|---|
| **0** | 0–50 tenants | Report straight off primary Postgres: `period_balance` + covering indexes + `SERIALIZABLE READ ONLY DEFERRABLE` for long reports. You get much further than expected |
| **1** | First real pain | Physical **read replica**, reporting and exports routed via a DB router. Watch replication lag — never serve "post then immediately show trial balance" from the replica |
| **2** | Heavy per-tenant analytics, big exports | **DuckDB** over per-tenant Parquet extracts of `journal_line` on object storage, in-process in a worker. Superb at "scan one tenant's 50M lines and pivot", and excellent for the XLSX/CSV exports accountants actually want. **This is where a seed-stage accounting SaaS should stop** |
| **3** | Only if you become a data product | ClickHouse. Not warranted for a ledger at seed stage |

**Hard rule: statutory reports — trial balance, statutory P&L, VAT return — are served from the transactional store, never from an eventually-consistent copy.** Analytics layers are for management reporting, drilldowns and exports. Any number an auditor or regulator sees stays on the ACID path.

Report computation: **trial balance** = one indexed scan of `period_balance`. **P&L** = period movement on income/expense accounts. **Balance sheet** = cumulative-to-date plus computed current-year earnings. **Cash flow** = indirect method by default (derivable from `period_balance` plus account tagging); direct method only if you commit to the `cashflow_category` tagging discipline at posting time.

**Dimension hierarchies must be date-effective and versioned.** Reorganisations happen, and last year's report must still roll up the way it did last year. Store a `hierarchy_version_id` and let the report choose — this is Oracle's "tree versions" pattern and it is genuinely necessary.

### 6.5 Consolidation

Model the legal entity as a first-class ledger dimension and give every intercompany line a `partner_entity_id`; without it, elimination is guesswork. The pipeline is: per-entity trial balance in functional currency → translate to group presentation currency (assets/liabilities at closing rate, P&L at average, differences to CTA in OCI) → aggregate → eliminate → minority interest → group statements.

**Eliminations are journals in a separate consolidation ledger, not deletions** — reproducible, auditable, reversible, with their own journal types (`ELIM`, `TRANS`, `CTA`). Build the **intercompany matching report** (entity A's payable to B vs B's receivable from A, by partner and currency) before building the elimination engine; IC mismatches are a reconciliation problem, not an accounting one.

---

## 7. Security, identity and audit

### 7.1 Identity model

```
User ──< Membership >── Tenant ──< Entity (legal entity) 
                 │
                 └── Role ──< Permission
```

- **Tenant id is derived only from verified token claims.** If a `tenant_id` ever arrives in a request body or query string and is used for scoping, that is a finding, not a design choice.
- Roles need to be **entity-scoped**, not just tenant-scoped: a group accountant sees all entities; a subsidiary bookkeeper sees one.
- **Segregation of duties is a product feature here**, not just an internal control: the person who creates a payment must not be the person who approves it, and auditors will test this. Model approval as a first-class workflow with its own audit trail.
- **Accountant/advisor access** — one user, many client tenants — is a first-class use case in this market. Design the membership model for it now; bolting it on means reworking every authorisation check.
- SSO/SAML/SCIM is table stakes for anything above SMB; plan it for the first enterprise deal, not before.

### 7.2 Audit

Two separate things, both required:

- **Ledger immutability** (§3.3) — the hash-chained, append-only journal.
- **Application audit log** — actor, timestamp, action, before/after, request id, on every state change including reads of sensitive data. GoBD requires traceability of every entry; NF203 requires database logging capturing user, timestamp and action; France's audit event codes (§5.5) are a taxonomy you should adopt directly.

Store audit records in a partitioned, append-only table with its own RLS policy and a retention aligned to the longest statutory period (10 years), not to your log retention default.

### 7.3 Compliance posture

- **SOC 2 Type II** is the practical entry ticket for selling to anyone with a security review. Start collecting evidence from month one; retrofitting a year of evidence is impossible.
- **ISO 27001** matters if you ever want to be a Peppol service provider or sell in Europe at enterprise scale.
- **GDPR**: you are a processor for tenant data and a controller for your own users. You need a DPA, a sub-processor register, a documented processing-location register (which Germany may ask for directly), and the crypto-shredding design from §2.8.
- **PII separation** (§2.8) is both a GDPR and an architecture requirement. Decide it now.

---

## 8. Non-functional requirements

| Dimension | Target | Notes |
|---|---|---|
| Posting latency | p95 < 300 ms for a ≤20-line journal | Dominated by counter-lock hold time; keep external calls out |
| Trial balance | p95 < 2 s for 10⁷ lines | Served from `period_balance`, one indexed scan |
| Availability | 99.9% application, 99.95% posting path | Posting must degrade last |
| Durability | RPO ≤ 5 min, RTO ≤ 1 h (cluster), ≤ 8 h (single tenant) | Per-tenant restore is restore-then-extract (§2.8) |
| Correctness | Zero unbalanced journals, zero silent balance drift | Deferred constraint trigger + nightly drift job |
| Isolation | Zero cross-tenant reads | Enforced at four layers; CI-gated |
| E-invoice delivery | 99.9% eventual delivery within the statutory window | France: 10 days from chargeable event; Poland: next business day for offline24 |
| Retention | 10 years default, per-country override | Original XML, schemas and code lists |

**Explicitly out of scope for v1:** real-time cross-tenant analytics, sub-second dashboards, high-frequency payment processing, per-second interest accrual.

---

## 9. Delivery roadmap

Phasing that respects the dependency structure — each phase produces something sellable.

### Phase 0 — Foundations (weeks 1–8)

The things that cannot be added later.

- Control plane: tenants, `tenant_routing`, identity, memberships, entity-scoped roles.
- RLS baseline: three-role separation, RESTRICTIVE policies, `NULLIF` guard, the session wrapper, PgBouncer config.
- CI gates: schema gate, policy-diff gate, the four per-table isolation tests, cross-tenant fuzzer skeleton.
- Ledger core: `journal`, `journal_line`, `fiscal_period`, `period_balance`, deferred balance trigger, hash chain, `doc_counter`, period lock tiers.
- Money value object, ISO 4217 currency table with minor units, FX rate store with explicit direction.
- PII/ledger-fact separation and per-tenant data keys.
- Audit log with the NF203-shaped event taxonomy.
- Outbox (or Procrastinate) wired into the posting transaction.

**Exit criterion:** you can post, reverse, close a period, produce a trial balance, and prove isolation in CI. No UI required.

### Phase 1 — Core accounting (weeks 9–20)

- Chart of accounts + statutory mapping + `ledger_id` books.
- SLA rule engine with dry-run and versioning; seeded default rule sets.
- AR: invoices, credit notes, open items, applications, aging, realised FX.
- AP: bills, payments, approval workflow with segregation of duties.
- Banking: statement import (CAMT.053, OFX, CSV), match-group model, deterministic + scored matching, human queue.
- Reporting v1: trial balance, P&L, balance sheet, GL detail, aged AR/AP, drilldown.
- One localisation pack end to end.

**Exit criterion:** a real business could keep its books on it for one country.

### Phase 2 — Compliance surface (weeks 21–36)

- Localisation pack framework hardened; second and third countries added by configuration to prove the abstraction.
- E-invoicing gateway (FastAPI) + aggregator integration + Temporal submission workflow.
- Archive service: original XML, schemas, code lists, per-party retention policy, residency routing.
- Statutory exports: FEC and one SAF-T variant.
- Tax determination port + first vendor; nexus monitoring if selling into the US.
- VAT/GST return preparation.

**Exit criterion:** you can sell into France, Belgium and Germany without manual workarounds.

### Phase 3 — Depth and scale (weeks 37+)

- Fixed assets with multi-book, revenue recognition subledger, inventory costing.
- Consolidation: translation, IC matching, elimination ledger.
- Multi-entity, multi-currency group reporting; dimension hierarchies with versions.
- Read replica → DuckDB analytics; large exports.
- Tenant promotion tooling (logical replication runbook, automated).
- SOC 2 Type II audit window.

### Team shape

| Role | Count | Focus |
|---|---|---|
| Backend / ledger | 2 | Ledger core, SLA engine, posting correctness |
| Backend / product | 1–2 | AR, AP, banking, workflows |
| Backend / integrations | 1 | E-invoicing gateway, bank feeds, tax vendor |
| Frontend | 1–2 | Accounting UX is unusually demanding — grids, drilldowns, keyboard-first entry |
| Platform / SRE | 0.5–1 | Postgres, pooling, observability, DR rehearsals |
| **Domain expert (qualified accountant)** | 1, from day one | Not optional. Every wrong assumption here is a rewrite |

The last row is the one most teams skip and most regret.

---

## 10. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Cross-tenant data leak | Low | **Existential** | Four defence layers (§2), CI gates, fuzzer, runtime divergence alerting |
| R2 | Silent balance drift between lines and `period_balance` | Medium | High | Nightly drift job that auto-disables cache reads for divergent accounts |
| R3 | Cached-plan tenant skew causing nondeterministic latency | **High** | Medium | `force_custom_plan` on the runtime role; disable client statement caching (§2.6) |
| R4 | Compliance scope creep — each new country costs a quarter | **High** | High | Localisation Pack abstraction proven across three countries in Phase 2 before selling more |
| R5 | E-invoicing vendor lock-in or failure | Medium | High | Own the semantic model; contractual raw-document export; abstraction port |
| R6 | France Sep 2026 market unreadiness (~40 of 158 PDPs operational) | **High** | Medium | Assume partial readiness; build fallback paths; the law permits slipping to 1 Dec 2026 |
| R7 | Gapless numbering contention under load | Low | Medium | Number last, number at post, multiple series; per-(tenant,series,year) sharding is natural |
| R8 | GDPR erasure vs statutory retention conflict | Medium | High | PII/ledger-fact separation + crypto-shredding, designed in Phase 0 |
| R9 | Retrofitting multi-book fixed assets or dual-COA | Medium | **Very high** | `book_id` and `ledger_id` in the model from day one |
| R10 | Building without an accountant | Medium | High | Hire one before Phase 1 |
| R11 | Per-tenant restore RTO unacceptable to an enterprise customer | Medium | Medium | Dedicated tier + rehearsed runbook; price it |
| R12 | Postgres write throughput ceiling | Low | Medium | Partitioning → read replica → Citus or tenant promotion. Do not pre-optimise |

---

## 11. ADR index

| ADR | Decision | Status | Section |
|---|---|---|---|
| 001 | Shared DB + RLS, promotable via routing table | Accepted | §2 |
| 002 | Postgres ledger core; no TigerBeetle, no event bus | Accepted | §3 |
| 003 | SLA rule engine — posting rules as data | Accepted | §4 |
| 004 | Localisation Packs — country behaviour as versioned plugins | Accepted | §5 |
| 005 | Django modular monolith + FastAPI gateway | Accepted | §6 |
| 006 | Transactional outbox for all posting side effects | Accepted | §6.3 |
| 007 | Temporal for e-invoicing and period close only | Accepted | §6.3 |
| 008 | Statutory reports from Postgres; analytics from replica/DuckDB | Accepted | §6.4 |
| 009 | Integer minor units + explicit currency; no floats, no `money` | Accepted | §3.8 |
| 010 | PII separated from ledger facts, per-tenant data keys | Accepted | §2.8 |

---

## 12. Open questions for you

These change the design materially and I could not decide them from the brief:

1. **Which three countries first?** "Global" is a target, not a v1. The Localisation Pack abstraction needs three real, *different* regimes to be proven — my suggestion is France (PDP + FEC + PCG), Germany (decentralised, no central platform, SKR) and Malaysia or Singapore (Peppol 5-corner). Picking Italy and Romania instead changes Phase 2 substantially.
2. **Who is the buyer?** SMB self-serve, mid-market with an accountant, or accounting practices managing many client books? Practice-management changes the identity model (§7.1) and the entire UX.
3. **Does v1 include inventory?** Inventory costing is roughly a quarter of engineering on its own and pulls in a whole product surface. Excluding it halves Phase 3.
4. **Is payments/money movement in scope**, or do you integrate and reconcile only? This is the TigerBeetle decision (§3.1) and the licensing/regulatory question behind it.
5. **What is the migration story?** Importing from Xero/QuickBooks/Sage/Tally is often the actual sales blocker. It also constrains the COA model, because you must be able to represent whatever they are leaving.
6. **Target scale in 24 months** — 500 tenants or 50,000? Below ~2,000 the shared-RLS design is uncontroversial; above that, partitioning and promotion tooling move from Phase 3 into Phase 1.

---

*Prepared 17 August 2026. Regulatory positions reflect sources current at that date; e-invoicing mandates move, and several dates in §5.3 have live execution risk. Verify against primary sources before making commercial commitments.*

