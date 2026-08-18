# 09 — Phase 3: Depth and Scale

**Status** Ready to develop · **Depends on** Phases 1–2 ·
**Exit criterion** Multi-entity groups consolidate; SOC 2 Type II window open.

Phase 3 is where the product stops being a bookkeeping tool and becomes
something a mid-market group can run on. Each module below is independently
shippable — sequence them by which customers you have actually signed, not by
this document's order.

---

## 1. Fixed assets

**The one thing that must be right on day one: `book_id`.**

Multiple books per asset — IFRS book, local GAAP book, tax book — with
independent methods and lives is a hard requirement in Malaysia (capital
allowances differ from accounting depreciation), Indonesia, Thailand and
Australia. Retrofitting it is a rewrite.

```
asset                 (tenant, id, entity_id, class, acquired_on, cost, ...)
asset_book            (tenant, asset_id, book_id, method, life, salvage,
                       start_date, status)
depreciation_schedule (tenant, asset_id, book_id, period_id, amount,
                       remaining_nbv, schedule_version)
```

**Store the schedule, not just the balance.** Regenerate it on any change —
revaluation, impairment, useful-life change, partial disposal — as a new
`schedule_version`. Changes in useful life are **prospective** under IAS 8:
regenerate the remaining schedule from current NBV, never restate the past.

Monthly run posts `Dr Depreciation expense / Cr Accumulated depreciation`, per
asset or summarised by asset class and cost centre. Offer both — detail volume
matters at scale.

**Market-specific:** Malaysia's capital allowances (initial and annual) are a tax
book concept with their own rates by asset class; Australia has instant asset
write-off thresholds that change with the budget cycle. Both are pack data
driving the tax book, not core logic.

| # | Criterion |
|---|---|
| FA-1 | Multiple books per asset with independent method and life |
| FA-2 | Schedule versioned; regeneration on change is prospective |
| FA-3 | Disposal computes gain/loss per book and posts correctly |
| FA-4 | Depreciation run is idempotent per (asset, book, period) |

---

## 2. Revenue recognition

Model **three distinct balance-sheet artefacts separately** — engineers
habitually collapse them and it is expensive to unpick:

| Artefact | Meaning |
|---|---|
| **Contract asset** | Revenue recognised; right to consideration conditional on more than the passage of time |
| **Receivable** | Unconditional right to consideration |
| **Contract liability** | Consideration received or due ahead of performance (deferred revenue) |

```
Bill in advance:        Dr AR                  Cr Contract liability
Recognise:              Dr Contract liability  Cr Revenue
Recognise ahead of bill:Dr Contract asset      Cr Revenue
Then bill:              Dr AR                  Cr Contract asset
Costs to obtain:        Dr Capitalised commission  Cr Cash/Payable
Amortise:               Dr Commission expense      Cr Capitalised commission
```

Implement as a subledger: performance obligations, allocated transaction price
(using the platform's single documented allocation algorithm — see doc 01), and
a **versioned recognition schedule**.

**Contract modifications have three treatments** under ASC 606-10-25-12/13 —
separate contract, prospective termination-and-replacement with re-allocation of
the remaining transaction price, and cumulative catch-up. The product must
express all three, which is precisely why the schedule is versioned rather than
mutated.

| # | Criterion |
|---|---|
| RR-1 | Contract asset, receivable and contract liability are distinct accounts and distinct states |
| RR-2 | All three modification treatments supported |
| RR-3 | Schedule versioned; historical recognition reproducible |
| RR-4 | Deferred revenue roll-forward report ties to the ledger |

---

## 3. Inventory

Roughly a quarter of engineering on its own, and it pulls in a whole product
surface (items, warehouses, movements, purchase receipts). **Decide explicitly
whether v1 includes it** — see the open question in doc 10.

- **Perpetual with cost layers.** FIFO consumes a
  `receipt_layer(qty_remaining, unit_cost, received_at)` in order; weighted
  average keeps a running `(total_qty, total_value)` per item-location.
- **Concurrency hazard:** weighted-average cost is a read-modify-write on a hot
  row per SKU. Lock the item-location cost row `FOR UPDATE` or serialise costing
  per SKU. This is a classic silent-corruption site.
- **Backdated receipts and negative inventory force cost adjustments.** A later-
  arriving cost must retro-adjust already-posted COGS. Design for it: a
  `cost_adjustment` document posting a delta journal in the **current** period,
  referencing the original. Never rewrite history.
- GL interaction: receipt `Dr Inventory / Cr GR-IR`; issue `Dr COGS / Cr
  Inventory` at the computed cost; variances (PPV, revaluation, NRV write-down)
  each get their own account.

**Market note:** Malaysia's sales tax is levied at manufacture or import by HS
code, so the item master needs the HS code field anyway (doc 03 §2.1) — inventory
and the MY pack share that dependency.

| # | Criterion |
|---|---|
| INV-1 | FIFO and weighted average both correct under concurrent movements |
| INV-2 | Cost adjustment posts a delta in the current period, never rewriting history |
| INV-3 | Inventory subledger reconciles to the GL control account on a schedule |

---

## 4. Consolidation

Model the legal entity as a first-class ledger dimension, and give every
intercompany line a `partner_entity_id`. Without it, elimination is guesswork.

Pipeline:

```
per-entity TB in functional currency
  → translate to group presentation currency
      (assets/liabilities @ closing, P&L @ average, differences → CTA in OCI)
  → aggregate
  → eliminate (IC receivables/payables, IC revenue/COGS, investment/equity,
               unrealised profit in inventory)
  → minority interest
  → group statements
```

**Eliminations are journals in a separate consolidation ledger, not deletions** —
reproducible, auditable, reversible, with their own journal types (`ELIM`,
`TRANS`, `CTA`).

**Build the intercompany matching report before the elimination engine.** Entity
A's payable to B versus B's receivable from A, by partner and currency. IC
mismatches are a reconciliation problem, not an accounting one, and customers
will spend most of their time in that report.

**Regional relevance:** a Singapore holding company with Malaysian, Indonesian
and Thai operating subsidiaries is the *standard* structure in this region, not
an edge case. Consolidation is closer to table stakes in APAC than it is in the
US SMB market.

| # | Criterion |
|---|---|
| CON-1 | Translation follows IAS 21 with CTA in OCI, not recycled |
| CON-2 | Eliminations are reversible journals in a separate ledger |
| CON-3 | IC matching report by partner and currency |
| CON-4 | Group statements reconcile to the sum of entity statements plus eliminations |

---

## 5. Analytics and reporting at scale

The staged path from the blueprint, unchanged:

| Stage | When | What |
|---|---|---|
| 0 | 0–50 tenants | Primary Postgres, `period_balance` + covering indexes |
| 1 | First real pain | **Read replica**, reporting routed via a DB router |
| 2 | Heavy per-tenant analytics, big exports | **DuckDB** over per-tenant Parquet extracts of `journal_line` on object storage |
| 3 | Only if you become a data product | ClickHouse |

**Hard rule, restated because it is the one people break:** statutory reports —
trial balance, statutory P&L, VAT/GST/SST returns — are served from the
transactional store. Analytics layers are for management reporting, drilldowns
and exports.

**Dimensional cube maintenance** (`period_balance_dim`, `dimension_tuple`) lands
here. The schema exists from Phase 0; only the account-level cube is maintained
until now.

---

## 6. Scale and tenancy operations

| Item | Trigger | Work |
|---|---|---|
| **Whale partitions** | A tenant exceeds ~5% of `journal_line` | Named LIST partition, provisioned at signup for large accounts |
| **Tenant promotion** | Contractual isolation, restore RTO, or size | Automate the logical-replication runbook: publication with row filter → lag ≈ 0 → freeze via `tenant_routing.status` → verify counts → flip → soak → drop source. **Reset `doc_counter` on the target before cutover** |
| **Regional provisioning** | Malaysia s82(8); any Indonesian residency finding | Second region, `tenant_routing.region` already carries it |
| **Per-tenant restore** | Enterprise commitment | Rehearse quarterly; keep timing evidence for auditors |
| **Drift detection** | Always on | Nightly `detect_balance_drift` per tenant, alerting on any row |

---

## 7. SOC 2 Type II

Start evidence collection in **Phase 1**. Retrofitting a year of evidence is not
possible, and US buyers will ask before signing.

Controls that map directly to work already specified elsewhere:

| Control area | Where it already exists |
|---|---|
| Logical access | Entity-scoped roles, segregation of duties (doc 01 §6) |
| Change management | Migration gates, policy-diff gate, CI (Phase 0) |
| Data isolation | RLS four-layer defence + CI gates (Phase 0) |
| Availability | DR rehearsals, per-tenant restore runbook (§6) |
| Confidentiality | PII/ledger separation, per-tenant data keys (Phase 0) |
| Monitoring | Drift detection, tenant-context divergence alerting (Phase 0) |

The point of that table: Phase 0 was designed so that SOC 2 is mostly
*evidencing what already exists* rather than building new controls. Do not let
that advantage decay.

---

## 8. Phase 3 sequencing

There is no single right order — sequence by signed customers. A defensible
default:

| Order | Module | Rationale |
|---|---|---|
| 1 | Fixed assets | Every customer has assets; smallest module with the highest hit rate |
| 2 | Consolidation | Standard APAC group structure; differentiates against SMB incumbents |
| 3 | Revenue recognition | Needed the moment you sell to a software or services company |
| 4 | Analytics stage 1–2 | Triggered by report latency, not by plan |
| 5 | Inventory | Largest; only if you are selling to distribution or manufacturing |
| — | Scale operations | Continuous, triggered by metrics not calendar |
