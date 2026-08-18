# 04 — Localisation Pack: Singapore (`sg`)

**Recommended as pack #2.** Architecturally the opposite of Malaysia — post-audit
Peppol reporting, a fully recoverable tax, no residency constraint. Building it
second is what proves the framework abstracts rather than just accommodates.

**Facts current as at 17 August 2026.** ⚠️ items in §9.

---

## 1. E-invoicing — InvoiceNow (Peppol, IRAS as corner 5)

**Model: post-audit reporting over Peppol.** The invoice is valid on issue.
Transmission delivers it to the buyer's Access Point, and IRAS is notified
**after** delivery. No UIN, no QR, no clearance, no cancellation window.

### 1.1 Mandate timeline — GST InvoiceNow

| From | Who |
|---|---|
| 1 May 2025 | Voluntary soft launch |
| 1 Nov 2025 | Newly incorporated companies voluntarily GST-registering within 6 months of incorporation |
| **1 Apr 2026** | All new voluntary GST registrants |
| 1 Apr 2028 | New compulsory registrants + existing businesses with supplies ≤ S$200k |
| 1 Apr 2029 | Existing businesses ≤ S$1m |
| 1 Apr 2030 | Existing businesses ≤ S$4m |
| 1 Apr 2031 | All remaining GST-registered businesses |

**Note the sequencing is smallest-first — the reverse of Malaysia.** So your
Singaporean early adopters are new and small, and your Malaysian ones are large
and established. That changes onboarding, pricing and support load in both
markets.

### 1.2 Scope of transmission

Data transmitted maps to the GST return, not just AR: standard-rated, zero-rated
and exempt **supplies**, plus standard-rated and zero-rated **purchases**. Plan
for AP-side transmission from the start — it is not an AR feature.

### 1.3 API

| Item | Value |
|---|---|
| Network | Peppol; profile **PINT-SG** |
| IRAS interface | **C5 API** |
| Auth | `KeyId`-based |
| Batching | ≤ 10 documents, ≤ 10 MB per batch |
| Sandbox | Available |

⚠️ **Error reporting differs between sandbox and production.** Do not assume
parity — build the error-handling path against production semantics as
documented, and treat sandbox success as necessary but not sufficient.

You need an Access Point. Integrate one (Storecove/Fonoa-class) behind the
`TransmissionPort` rather than becoming one; OpenPeppol fees are trivial but the
AS4/SMP engineering, uptime obligation and per-country authority onboarding are
not.

---

## 2. Indirect tax — GST

Fully recoverable. `tax_code.recoverability = 'full'` by default, with a blocked
input tax list.

| Item | Value |
|---|---|
| Rate | **9%** |
| Registration threshold | S$1m taxable turnover (retrospective/prospective tests) |
| Reverse charge | Imported services, from 1 Jan 2020 |
| Overseas Vendor Registration | Digital and low-value goods to non-GST-registered customers |

### 2.1 GST F5 — box map

This is the pack's core table. Every tax code carries its `f5_box` tag so the
return is a pure aggregation.

| Box | Contents | Ledger source |
|---|---|---|
| 1 | Standard-rated supplies (excl. GST) | Revenue tagged `SR` |
| 2 | Zero-rated supplies | Revenue tagged `ZR` (exports, international services) |
| 3 | Exempt supplies | Revenue tagged `EX` |
| 4 | Total supplies | Box 1+2+3 (computed) |
| 5 | Taxable purchases (excl. GST) | Expense/asset tagged `TX`/`IM` |
| 6 | Output tax due | `GST Output Tax` control (credit) |
| 7 | Input tax and refunds claimed | `GST Input Tax` control (debit) |
| 8 | Net GST payable/(refundable) | Box 6 − Box 7 → posts to `GST Control` |
| 9 | Imports under MES / 3PL / approved schemes | Import register |
| 10 | Tourist refund scheme claims | TRS module |
| 11 | Bad debt relief | Bad debt relief journal |
| 12 | Pre-registration input tax | First return only |
| 13 | Total revenue | P&L revenue |
| 14 | Imported services subject to reverse charge | `RC` code |
| 15 | Digital services by electronic marketplace operators | Marketplace operators only |

⚠️ Additional boxes exist for Import GST Deferment Scheme filers — verify against
the current F5/F7 form before building.

**Reverse charge posts on both sides simultaneously** (output and input on the
same transaction), netting to zero for a fully-taxable business but non-zero
where input tax is blocked or partially exempt. Model it as a dual-posting tax
code, not as two manual journals.

### 2.2 Filing

| Item | Value |
|---|---|
| Default frequency | **Quarterly** (monthly available on application) |
| Due | Within **one month** of period end |
| Channel | myTax Portal; IRAS API available for software vendors |
| Late filing | S$200 immediately, S$200/month thereafter (capped) |
| Currency | SGD |

**Quarterly ≠ calendar quarter.** IRAS assigns each registrant one of three
cycles (Mar/Jun/Sep/Dec, Jan/Apr/Jul/Oct, Feb/May/Aug/Nov). Store the assigned
cycle per entity; assuming calendar quarters will produce wrong periods for
roughly two-thirds of your customers.

### 2.3 Schemes worth supporting

Major Exporter Scheme (MES) suspends import GST — material for the trading
companies that make up a large share of the Singapore SME base. Also worth
knowing: Import GST Deferment Scheme, Approved Third Party Logistics.

---

## 3. Withholding tax

Applies to payments to non-residents under ITA s45. Common rates ⚠️:

| Payment | Rate |
|---|---|
| Interest, commission, fees on loans | 15% |
| Royalties | 10% |
| Technical/management services performed in Singapore | 17% (prevailing corporate rate) |
| Director's remuneration (non-resident) | **24%** (the 22% figure widely quoted is the pre-YA2017 rate — using it under-withholds on every non-resident director fee) |
| Rent of moveable property | 15% |

**Remittance timing differs from Malaysia** — filing and payment by the 15th of
the second month following the date of payment/deemed payment. Do not share
scheduler logic across the two packs; this is a known trap.

**CPF** and **IR8A/AIS** are payroll obligations the ledger must carry as summary
postings: CPF employer and employee liability accounts, and an annual AIS
submission that most customers will do in their payroll product. Post the
journals; do not build payroll.

---

## 4. Numbering, retention, residency

| Item | Position |
|---|---|
| Numbering | **No gapless requirement.** Sequential is convention, not law |
| Tax invoice contents | Prescribed by IRAS — supplier name/address/GST reg no, invoice number, date, customer details, description, quantity, amount excl. GST, GST rate and amount, total incl. GST |
| Retention | **5 years** |
| Residency | **No requirement.** Records may be kept overseas provided they are accessible |
| Language | English |
| Currency | Any invoicing currency; **the F5 return is in SGD**, and SGD equivalents must appear on the tax invoice for local supplies |

The contrast with Malaysia is the point: same region, opposite residency answer.
Your `tenant_routing` must be able to place a Singaporean tenant and a Malaysian
tenant in different regions under the same customer account.

---

## 5. Statutory accounts

| Item | Position |
|---|---|
| Framework | **SFRS** (IFRS-aligned); **SFRS for Small Entities** for qualifying entities |
| Filing | ACRA, in **XBRL via BizFinx** |
| Tool | **BizFinx preparation/multi-upload tool v4.0**, mandatory from 15 Apr 2026 |
| **Taxonomy** | **ACRA Taxonomy 2026 v1.0** (replacing the 2022 taxonomy) — this is the artefact gate G2 vendors, not "v4.0" |
| Audit exemption | "Small company" test under Companies Act s205C — 2 of 3: revenue ≤ S$10m, assets ≤ S$10m, employees ≤ 50 |
| **Simplified XBRL threshold** | Revenue ≤ **S$500k** **AND** total assets ≤ **S$500k** — both tests |

Note the two are different tests and are routinely conflated: the S$10m figures
are the **audit exemption** test, not the XBRL template selector. Using S$10m to
pick the template makes customers file the wrong form.

---

## 6. Chart of accounts

No prescribed chart. Singaporean practice broadly follows international
convention. Seed the same structure as the platform default, mapped to SFRS
statutory elements for BizFinx.

---

## 7. Integrations

| Category | Options |
|---|---|
| Payment rails | **PayNow** (instant, proxy-addressed), **GIRO** (direct debit), FAST |
| Banking data | DBS/OCBC/UOB APIs; SGFinDex for consented data |
| Migration sources | Xero (very strong in SG), QuickBooks Online, MYOB, Financio, Autocount |

**Xero has deep penetration in Singapore.** A high-fidelity Xero import — chart,
contacts, open items, historical journals with dates preserved — is the single
highest-leverage migration story in this market.

---

## 8. Pack acceptance criteria

| # | Criterion |
|---|---|
| SG-1 | Outbound invoice, CN and DN transmit via Peppol in PINT-SG and validate |
| SG-2 | AP-side purchase data transmits to IRAS C5 |
| SG-3 | Batch limits enforced (≤10 docs, ≤10 MB); oversize batches split automatically |
| SG-4 | Reverse charge posts output and input simultaneously, and lands in boxes 5, 6, 7 and 14 correctly |
| SG-5 | GST F5 reconciles to the ledger for a seeded book, including a partially-exempt case (gate G4) |
| SG-6 | The IRAS-assigned quarterly cycle drives period selection; calendar quarters are never assumed |
| SG-7 | Tax invoice PDF carries all IRAS-prescribed particulars and SGD equivalents |
| SG-8 | WHT posts with correct s45 timing (15th of second month), distinct from the MY scheduler |
| SG-9 | XBRL export validates against **ACRA Taxonomy 2026 v1.0** via BizFinx tool v4.0; Full vs Simplified template selected by the S$500k/S$500k test |
| SG-10 | Signed off by a named Singapore chartered accountant against pack version |

---

## 9. Open items — resolve before ship

1. ~~Simplified XBRL threshold~~ — **closed.** S$500k revenue AND S$500k total
   assets, both tests. The S$10m figure was the audit-exemption conflation.
2. IGDS and any other boxes beyond 15 on the current F5/F7 form.
3. IRAS C5 production error semantics vs sandbox.
4. Current s45 withholding rate table and treaty handling.
5. Whether IRAS API filing (not just transmission) is available to third-party
   software, and under what accreditation.
6. Blocked input tax list — current scope (club subscriptions, medical expenses,
   motor cars, family benefits) and any 2025–26 changes.
