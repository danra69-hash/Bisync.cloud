# 01 — Phase 1: Core Accounting

**Status** Ready to develop · **Depends on** Phase 0 skeleton (shipped) ·
**Exit criterion** A real business can keep its books on it, for one country.

Phase 0 proved the ledger. Phase 1 makes it usable: a rule engine so postings
stop being hand-built, the two subledgers that generate 90% of real journals,
bank reconciliation, and the reports an accountant actually opens.

---

## 1. Subledger Accounting (SLA) rule engine

**The decision: how a business event hits the general ledger is tenant-and-
country configuration data, not application code.** This is what Oracle Fusion
and SAP both do, and it is the only realistic way one codebase serves six
markets with per-tenant chart customisation.

### 1.1 Flow

```
business event  →  rule set (data, versioned)  →  balanced draft  →  ledger core
{ entity,           for each rule line:              journal +          validates
  counterparty,       condition                      lines             and seals
  lines[], tax[],     account selector
  currency, dims }    dimension map
                      direction, amount source
```

### 1.2 Schema

```sql
CREATE TABLE app.sla_rule_set (
  tenant_id      uuid NOT NULL,
  id             uuid NOT NULL DEFAULT app.uuid7(),
  event_type     text NOT NULL,          -- ar.invoice.posted, ap.bill.posted, ...
  entity_id      uuid,                   -- NULL = all entities
  pack_id        text,                   -- NULL = country-agnostic
  version        int  NOT NULL,
  effective_from date NOT NULL,
  status         text NOT NULL CHECK (status IN ('draft','active','superseded')),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, event_type, entity_id, pack_id, version)
);

CREATE TABLE app.sla_rule_line (
  tenant_id        uuid NOT NULL,
  rule_set_id      uuid NOT NULL,
  seq              smallint NOT NULL,
  condition        jsonb NOT NULL,   -- JSONLogic-style predicate over the event
  account_selector jsonb NOT NULL,   -- literal code | account_role | expression
  dimension_map    jsonb NOT NULL,
  direction        char(1) NOT NULL CHECK (direction IN ('D','C')),
  amount_source    text NOT NULL,    -- net | tax | gross | withholding | rounding
  PRIMARY KEY (tenant_id, rule_set_id, seq),
  FOREIGN KEY (tenant_id, rule_set_id) REFERENCES app.sla_rule_set (tenant_id, id)
);
```

Add `sla_rule_set_version_id` to `app.journal`. Every posted journal records the
rule set version that produced it.

### 1.3 Account roles — the indirection that makes packs portable

Rules never name account codes directly. They name **roles**, which the tenant
maps to their own chart. A pack seeds default role assignments.

```
ar_control · ap_control · revenue_default · cogs_default
tax_output_payable · tax_input_receivable · tax_control
withholding_receivable · withholding_payable
fx_realised · fx_unrealised · rounding_difference · suspense
bank_default · retained_earnings · undue_output_vat · undue_input_vat
```

`undue_output_vat` / `undue_input_vat` exist because of Thailand — its tax point
for services is receipt of payment, not invoice date. Without those accounts you
overstate the VAT liability every single month. Add them now; they cost nothing
in markets that don't use them.

### 1.4 Acceptance criteria

| # | Criterion |
|---|---|
| SLA-1 | A rule set produces a balanced draft for every seeded event type in every launch market |
| SLA-2 | `dry_run()` returns the draft without posting; the "preview accounting entries" screen uses it |
| SLA-3 | Rule sets are versioned and effective-dated; editing an active set creates a new version |
| SLA-4 | Every posted journal records `sla_rule_set_version_id`, and the UI can answer "why this account?" |
| SLA-5 | A rule referencing an unmapped account role fails at **validation time**, listing the missing roles — never at post time |
| SLA-6 | Reprocessing a historical event with its original rule set reproduces the original journal byte-for-byte |

---

## 2. Accounts Receivable

### 2.1 Model

```
open_item        (tenant, id, entity_id, kind, counterparty_id, currency,
                  issue_date, due_date, gross, internal_document_no,
                  statutory_document_no, journal_id, status)
                  kind ∈ invoice | credit_note | debit_note | payment | adjustment

item_application (tenant, id, applied_from_id, applied_to_id, amount,
                  applied_at, effective_at, reversal_of_id)
```

Three things people get wrong here and pay for later:

1. **Applications are a separate many-to-many table**, never a nullable FK. A
   payment settling three invoices partially is the normal case, not the edge.
2. **Applications are bi-temporal and never deleted.** Un-applying writes a
   reversing row. Aging must be computable *as of* a past date, because that is
   what an auditor asks for.
3. **Realised FX is emitted by the application engine, computed not plugged.**
   `(settlement rate − booking rate) × FC amount cleared`. If you post whatever
   balances, a wrong rate or a rounding bug lands silently in FX P&L forever.

### 2.2 Withholding on receipts — the APAC-specific flow

In Indonesia and Thailand, business customers routinely withhold tax when paying
you. A generic Western ledger breaks here, because the cash received is less
than the invoice but the invoice is fully settled.

```
Invoice:   Dr AR 1,000,000            Cr Revenue  1,000,000
Receipt:   Dr Bank    980,000
           Dr Prepaid income tax (asset)  20,000   ← PPh 23 @ 2% withheld
                                     Cr AR   1,000,000
```

The withholding certificate (*bukti potong* in Indonesia, withholding tax
certificate in Thailand) is a document you must **chase, receive, and match**,
because it is what substantiates the prepaid-tax asset against the annual
return. Model it as a first-class object with its own lifecycle:
`expected → received → matched → claimed`. An unmatched certificate at year end
is a real financial loss for the customer, so it needs an aging report of its
own.

### 2.3 Acceptance criteria

| # | Criterion |
|---|---|
| AR-1 | Partial, over- and multi-invoice applications all supported; N:M representable |
| AR-2 | Aging as at any past date reproduces exactly what the aging showed on that date |
| AR-3 | Realised FX is computed from rates, posted explicitly, and the entry then asserted to balance |
| AR-4 | Un-applying writes a reversal row; no application row is ever deleted or updated |
| AR-5 | AR control account balance equals the sum of open items, verified by a scheduled job that alerts on divergence |
| AR-6 | Withholding on receipt posts to `withholding_receivable`; certificate lifecycle tracked with an aging report |

---

## 3. Accounts Payable

Mirrors AR, plus three additions:

- **Approval workflow with segregation of duties.** The person who creates a
  payment must not approve it. This is a product feature in this market, not an
  internal control, and auditors test it. Model approval as a first-class
  workflow with its own audit trail and configurable thresholds.
- **Withholding on payment.** Indonesia (PPh 23 at 2%, PPh 4(2) final at 10% on
  property rent), Thailand (PND 3/53), Australia (no-ABN withholding at 47%),
  US (backup withholding). The ledger posts a `withholding_payable` liability
  and the pack generates the certificate the vendor will chase you for.
- **Payment file export.** Australia's ABA (Cemtext) file is still essential and
  will be asked for in the first sales call. Malaysia and Singapore need bulk
  payment formats for DuitNow and GIRO respectively.

| # | Criterion |
|---|---|
| AP-1 | Approval workflow enforces segregation of duties with an audit trail |
| AP-2 | Withholding computed by the pack, posted to `withholding_payable`, certificate generated |
| AP-3 | AP control reconciles to open items on a schedule |
| AP-4 | ABA file export validates against the bank's specification |

---

## 4. Banking and reconciliation

**All four match cardinalities must be representable from day one:** 1:1 (wires,
single-invoice payments), N:1 (card settlement batches), 1:N (partial payments,
instalments), N:M (netting, cross-currency).

Model the match as a **match-group entity** — many statement lines to many
ledger items. A nullable FK on the statement line makes N:M unrepresentable and
the retrofit is painful.

### 4.1 Matching engine

Three stages, in order:

1. **Deterministic rules** — exact provider reference, then exact amount + date.
2. **Scored candidates** — amount proximity, date proximity, string similarity on
   narrative, counterparty history. Rolling lookback window with amount
   tolerance, never exact timestamp equality; settlement timing varies by rail.
3. **Human queue** for the remainder.

**Store the rule or score that produced every match.** Auditors ask.

Clearing accounts per rail (`psp:stripe:settlement`, `bank:in-transit`) keep
gross-vs-net and fee splits ledger-visible. Timing differences carry forward;
they are not written off.

### 4.2 Feeds by market

| Market | Primary | Notes |
|---|---|---|
| AU | CDR / Open Banking, Basiq, Yodlee | Bank feeds are the **#1 buying criterion** in Australia |
| SG | Bank APIs, PayNow, GIRO | |
| MY | FPX, DuitNow; bank statement files | Direct bank APIs are limited |
| ID | Bank APIs, QRIS, Virtual Account | |
| TH | PromptPay, bank APIs | |
| US | Plaid / Finicity / MX; FDX | CFPB §1033 is enjoined and under reconsideration as of Aug 2026 — the April 2026 compliance date passed with no effect. **Build to FDX; treat aggregator cost as variable COGS, not a fixed line** |

| # | Criterion |
|---|---|
| BNK-1 | CAMT.053, OFX, CSV and at least one live feed import into a common statement model |
| BNK-2 | All four cardinalities representable and tested, including N:M |
| BNK-3 | Every match stores its rule id or score |
| BNK-4 | Unmatched items age into a queue with a documented exception taxonomy |

---

## 5. Reporting

Served from the transactional store. Not from a replica, not from DuckDB — any
number an auditor or regulator sees stays on the ACID path.

| Report | Source | Note |
|---|---|---|
| Trial balance | `period_balance`, one indexed scan | Shipped in Phase 0 |
| P&L | Period movement on income/expense | Comparatives and % of revenue |
| Balance sheet | Cumulative + computed current-year earnings | |
| Cash flow | Indirect from `period_balance` + account tagging | Direct method needs `cashflow_category` tagged at posting — the column exists |
| Aged AR / AP | Open items + applications, as-at any date | |
| GL detail / drilldown | `journal_line` | Must reach the source document in ≤2 clicks |
| Tax return prep | Declarative return definitions (doc 02 §2.3) | Per market |

**Dimension hierarchies must be date-effective and versioned.** Reorganisations
happen and last year's report must still roll up the way it did last year. Store
`hierarchy_version_id` and let the report choose.

| # | Criterion |
|---|---|
| RPT-1 | Trial balance ties to the sum of `journal_line` for the period, asserted in test |
| RPT-2 | Balance sheet balances; P&L ties to the movement on income/expense accounts |
| RPT-3 | Every report drills through to source documents |
| RPT-4 | Reports run for a closed period return the frozen snapshot, not a recomputation |
| RPT-5 | p95 < 2s for a 10⁷-line book |

---

## 6. Identity and access

The Phase 0 skeleton has tenants and roles. Phase 1 adds what the market
actually requires:

- **Entity-scoped roles.** A group accountant sees all entities; a subsidiary
  bookkeeper sees one. Not tenant-scoped — entity-scoped.
- **Accountant / advisor access** — one user, many client tenants. This is a
  first-class use case in all six markets, and in Australia and Malaysia the
  accounting practice is often the *buyer*. Design the membership model for it
  now; bolting it on means reworking every authorisation check.
- **Segregation of duties** as configurable policy, with the audit trail to
  prove it.

---

## 7. Phase 1 sequencing

| Weeks | Work | Parallel |
|---|---|---|
| 1–3 | Account roles, SLA rule engine, dry-run | Django app shell, auth, entity-scoped roles |
| 4–6 | AR: open items, applications, aging, realised FX | Chart of accounts UI, import |
| 7–9 | AP: bills, approvals, withholding, payment files | Banking: statement import model |
| 10–12 | Bank reconciliation: match groups, rules, scoring, queue | Reports: P&L, BS, aged AR/AP |
| 13–14 | First localisation pack end-to-end (recommend **Malaysia** — see doc 10) | Hardening, performance |

**Note the Django cost flagged in the blueprint:** composite primary keys mean
`journal`, `journal_line` and `period_balance` cannot be registered in the Django
admin. Budget a purpose-built internal inspection view in weeks 1–3 — support
will need it from the first customer.
