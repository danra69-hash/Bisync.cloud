# 10 — Delivery Backlog

**Status** Ready to develop · **Estimates** engineer-weeks, ±40% at this
resolution · **Team assumption** 6 engineers + 1 qualified accountant + design

Estimates assume the Phase 0 skeleton as shipped. They exclude the accountant's
time, sales engineering and the ATO accreditation calendar (which runs in
parallel and costs no engineering).

---

## 1. Recommended market sequence

| # | Market | Why here |
|---|---|---|
| 1 | **Malaysia** | Exercises every hard part — clearance, non-recoverable tax, in-country records. If the framework survives MY it survives anything |
| 2 | **Singapore** | Architecturally opposite (Peppol, recoverable, no residency). Proves the framework abstracts rather than accommodates |
| 3 | **Australia** | No mandate to build against, but start DSP accreditation at Phase 2 week 1. Payday Super has just displaced every micro-employer |
| 4 | **Thailand** | Needs a second (CII) serializer and the tax-point machinery. Do it once the framework is proven |
| 5 | **Indonesia** | Hardest: external numbering, routine withholding, most open questions |
| 6 | **United States** | Largest market, smallest pack — but SOC 2 and a QBO import gate entry, not the pack |

**Do not start markets 4–6 until markets 1–3 are live.** Three genuinely
different regimes is what proves the abstraction; six half-built packs is what
kills the roadmap.

---

## 2. Epics

### EPIC-1 · SLA rule engine — 6 weeks

| Story | Est | Acceptance |
|---|---|---|
| Account roles + tenant role mapping | 1w | Unmapped role fails at validation, listing missing roles |
| Rule set schema, versioning, effective dating | 1.5w | SLA-3; editing an active set creates a version |
| Condition evaluator + account selector | 1.5w | SLA-1 across all seeded event types |
| `dry_run()` and preview screen | 1w | SLA-2 |
| Provenance: `sla_rule_set_version_id` on journal, "why this account?" UI | 1w | SLA-4, SLA-6 |

### EPIC-2 · Accounts Receivable — 5 weeks

| Story | Est | Acceptance |
|---|---|---|
| Open items + bi-temporal applications | 1.5w | AR-1, AR-4 |
| Aging as-at any date | 1w | AR-2 |
| Realised FX computed and posted | 1w | AR-3 |
| Control account reconciliation job | 0.5w | AR-5 |
| **Withholding-on-receipt + certificate lifecycle** | 1w | AR-6 — shared by ID and TH |

### EPIC-3 · Accounts Payable — 5 weeks

| Story | Est | Acceptance |
|---|---|---|
| Bills, open items, applications (reuses AR model) | 1w | AP-3 |
| Approval workflow + segregation of duties | 1.5w | AP-1 |
| Withholding on payment + certificate generation | 1.5w | AP-2 |
| Payment file export framework (ABA first) | 1w | AP-4 |

### EPIC-4 · Banking & reconciliation — 6 weeks

| Story | Est | Acceptance |
|---|---|---|
| Statement import: CAMT.053, OFX, CSV | 1.5w | BNK-1 |
| Match-group model, all four cardinalities | 1.5w | BNK-2 |
| Deterministic rules + scored candidates | 2w | BNK-3 |
| Exception queue and taxonomy | 1w | BNK-4 |

### EPIC-5 · Reporting — 4 weeks

| Story | Est | Acceptance |
|---|---|---|
| P&L, balance sheet with comparatives | 1w | RPT-2 |
| Cash flow (indirect) | 0.5w | |
| Aged AR/AP as-at | 0.5w | |
| GL detail + drilldown to source | 1w | RPT-3 |
| Frozen-period snapshot serving | 0.5w | RPT-4 |
| Performance to p95 < 2s @ 10⁷ lines | 0.5w | RPT-5 |

### EPIC-6 · App shell, identity, admin — 5 weeks

| Story | Est | Notes |
|---|---|---|
| Django project, auth, entity-scoped roles | 2w | |
| **Internal inspection UI for ledger tables** | 1.5w | Django admin cannot register composite-PK tables — this is not optional |
| Accountant/advisor multi-tenant access | 1.5w | Practice is often the buyer in AU and MY |

### EPIC-7 · Localisation pack framework — 5 weeks

| Story | Est | Acceptance |
|---|---|---|
| Manifest, loader, versioning, per-entity resolution | 1.5w | Two packs load side by side without interference |
| Ports: determination, tax point, numbering, content, transmission, returns | 1.5w | Import-linter contract passes |
| Declarative return definitions + evaluator | 1w | A return is a YAML file |
| Statutory mapping subsystem (chart → element) | 1w | Serves TH XBRL and US return lines from one implementation |

### EPIC-8..13 · Country packs

| Pack | Est | Dominant cost |
|---|---|---|
| **Malaysia** | 7w | MyInvois clearance + self-billed + consolidated; SST non-recoverable model |
| **Singapore** | 5w | Peppol AP integration, IRAS C5, F5 return, BizFinx |
| **Australia** | 6w | BAS in both variants, PAYG, ABA, TPAR (DSP accreditation is calendar, not effort) |
| **Thailand** | 8w | **CII serializer** (~2.5w alone), tax-point machinery, Thai localisation, DBD export |
| **Indonesia** | 9w | Coretax state machine, NSFP, PPN 12/11, PPh service-list engine, bukti potong |
| **United States** | 5w | Vendor integration, nexus monitoring, 1099 + W-9 + TIN matching, return-line mapping |

Pack estimates assume the framework (EPIC-7) is done and the open items in each
pack's §9 have been resolved. **Unresolved open items are the main estimate
risk** — the Indonesian PMK service list and the Thai DBD taxonomy each carry
±2 weeks.

### EPIC-14 · Migration importers — 6 weeks

Ranked by commercial impact, not effort:

| Importer | Market | Est |
|---|---|---|
| QuickBooks Online | US | 1.5w |
| Xero | SG, AU | 1.5w |
| SQL Accounting + AutoCount | MY | 1.5w |
| Accurate / Jurnal | ID | 1w |
| Express | TH | 0.5w |

**Fidelity requirement for all of them:** chart, contacts, open items, and
historical journals **with original dates preserved**. An importer that lands
everything as an opening balance is not a migration, and customers know it.

### EPIC-15 · Phase 3 modules

| Module | Est |
|---|---|
| Fixed assets (multi-book) | 5w |
| Consolidation | 6w |
| Revenue recognition | 5w |
| Analytics stage 1–2 | 3w |
| Inventory | 10w |
| Scale operations (promotion automation, whale partitions) | 4w |

### EPIC-16 · SOC 2 — continuous from Phase 1

| Story | Est |
|---|---|
| Evidence collection tooling and control mapping | 2w |
| Policy set, DPA, sub-processor register, processing-location register | 1w |
| Quarterly DR rehearsal automation | 1w |

---

## 3. Timeline

Six engineers, allowing for parallelism and one integration-hardening week per
phase.

```
        Q4 2026          Q1 2027          Q2 2027          Q3 2027
Phase 1 ██████████████
        SLA · AR · AP · Banking · Reports · App shell
Phase 2      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
             Framework · MY · SG · AU · importers
                              ░░░░░░░░░░░░░░░░░░░░
                              TH · ID · US
Phase 3                            ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
                                   FA · Consol · RevRec · analytics
SOC 2   ──────────────────────────────────────────────►  Type II window
ATO DSP      ══════════════════════════  (calendar, 6–12 months)
```

**Milestones:**

| When | Milestone |
|---|---|
| End Q4 2026 | A real business can keep its books, one country, no manual workarounds |
| ~Feb 2027 | Malaysia live — first paying customer on a clearance regime |
| ~Apr 2027 | Singapore + Australia live; framework proven across three regimes |
| ~Jul 2027 | Thailand, Indonesia, US live; six markets |
| ~Q3 2027 | Consolidation shipped; SOC 2 Type II window closes |

---

## 4. Critical path and long-lead items

| Item | Lead time | Start by |
|---|---|---|
| **ATO DSP accreditation** | 6–12 months | Phase 2 week 1 — gates all AU lodgment |
| **Malaysia s82(8) residency ruling** | Legal, weeks | Before the first MY customer signs |
| **Indonesian PMK 141 service list** | Procurement | Before ID pack estimate is committed |
| **Thai DBD XBRL taxonomy** | Investigation | Before TH pack estimate is committed |
| **MyInvois intermediary registration** | Weeks | Phase 2 week 1 |
| **Peppol Access Point contract** | Weeks | Before SG pack starts |
| **Qualified accountant per market** | Hiring | One per market before its pack starts |
| **SOC 2 evidence window** | 12 months | Phase 1 week 1 |

---

## 5. Risks specific to this scope

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R20 | Six markets in one year dilutes all six | **High** | **High** | Hard gate: no market 4–6 until 1–3 are live with paying customers |
| R21 | ATO accreditation slips past the AU launch | Medium | High | Start week 1; AU pack can be built and demoed without it |
| R22 | Indonesian Coretax API instability | **High** | Medium | Portal-based fallback path; do not make host-to-host the only route |
| R23 | Thai CII serializer underestimated | Medium | Medium | Spike it in Phase 2 before committing the TH estimate |
| R24 | Malaysia s82(8) forces a Malaysian region earlier than planned | Medium | High | `tenant_routing.region` already exists; cost is infra, not code |
| R25 | Withholding flows treated as an ID/TH edge case | Medium | **High** | Built once in EPIC-2/3 as core AR/AP, not in the packs |
| R26 | Migration importers deprioritised as "not product" | **High** | **High** | They are the deal-closers in every one of the six markets. Fund EPIC-14 explicitly |
| R27 | Open items in pack §9 sections never resolved | **High** | Medium | Each is a ticket with a named owner before its pack starts |

**R25 and R26 are the two most commonly under-weighted.** Withholding is not an
exotic case in Indonesia and Thailand — it is on most B2B invoices. And in every
market on this list, the question "can you import my existing books?" is asked
before any feature question.

---

## 6. Definition of done — for any country pack

Copy into the ticket:

- [ ] All five framework gates green (G1 golden docs, G2 schema, G3 sandbox,
      G4 return reconciliation, G5 determination coverage)
- [ ] Pack's own acceptance criteria table complete
- [ ] Every open item in the pack's §9 resolved or explicitly accepted with a
      documented workaround
- [ ] Signed off by a named locally qualified accountant, recorded against the
      pack version
- [ ] Migration importer for the dominant local incumbent
- [ ] Runbook: what to do when the authority's API is down, and what the customer
      sees
- [ ] Pricing and packaging decided for that market
