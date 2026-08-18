# 05 — Localisation Pack: Australia (`au`)

**The commercially easiest pack and the one with the longest lead time.** No
e-invoicing mandate to build against, but ATO Digital Service Provider
accreditation gates all lodgment and takes **6–12 months**. Start it in the same
week you start Phase 2, before a line of the pack is written.

**Facts current as at 17 August 2026.** ⚠️ items in §9.

---

## 1. E-invoicing — Peppol, voluntary

**There is no B2B mandate.** The Business eInvoicing Right (BER) was consulted on
but never legislated.

Hard obligations are B2G only: Non-Corporate Commonwealth Entities had a target
of 30% of invoices via Peppol by **1 July 2026**, with automation targets to
December 2026.

**Technical:** **PINT A-NZ v1.1.2 is now the only accepted specification.**
BIS Billing 3.0 is dead on the A-NZ network. If your Singapore work produced a
BIS 3.0 binding, Australia needs the PINT profile — same syntax family,
different rules and code lists.

The ATO is the Peppol Authority for Australia.

**What *is* mandatory is tax invoice content** (§2.4). Do not confuse "no
e-invoicing mandate" with "no invoice rules".

---

## 2. GST and the BAS

| Item | Value |
|---|---|
| Rate | **10%** |
| Registration threshold | A$75,000 (A$150,000 for non-profits) |
| Recoverability | Full, except input-taxed supplies |
| Accounting basis | Cash or accruals; cash available under **A$10m aggregated turnover** (confirmed against ATO guidance) |

### 2.1 GST treatment taxonomy

| Treatment | Output GST | Input credits | Code | Examples |
|---|---|---|---|---|
| Taxable | 10% | Yes | `GST` | Most goods and services |
| GST-free | No | **Yes** | `FRE` / `EXP` | Basic food, most medical and health, education, childcare, exports, going concern, farmland, water |
| Input-taxed | No | **No** | `INP` | Financial supplies, residential rent, existing residential premises |
| Out of scope | No | No | `N-T` / BAS Excluded | Wages, super, dividends, ATO payments, internal transfers, depreciation |

> **Do not collapse `N-T` and `FRE`.** Australian bookkeepers treat these as
> distinct and will reject a product that maps wages to "GST-free" — wages must
> be BAS-excluded so they never reach G1. This is the single fastest way to lose
> credibility with an Australian bookkeeper in a demo.

### 2.2 BAS label map — the core localisation table

**GST section**

| Label | Name | Derivation | Simpler BAS |
|---|---|---|---|
| **G1** | Total sales | All sale lines: taxable + GST-free + input-taxed. GST-inclusive or exclusive per a user toggle — **store the toggle** | Required |
| G2 | Export sales | Lines coded `EXP` | Full only |
| G3 | Other GST-free sales | Lines coded `FRE` | Full only |
| G10 | Capital purchases | Purchase lines `is_capital = true`, GST-inclusive | Full only |
| G11 | Non-capital purchases | Purchase lines `is_capital = false`, GST-inclusive | Full only |
| **1A** | GST on sales | `GST Collected` balance for the period + adjustments | Required |
| **1B** | GST on purchases | `GST Paid` balance for the period + adjustments | Required |
| 1C/1D | Wine Equalisation Tax | WET module | Full only |
| 1E/1F | Luxury Car Tax | LCT module | Full only |

**Simpler BAS (turnover < A$10m) lodges only G1, 1A, 1B.** Critical design point:
**always compute G2/G3/G10/G11, conditionally lodge them.** You need them for
reconciliation, for the customer crossing A$10m, and for agents who want to see
them.

**PAYG withholding section**

| Label | Name | Ledger source |
|---|---|---|
| W1 | Total salary, wages and other payments | Gross payments subject to withholding |
| W2 | Amounts withheld from W1 | `PAYG Withholding Payable` — employee component |
| W3 | Other amounts withheld | Investment distributions, foreign resident withholding |
| **W4** | Amounts withheld where **no ABN quoted** | Separate liability sub-account. **47%** |
| W5 | Total withheld = W2+W4+W3 | Copied to summary label 4 |

**PAYG instalments**

| Label | Name |
|---|---|
| 5A | PAYG income tax instalment |
| 5B | Credit from instalment variation |
| T1 | Instalment income (ordinary income excluding GST) |
| T2 / T3 / T4 | ATO rate / varied rate / variation reason code |
| 8A / 8B / 9 | Total payable / creditable / **net amount to ATO** |

Store the tenant's PAYG instalment option: **Option 1** (you calculate: T1 ×
rate → 5A), **Option 2** (ATO-supplied fixed amount), **Option 3** (annual GST
instalment).

### 2.3 BAS validation rules — enforce these

- **Whole dollars only. Leave cents out and do not round up — truncate.**
- No negative figures, no arithmetic symbols.
- Each invoice reported once only.
- **Blank ≠ zero.** Leave non-applicable labels blank rather than entering 0.

These are real ATO rules and a validator that rounds instead of truncating will
produce lodgments that differ from the ATO's own calculation.

### 2.4 Reporting cycles

| Turnover | Cycle |
|---|---|
| ≥ A$20m | Monthly |
| < A$20m | Quarterly (default) |
| < A$75k voluntarily registered | Annual |

Quarterly BAS due the 28th of the month after quarter end (28 February for the
December quarter). Monthly due the 21st.

---

## 3. Payroll-adjacent obligations

### 3.1 Payday Super — the biggest change in this market right now

**Live 1 July 2026.** Superannuation must reach the employee's fund within
**7 business days of pay day**, calculated on a new "Qualifying Earnings" base,
with ATO-assessed Superannuation Guarantee Charge compounding **daily** on
shortfalls. The free Small Business Superannuation Clearing House **closed the
same day**.

**Commercial read: every Australian micro-employer was pushed onto a commercial
product on 1 July 2026.** That is an unusually good moment to enter this market,
and it means your Australian go-to-market should lead with payroll-adjacency even
if you do not build payroll — at minimum, clean integration with the clearing
house or a super gateway, and the liability accounting to match.

### 3.2 Other

- **Single Touch Payroll Phase 2** — the ledger carries summary postings; STP
  reporting itself belongs in the payroll product.
- **No-ABN withholding at 47%** — build this. It is ledger-visible, it hits label
  W4, and it applies to ordinary supplier payments, so AP must handle it.
- **TPAR** (Taxable Payments Annual Report) — required in building and
  construction, cleaning, courier, road freight, IT and security services. Driven
  off AP data; a genuine differentiator for tradie-adjacent customers.

---

## 4. Numbering, retention, residency

| Item | Position |
|---|---|
| Numbering | **No gapless requirement** |
| Tax invoice contents | Mandatory: supplier identity and ABN, date, description, GST amount or the statement "Total price includes GST", recipient identity and ABN for supplies ≥ A$1,000 |
| Retention | **5 years** |
| Residency | No requirement; records may be kept offshore if accessible to the ATO ⚠️ (confirm current ATO position on offshore cloud storage) |
| Language | English |
| Currency | AUD for BAS; foreign currency invoices permitted with AUD equivalents |

---

## 5. Statutory accounts

| Item | Position |
|---|---|
| Framework | **AASB** standards; **Tier 1** (full) vs **Tier 2** Simplified Disclosures |
| Lodgment | ASIC, for entities above the large proprietary company test |
| Large proprietary test | 2 of 3: revenue ≥ A$50m, gross assets ≥ A$25m, ≥ 100 employees ⚠️ |

⚠️ **Sources conflict on the thresholds.** Treasury material presents
$50m/$25m/100 as a proposal; ASIC states it as law since FY2019-20. ASIC is the
better authority and the reconciliation is that Treasury's page is stale
consultation material — but verify before the threshold drives a product
behaviour.

Most SME customers will be below this and lodge nothing with ASIC. Do not
over-build.

---

## 6. Chart of accounts

No prescribed chart. Australian practice follows Xero/MYOB conventions closely
enough that matching them materially reduces migration friction. Seed a chart
that mirrors the Xero default structure and account naming.

---

## 7. Integrations

| Category | Options | Note |
|---|---|---|
| **Bank feeds** | CDR / Open Banking, Basiq, Yodlee | **The #1 buying criterion in Australia.** Not a feature — the reason a deal closes |
| Payment files | **ABA (Cemtext)** | Still essential for bulk payments |
| Bill payment | BPAY | |
| Super | Clearing house / gateway | Now commercially critical (§3.1) |
| Migration sources | **Xero, MYOB, Reckon** | Xero dominates; MYOB strong in established SMEs |

---

## 8. Pack acceptance criteria

| # | Criterion |
|---|---|
| AU-1 | **ATO DSP accreditation obtained** (long-lead — track from Phase 2 week 1) |
| AU-2 | BAS prepared for Simpler and Full variants; G2/G3/G10/G11 computed always, lodged conditionally |
| AU-3 | Whole-dollar truncation (not rounding), blank-vs-zero, and no-negatives validation enforced |
| AU-4 | `N-T` and `FRE` are distinct codes; wages never reach G1 |
| AU-5 | Cash vs accruals basis changes the period in which 1A/1B recognise, not the amount |
| AU-6 | No-ABN withholding at 47% posts to a separate sub-account and lands in W4 |
| AU-7 | BAS reconciles to the ledger for a seeded book (gate G4) |
| AU-8 | Peppol PINT A-NZ v1.1.2 outbound validates; BIS 3.0 is not offered |
| AU-9 | ABA file validates against a real bank specification |
| AU-10 | TPAR generated from AP data for a construction-industry fixture |
| AU-11 | Signed off by a named Australian CA/CPA against pack version |

---

## 9. Open items — resolve before ship

1. **Start ATO DSP accreditation now.** 6–12 months, pure calendar, gates AU-1
   and therefore all lodgment.
2. ~~Cash-basis GST eligibility threshold~~ — **closed.** A$10m aggregated
   turnover, per ATO.
3. Large proprietary company thresholds — reconcile ASIC vs Treasury.
4. ATO position on offshore cloud storage of records.
5. Payday Super: the exact "Qualifying Earnings" definition and the SGC daily
   compounding calculation, if you build any super functionality.
6. Whether TPAR industry scope has changed for 2026–27.
