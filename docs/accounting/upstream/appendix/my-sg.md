# Malaysia & Singapore — Accounting/Tax Compliance Brief for a Multi-Tenant SaaS Ledger

**Research date: 17 August 2026.** Written as an input to a localisation-pack spec. Every non-obvious claim carries a source URL. Confidence flags: **[HIGH]** primary/regulator source; **[MED]** reputable secondary (Big-4, law firm, established vendor) corroborated; **[LOW]** single secondary source or sources conflict — verify before coding.

> **Global caveat.** LHDN (hasil.gov.my) and IRAS (iras.gov.sg) render their key pages client-side; several were not machine-readable. Where a fact came only from a secondary source, it is flagged. Anything driving penalties or hard deadlines should be re-verified against the regulator before release.

---

# PART A — MALAYSIA

## A1. E-invoicing (MyInvois / LHDN-IRBM)

### A1.1 Mandate status and phase table

Governing documents: **e-Invoice Guideline v4.7 (7 July 2026)** and **e-Invoice Specific Guideline v4.8 (7 July 2026)**.
- https://www.hasil.gov.my/wp-content/uploads/IRBM-e-Invoice-Guideline.pdf
- https://www.hasil.gov.my/wp-content/uploads/IRBM-e-Invoice-Specific-Guideline.pdf

Turnover band is fixed by **FY2022 audited financial statements** (or FY2022 tax return where unaudited). It does **not** float with later years — important: this is a static tenant attribute, not a derived one. **[HIGH]**

| Phase | Annual turnover / revenue (FY2022 basis) | Mandatory date | Interim relaxation ("grace") ends | Penalties bite |
|---|---|---|---|---|
| 1 | > RM100m | **1 Aug 2024** | 31 Jan 2025 | live |
| 2 | > RM25m – RM100m | **1 Jan 2025** | 30 Jun 2025 | live |
| 3 | > RM5m – RM25m | **1 Jul 2025** | 31 Dec 2025 | live |
| 4 | > RM1m – RM5m | **1 Jan 2026** | **31 Dec 2027** (extended) | **1 Jan 2028** |
| — | ≤ RM1m | **Exempt** (no mandate) | n/a | n/a |

Sources: guideline v4.7 timeline table (rows 1–4, with "up to RM5 million → 1 January 2026") — https://www.hasil.gov.my/wp-content/uploads/IRBM-e-Invoice-Guideline.pdf **[HIGH]**; RM1m exemption also in v4.7 ("annual turnover or revenue of less than RM1,000,000" exempt) **[HIGH]**; KPMG on the exemption being raised from RM500k to RM1m and the Dec-2025 guideline refresh — https://kpmg.com/us/en/taxnewsflash/news/2026/01/malaysia-revised-e-invoicing-guidelines.html **[MED]**.

**Phase 4 grace extension — flag [MED/LOW].** The mandatory *start* date for the RM1m–RM5m band remains **1 Jan 2026**; what moved is the penalty-free relaxation window, extended to **31 Dec 2027** (announced by the Prime Minister, 20 Apr 2026). Sources: BDO, "The interim relaxation period has been further extended to 31 December 2027, a total of two years" — https://www.bdo.my/en-gb/insights/featured-insights/guide-to-e-invoicing-in-malaysia **[MED]**; jomeinvoice summarising Business Today 20 Apr 2026 / The Star 21 Apr 2026 — https://jomeinvoice.my/article/e-invoice-phase-4-extension-malaysia-2028/ **[LOW]**. KPMG Malaysia separately describes the RM1m–RM5m band as "extended to 2027" — https://kpmg.com/my/en/media-press-releases/2026/01/e-invoicing-extension.html **[MED]**.
> **Conflict to resolve before shipping compliance messaging:** cleartax still shows Phase 4 relaxation ending 30 Jun 2026 (https://www.cleartax.com/my/en/different-phases-implementation-timelines-einvoicing-malaysia) — this appears stale. Guideline v4.7 itself does **not** document the relaxation period, so the concession is administrative, not in the guideline. **Product implication:** model `relaxation_end_date` as tenant-configurable with a defaulted value, not a hardcoded constant.

**What the relaxation period actually permits (design-relevant):** during relaxation a taxpayer may issue a **consolidated e-Invoice for all transactions** (including B2B), may use any invoice number/reference in the "e-Invoice Code/Number" field, and is not penalised for non-compliance provided consolidated e-Invoices are issued. **[MED]** (BDO, as above.)

### A1.2 Exemptions (persons and income types)

Exempt **persons**: foreign diplomatic offices; individuals not conducting business; statutory bodies/authorities/local authorities (for specified functions); international organisations; **taxpayers with annual turnover/revenue < RM1,000,000**.
Exempt **income/transaction types**: employment income, pensions, alimony, zakat, securities/derivatives trades on exchange, certain donations.
Source: guideline v4.7 — https://www.hasil.gov.my/wp-content/uploads/IRBM-e-Invoice-Guideline.pdf **[HIGH]**

### A1.3 Submission channels

| Channel | Description | Fit |
|---|---|---|
| **MyInvois Portal** | Web UI, individual entry or batch spreadsheet upload. Free, available to all taxpayers. | Micro/small tenants, fallback when API down |
| **MyInvois API** | Direct ERP→LHDN integration. Supports high volume, batch. | Our primary integration |
| **Peppol / non-Peppol service providers** | MDEC-accredited Peppol Access Points and technology providers submit on the taxpayer's behalf as **intermediaries** | Multi-tenant SaaS acting for clients |

Source: guideline v4.7 §on transmission mechanisms **[HIGH]**.

**Note on Peppol in Malaysia:** MDEC is the Peppol Authority; Peppol is a *transport option into* MyInvois, not a substitute for LHDN clearance. Every document still needs IRBM validation. Contrast with Singapore, where Peppol *is* the network.

### A1.4 API model, environments, auth

| Environment | Portal | API base |
|---|---|---|
| Production | `myinvois.hasil.gov.my` | `api.myinvois.hasil.gov.my` |
| Sandbox / pre-prod | `preprod.myinvois.hasil.gov.my` | `preprod-api.myinvois.hasil.gov.my` |

Source: https://sdk.myinvois.hasil.gov.my/faq/ **[HIGH]**

- **Auth:** two login modes — **"Login as Taxpayer System"** (own documents) and **"Login as Intermediary System"** (submitting on behalf of clients). **A multi-tenant SaaS must use the intermediary flow**, and each tenant must appoint us as intermediary in MyInvois. **[HIGH]**
- **Tokens:** access tokens expire after **60 minutes**; reuse them. Repeated token generation triggers a **"Login Too Frequent"** error. Separate Client ID/Secret per environment. → Implement a per-tenant token cache with expiry-aware refresh, not per-request auth. **[HIGH]**
- **Rate limiting:** HTTP rate-limit headers are returned; batch submission is recommended over per-document calls. **[HIGH]**
- **Key endpoints:** submit documents (signed, one or many); get document details incl. validation result; **cancel** (issuer-initiated or accepting a rejection); **reject** (buyer-initiated, requests supplier to cancel); search recent documents (**only returns documents issued in the last 31 days** — do not rely on this as a system of record; persist locally). Source: https://sdk.myinvois.hasil.gov.my/einvoicingapi/ **[HIGH]**
- **Format:** UBL 2.1, **XML or JSON**. Documents must be **digitally signed** by the issuer. **[MED]** (BDO, above; digital signature is also a mandatory field in the guideline **[HIGH]**.)

**Validation field limits (build these as input validators):** supplier/buyer name ≤300 chars; email RFC-compliant, ≤320 chars; phone 8–20 chars; address ≤150 chars per line; Malaysian postcode exactly 5 digits; TIN format supports prefixes (e.g. `IG` for individuals). Source: https://sdk.myinvois.hasil.gov.my/faq/ **[HIGH]**

### A1.5 Document types

| Type | Purpose |
|---|---|
| **Invoice** | Commercial transaction record |
| **Credit Note** | Corrections, discounts, returns — reduces value |
| **Debit Note** | Additional charges — increases value |
| **Refund Note** | Confirms monetary refund to buyer |

Each also exists in a **self-billed** variant. Source: guideline v4.7 **[HIGH]**.

> A credit/debit/refund note **must** carry `Original e-Invoice Reference Number`. This is conditional-mandatory and is the single most common integration failure — enforce at the domain level.

### A1.6 Self-billed e-Invoice — when the *buyer* must issue

Buyer issues a self-billed e-Invoice for: (1) payments to agents/dealers/distributors; (2) acquisitions from **foreign suppliers** not on MyInvois; (3) profit distributions/dividends; (4) e-commerce platform transactions; (5) betting & gaming payouts; (6) transactions with individuals not conducting business; (7) interest payments (carve-outs: financial institutions, employee loans, centralised treasury); (8) insurance claims/compensation/benefits; (9) capital reductions, share redemptions, buybacks, liquidation proceeds.
Source: Specific Guideline v4.8 — https://www.hasil.gov.my/wp-content/uploads/IRBM-e-Invoice-Specific-Guideline.pdf **[HIGH]**

**Product implication:** self-billing is *not* an edge case in MY. Any AP module must be able to originate an outbound e-Invoice from a purchase transaction. Model it as a first-class document flow with its own numbering series.

### A1.7 Consolidated e-Invoice

- For B2C where the buyer does not request an e-Invoice, the supplier aggregates receipts **monthly** and submits a consolidated e-Invoice **within 7 calendar days after month end**. **[MED]** (BDO, above.)
- **Consolidation prohibited for:** motor vehicle sales; flight tickets/private charters; construction contracts; licensed betting & gaming payouts (casino and gaming machines temporarily excepted); payments to agents/dealers/distributors; **any single transaction > RM10,000 (from 1 Jan 2026)**; electricity distribution/supply (from 1 Jan 2026); postpaid telecom services and electronic device sales (from 1 Jan 2026). Source: Specific Guideline v4.8 **[HIGH]**
- Scope was extended to **retail** and **construction materials** in the Dec-2025 guideline refresh. **[MED]** (KPMG, above.)

**Product implication:** the RM10,000 rule needs a per-transaction gate in the POS/consolidation path, evaluated at line-of-business level, plus an industry flag on the tenant.

### A1.8 Timing windows — the 72-hour rule (VERIFIED)

Guideline v4.7, verbatim: *"If the e-Invoice is not rejected or cancelled within 72 hours, no cancellation would be allowed."* and *"Any subsequent adjustments would have to be made by issuing a new e-Invoice (e.g., credit note, debit note or refund note e-Invoice)."* The **72 hours runs from the date/time of validation**, and covers both buyer-initiated rejection requests and supplier-initiated cancellation.
Source: https://www.hasil.gov.my/wp-content/uploads/IRBM-e-Invoice-Guideline.pdf **[HIGH]**; corroborated by BDO ("72 hours from the time of e-Invoice validation") **[MED]**.

**Product implication:** store `validated_at` (LHDN's timestamp, not ours) and derive a `cancellable_until = validated_at + 72h`. After expiry, the UI must hard-block cancellation and route the user to a credit note. Rejection by the buyer does **not** itself void the document — it is a *request*; the supplier must then cancel within the same window.

### A1.9 What LHDN returns, and what the supplier must show the buyer

On successful validation IRBM assigns and returns:
- **IRBM Unique Identifier Number (UIN)** — persist it; it is the legal identity of the document
- **Date and time of validation**
- **Validation link** — of the form `{envbaseurl}/{uuid}/share/{longid}`

The supplier must give the buyer **either** the validated e-Invoice document **or** a **visual representation embedding a QR code** derived from the validation link, so the buyer can verify existence and status on the MyInvois Portal.
Sources: guideline v4.7 **[HIGH]**; QR URL pattern from https://sdk.myinvois.hasil.gov.my/faq/ **[HIGH]**

**Minimum persisted set per document:** `uuid`, `long_id`, `uin`, `validated_at`, `validation_link`, `submission_uid`, `status`, plus the submitted payload hash. Note intermediaries can only retrieve documents **they** submitted — they cannot read invoices the taxpayer *received*. **[HIGH]** (SDK FAQ.) That is a real limitation for building a payables inbox.

### A1.10 Mandatory data fields (Appendix 1)

Source for the whole table: https://www.hasil.gov.my/wp-content/uploads/IRBM-e-Invoice-Guideline.pdf **[HIGH]**. M = Mandatory, C = Conditional, O = Optional.

**Parties**

| Field | M/C/O | Notes |
|---|---|---|
| Supplier's Name | M | |
| Buyer's Name | M | |

**Supplier's details**

| Field | M/C/O | Notes |
|---|---|---|
| Supplier's TIN | M | IRBM-assigned |
| Supplier's Registration / Identification / Passport Number | M | BRN for business; MyKad/passport for individual |
| Supplier's SST Registration Number | C | Only if SST-registered |
| Supplier's Tourism Tax Registration Number | C | Only if TTx-registered |
| Supplier's MSIC Code | M | **5-digit** industry classification |
| Supplier's Business Activity Description | M | |
| Supplier's Email | O | |

**Buyer's details**

| Field | M/C/O |
|---|---|
| Buyer's TIN | M |
| Buyer's Registration / Identification / Passport Number | M |
| Buyer's SST Registration Number | C |
| Buyer's Email | O |

**Address / Contact**

| Field | M/C/O |
|---|---|
| Supplier's Address | M |
| Buyer's Address | M |
| Supplier's Contact Number | M |
| Buyer's Contact Number | M |

**Invoice details**

| Field | M/C/O | Notes |
|---|---|---|
| e-Invoice Version | M | |
| e-Invoice Type | M | Invoice / credit note / debit note / refund note |
| e-Invoice Code or Number | M | Supplier's internal reference, e.g. `INV12345` |
| Original e-Invoice Reference Number | C | **Required for CN/DN/RN** |
| e-Invoice Date and Time | M | Must be the current date/time of issuance |
| Issuer's Digital Signature | M | |
| Invoice Currency Code | M | |
| Currency Exchange Rate | C | **Required whenever currency ≠ MYR** |
| Frequency of Billing | O | |
| Billing Period | O | |

**Products / Services**

| Field | M/C/O | Level |
|---|---|---|
| Classification | M | line |
| Description of Product or Service | M | line |
| Unit Price | M | line |
| Tax Type | M | line and/or invoice — sales tax / service tax / tourism tax |
| Tax Rate | C | |
| Tax Amount | M | line and/or invoice |
| Details of Tax Exemption | C | |
| Amount Exempted from Tax | C | |
| Subtotal | M | line, excl. tax/charges/discounts |
| Total Excluding Tax | M | line and invoice |
| Total Including Tax | M | invoice only |
| Total Payable Amount | M | invoice |
| Total Net Amount | O | invoice |
| Rounding Amount | O | |
| Total Taxable Amount Per Tax Type | O | invoice |
| Quantity, Measurement | O | line |
| Discount Rate / Discount Amount | O | line and invoice |
| Fee or Charge Rate / Amount | O | line and invoice |

**Payment info (all Optional)**: Payment Mode; Supplier's Bank Account Number; Payment Terms; Prepayment Amount; Prepayment Date; Prepayment Reference Number; Bill Reference Number.

**Annex (Appendix 2)**: **Reference Number of Customs Form No. 1/9/etc. — Mandatory for imports/exports.** Optional: shipping recipient name/address/TIN/registration no.; Incoterms; product tariff code; FTA information; authorised exporter certification number; country of origin; additional charges.

> **Two fields will cause most onboarding friction:** `MSIC Code` (5-digit, per legal entity, and tenants rarely know theirs) and `Classification` (per line item, from LHDN's classification code list). Build a searchable picker with defaults per industry, and store the MSIC on the tenant record at onboarding.

### A1.11 Cross-border special TINs

| Scenario | Handling |
|---|---|
| Foreign seller → Malaysian buyer | Buyer issues **self-billed** e-Invoice using TIN **`EI00000000030`** (or general TIN plus passport details) |
| Malaysian seller → foreign buyer | Seller issues normal e-Invoice with foreign registration details, or general TIN **`EI00000000020`** if unavailable |

Source: Specific Guideline v4.8 **[HIGH]**. Hardcode these as constants; they are stable and heavily used.

---

## A2. Indirect tax — SST (Sales Tax + Service Tax)

Malaysia has **no VAT/GST**. SST is two separate single-stage taxes with **no input tax credit**. This is the single largest architectural difference from Singapore: an MY ledger must treat SST as a **cost** on purchases and a **liability** on sales, never as a recoverable asset.

### A2.1 Sales Tax (goods, at manufacture/import)

| Rate | Scope (post 1 Jul 2025 expansion) |
|---|---|
| **0%** | Essential staples: rice, books, school supplies, medicines, basic building materials |
| **5%** | Imported fruits; premium seafood (king crab, salmon); essential oils; silk and premium fabrics; antique artwork; racing bicycles |
| **10%** | Default rate for other taxable goods |

~5,000 tariff lines moved from zero-rated into 5% or 10% on **1 July 2025**.
Source: https://www.mondaq.com/sales-taxes-vat-gst/1638642/malaysias-sst-expansion-from-1-july-2025-a-practical-guide-for-businesses **[MED]**

> Sales tax is levied by **tariff code (HS code)**, not by product category name. Any MY sales-tax engine needs an HS-code field on the product master. Do not attempt to infer the rate from a description.

### A2.2 Service Tax — rates and taxable service groups

Standard rate historically **6%**; **8%** applies to a defined subset since 1 Mar 2024, and the 2025 expansion added new groups at both rates.

**Groups added / changed effective 1 July 2025:**

| Service | Rate | Registration threshold |
|---|---|---|
| Construction works | 6% | **RM1,500,000** |
| Rental / leasing of tangible assets & commercial property | 8% | RM500,000 |
| Fee-based financial services (brokerage, underwriting, trade finance) | 8% | RM500,000 |
| Private healthcare, TCM, allied health — **non-Malaysian patients only** | 6% | RM1,500,000 |
| Private education > RM60,000/student/year; tertiary for non-citizens | 6% | **No threshold** |
| Beauty, wellness & aesthetic services | 8% | RM500,000 |

Source: https://www.mondaq.com/sales-taxes-vat-gst/1638642/malaysias-sst-expansion-from-1-july-2025-a-practical-guide-for-businesses **[MED]**

General registration threshold for most service groups is **RM500,000** of taxable services in 12 months. **[MED]**

**Transitional relief (still relevant for FY2026 comparatives and audit trails):**
- **Non-reviewable contracts** signed before 1 Jul 2025 get a **12-month exemption** for construction and rental/leasing.
- Commercial leases to tenants with turnover < RM500,000 exempt from the 8% leasing tax (MSME tenant relief).
- Penalty-free grace period to **31 Dec 2025**; registration applications were due by 31 Aug 2025, charging from 1 Sep 2025.
Source: as above **[MED]**

> **Flag [LOW] — group letters.** The statutory taxable service groups are lettered (Group A Accommodation, B F&B, C Night-clubs, D Private clubs, E Golf, F Betting & gaming, G Professional, H Credit cards, I Other services incl. telecoms/insurance/advertising, J Logistics, K Rental/leasing, L Financial services — numbering after the 2025 expansion). I could not retrieve the current authoritative Group A–L list with thresholds from mysst.customs.gov.my (the return/payment guide PDF 404'd and several pages returned errors). **Verify the group letters and per-group thresholds against the Service Tax Regulations 2018 First Schedule (as amended 2025) before coding the tax-code taxonomy.**

### A2.3 SST filing

| Item | Value |
|---|---|
| Return form | **SST-02** |
| Taxable period | **Every 2 months** (bimonthly) |
| Filing & payment due | **Not later than the last day of the month following the end of the taxable period** |
| Channel | MySST portal (electronic) or post |
| Final return on deregistration | Within **30 days** |

Source: https://mysst.customs.gov.my/filing-text-returns/ **[HIGH]**

Late-payment penalties are tiered (commonly cited as 10% / +15% / +15% across successive 30-day blocks, capped at 40%) — **[LOW]**, the MySST penalties page was not retrievable; verify.

**Ledger design:** SST liability accrues on the **invoice date** for service tax by default (with a payment-basis option for some groups) — confirm basis per group. Provide a `sst_taxable_period` dimension (2-month buckets, tenant-specific start month, since Customs assigns period cycles at registration).

---

## A3. Statutory accounts & GAAP (Malaysia)

### A3.1 MFRS vs MPERS

| Framework | Who uses it |
|---|---|
| **MFRS** (word-for-word IFRS) | Entities with public accountability: listed companies, entities regulated by Securities Commission or Bank Negara, and their subsidiaries/associates/JVs. Also available by choice to any private entity. |
| **MPERS** (based on IFRS for SMEs) | **Private entities**: private companies under Companies Act 2016 that (a) are not required to prepare/lodge FS under SC or BNM law, and (b) are not a subsidiary, associate or JV of such an entity. Management companies under the Interest Schemes Act 2016 are excluded. |

Source: https://www.masb.org.my/pages.php?id=20 **[HIGH]**

**Timing that matters for a 2026–2027 product roadmap:**
- **MPERS (2016)** applies to annual periods beginning on/after 1 Jan 2016.
- **MPERS (2025)**, aligned to the **third edition of IFRS for SMEs**, was issued by MASB in **October 2025** and applies to annual periods beginning on or after **1 January 2027** (early adoption permitted).
- **MPERS (2016) is withdrawn** for periods beginning on/after 1 Jan 2027.
Source: https://www.masb.org.my/pages.php?id=20 **[HIGH]**

> **Product implication:** a `reporting_framework` enum of `MFRS | MPERS_2016 | MPERS_2025` is required, effective-dated, because FY2026 and FY2027 statements for the same tenant may sit on different bases. Presentation/disclosure templates and the MBRS taxonomy mapping both branch on it.

**Software-relevant MPERS vs MFRS differences:** MPERS has no MFRS 9 expected-credit-loss model (incurred-loss instead), no MFRS 16 lessee right-of-use capitalisation for most leases (operating/finance split retained), amortisation of goodwill (vs impairment-only), a cost model for investment property where fair value is not readily determinable, and vastly reduced disclosure. Practically: the **lease module and the receivables-provisioning module must be framework-aware**. **[MED]** — https://www.gskassociates.net/post/key-differences-between-mpers-ifrs-for-smes-and-mfrs

### A3.2 Companies Act 2016 filing and MBRS

- **MBRS 2.0** is SSM's XBRL filing platform; full implementation deadline **1 June 2025**. **[MED]** — https://www.crowe.com/my/insights/malaysian-business-reporting-system-mbrs-2-is-your-organisation-ready
- Scope: **all companies including foreign companies registered in Malaysia**; extended on **26 Nov 2024** to banking, financial institutions and insurers regulated by BNM (previously excepted).
- Filings covered: **Financial Statements (FS)**, **Annual Return (AR)**, **Exemption Applications (EA)** relating to FS and AR.
- Taxonomy basis: **MFRS, MPERS, and Companies Act 2016** — i.e. separate taxonomy branches per framework. **[MED]**
- SSM overview PDF: https://www.ssm.com.my/Pages/Publication/PDF%20Files/AD%202024%20-%20Overview%20of%20MBRS%20v2.pdf **[HIGH — not fetched, cited for verification]**

> **Flag [MED]:** I could not confirm the exact current MBRS taxonomy version string. Confirm from SSM before building the export.

Companies Act 2016 statutory deadlines (standard, **[MED]**): AGM for public companies within 6 months of FYE; FS circulated to members within 6 months of FYE (private) / laid at AGM (public); FS lodged with SSM within **30 days** of circulation (private) or of the AGM (public); Annual Return within **30 days** of the company's anniversary of incorporation.

### A3.3 Audit exemption — SSM Practice Directive 10/2024

Applies to financial statements for **annual periods commencing on or after 1 January 2025**; supersedes PD 3/2017.
Source: https://www.ssm.com.my/Pages/Legal_Framework/Document/PD10-2024-Qualifying-Criteria-for-Audit-Exemption-for-Certain-Categories-of-Private-Companies.pdf **[HIGH]**

| Phase | FY commencing on/after | Turnover ≤ | Total assets ≤ | Employees ≤ |
|---|---|---|---|---|
| 1 | 1 Jan 2025 | RM1,000,000 | RM1,000,000 | 10 |
| 2 | 1 Jan 2026 | RM2,000,000 | RM2,000,000 | 20 |
| 3 | 1 Jan 2027 | RM3,000,000 | RM3,000,000 | 30 |

Test: meet **at least two of three** criteria, and the thresholds must not be exceeded **in the immediate past two financial years** for the corresponding phase. Dormant companies (no business, no accounting transaction) are exempt regardless of thresholds. Zero-revenue companies form a separate eligible category. **[HIGH]**

> **Product implication:** this is a *rolling three-year window with escalating thresholds*. The eligibility check must evaluate the threshold applicable to the FY in question, against the two prior years' actuals — not a single current-year test.

---

## A4. Withholding tax & payroll touchpoints (Malaysia)

### A4.1 Withholding tax on payments to non-residents

| Payment type | ITA section | Rate | Form |
|---|---|---|---|
| Contract payment (services) — non-resident contractor | 107A(1)(a) & (1)(b) | **10% + 3%** (10% on contractor's tax account, 3% on employees') | CP37A |
| Interest | 109 | **15%** | CP37 |
| Royalty | 109 | **10%** | CP37 |
| Special classes of income (s4A: technical advice/assistance, installation services, rent of movable property) | 109B | **10%** | CP37D |
| Interest paid by approved financial institutions | 109C | **5%** | CP37C |
| Non-resident public entertainer | 109A | **15%** | (Assessment Branch) |

Source: https://relinconsultants.com/malaysia-withholding-tax/ **[MED]**; LHDN landing: https://www.hasil.gov.my/en/legislation/withholding-tax/ **[HIGH — index only]**

- **Remittance deadline: within one month of the date of payment/crediting to the non-resident.** **[MED]**
- **Late penalty: 10%** of the unpaid WHT. Additionally, **the underlying expense is disallowed for corporate tax** until the WHT plus penalty is paid — this is the commercially significant consequence and worth surfacing in-product. **[MED]**
- Note s109F (5% on other s4(f) gains/income) exists and is commonly missed. **[LOW]** — not confirmed in fetched sources.

**Journals a ledger must post (WHT on a RM100,000 royalty at 10%):**
```
Dr Royalty expense              100,000
    Cr Accounts payable — vendor          90,000
    Cr WHT payable — LHDN (s109)          10,000
```
then on remittance: `Dr WHT payable 10,000 / Cr Bank 10,000`. The AP module must support **gross-up** where the contract is net-of-tax (common), i.e. compute the grossed-up base so the vendor receives the invoiced amount.

### A4.2 CP58

**Form CP58** — *Statement of Monetary and Non-Monetary Incentive Payment to an Agent, Dealer or Distributor*. Payer companies must prepare and furnish CP58 to each agent/dealer/distributor where incentives in a calendar year exceed **RM5,000**, by **31 March** of the following year. Sources: https://www.crowe.com/my/news/ensuring-compliance-with-irbm-requirements-for-payments-to-agents-dealers-and-distributors **[MED]**; https://staccount.com/what-is-cp58-statement-of-monetary-and-non-monetary-incentive-payment-to-agent-dealer-or-distributor/ **[MED]**

> **Interaction with e-Invoicing:** payments to agents/dealers/distributors require a **self-billed e-Invoice** *and* still require CP58. The two are not substitutes. https://jomeinvoice.my/article/cp58-guide-self-billed-income/ **[LOW]**

**Product implication:** tag vendor master records with an `is_agent_dealer_distributor` flag; accumulate monetary and **non-monetary** (e.g. trips, goods) incentives per calendar year per payee; emit a CP58 dataset. Non-monetary incentives will not exist as ledger entries unless explicitly captured — provide a memo-transaction type.

### A4.3 Payroll statutory — what the ledger must carry

Rates below are 2026 figures **[MED]** — https://www.ajobthing.com/resources/blog/epf-socso-eis-contribution-2026-latest-rates-rules-employer-guide-malaysia

| Scheme | Employer | Employee | Ceiling / notes |
|---|---|---|---|
| **EPF (KWSP)** — Malaysians < 60 | 13% (wage ≤ RM5,000) / 12% (> RM5,000) | 11% | Must use the **Third Schedule contribution table**, not a raw percentage, except above RM20,000 |
| EPF — foreign workers | 2% | 2% | Effective October 2025 |
| **SOCSO (PERKESO)** — Malaysian/PR < 60 | 1.75% | 0.5% | Wage ceiling **RM6,000/month** (from Oct 2024) |
| SOCSO — age 60+ / foreign workers | 1.25% | 0% | |
| **EIS (SIP)** — ages 18–60 | 0.2% | 0.2% | Wage ceiling **RM6,000/month** |
| **PCB / MTD** | — | monthly income tax deduction | Remitted by employer |

**Payment deadline: 15th of the following month** for EPF, SOCSO and EIS. **[MED]** PCB is also due by the 15th. **[LOW]**

**Journals required (summary level, per payroll run):**
```
Dr Salaries & wages expense           (gross)
Dr EPF employer contribution expense
Dr SOCSO employer contribution expense
Dr EIS employer contribution expense
    Cr EPF payable            (employer + employee portions)
    Cr SOCSO payable          (employer + employee)
    Cr EIS payable            (employer + employee)
    Cr PCB payable            (employee)
    Cr Net salaries payable / Bank
```
Four separate statutory payable accounts, each cleared by a distinct remittance to a distinct body on the same date. Provide a payroll-journal import contract with these five credit legs; do not attempt payroll calculation in the ledger.

> **Note:** EPF's Third Schedule is a *lookup table with wage bands*, not a formula. If we ever compute rather than import, this table must be shipped and versioned.

---

## A5. Numbering, retention, residency, language, FX (Malaysia)

### A5.1 Invoice numbering

- No statutory requirement for a single unbroken national sequence, but ITA s82 requires businesses above specified thresholds to issue **serially numbered** printed receipts — a requirement that **may be waived where e-Invoices are used**. Source: https://ccs-co.com/post/evolution-of-record-keeping-amendments-to-section-82/ **[MED]**
- MyInvois: the `e-Invoice Code / Number` is the supplier's own internal reference and must be **unique per supplier**. Multiple series (per branch, per document type, per year) are acceptable provided uniqueness holds. During the relaxation period any reference may be used. **[MED]**

**Design:** per-tenant, per-document-type, per-branch numbering series with configurable prefix/reset policy; enforce uniqueness at `(tenant, e_invoice_code)`.

### A5.2 Retention and residency — the important one

- **Retention: 7 years** from the end of the year of assessment. ITA s82: keep and retain in safe custody sufficient records for seven years. **[MED]**
- **Residency: "All records that relate to any business in Malaysia shall be kept and retained in Malaysia."** (ITA s82A). Source: https://ccs-co.com/post/evolution-of-record-keeping-amendments-to-section-82/ **[MED]**
- Entries must be made **within 60 days** of each transaction. **[MED]**
- Electronic records must be retained in **electronically readable form**, "readily accessible and convertible into writing". **[MED]**

> **This is a material product constraint.** A multi-tenant SaaS hosting Malaysian tenants' books offshore is in tension with s82A. The market practice is to run an in-Malaysia data region or to maintain a Malaysian-resident readable copy/export. **Recommendation: provision a Malaysian region (or a documented in-country replica + export capability) for MY tenants, and make this an explicit compliance feature.** Verify with Malaysian tax counsel — LHDN's practical enforcement posture on cloud storage is not documented in the sources retrieved. **[Flagged: uncertain]**

- **Personal data (separate regime):** PDP(A)A 2024 phased in Jan–Jun 2025. The **whitelist approach to cross-border transfers was abolished**, replaced by a risk-based test — transfer is lawful where the destination has laws **"substantially similar"** to the PDPA or ensures an **"adequate level of protection"**. Controllers must run a **Transfer Impact Assessment (valid 3 years)**. **DPO appointment mandatory** for controllers *and processors* from June 2025. **Breach notification** to the Commissioner required from June 2025. Penalties raised from RM300k to **RM1,000,000** and imprisonment from 2 to 3 years. Source: https://www.mayerbrown.com/en/insights/publications/2025/07/from-legislative-reform-to-practical-guidance-key-amendments-to-malaysias-pdpa-and-the-launch-of-cross-border-transfer-guidelines **[MED]**
  → As a **data processor** we now have direct criminal exposure for security failures. DPA templates, a named DPO, and a TIA pack are table stakes for MY.

### A5.3 Language and currency

- Permitted languages: **Bahasa Malaysia or English**. **[LOW]** — not confirmed in retrieved primary sources; assume both, default English.
- Any currency permitted on the e-Invoice; `Invoice Currency Code` is mandatory. **[HIGH]**

### A5.4 FX translation for tax purposes

- `Currency Exchange Rate` is **conditional-mandatory whenever the invoice currency is not MYR**. **[HIGH]** (Guideline v4.7 Appendix 1.)
- Effective **31 March 2026**, the field is enforced: foreign-currency e-Invoices with missing or incorrect exchange-rate data are **rejected by IRBM**. **[MED]** — BDO, above.
- Acceptable rate sources: **Bank Negara Malaysia** reference rate is the primary approved source; Bloomberg and similar are also cited. **[MED]**
- Rate to apply: **the rate on the invoice date** — daily rates per invoice, not a period average. **[LOW]** — https://einvoice.advintek.com.my/what-are-lhdns-foreign-currency-exchange-rate-rules-for-malaysia-e-invoicing/
- The applied rate must be **documented and retained with the invoice record**. **[LOW]**
- Customs issued separate guidance in April 2026 on FX rates for **service and sales tax invoices** — https://www.vatupdate.com/2026/04/17/malaysia-issues-guidance-on-foreign-currency-exchange-rates-for-service-and-sales-tax-invoices/ **[LOW — not fetched; verify, as the SST rate source may differ from the e-Invoice one]**

**Design:** a pluggable FX rate provider with **BNM as the MY default**, daily granularity, rate stored **immutably on the document** (never re-derived), and a `rate_source` audit field.

---

## A6. Chart of accounts conventions (Malaysia)

- **There is no statutory prescribed COA.** Companies Act 2016 and MFRS/MPERS prescribe *presentation*, not account codes. **[MED]**
- The binding constraint is the **MBRS taxonomy**: every account must map to an SSM MBRS element for XBRL filing. In practice Malaysian firms design the COA backwards from MBRS/MFRS-101 line items. **[MED]** — https://www.ssm.com.my/Pages/Register_Business_Company_LLP/Company/document/FAQs_Malaysian_Business_Reporting_System_MBRS.pdf
- Dominant convention is the **4-digit block** inherited from the incumbent desktop products (UBS, SQL, AutoCount):

| Range | Class |
|---|---|
| 1000–1999 | Assets (1000s non-current, 1100–1900 current) |
| 2000–2999 | Liabilities |
| 3000–3999 | Equity |
| 4000–4999 | Revenue / Sales |
| 5000–5999 | Cost of sales |
| 6000–6999 | Expenses (often further split: 6000 admin, 7000 selling, 8000 finance) |
| 9000–9999 | Suspense / taxation / other |

**[LOW]** — convention, not regulation; corroborated informally across vendor documentation (https://www.hashmicro.com/my/blog/chart-of-account/).

**What Malaysian accountants and audit firms expect in the product:**
1. A **default MFRS COA and a default MPERS COA**, both pre-mapped to MBRS tags.
2. Explicit **SST control accounts** — separate *Sales Tax Payable*, *Service Tax Payable* (and by group, since service tax rates differ), and **SST on purchases posted to expense/COGS, not to a recoverable asset**.
3. Separate statutory payables: EPF, SOCSO, EIS, PCB, WHT (by section).
4. A **"Deemed" / consolidated e-Invoice** revenue split so B2C aggregate revenue reconciles to the monthly consolidated submission.
5. Trial balance exportable in a **tax-computation-ready** layout (LHDN Form C adjustments), since audit firms do the tax comp externally.

---

## A7. Integrations that matter commercially (Malaysia)

### Payment rails
- **PayNet (Payments Network Malaysia)** operates the national rails: **DuitNow** (instant credit transfer, proxy-addressed via mobile/NRIC/business registration no.), **DuitNow QR** (national QR standard, interoperable across banks and e-wallets), **DuitNow Request** (request-to-pay — directly relevant to AR collections), and **FPX** (online banking debit, the dominant e-commerce/B2B online payment method). https://en.wikipedia.org/wiki/Payments_Network_Malaysia **[MED]**
- **DuitNow Request** appears as distinct bank-statement entries — build a matching rule for it. https://connect-content.us.hsbc.com/hsbc_pcm/onetime/2021/April/21_my_duitnow_request_stmt.html **[MED]**
- **RENTAS** for high-value RTGS.

### Banking data
- **Open banking is BNM/PayNet-framework-driven and still maturing** — there is no mandated, universal open-banking API standard comparable to UK/EU. https://www.fiskil.com/open-finance-tracker/malaysia **[MED]**
- Practical bank feed strategy: **file-based first**. MT940 and increasingly **ISO 20022 camt.053** from the corporate banking portals of Maybank, CIMB, Public Bank, RHB, Hong Leong; CSV/Excel exports for SME accounts. Direct APIs exist at the corporate tier (Maybank, CIMB) but are onboarding-heavy.
- **Recommendation: ship camt.053 + MT940 + a per-bank CSV mapper before attempting APIs.**

### Incumbent accounting products (= migration sources)
**SQL Account**, **AutoCount**, **UBS (Sage UBS)** dominate the SME desktop market; **Financio** (by AutoCount) and **QNE** in cloud; **Xero** and **QuickBooks** have modest share; **Million**, **MYOB**. Enterprise: SAP, Microsoft Dynamics. https://www.airwallex.com/en-my/blog/best-accounting-software-malaysia **[MED]**, https://accounting.my/accounting/top-10-accounting-software-in-malaysia/ **[MED]**

> Migration priority: **SQL Account and AutoCount**. Both are SQL-Server/Firebird-backed desktop products with documented export formats; both already emit MyInvois-ready payloads, so field-level parity is expected by the market.

---
---

# PART B — SINGAPORE

## B1. E-invoicing (InvoiceNow / Peppol / IRAS)

### B1.1 Architecture — fundamentally different from Malaysia

Singapore uses the **Peppol 4-corner network extended to 5 corners**, with IRAS as **Corner 5 (C5)**:

```
C1 Supplier → C2 Sender's Access Point → C3 Recipient's Access Point → C4 Buyer
                                              ↓
                                        C5 IRAS System
```

Critically: **"transmission of the invoice document to IRAS should only happen after the invoice document is successfully sent to the recipient's Access Point."** There is **no clearance model** — IRAS receives a copy for reporting, it does not validate or authorise the invoice. Nothing is returned to the buyer; there is no UIN, no QR code, no rejection window.
Source: IMDA TX1 Design Document v1.1 (effective 15 May 2024) — https://www.imda.gov.sg/-/media/imda/files/programme/nationwide-e-invoicing-framework/invoicenow-technical-playbook/tx1---design-document-release.pdf **[HIGH]**

**Standard:** Peppol **PINT** (Peppol International) data structure, OASIS **UBL 2.1**, with a Singapore-localised specification (**PINT SG**). IMDA is the Singapore Peppol Authority. **[HIGH]**

### B1.2 Mandate status and phase table

| Date | Who | Nature |
|---|---|---|
| **1 May 2025** | All existing GST-registered businesses | **Voluntary** soft launch for early adoption |
| **1 Nov 2025** | Newly incorporated companies that register for GST **voluntarily** (incorporated within 6 months of the GST registration application) | **Mandatory** |
| **1 Apr 2026** | **All new voluntary GST registrants**, regardless of incorporation date | **Mandatory** |
| **1 Apr 2028** | New **compulsory** GST registrants + existing businesses with annual supplies up to **S$200,000** | Mandatory |
| **1 Apr 2029** | Existing GST-registered businesses, annual supplies up to **S$1,000,000** | Mandatory |
| **1 Apr 2030** | Existing GST-registered businesses, annual supplies up to **S$4,000,000** | Mandatory |
| **1 Apr 2031** | Existing GST-registered businesses, annual supplies **above S$4,000,000** | Mandatory |

Sources: EY tax alert (2025–2026 phases) — https://www.ey.com/en_gl/technical/tax-alerts/singapore-revenue-authority-announces-gst-invoicenow-requirement **[MED]**; Budget/COS 2026 extension to April 2031 — https://www.iras.gov.sg/news-events/newsroom/committee-of-supply-2026--extension-of-gst-invoicenow-requirement-to-all-gst-registered-businesses-by-april-2031 **[HIGH — page title/date confirmed; body JS-rendered]**; phase table detail — https://www.hawksford.com/insights-and-guides/gst-registration-einvoicing-singapore **[MED]**

**As of Aug 2026 the live obligation is: all new voluntary GST registrants (since 1 Apr 2026).** Everything else is voluntary. IRAS committed to **notifying businesses registered before 2026 of their mandatory date by mid-2026**, and publishes a **GST InvoiceNow Implementation Date Calculator**. https://www.vatupdate.com/2026/06/20/gst-invoicenow-requirement-and-mandatory-implementation-date/ **[MED]**

> **Note the turnover bands run smallest-first** — the opposite of Malaysia. The smallest businesses are mandated in 2028–2029 and the largest last, in 2031. Product sequencing should not assume MY's large-first pattern.

### B1.3 Scope of transmission

**In scope (must be transmitted to IRAS):**
- Standard-rated supplies (excluding reverse-charge)
- Zero-rated supplies
- Standard-rated purchases on which input tax is claimed (excluding reverse-charge)

Point-of-sale sales and petty-cash purchases may be **aggregated** before transmission (data flow types C and F; customer/supplier default to `"B2C"` and `"PCP"` respectively rather than real identifiers).

**Out of scope / exempt entities:**
- Businesses operating **solely under the Reverse Charge regime**
- **Overseas entities** and OVR-registered vendors (pay-only and full)

Sources: EY, above **[MED]**; IMDA TX1 **[HIGH]**; Hawksford **[MED]**

**Timing:** invoice data must reach IRAS by the **earlier of the GST return filing date or the filing due date**. **[MED]** (EY.) So the transmission deadline is derived from the GST accounting period, not from the invoice date — but per TX1, transmission is expected to follow shortly after the document reaches C3.

### B1.4 IRAS C5 API — implementation detail

Source for this whole section: **IRAS API Services Interface Specification (invoice data submission)** — https://file.go.gov.sg/apex-invoice-data-sub.pdf **[HIGH]**

| Item | Value |
|---|---|
| Sandbox base | `https://public.api.gov.sg/iras/sbx/gst/einvoicing/` |
| Production base | `https://public.api.gov.sg/iras/gst/einvoicing/` |
| Submit single | `POST /v1/submit` |
| Submit bulk | `POST /v1/bulksubmit` |
| Check status | `GET /v1/status` |
| Auth | **API key** in header `KeyId` (GUID). Issued to the **Access Point**, not to the taxpayer. Must not be shared. |
| Content-Type | `application/xml; charset=utf-8` |
| Transport | **TLS 1.2** minimum |
| Max payload | **10 MB** (502 typically indicates the limit was exceeded) |
| Bulk limit | **10 documents per transmission** |
| Status polling | Wait **≥15 minutes** after a bulk submission before querying status |

**Payload:** OASIS UBL 2.1 wrapped in a **Standard Business Document Header (SBDH)**. SBDH elements: `Sender`/`Receiver` `Identifier` with `Authority="iso6523-actoridupis"`; `DocumentIdentification` (`Standard`, `TypeVersion`, `InstanceIdentifier`, `Type`, `CreationDateAndTime`). Invoice/CreditNote root elements: `CustomizationID`, `ProfileID`, `ID`, `UUID`, `IssueDate`, `DocumentCurrencyCode`, plus supplier/customer party details, tax totals, line items, monetary totals.

**Two UUIDs to persist (do not conflate):**
- `documentUUID` — uniquely identifies the invoice/credit note document
- `transmissionId` — identifies the submission to IRAS

**Response fields:** `code`, `success` (bool), `senderId` (Peppol ID), `transmissionId`, `documentUUID`, `message`, `correlationID` (GUID for support tickets — log it), `received` (count), `errorCode` (e.g. `XSD_SCHEMA_ERROR`, `IRASC5-005`), `errors[]` `{id, description}`.

| HTTP | Meaning | Handling |
|---|---|---|
| 200 | OK / record found | — |
| 400 | Malformed XML or validation error | Do not retry; fix payload |
| 401 | Invalid/missing API key | Alert, do not retry |
| 500 | Server error | **Retry with backoff** |
| 502 | Gateway error — payload may exceed 10 MB | Split batch |
| 503 / 504 | Unavailable / timeout | Retry with backoff |

**Sandbox behaviour differs from production in a way that matters for testing:** sandbox **aggregates all validation errors**, production **returns only the first error**. Write integration tests against sandbox, but do not assume production will enumerate every problem. **[HIGH]**

**Document types transmitted:** Invoice and Credit Note (plus aggregated sales/purchase records). Notably **no debit note, no refund note, no self-billed clearance concept** — Singapore has none of Malaysia's document-type zoo. Self-billing exists as a Peppol/GST arrangement but is not a distinct IRAS transmission type. **[HIGH]** (TX1.)

**Peppol Access Point role:** we either become an accredited AP (IMDA Access Point Services spec: https://www.imda.gov.sg/-/media/imda/files/programme/nationwide-e-invoicing-framework/invoicenow-technical-playbook/tx3---access-point-services-release.pdf **[HIGH — cited, not fetched]**) or partner with one. Note the IRAS API key is **issued to the AP**, which means as a SaaS we need either AP accreditation or an AP partner willing to relay — this is a strategic build/buy decision.

### B1.5 What the buyer receives

The invoice itself, over Peppol, in machine-readable form. **No clearance artefact, no QR, no UIN, no cancellation window.** Corrections are made by credit note in the ordinary way. This is a far simpler product surface than Malaysia's.

---

## B2. Indirect tax — GST

### B2.1 Rate and registration

| Item | Value |
|---|---|
| **Standard rate** | **9%** from **1 January 2024** (8% in 2023, 7% before 2023) |
| Zero-rated | Exports of goods, international services |
| Exempt | Sale/lease of residential property, most financial services, investment precious metals, digital payment tokens |
| **Compulsory registration threshold** | **S$1,000,000** taxable turnover |
| Retrospective test | Turnover exceeded S$1m in the **past calendar year** |
| Prospective test | Reasonably expect to exceed S$1m in the **next 12 months** |
| Application deadline | Within **30 days** of liability arising |
| Voluntary registration | Permitted below S$1m; **minimum 2-year commitment**; from 1 Apr 2026 also triggers the InvoiceNow mandate |

Source: https://hellobooks.ai/sg/gst **[MED]**; IRAS index: https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/gst-registration-deregistration/do-i-need-to-register-for-gst **[HIGH — index only, body JS-rendered]**

> **Note the single-threshold, calendar-year design.** Unlike MY's per-service-group thresholds, SG has one number. Registration monitoring is a simple rolling calculation — build it as an in-product alert; it is a genuinely valuable feature for SG SMEs.

### B2.2 Reverse charge and OVR

- **Reverse charge**: applies to GST-registered businesses that **cannot fully recover input tax** (partially exempt or non-business activities). Covers **imported services from 1 Jan 2020** and **low-value imported goods from 1 Jan 2023**. The recipient accounts for output GST as if it were the supplier, and claims input GST subject to its recovery position. **[MED]**
- **Overseas Vendor Registration (OVR)**: overseas suppliers of digital services to Singapore consumers must register and charge 9%. Scope expanded from **1 Jan 2023** to **low-value goods (≤S$400 imported by air/post)** and **non-digital remote services**. **[MED]**
- IRAS e-Tax Guide on LVG/OVR: https://www.iras.gov.sg/media/docs/default-source/e-tax/gst-e-tax-guide_taxing-imported-low-value-goods-by-way-of-the-overseas-vendor-registration-regime_(1st-ed).pdf **[HIGH — cited]**
- IRAS overseas-business page: https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/gst-and-digital-economy/overseas-businesses **[HIGH — index]**

**Ledger implication:** reverse charge requires posting **both** an output-tax liability and an input-tax claim from a *purchase* document, with the claimable proportion driven by the tenant's recovery rate. That means a `reverse_charge` tax code that generates two tax lines from one transaction, plus a partial-exemption apportionment engine. This is the hardest part of an SG GST implementation.

### B2.3 GST F5 — box map to ledger accounts

**Verified box list [MED]**, from https://www.pwco.com.sg/guides/gst-f5/. **⚠️ That source says "standard 7% rated supplies" in Box 1 — that is stale; the rate is 9%. The box *structure* is correct; the rate is not.** IRAS's own page is JS-rendered: https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/filing-gst/completing-gst-returns

| Box | Label / contents | Ledger source |
|---|---|---|
| **1** | Total value of **standard-rated supplies** (excl. GST) | Revenue accounts tagged SR |
| **2** | Total value of **zero-rated supplies** | Revenue tagged ZR (exports, international services) |
| **3** | Total value of **exempt supplies** | Revenue tagged EX |
| **4** | **Total supplies** = Box 1 + 2 + 3 | Computed |
| **5** | Total value of **taxable purchases** (excl. GST) | Expense/asset accounts tagged TX/IM |
| **6** | **Output tax due** (net of credit/debit notes) | GST Output Tax control account (credit) |
| **7** | **Input tax and refunds claimed** | GST Input Tax control account (debit) |
| **8** | **Net GST payable / (refundable)** = Box 6 − Box 7 | Computed → GST Control |
| **9** | Total value of goods imported under **MES / 3PL / other approved schemes** | Import register |
| **10** | GST refunds claimed for **tourist purchases** | TRS module |
| **11** | **Bad debt relief** claimed | Bad debt relief journal |
| **12** | Pre-registration input tax (first GST return) | One-off |
| **13** | **Total revenue** | P&L revenue |
| **14** | **Imported services subject to Reverse Charge** (from 1 Jan 2020) | RC tax code |
| **15** | **Digital services by electronic marketplace operators** (from 1 Jan 2020) | Marketplace operator only |

Boxes beyond 15 exist for **Import GST Deferment Scheme (IGDS)** filers (deferred import GST, etc.) — **[LOW]**, not enumerated in retrieved sources; verify against the current F5/F7 form before building.

**Design:** two GST control accounts (Output Tax Payable, Input Tax Receivable) plus a GST Control/Clearing account that Box 8 posts to on filing. Every tax code must carry a `f5_box` attribute so the return is a pure aggregation over tagged transactions, not a bespoke report.

### B2.4 Filing

| Item | Value |
|---|---|
| Default frequency | **Quarterly** (4 accounting periods/year); monthly and (rarely) biannual available on application |
| Due date | **Within one month of the end of the accounting period** |
| Channel | **myTax Portal** e-filing (also available via IRAS API for software vendors) |
| Late filing penalty | **S$200** immediately, S$200 per month thereafter (capped) |
| Currency | Return values in **SGD** |

Source: https://www.pwco.com.sg/guides/gst-f5/ **[MED]**; https://hellobooks.ai/sg/gst **[MED]**

> **Quarterly ≠ calendar quarter.** IRAS assigns each registrant one of three quarterly cycles (Mar/Jun/Sep/Dec, Jan/Apr/Jul/Oct, Feb/May/Aug/Nov). Store the tenant's assigned cycle; do not assume calendar quarters.

### B2.5 Schemes worth supporting

| Scheme | What it does | Why it matters to the ledger |
|---|---|---|
| **Major Exporter Scheme (MES)** | **Suspends import GST** at point of import for import-heavy exporters (broadly: zero-rated supplies > 50% of total supplies, **or** imports > S$10m in 12 months) | Imports post with **no input tax** — a distinct tax code; value flows to **Box 9** |
| **Import GST Deferment Scheme (IGDS)** | Defers import GST to the GST return instead of paying at import | Additional F5 boxes; changes cash timing |
| **Tourist Refund Scheme (TRS)** | Refunds to departing tourists | **Box 10** |
| **Approved Third Party Logistics (3PL)** | GST suspension for logistics operators | **Box 9** |
| **Gross Margin Scheme** | GST on margin only for second-hand goods | Margin-basis tax code |
| **Customer Accounting** | For prescribed goods (mobile phones, memory cards, off-the-shelf software) above S$10,000 — GST accounted for by the **customer** | Special tax code on both sides |

Sources: IRAS MES page https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/general-gst-schemes/major-exporter-scheme-(mes) **[HIGH — index]**; IRAS MES e-Tax Guide (17th ed.) https://www.iras.gov.sg/docs/default-source/e-tax/etaxguide_gst_gst-major-exporter-scheme.pdf **[HIGH — cited]**; MES criteria detail **[LOW]** — https://www.excellencesg.com/major-exporter-scheme-mes-2025-definitive-guide-for-cash-flow-hungry-exporters/. **Verify the >50% / S$10m tests against the e-Tax Guide.**

> **Customer Accounting is a frequently-missed requirement** and a good differentiator: it needs a value threshold check (S$10,000) plus a prescribed-goods flag on the item master.

---

## B3. Statutory accounts & GAAP (Singapore)

### B3.1 SFRS vs SFRS for Small Entities

| Framework | Who |
|---|---|
| **SFRS(I)** | Singapore-incorporated companies with **public accountability** (listed, or holding assets in a fiduciary capacity) — identical to full IFRS |
| **SFRS** | Legacy full framework, substantially IFRS-converged, for non-publicly-accountable entities |
| **SFRS for Small Entities** | Based on **IFRS for SMEs**. Eligibility: not publicly accountable, publishes general-purpose FS, and meets **2 of 3**: total revenue ≤ S$10m, total assets ≤ S$10m, ≤ 50 employees |
| **SFRS(I) / SFRS (Reduced Disclosure Requirements)** | New selectable option, added in **BizFinx v4.0 (Feb 2026)** |

**[MED]** — the RDR option is confirmed by https://www.allenandgledhill.com/sg/publication/articles/32618/acra-releases-version-40-of-bizfinx-preparation-tool-and-multi-upload-tool. The SFRS for SE eligibility thresholds align with the small-company audit-exemption test (below) **[MED]**.

> Note the SG small-entity thresholds (S$10m/S$10m/50) are the **same numbers** as the audit exemption test — convenient, and worth exposing as one derived `is_small_entity` flag.

### B3.2 ACRA XBRL filing

| Template | ~Elements | Who |
|---|---|---|
| **Full XBRL** | ~210 | Listed companies and larger non-listed entities — the default |
| **Simplified XBRL** | ~120 | **"Smaller companies"** |
| **XBRL FSH (Banks)** | ~80 | MAS-regulated banks |
| **XBRL FSH (Insurance)** | ~80 | Licensed insurers |

Sources: https://www.corporateservices.com/singapore/xbrl-filing-in-singapore/ **[MED]**; https://datatracks.com/sg/blog/xbrl-filing-in-singapore-the-complete-2026-guide/ **[MED]**

> **⚠️ CONFLICT — resolve before coding the template selector.** Two incompatible definitions of "smaller company" for **Simplified XBRL** appear in the sources:
> - **(a) revenue AND total assets each ≤ S$500,000** for the current FY — https://www.wealthbridgecs.com/sg-guide/full-or-simplified-xbrl-which-one-to-submit **[MED]**
> - **(b) the Companies Act small-company test** (2 of 3: revenue ≤ S$10m / assets ≤ S$10m / ≤50 employees) and not publicly accountable — https://datatracks.com/sg/blog/xbrl-filing-in-singapore-the-complete-2026-guide/ **[MED]**
>
> **My assessment: (a) is correct.** ACRA's published rule for Simplified XBRL uses the **S$500,000 revenue *and* S$500,000 total assets** test, which is a much narrower gate than the audit-exemption test; (b) appears to be a conflation of the two regimes, a very common error in secondary sources. **Confirm against ACRA's "Who needs to file financial statements in XBRL" page before release.**

**Exempt from XBRL (PDF-only filing):**
- **Solvent Exempt Private Companies (EPCs)**
- Dormant EPCs / dormant companies under s201A
- Companies limited by guarantee
- Foreign company branches in Singapore
- Entities not preparing FS under SFRS

**[MED]** — corporateservices.com and datatracks, above.

**Tooling:** **BizFinx Preparation Tool v4.0** and **Multi-Upload Tool v4.0**, released **25 February 2026**, **mandatory transition by 15 April 2026**. Changes in v4.0: support for **FRS 117** (insurance contracts); new **SFRS (Reduced Disclosure Requirements)** selection; a new **`AdditionalInformation` tab**; and reclassification of certain validation rules from "genuine error" to "possible error" so filers can proceed after self-verification instead of requesting an exemption.
Source: https://www.allenandgledhill.com/sg/publication/articles/32618/acra-releases-version-40-of-bizfinx-preparation-tool-and-multi-upload-tool **[MED]**; ACRA announcement: https://www.acra.gov.sg/xbrl-filing-and-resources/updated-bizfinx-prepration-tool-and-multi-upload-tool-are-now-available **[HIGH — cited]**

> **Flag [MED]: the ACRA Taxonomy *version string* could not be confirmed.** ACRA's own taxonomy page (https://www.acra.gov.sg/how-to-guides/filing-financial-statements-in-xbrl-format/introduction-to-acra-taxonomy) does not state it in retrievable text, and no secondary source gave a version number. **Pull the version from the BizFinx v4.0 package itself** — that is the authoritative artefact and what our export must target.

### B3.3 Deadlines and audit exemption

**Filing deadlines** (annual return with ACRA): **listed — within 5 months** of FYE; **non-listed — within 7 months** of FYE. AGM (where required): 6 months post-FYE. **[MED]**

**Small company audit exemption (Companies Act s205C, FYs beginning on/after 1 July 2015):**

Qualify by meeting **at least 2 of 3** for the **immediate past two consecutive financial years**:
- Total annual revenue **≤ S$10,000,000**
- Total assets **≤ S$10,000,000**
- **≤ 50 employees**

Newly incorporated entities (< 2 years old) need only meet the criteria in the current FY. For groups, **both** the Singapore entity individually **and** the group on a consolidated basis must satisfy the test ("small group").
Source: https://www.acra.gov.sg/manage/companies/legal-requirements-common-offences/preparing-financial-statements/audit-exemptions/ **[HIGH]**

---

## B4. Withholding tax & payroll touchpoints (Singapore)

### B4.1 Withholding tax on payments to non-residents (ITA s45)

| Payment type | Rate |
|---|---|
| Interest, commissions, fees in connection with a loan | **15%** |
| Royalties / use of movable property | **10%** |
| Payment for use of scientific, technical, industrial or commercial knowledge | **10%** |
| Rent of movable property | **15%** |
| **Technical assistance and management fees** | **17%** (prevailing corporate rate) |
| Non-resident professional | **15%** on gross (or 24% on net, by election) |
| **Non-resident director's fees** | **24%** |
| Non-resident public entertainer | **15%** (concessionary; 10% applies in certain periods) |
| Payments to authors/composers | **24%** |

Source: https://statrys.com/sg/guides/tax-system-and-rates/withholding-tax **[MED]**; IRAS index: https://www.iras.gov.sg/taxes/withholding-tax/basics-of-withholding-tax/types-of-payment-and-withholding-tax-rates **[HIGH — index only]**

| Item | Value |
|---|---|
| Form | **S45** (S45 Online Filing, or **S45 ODE** offline Excel for bulk) |
| Channel | myTax Portal |
| **Deadline** | **15th of the second month following the date of payment** to the non-resident (e.g. paid 7 Apr → due 15 Jun) |
| Late penalty | **5%** immediately; **+1% per month** after 30 days, capped at **15%** |

**[MED]**

> **Contrast MY vs SG on WHT timing — this is a common source of bugs in a shared codebase:** MY is *within one month of payment*; SG is *the 15th of the second month after payment*. Both must be modelled as jurisdiction-specific due-date functions, not a shared "n days" constant.

**Journals:** same shape as Malaysia (A4.1) — accrue `WHT payable` on the payment date, clear on remittance. Treaty relief reduces the rate but requires a Certificate of Residence from the payee; store `treaty_rate` and `cor_on_file` on the vendor.

### B4.2 CPF and payroll

2026 figures **[MED]** — https://rafflescorporateservices.com/singapore-payroll-cpf-guide-2026-rates-deadlines/

| Age band | Employer | Employee | Total |
|---|---|---|---|
| 55 and below | 17% | 20% | 37% |
| > 55 to 60 | 16.5% | 17% | 33.5% |
| > 60 to 65 | 12.5% | 11.5% | 24% |
| > 65 to 70 | 9% | 7.5% | 16.5% |
| > 70 | 7.5% | 5% | 12.5% |

| Item | Value |
|---|---|
| **Ordinary Wage (OW) ceiling** | **S$8,000/month** |
| **Additional Wage (AW) ceiling** | **S$102,000 − total OW subject to CPF for the year** |
| **CPF Annual Limit** | **S$37,740** per employee |
| **SDL** | **0.25%** on the first S$4,500 of monthly wages; **minimum S$2** per employee/month |
| **CPF + SDL payment deadline** | **14th of the following month** |
| **Foreign Worker Levy** | Tiered by sector, for S Pass and Work Permit holders |

CPF applies only to **Singapore Citizens and PRs**; foreign employees on EP/S Pass/WP are **not** CPF-liable (FWL applies instead) — a frequent modelling error.

### B4.3 IR8A / AIS

| Item | Value |
|---|---|
| Form | **IR8A** (+ Appendix 8A benefits-in-kind, Appendix 8B gains from share options, **IR8S** excess CPF) |
| **AIS (Auto-Inclusion Scheme)** | **Mandatory for employers with 5 or more employees** in the preceding year |
| **Submission deadline** | **1 March** each year |
| **IR21** (tax clearance, foreign employees ceasing/leaving) | **At least 1 month before** cessation/departure; employer must **withhold monies pending clearance** |

**[MED]** — Raffles, above.

> **IR21 has a ledger consequence** most products miss: the employer must **withhold all monies due to the departing foreign employee** until IRAS issues clearance. That is a real payable that sits on the balance sheet — model it as a distinct `Withheld pending IR21 clearance` liability, not as unpaid salary.

**Journals (per payroll run):**
```
Dr Salaries & wages expense          (gross)
Dr CPF employer contribution expense
Dr SDL expense
Dr Foreign worker levy expense
    Cr CPF payable          (employer + employee)
    Cr SDL payable
    Cr FWL payable
    Cr Net salaries payable / Bank
```
Note **no PAYE-equivalent**: Singapore employees pay their own income tax; the employer only *reports* via IR8A/AIS. So — unlike Malaysia's PCB — **there is no employee income-tax withholding liability in the SG payroll journal**. This is a genuine structural difference between the two payroll postings.

---

## B5. Numbering, retention, residency, language, FX (Singapore)

### B5.1 Tax invoice requirements — mandatory contents

Source for B5.1–B5.4: **IRAS Record Keeping Guide for GST-Registered Businesses** — https://www.iras.gov.sg/media/docs/default-source/e-tax/record-keeping-guide-for-gst-registered-businesses.pdf **[HIGH]**

A tax invoice must contain:
1. The words **"Tax Invoice"** prominently displayed
2. An **identifying number** (invoice number)
3. **Date of issue**
4. Supplier's **business name, address and GST registration number**
5. Customer's **name and address**
6. **Description** of goods/services and type of supply
7. **Quantity and amount payable excluding GST** per item
8. Any **cash discount** offered
9. **Total amount payable excluding GST**
10. **GST rate and total GST amount, shown separately**
11. **Total amount payable including GST**
12. Breakdown of **exempt, zero-rated or other supplies**

**Simplified tax invoice**: permitted where the **total payable including GST does not exceed S$1,000**. Requires only: invoice number, date, supplier details (incl. GST reg. no.), description of supply, and total payable with a GST-inclusive notation.

**Credit note** must contain: serial number; date of issue; supplier and customer details; **reference to the original invoice**; description; **reason for the credit**; quantity/amount credited; total credited excluding and including GST; applicable GST rate and amount.

### B5.2 Numbering

Invoices must be **"serially-numbered."** Receipts require duplicate copies to be retained. No requirement for a single global sequence; per-series numbering is acceptable provided each number is identifying and unique. **[HIGH]**

### B5.3 Retention and residency

| Item | Value |
|---|---|
| **Retention period** | **5 years** |
| Legal basis | **Income Tax Act 1947** and **GST Act 1993** |
| Post-dissolution | Companies and LLPs must retain a further **5 years after dissolution** |
| Electronic records | Permitted **without IRAS approval**, provided "proper internal controls are put in place to ensure the integrity, completeness, accuracy, availability and reliability." Physical source documents need not be kept if properly digitised. Reference: **Evidence (Computer Output) Regulations** |
| **Overseas storage** | **Not expressly prohibited.** The guide does not impose a residency requirement — the operative test is accessibility and integrity. |

**[HIGH]**

> **Key jurisdictional contrast: Singapore has no data-residency requirement for accounting records; Malaysia effectively does (ITA s82A).** For a multi-tenant SaaS this means SG tenants can sit in any well-run region, while MY tenants likely need in-country hosting. Plan the region topology around this asymmetry rather than treating APAC as one unit.

**Personal data:** PDPA **s26 Transfer Limitation Obligation** — personal data may only be transferred overseas where the recipient is bound by legally enforceable obligations providing a standard of protection comparable to the PDPA (contract, BCRs, certification, or specified exceptions), per the Personal Data Protection Regulations 2021. https://www.pdpc.gov.sg/-/media/files/pdpc/pdf-files/advisory-guidelines/the-transfer-limitation-obligation---ch-19-(270717).pdf **[HIGH — cited]**; https://oecd.ai/en/dashboards/policy-initiatives/personal-data-protection-act-pdpa,-section-26-transfer-limitation-obligation-and-personal-data-protection-regulations-2021 **[MED]**

### B5.4 Language and currency

- **Language:** English is the working language; IRAS's guide does not state an explicit requirement, but records must be producible in English on request. **[LOW]** — treat English as required in practice.
- **Foreign-currency invoices:** permitted, but **three amounts must be converted to Singapore dollars**:
  1. Total amount payable **excluding** GST
  2. Total **GST amount**
  3. Total amount payable **including** GST
- **Rate to use:** *"the selling rate of exchange prevailing in Singapore at the time of supply."*
- **Acceptable rate sources:** as set out in the IRAS e-Tax Guide **"Exchange Rates for GST Purpose"** — IRAS accepts any rate that is (i) from a source reflecting the Singapore money market, (ii) updated at least once a week, and (iii) used consistently for at least one year. **[HIGH for the three-amount rule and the "selling rate" wording; [LOW] for the three-condition summary — verify in the e-Tax Guide.]**

**Design:** the SG FX requirement is materially different from MY's. MY wants a single `Currency Exchange Rate` field on the document; SG wants **three SGD-translated totals printed on the invoice**. The invoice template engine must be jurisdiction-aware, and the FX policy object needs a `consistency_period` (SG requires one year's consistent use of a source) that MY does not.

---

## B6. Chart of accounts conventions (Singapore)

- **No prescribed statutory COA.** SFRS prescribes presentation; ACRA prescribes XBRL tagging. **[MED]**
- The binding constraint is the **ACRA Taxonomy**: accounts must map to taxonomy elements for Full or Simplified XBRL. Design the COA from the XBRL element list backwards.
- Convention mirrors the standard 4-digit blocks (1000 assets / 2000 liabilities / 3000 equity / 4000 revenue / 5000 COGS / 6000+ expenses). **[LOW]** — https://rafflescorporateservices.com/setting-up-basic-chart-of-accounts-singapore-sme/, https://counto.sg/mastering-the-chart-of-accounts-a-comprehensive-guide-for-small-businesses-in-singapore/

**What SG accountants and audit firms expect:**
1. Default COA **pre-mapped to the ACRA taxonomy**, with the mapping visible and overridable.
2. **GST Output Tax** and **GST Input Tax** as separate control accounts, plus a **GST Control/Clearing** account; every tax code carrying its **F5 box** tag.
3. Distinct handling for **reverse charge** (dual posting) and **blocked input tax** (S$ non-claimable — e.g. club subscriptions, medical, motor cars — must post to expense, not to Input Tax).
4. Separate **CPF payable / SDL payable / FWL payable** liabilities.
5. A **directors' remuneration** and **related-party** analysis, since these are mandatory XBRL/FS disclosures.
6. Ability to produce **FS in SFRS presentation order** with comparatives, and to export to BizFinx.

> **Blocked input tax (GST Act Regulations 26 & 27) is the most common SG compliance error in generic accounting software.** A jurisdictional pack that ships blocked-input-tax codes out of the box is a real selling point to SG accountants.

---

## B7. Integrations that matter commercially (Singapore)

### Payment rails
- **PayNow** — instant proxy-addressed transfers via mobile number, NRIC/FIN, or **UEN** (the UEN variant, *PayNow Corporate*, is the B2B rail and is directly relevant to AR/AP matching). Built on **FAST**. https://en.wikipedia.org/wiki/PayNow **[MED]**
- **SGQR** — the unified national QR standard.
- **GIRO** — the dominant recurring direct-debit/credit rail; still heavily used for subscription collections, CPF, and IRAS payments. Mandate setup is paper/eGIRO-based.
- **FAST** (instant, ≤S$200k typical) and **MEPS+** (RTGS, high value).
- **eGIRO** — digitised GIRO mandate setup; supported by the major banks; worth integrating for subscription billing.

### Banking data
- **ISO 20022 camt.053** is well supported by DBS, OCBC and UOB corporate channels; **MT940** remains widely available. https://community.sap.com/t5/financial-management-blog-posts-by-members/bank-statement-automation-camt-053-and-camt-052/ba-p/13945628 **[MED]**
- **DBS, OCBC and UOB all publish developer API portals** with account/statement and payment-initiation APIs; **SGFinDex** provides consented retrieval of financial data (primarily consumer-oriented, but signals direction of travel).
- Singapore's banking API maturity is materially ahead of Malaysia's. **Recommendation: API-first for SG (DBS/OCBC/UOB), file-first for MY.**

### Incumbent accounting products (= migration sources)
**Xero** is unusually strong in Singapore (large accountant/partner channel); **QuickBooks Online**; **MYOB**; **Financio**; **Sage**; local/regional: **Million**, **ABSS** (formerly MYOB Asia — note ABSS has published GST InvoiceNow support: https://sg.abssasia.com/gst-invoicenow), **Moiboo**, **Realtimme**. Enterprise: SAP, Microsoft Dynamics, NetSuite.
Sources: https://arnifi.com/blog/best-accounting-software-singapore-sme-2026-guide/ **[MED]**, https://www.excellencesg.com/best-accounting-software-singapore-sme-2026/ **[MED]**

> Migration priority: **Xero and QuickBooks Online** (both have well-documented APIs — build API-based migration, not CSV) then **ABSS**.

---
---

# PART C — CROSS-CUTTING SPEC NOTES

## C1. The ten differences that must be modelled per-jurisdiction

| # | Dimension | Malaysia | Singapore |
|---|---|---|---|
| 1 | Indirect tax model | **SST — no input credit**; tax is a cost | **GST — full input credit**; tax is a flow-through |
| 2 | E-invoice model | **Clearance** (LHDN validates before/around issue) | **Post-audit reporting** (IRAS gets a copy, C5) |
| 3 | E-invoice network | MyInvois API / Portal (Peppol optional transport) | **Peppol is the network**; IRAS is corner 5 |
| 4 | Clearance artefacts | **UIN, validation link, QR** — must be stored and shown to buyer | **None** |
| 5 | Cancellation | **72-hour hard window** from validation | No window; use credit notes |
| 6 | Document types | Invoice, CN, DN, **Refund Note**, all with **self-billed** variants, plus **consolidated** | Invoice, Credit Note (plus aggregated records) |
| 7 | Retention | **7 years**, **records must be kept in Malaysia** | **5 years**, **no residency requirement** |
| 8 | FX on invoice | One `Currency Exchange Rate` field; BNM rate; invoice-date | **Three SGD totals printed**; "selling rate in Singapore"; source used consistently ≥1 year |
| 9 | Payroll withholding | **PCB** — employer withholds employee income tax | **No PAYE** — employer only reports (IR8A/AIS) |
| 10 | WHT remittance | Within **1 month** of payment | **15th of the 2nd month** after payment |

## C2. Suggested localisation-pack shape

```
pack/
  my/
    einvoice/          # MyInvois: UBL2.1 mapping, MSIC + classification code lists,
                       # special TINs (EI00000000020/30), 72h state machine,
                       # consolidated-e-invoice rules incl. RM10k gate + prohibited industries
    tax/               # SST: sales tax by HS code, service tax by group,
                       # bimonthly SST-02 periods, no-input-credit posting rules
    gaap/              # MFRS | MPERS_2016 | MPERS_2027 presentation + MBRS mapping
    payroll/           # EPF Third Schedule table, SOCSO/EIS ceilings, PCB
    wht/               # s107A/109/109A/109B/109C + CP37x forms, CP58 accumulator
    coa/               # default MFRS COA, default MPERS COA
    fx/                # BNM daily, invoice-date
    numbering/         # per-branch series, uniqueness on (tenant, e_invoice_code)
  sg/
    einvoice/          # PINT SG / UBL2.1 + SBDH, IRAS C5 API client,
                       # Peppol AP integration, 10MB/10-doc batching
    tax/               # GST 9%, F5 box map, reverse charge dual-posting,
                       # blocked input tax (Reg 26/27), MES/IGDS/customer accounting
    gaap/              # SFRS(I) | SFRS | SFRS for SE | RDR + ACRA taxonomy mapping
    payroll/           # CPF age bands, OW/AW ceilings, SDL, FWL, IR21 withholding
    wht/               # s45 rates + S45 form, treaty/COR tracking
    coa/               # default SFRS COA, default SFRS-for-SE COA
    fx/                # weekly-updated source, 1-year consistency lock, 3 SGD totals
    numbering/         # serial numbering, S$1,000 simplified-invoice threshold
```

## C3. Open items to verify before shipping

| # | Item | Why it matters | Where to check |
|---|---|---|---|
| 1 | **MY Phase 4 relaxation end date** (31 Dec 2027 vs 30 Jun 2026) | Drives in-product compliance messaging and penalty warnings | LHDN media releases; guideline v4.8+ |
| 2 | **MY service tax Groups A–L** — current letters, names, per-group thresholds | Tax-code taxonomy structure | Service Tax Regulations 2018, First Schedule (as amended 2025) |
| 3 | **MY SST late-payment penalty tiers** | Penalty calculator | mysst.customs.gov.my penalties page |
| 4 | **SG Simplified XBRL threshold** (S$500k vs S$10m) | Template selection logic | ACRA "Who needs to file FS in XBRL" |
| 5 | **ACRA Taxonomy version string** | XBRL export target | BizFinx PrepTool v4.0 package |
| 6 | **MBRS taxonomy version** | XBRL export target | SSM MBRS portal |
| 7 | **SG F5 boxes beyond 15** (IGDS) | Return completeness for IGDS filers | Current F5/F7 form |
| 8 | **MY records-in-Malaysia (s82A)** practical enforcement for cloud | Region topology / go-to-market | Malaysian tax counsel |
| 9 | **MY permitted e-Invoice languages** | Template engine | Guideline; LHDN FAQ |
| 10 | **SG MES qualifying tests** (>50% zero-rated / >S$10m imports) | Scheme eligibility checks | IRAS MES e-Tax Guide (17th ed.) |
| 11 | **MY Customs Apr-2026 FX guidance for SST invoices** | May differ from the e-Invoice FX rule | vatupdate 17 Apr 2026 → trace to Customs source |
| 12 | **Peppol AP strategy for SG** | IRAS API keys are issued to APs, not taxpayers | IMDA TX3 Access Point Services spec |
