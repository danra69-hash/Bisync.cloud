# Bisync Accounting Architecture

**Status:** Binding for the Accounting module · **Date:** 17 August 2026  
**Source:** Multi-tenant SaaS accounting blueprint (adapted to Bisync.cloud’s current build)  
**Related:** [`SAAS_DB_TENANCY.md`](./SAAS_DB_TENANCY.md), [`PRODUCT_TARGET_ARCHITECTURE.md`](./PRODUCT_TARGET_ARCHITECTURE.md)

This document defines how statutory accounting lands **inside Bisync.cloud**. It is not a greenfield Django rewrite. Stack, tenancy, and ops bridges already in production stay authoritative; ledger design follows the blueprint’s invariants where they matter.

---

## 0. Current build (source of truth)

| Surface | Status today |
|---|---|
| **Accounting module** | Company-scoped only (`CompanyModuleRules`). Route `/accounting` hosts **Payroll**, **Ops→Finance**, and **Books** (Phase 0). |
| **Payroll** | Live. Process posts a sealed PAYROLL journal + `hrm.payroll_posted` outbox (best-effort). |
| **Ops cost truth** | Purchase receive → consolidate, stock-card / FIFO, COGS audit, credit notes. Consolidate posts Inventory/AP journal + `ops.purchase_affirmed`. |
| **Chart of accounts / journals / trial balance** | **Phase 0 live** via `/api/accounting/*` (seed COA, sealed journals, TB). Full AP/AR / bank rec still roadmap. |
| **API stack** | ASP.NET Core + EF Core + PostgreSQL. Identity and tenant routing use the shared control plane (`TenantConnections`). |
| **Isolation** | App-layer `companyId` scoping + optional dedicated company DB. **Postgres RLS is not used** on operational tables today. |

**Hard rule:** do not claim a statutory book of record until Phase 0 exit criteria below are met.

---

## 1. What we keep from the blueprint

These properties are expensive or impossible to retrofit. They apply when ledger work starts:

1. **Immutability** — once posted, a journal is sealed; corrections are reversals (storno), never in-place edits.
2. **Multi-book / multi-COA** — `ledger_id` (primary | tax | ifrs | local_gaap | consolidation) and statutory mapping from day one of the ledger, even if v1 ships one country.
3. **Tenant isolation that fails closed** — company context required on every financial query; dedicated-DB promotion already exists via `TenantConnections` (blueprint’s “promotable tenancy”).
4. **Subledger → GL via rules, not hard-coded account strings** — SLA-style posting rules as versioned data (Bisync events: receive consolidated, sale/FIFO issue, payroll processed, CN confirmed).
5. **Localisation as packs** — country behaviour is versioned configuration, not `if (country == "MY")` in the posting engine.
6. **Statutory numbers from the transactional store** — never from analytics replicas / exports as the auditor-facing source.
7. **Integer minor units + explicit currency** — no floats, no Postgres `money`.
8. **Transactional outbox** for every side effect of a posting (e-invoice, archive, notifications).

### What we deliberately change vs the upstream blueprint

| Blueprint | Bisync decision |
|---|---|
| Django modular monolith + FastAPI gateway | **Stay on ASP.NET Core** modular monolith; optional future integrations service only when e-invoicing / bank feeds need it |
| Shared DB + **RESTRICTIVE RLS** as the hard floor | Keep **app scoping + optional dedicated DB** as the floor for v1 ledger; evaluate RLS as a *second* floor later without changing application connection patterns |
| `tenant_routing` table | Already covered by **`TenantConnections`** (`cluster`/DSN, dedicated vs shared). Extend; do not invent a parallel router |
| TigerBeetle / Kafka between journal and balances | **Rejected** for the same reasons as the blueprint — Postgres ACID ledger |
| Partition by `tenant_id` on journal tables | Prefer existing **company DB promotion** for whales; within a DB, partition only if volume demands it |
| Full PEPOL/PDP Year-1 surface | Hospitality-first: **ops bridges + payroll + one localisation pack** before multi-regime e-invoicing |

---

## 2. Module map (Bisync-shaped)

```
 CONTROL PLANE (shared)          APPLICATION PLANE (shared or bisync_c_{id})
 tenants · TenantConnections ·   ┌─────────────────────────────────────────┐
 identity · modules · billing    │  Accounting module (company-only)       │
                                 │   · Payroll (live)                      │
                                 │   · Ops→Finance bridges (live)          │
                                 │   · Books / GL / AP / AR (roadmap)      │
                                 └──────────────────┬──────────────────────┘
                                                    │
   RMS / POS / HRM subledgers ── events ──► SLA rules ──► Ledger core (future)
   receive·consolidate · FIFO  · payroll · CN · POS settle
```

**Boundary (unchanged from blueprint):** only the ledger core may seal journal lines. Payroll, RMS, and POS raise business events / drafts; they never insert sealed GL rows.

---

## 3. ADR index (Bisync)

| ADR | Decision | Status |
|---|---|---|
| B-001 | Company = tenant; `TenantConnections` for promotion; Accounting is company-scoped | **Accepted (live)** |
| B-002 | Ops stock/FIFO/COGS/CN remain source documents until SLA posts them | **Accepted (live)** |
| B-003 | Future GL is immutable `journal` + `journal_line` in PostgreSQL on the company operational DB | Accepted (design) |
| B-004 | Posting rules = versioned SLA data driven by Bisync events | Accepted (design) |
| B-005 | Localisation packs for tax/COA/numbering/export; first pack follows company country (MY-first likely) | Accepted (design) |
| B-006 | Stack remains ASP.NET Core + EF; ledger posting path may use raw SQL for locking/CTEs | Accepted |
| B-007 | Access-control GL/AP/AR rows are **reserved**; enforce only after API exists | Accepted |
| B-008 | Statutory reports from primary company DB; DuckDB/replica only for analytics | Accepted (design) |

---

## 4. Tenancy for accounting data

Follow [`SAAS_DB_TENANCY.md`](./SAAS_DB_TENANCY.md):

1. Resolve company from verified identity / `X-Bisync-Company-Id` — never trust a body `companyId` alone for scoping.
2. Open the operational connection through `ITenantConnectionResolver`.
3. Every ledger table carries `CompanyId` (Bisync’s `tenant_id`).
4. Unique constraints and FKs are company-scoped: `(CompanyId, …)`.
5. Background jobs (payroll post, drift detection, period close) must set tenant context through the same resolver wrapper — same leak class the blueprint warns about for workers.
6. **Loud app guard:** repositories raise if company context is missing; do not return empty lists that look like “no journals”.

RLS (blueprint §2) remains a **future hardening layer**, not a prerequisite for Phase 0. If adopted, use `set_config('app.company_id', …, true)` inside an explicit transaction and FORCE policies — do not copy tutorials that use plain `SET` under PgBouncer.

---

## 5. Ledger core (Phase 0+) — shape

When implemented, prefer the Universal Journal shape (adapted names to Bisync conventions):

- `GlJournal` — sealed document (`PostedAt` null = draft; non-null = immutable)
- `GlJournalLine` — direction `D`/`C`, dual amounts (txn + functional) in **minor units**, dimensions denormalised
- `FiscalPeriod` — entity-scoped; soft / tax / hard lock tiers
- `PeriodBalance` — trial-balance cube updated in the posting transaction; rebuildable; drift job mandatory
- `DocCounter` — gapless series locked in-transaction; number at **post**, not draft
- Hash chain optional in Phase 0, required before any inalterability certification

**Invariants in the database:** deferred balanced-journal trigger (per txn currency and functional currency); reject mutate/delete of lines on posted journals.

**Money:** value object `(minor_units, currency)`; FX rate store with explicit direction; round half-up for commercial amounts unless a localisation pack says otherwise.

---

## 6. Subledger bridges (live → future SLA)

| Bisync event (today) | Future SLA event | Notes |
|---|---|---|
| PO receive + consolidate | `ops.purchase_affirmed` | **Wired:** consolidate posts Inventory/AP journal + outbox |
| FIFO issue / sale depletion | `ops.inventory_issued` | Stock-card / `transaction_lines` are cost layers (not auto-posted yet) |
| Credit note confirmed | `ops.vendor_credit` | Stock outbound; not AP until mapped |
| Payroll run processed | `hrm.payroll_posted` | **Wired:** process posts PAYROLL journal + outbox |
| POS payment / closed check | `pos.settlement` | Tender only until AR/cash posting rules exist |
| B2B `InvoiceIssued` flag | `b2b.invoice_issued` | Flag only today — no AR invoice entity |

Accounting → Books shows trial balance, journals, and outbox for the selected company. Ops detail remains on stock card / COGS / payroll screens.

---

## 7. Phased delivery (aligned to current product)

### Phase A — Honesty & hub ✅

- Accounting page = Payroll + Ops→Finance bridges + Books.
- Copy and glossary match live capability.
- Architecture doc binding; AC GL/AP/AR rows reserved until richer APIs exist.

### Phase B — Ledger foundations ✅ (initial)

- `GlJournal` / lines / periods / balances / counters / outbox on company operational DB.
- Post, reverse, soft-close period, trial balance API (`/api/accounting/*`).
- Bridges: payroll process + PO reconcile → sealed journals (best-effort; never fails ops).

### Phase C — Core books

- COA + statutory map + `ledger_id`.
- SLA engine (dry-run + versioned rules) seeded for hospitality events above.
- AR/AP open items only if product scope includes them; otherwise export bridges remain.

### Phase D — Compliance surface

- First localisation pack (likely Malaysia / Singapore Peppol path for hospitality).
- E-invoicing via aggregator behind an internal port; Temporal-like workflow only when submission durability demands it.
- Statutory export as required by pack.

---

## 8. Non-goals for the current build

- Rewriting Bisync to Django / FastAPI.
- Requiring Postgres RLS before first journal table.
- Treating stock-card “ledger”, prepaid ledger, or deposit ledger as statutory GL.
- Serving auditor-facing trial balances from CSV exports or BI replicas.
- Enabling Access Control GL/AP/AR permissions against missing APIs.

---

## 9. Open product choices (still required before Phase C sell)

1. First three countries for packs (hospitality-weighted).
2. Buyer: operator self-serve vs accountant/practice multi-client.
3. Inventory costing already lives in RMS — GL posts **summaries**, does not reimplement FIFO.
4. Payments: reconcile only vs money-movement (keeps TigerBeetle out).
5. Migration story from Xero/QBO for takeovers.

---

*Regulatory and e-invoicing dates in the upstream blueprint move frequently; verify before commercial commitments. This file owns Bisync-specific decisions.*
