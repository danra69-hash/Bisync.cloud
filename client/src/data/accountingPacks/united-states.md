# 08 — Localisation Pack: United States (`us`)

The US is the odd one out. There is **no e-invoicing mandate**, **no gapless
numbering requirement**, and **no statutory chart** — but sales tax is a
~13,000-jurisdiction problem you should buy rather than build, and information
reporting thresholds just changed in a way most specs have not caught up with.

**Facts current as at 17 August 2026.** ⚠️ items in §9.

---

## 1. Sales tax — buy the engine, own the boundary

**Do not build rate determination.** Integrate a vendor behind
`TaxDeterminationPort` and keep your own rounding policy on your side of the
boundary.

| Vendor | Model | Published pricing |
|---|---|---|
| Stripe Tax | % of transaction | 0.5%/transaction; no filing service |
| TaxJar | Tiered + AutoFile credits | From $39/mo; ~$50 per filing credit |
| **Anrok** | SaaS-specific | ~$400–1,000/mo; best SaaS taxability logic |
| Avalara / Vertex | Enterprise, quote-only | Worth it only if you need US sales tax **and** EU VAT **and** e-invoicing from one vendor |

### 1.1 Economic nexus — where product bugs create customer liability

The common threshold is $100,000 **or** 200 transactions, but the variation is
the whole problem:

| State | Threshold |
|---|---|
| California, Texas, New York | **$500,000** (NY additionally requires 100 transactions — conjunctive) |
| Alabama, Mississippi | $250,000 |
| Most others | $100,000 or 200 transactions |

**Transaction-count thresholds are being deleted** — Utah dropped its count on
1 Jul 2025, Illinois on 1 Jan 2026, and the trend continues.

Three things that differ by state and cause real errors: the **measurement
period** (calendar year vs prior 12 months vs rolling), whether **exempt sales**
count toward the threshold, and whether **marketplace sales** do.

> **Nexus monitoring, not rate lookup, is where bugs create liability for your
> customer.** Build the monitoring; buy the rates.

### 1.2 SaaS taxability — including California

Roughly two dozen states tax SaaS. The California position has changed:

**California SB 122 taxes prewritten software including SaaS from 1 January
2027**, reversing a 30-plus-year exclusion. Custom software, digital content and
IaaS are excluded. Purchasers over $5m/year self-assess via a direct pay permit.
Sourcing follows billing address → shipping → payment instrument → mailing
address. CDTFA regulations were still pending as at August 2026.

**Rate: standard state + applicable local/district rate, determined by customer
location.** There is no special SaaS rate — the "7.5%" figure circulating in
secondary coverage appears to be a misreading of California's 7.25% statewide
base. Do not build a special rate.

**This is a dated, scheduled change — put it in the pack as an effective-dated
rate rule now**, not as a to-do.

### 1.3 The local traps

| Trap | Detail |
|---|---|
| **Texas 80/20 rule** | SaaS is taxed as a data processing service with **20% exempt** |
| **Chicago Personal Property Lease Transaction Tax** | **15%** as of Jan 2026 (9% → 11% → 15%) — the **highest sub-national SaaS rate in the US**, and a city tax entirely separate from Illinois state sales tax |
| **Home-rule jurisdictions** | Colorado, Alabama, Louisiana — independent registration, filing and sometimes rates |
| Marketplace facilitator rules | Shift collection to the marketplace; affects both threshold counting and who remits |

⚠️ Whether Chicago's reduced ~5.25% computer-lease rate survives is unconfirmed.

### 1.4 Exemption certificates

Certificate collection, validation, expiry tracking and audit retrieval is a
required capability for any customer with resale or non-profit buyers. Vendors
offer this; if you do not integrate it, your customer carries the assessed tax
personally on audit.

---

## 2. Information reporting — thresholds just changed

**OBBBA changed these and most specifications are stale.**

| Form | Threshold | Note |
|---|---|---|
| **1099-NEC / 1099-MISC** | **$2,000** for 2026 payments | Up from $600; inflation-indexed from 2027 |
| **1099-K** | **$20,000 AND 200 transactions** | **Restored** — the $600 threshold is gone |

Due dates: 1099-NEC to recipients and IRS by **31 January**; 1099-MISC to
recipients by 31 January (or 15 February for certain boxes), to the IRS by
28 February on paper or 31 March electronically.

Supporting machinery the pack must provide:

- **W-9 collection** at vendor onboarding, stored and retrievable.
- **TIN matching** against the IRS service.
- **Backup withholding at 24%** where a TIN is missing or incorrect — this is
  the US equivalent of Australia's no-ABN withholding, and it posts to
  `withholding_payable`.
- **State 1099 filing** and the Combined Federal/State Filing program ⚠️ — state
  participation and requirements vary.

---

## 3. GAAP and the books customers actually keep

Be honest about this in product design: most US small businesses do **not** keep
GAAP books. They keep tax-basis or modified-cash books and map to a return.

| Entity | Return | Mapping needed |
|---|---|---|
| Sole proprietor | Schedule C | Account → Schedule C line |
| C corporation | 1120 | Account → 1120 line |
| S corporation | 1120-S | Account → 1120-S line |
| Partnership / LLC | 1065 | Account → 1065 line |

**This is the same mapping subsystem as Thailand's DBD XBRL.** One versioned
`statutory_map` handles both; the pack supplies the element set.

Cash vs accrual is an entity-level election with thresholds ⚠️. Model it as a
property that selects the tax point, exactly as Australia's `gst_basis` does.

Where full GAAP does apply: **ASC 606** (revenue), **ASC 842** (leases), **ASC
740** (income taxes). These land in Phase 3, not the pack.

---

## 4. E-invoicing, numbering, retention

| Item | Position |
|---|---|
| E-invoicing | **No mandate.** DBNAlliance exists and is voluntary. Pack implements `transmission` as PDF + e-mail |
| Numbering | **No gapless requirement — confirmed.** Sequential is convention only |
| Retention | IRS guidance generally 3 years, longer in specific circumstances; state requirements vary |
| Residency | No requirement |
| Language / currency | English, USD |

**The numbering contrast is the clearest proof that the framework's
`numbering_rules` capability was the right call.** Malaysia and Thailand need
gapless; the US explicitly does not; Indonesia's number is not even yours. Three
incompatible behaviours, one capability, zero conditionals in the core.

---

## 5. SOC 2 and buyer expectations

US buyers will ask for **SOC 2 Type II** before signing anything above a
self-serve tier. Start evidence collection in Phase 1 — retrofitting a year of
evidence is not possible. This is a US-market-entry dependency, not an
engineering nicety.

---

## 6. Integrations

| Category | Options | Note |
|---|---|---|
| Bank feeds | **Plaid, Finicity, MX**; build to **FDX** | **CFPB §1033 is enjoined and under reconsideration.** The 1 Apr 2026 compliance date passed with no effect and the fee prohibition is what CFPB reopened. **Treat aggregator cost as variable COGS, not a fixed line** |
| Payment rails | ACH, RTP, **FedNow**, cards | |
| Payroll | Gusto, ADP, Rippling APIs | Integrate; do not build |
| Migration sources | **QuickBooks Online** (dominant), Xero, NetSuite, Sage Intacct | |

**QuickBooks Online is the incumbent and the migration source that matters.**
Nothing else in the US pack moves a deal as much as a clean QBO import.

---

## 7. Pack acceptance criteria

| # | Criterion |
|---|---|
| US-1 | Tax determination behind a vendor-agnostic port; vendor swappable without touching the ledger |
| US-2 | **Rounding policy applied on our side of the vendor boundary**, not the vendor's |
| US-3 | Nexus monitoring per state with correct measurement periods and configurable treatment of exempt and marketplace sales |
| US-4 | California SaaS taxability effective-dated to 1 Jan 2027 |
| US-5 | Texas 80/20 and Chicago lease tax handled as fixtures with expected outputs |
| US-6 | Exemption certificate lifecycle: collect, validate, expire, retrieve |
| US-7 | 1099-NEC/MISC at the **$2,000** threshold; 1099-K at **$20,000 and 200** |
| US-8 | W-9 capture, TIN matching, 24% backup withholding posting to `withholding_payable` |
| US-9 | Account → return line mapping for Schedule C, 1120, 1120-S, 1065 |
| US-10 | Cash vs accrual election drives the tax point |
| US-11 | Sales tax liability by jurisdiction reconciles to the ledger (gate G4) |
| US-12 | Signed off by a named US CPA against pack version |

---

## 8. What the US pack does *not* need

Worth stating explicitly, because assuming otherwise wastes a sprint:

- No clearance transmission
- No gapless numbering
- No statutory chart of accounts
- No in-country residency constraint
- No language localisation
- No universal audit requirement

The US pack is mostly **tax determination + information reporting + return
mapping**. It is smaller than Indonesia's or Thailand's despite the market being
larger.

---

## 9. Open items — resolve before ship

1. ~~California SB 122 rate treatment~~ — **closed.** Standard state + district
   rates by customer location; no special rate. Still watch for CDTFA
   regulations, which were pending.
2. Marketplace facilitator rules — not researched in depth; scope before
   supporting marketplace sellers.
3. State 1099 filing requirements and current CF/SF participation.
4. Whether Chicago's reduced computer-lease rate survives.
5. Cash vs accrual eligibility thresholds, current figures.
6. Exemption certificate audit-retention requirements by state.
7. §1033 status — re-check quarterly; it changes the economics of bank feeds.
