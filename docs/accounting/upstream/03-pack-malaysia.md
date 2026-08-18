# 03 — Localisation Pack: Malaysia (`my`)

**Recommended as pack #1.** It exercises every hard part of the framework —
clearance transmission, a non-recoverable tax, in-country record keeping — so if
the abstraction survives Malaysia it will survive the rest.

**Facts current as at 17 August 2026.** Items marked ⚠️ need verification against
primary sources before shipping; see §9.

---

## 1. E-invoicing — MyInvois (LHDN/IRBM)

**Model: clearance.** Every document goes to LHDN, which validates and returns a
UIN. The document is not valid until cleared.

### 1.1 Mandate status

| Band (annual turnover) | Mandatory from |
|---|---|
| > RM100m | 1 Aug 2024 |
| > RM25m | 1 Jan 2025 |
| > RM5m | 1 Jul 2025 |
| RM1m – RM5m | **1 Jan 2026** |
| < RM1m | **Exempt.** Phase 5 was cancelled; the exemption threshold was raised from RM500k to RM1m on 6 Dec 2025 |

The RM1m band was **not** deferred. What moved was the penalty-free relaxation
window: the mandatory start for the RM1m–RM5m band remains 1 Jan 2026, the
interim relaxation runs to **31 Dec 2027**, and penalties apply from **1 Jan
2028** (announced 20 Apr 2026, LHDN e-Invoice General FAQ 104).

**Commercial consequence:** Malaysia's micro-business long tail is permanently
out of scope for e-invoicing. That is a real TAM fact for an SMB product — do
not build the pack's onboarding assuming every Malaysian customer needs it.

### 1.2 Document types

| Type | Direction | Notes |
|---|---|---|
| Invoice | Outbound | |
| Credit note | Outbound | Reduces value |
| Debit note | Outbound | Increases value |
| Refund note | Outbound | Refund of payment |
| **Self-billed** invoice / CN / DN / refund | **Buyer issues** | Required for payments to foreign suppliers, agents/dealers/distributors, e-commerce payouts, profit distributions, and certain other cases |
| **Consolidated** e-invoice | Outbound, monthly | For buyers who do not request an e-invoice — aggregate B2C, submitted within 7 days after month end |

**Self-billing is not optional and is the most commonly missed requirement.**
Model it as a first-class AP-side document flow, not an AR variant: the ledger
posts a purchase, and the *same* transaction produces an outbound cleared
document under your own TIN.

### 1.3 Timing — the 72-hour rule

- A cleared document may be **cancelled by the supplier or rejected by the buyer
  within 72 hours of validation**.
- After 72 hours: no cancellation. Correction is by credit note, debit note or
  refund note only.

Implement as a pack-supplied duration with a visible countdown. Fire an outbox
event at T+60h so the customer gets a last chance. Expect this to be your top
support topic in Malaysia if you do not.

### 1.4 API

| Item | Value |
|---|---|
| Environments | Preprod sandbox + production |
| Auth | OAuth2 client credentials; **60-minute token lifetime**; separate intermediary model for software vendors acting on behalf of taxpayers |
| Payload | JSON or XML (UBL-derived), signed |
| Response | UIN, validation link, QR code |
| Field list | Appendix 1 of the MyInvois guideline (v4.7, 7 Jul 2026), ~55 fields, M/C/O at both invoice and line level |

**Register as an intermediary.** The taxpayer authorises your platform in the
MyInvois portal; you then submit on their behalf. Onboarding UX must walk the
customer through that authorisation — it is a step they will not find on their
own.

### 1.5 What the supplier must give the buyer

The validated document **plus** the UIN, the validation link and the QR code.
Your PDF template must render all three. A PDF without the QR is not a compliant
copy.

---

## 2. Indirect tax — SST

**Malaysia has no VAT/GST. SST is two separate single-stage taxes with no input
tax credit.** This is the single largest architectural difference from every
other pack in the set.

> **Design rule:** in the MY pack, `tax_code.recoverability = 'none'`. Purchase
> tax posts to **expense**, never to a receivable. There is no `tax_input_receivable`
> role mapping in Malaysia.

### 2.1 Sales tax (goods — at manufacture or import)

| Rate | Scope after the 1 Jul 2025 expansion |
|---|---|
| 0% | Essential staples: rice, books, school supplies, medicines, basic building materials |
| 5% | Certain imported fruits (**apples, oranges, mandarin oranges and dates were exempted to 0%** in the 27 Jun 2025 revision), premium seafood, essential oils, silk and premium fabrics, antique artwork, racing bicycles |
| 10% | Default for other taxable goods |

**Sales tax is levied by tariff (HS) code, not by product category name.** The
product master needs an HS code field. Do not attempt to infer the rate from a
description — roughly 5,000 tariff lines moved bands on 1 July 2025.

### 2.2 Service tax

Standard 6%, with 8% on a defined subset since 1 Mar 2024. Groups changed in the
1 Jul 2025 expansion:

| Service | Rate | Registration threshold |
|---|---|---|
| Construction works | 6% | RM1,500,000 |
| Rental / leasing of tangible assets & commercial property (Group K) | 8% | **RM1,000,000** |
| Fee-based financial services (Group H) | 8% | **RM1,000,000** |
| Private healthcare (non-Malaysian patients only) | 6% | RM1,500,000 |
| Private education above RM60,000/student/year; tertiary for non-citizens | 6% | No threshold |

**Beauty, wellness and aesthetic services are NOT taxable.** They were removed
from scope entirely by the MoF announcement of 27 June 2025, before the
expansion took effect — manicure/pedicure, facial services, barbers and
hairdressers were all excluded from Group C. Do not seed a tax code for them;
you would charge tax on out-of-scope supplies.

The rental/leasing and fee-based financial services thresholds were **raised
from RM500,000 to RM1,000,000** in that same 27 June 2025 revision. Registering
customers at RM500k forces roughly half the affected population to register when
they need not.

General registration threshold for other service groups: RM500,000 of taxable
services in 12 months.

⚠️ **The statutory Group A–L list and per-group thresholds could not be retrieved
from mysst.customs.gov.my.** Verify against the Service Tax Regulations 2018
First Schedule (as amended 2025) **before** coding the tax-code taxonomy. This is
the highest-value verification item in the pack.

Transitional relief still relevant for FY2026 comparatives: non-reviewable
contracts signed before 1 Jul 2025 get a 12-month exemption for construction and
rental/leasing; commercial leases to tenants with annual sales **not exceeding
RM1,000,000** are exempt from the 8% leasing tax.

### 2.3 Filing

| Item | Value |
|---|---|
| Form | **SST-02** |
| Period | **Bimonthly** (every 2 months) |
| Due | Last day of the month following period end |
| Channel | MySST portal |
| Final return on deregistration | Within 30 days |

**Customs assigns the period cycle at registration.** Store a per-entity
`sst_period_cycle` (which two-month buckets apply) — do not assume Jan/Feb.

---

## 3. Withholding tax

Applies to **payments to non-residents**. Common rates ⚠️ (verify current rates
and treaty overrides before shipping):

| Payment | Rate |
|---|---|
| Royalties | 10% |
| Interest | 15% |
| Technical/services fees performed in Malaysia | 10% |
| Contract payments to non-resident contractors | 10% + 3% |
| Rent of moveable property | 10% |

Treaty relief requires a certificate of residence. Ledger posts:

```
Dr Expense                     100,000
    Cr WHT payable (10%)                10,000
    Cr Accounts payable                 90,000
```

Remittance is due within a month of paying or crediting the non-resident — note
this differs from Singapore's timing, so do not share the scheduler logic.

`CP58` — statement of monetary and non-monetary incentive payments to agents,
dealers and distributors — is an annual obligation and is worth supporting
because it maps directly to the self-billed e-invoice population.

**Payroll statutory items the ledger must carry** (summary postings, not payroll
mechanics): EPF, SOCSO, EIS, PCB/MTD. Model each as a liability account and a
monthly remittance schedule.

---

## 4. Numbering, retention, residency

| Item | Position |
|---|---|
| Numbering | No explicit statutory gapless rule, but practical requirement — LHDN clearance rejects duplicates and auditors expect sequence. Use gapless per (entity, series, year) |
| Retention | **7 years** from end of the year of assessment |
| **Residency** | **Business records must be kept in Malaysia — Income Tax Act 1967 s82(8)**: "All records that relate to any business in Malaysia shall be kept and retained in Malaysia." (s82A(5) is the parallel provision for documents relating to income where no business is carried on. ⚠️ Sources cite both; get the gazetted text before quoting a section number to a customer or counsel.) This is the pack's hard constraint |
| Language | English or Bahasa Malaysia |
| Currency | MYR for statutory records; foreign-currency invoices permitted with MYR equivalents shown |
| FX | Use an acceptable published rate source consistently ⚠️ (confirm which sources LHDN accepts) |

**The residency rule drives infrastructure, not just config.** Malaysian tenants
need a Malaysian or contractually-compliant in-country data location, or a
documented arrangement that satisfies s82(8). Resolve this with counsel before
the first Malaysian customer signs, not after. It is why `tenant_routing.region`
exists in Phase 0.

---

## 5. Statutory accounts

| Item | Position |
|---|---|
| Framework | **MFRS** (full IFRS) for entities with public accountability; **MPERS** for private entities |
| Filing | Companies Act 2016, to SSM |
| Format | **MBRS 2.0** XBRL ⚠️ (confirm current taxonomy version string) |
| Audit exemption | SSM Practice Directive 10/2024, phased |

MPERS differs from MFRS in ways that touch software: simplified financial
instruments, no revaluation model for PPE in most cases, different disclosure
sets. Model as a `reporting_framework` on the entity that selects the statutory
element set — not as a report-level toggle.

---

## 6. Chart of accounts

No prescribed chart. Conventional ranges Malaysian accountants expect:

| Range | Class |
|---|---|
| 1000–1999 | Non-current assets |
| 2000–2999 | Current assets |
| 3000–3999 | Equity |
| 4000–4999 | Liabilities |
| 5000–5999 | Revenue |
| 6000–6999 | Cost of sales |
| 7000–7999 | Expenses |

Seed this as the default, mapped to MFRS/MPERS statutory elements.

---

## 7. Integrations

| Category | Options |
|---|---|
| Payment rails | **FPX** (online banking), **DuitNow** (transfers + QR) |
| Banking data | Limited direct APIs; statement file import is the practical path |
| Migration sources | SQL Accounting, AutoCount, Million, Xero, QuickBooks (legacy installs) |

**SQL Accounting and AutoCount dominate the Malaysian SME market.** A working
import from those two is a bigger sales lever than any feature in this document.
Scope it as a Phase 2 story with real effort attached, not a nice-to-have.

---

## 8. Pack acceptance criteria

| # | Criterion |
|---|---|
| MY-1 | All six document types submit to the MyInvois sandbox and return a UIN |
| MY-2 | Self-billed flow produces a cleared outbound document from an AP transaction |
| MY-3 | Consolidated e-invoice aggregates a month of non-requesting B2C sales and submits within the window |
| MY-4 | 72-hour cancellation enforced; after expiry the UI offers only CN/DN/refund note |
| MY-5 | PDF renders UIN, validation link and QR |
| MY-6 | Sales tax determined from HS code; service tax from service group; **no input credit posted in either case** |
| MY-7 | SST-02 reconciles to the ledger for a seeded book (gate G4) |
| MY-8 | WHT on non-resident payments posts correctly and generates the remittance schedule |
| MY-9 | Malaysian tenants provision into a compliant region per s82(8) |
| MY-10 | Signed off by a named Malaysian chartered accountant against pack version |

---

## 9. Open items — resolve before ship

1. **Service tax Group A–L list and per-group thresholds** (Service Tax
   Regulations 2018 First Schedule as amended 2025). Highest priority —
   mysst.customs.gov.my was unreachable across repeated attempts, so every group
   figure above rests on professional-firm summaries rather than the gazetted
   schedule.
2. ~~Phase 4 relaxation end date~~ — **closed.** Relaxation to 31 Dec 2027,
   penalties from 1 Jan 2028.
3. MBRS 2.0 taxonomy version string.
4. **Which ITA section governs — s82(8) or s82A(5).** Load-bearing citation;
   confirm from the gazetted text.
4. LHDN-acceptable FX rate sources.
5. Current non-resident WHT rate table and treaty handling.
6. SST late-payment penalty schedule (commonly cited as 10%/+15%/+15% capped at
   40%, unverified).
7. Whether service tax accrues on invoice or payment basis **per group** — this
   changes the tax point and therefore the return.
8. s82(8): what specifically satisfies "kept in Malaysia" for cloud-hosted records.
   Get written advice; it is a gating question for the whole market.
