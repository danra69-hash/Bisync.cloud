# Australia & Indonesia — Accounting/Tax Localisation Pack Spec

**Research date: 17 August 2026.** Written for engineers building a multi-tenant SaaS ledger. Every non-obvious claim carries a source URL. Uncertainty is flagged inline with **[VERIFY]**.

**How to read the confidence flags**
- **[SOLID]** — primary source (ATO/ASIC/AASB/DJP/IAI/BI/OJK) directly consulted, stable.
- **[VERIFY]** — secondary source only, or the rule is moving; re-check before you ship.
- **[GAP]** — I could not confirm this; treat as an open engineering question.

---

# PART A — AUSTRALIA

## A1. E-invoicing (Peppol)

### A1.1 Current legal state — no B2B mandate

| Fact | Detail | Source |
|---|---|---|
| B2B e-invoicing | **Voluntary.** No mandate exists as of Aug 2026. | [zoneandco 2026 guide](https://www.zoneandco.com/articles/e-invoicing-in-australia-compliance-guide) **[VERIFY — secondary]** |
| Business eInvoicing Right (BER) | Treasury consulted Dec 2021 ("Supporting business adoption of eInvoicing"); the phased BER (large business from Jul 2023, all business by Jul 2025) **was never legislated**. | [Treasury consultation](https://treasury.gov.au/consultation/c2021-185457), [Treasury paper PDF](https://treasury.gov.au/sites/default/files/2021-12/c2021-185457.pdf), [PwC alert](https://www.pwc.com.au/tax/tax-alerts/business-einvoicing-right.html) |
| Peppol Authority | The **ATO is the Australian Peppol Authority** (jointly with MBIE NZ for the A-NZ domain). | [ATO eInvoicing for government](https://www.ato.gov.au/businesses-and-organisations/einvoicing/einvoicing-for-government) |

**Engineering consequence:** eInvoicing in AU is a *sales feature*, not a compliance blocker. Build it as an optional outbound channel; do not gate invoice issuance on it.

### A1.2 B2G obligations (the only hard obligations)

| Obligation | Who | Date | Source |
|---|---|---|---|
| Must be able to *receive* Peppol eInvoices | All Non-Corporate Commonwealth Entities (NCEs) | Already in force (from 1 Jul 2022 for all NCEs) | [ATO](https://www.ato.gov.au/businesses-and-organisations/einvoicing/einvoicing-for-government) |
| **≥30% of all invoices received** must arrive via Peppol | NCEs | **1 July 2026** | [ATO](https://www.ato.gov.au/businesses-and-organisations/einvoicing/einvoicing-for-government) |
| Automated sending *and* receiving enabled | NCEs | **December 2026** | [ATO](https://www.ato.gov.au/businesses-and-organisations/einvoicing/einvoicing-for-government) |
| Quarterly progress reporting to the Australian Peppol Authority | NCEs | Ongoing | [ATO](https://www.ato.gov.au/businesses-and-organisations/einvoicing/einvoicing-for-government) |
| Corporate Commonwealth Entities | **Out of scope** (encouraged only) | — | [ATO](https://www.ato.gov.au/businesses-and-organisations/einvoicing/einvoicing-for-government) |
| State/territory | 300+ state/local bodies already receive; NSW, SA, ACT, QLD, WA broadly live | — | [ATO](https://www.ato.gov.au/businesses-and-organisations/einvoicing/einvoicing-for-government) |

**Commercial hook — RMG 411 "Pay on Time or Pay Interest":** Commonwealth entities pay valid **Peppol eInvoices within 5 calendar days** vs 20–30 days for PDF. This is the single strongest sales argument for AU eInvoicing. **[VERIFY — secondary source only](https://www.zoneandco.com/articles/e-invoicing-in-australia-compliance-guide); confirm current RMG 411 text and whether the 5-day rule still applies at all contract values.**

### A1.3 Technical profile — PINT A-NZ

| Item | Value | Source |
|---|---|---|
| Mandatory specification | **PINT A-NZ** — Peppol BIS Billing 3.0 (AU-NZ) is **no longer accepted** on the network | [zoneandco](https://www.zoneandco.com/articles/e-invoicing-in-australia-compliance-guide) **[VERIFY]** |
| Cutover to PINT-only | **15 May 2025** | [zoneandco](https://www.zoneandco.com/articles/e-invoicing-in-australia-compliance-guide) **[VERIFY]** |
| Current version | **PINT A-NZ Billing v1.1.2**, released **21 November 2025**. Covers Invoice + Credit Note. | [Peppol OpenPeppol docs](https://docs.peppol.eu/poac/aunz/) **[SOLID]** |
| Self-billing | **PINT A-NZ Self-billing v1.1.2** (buyer sends). **Optional** for service providers. | [Peppol docs](https://docs.peppol.eu/poac/aunz/) |
| Transport | Peppol AS4, four-corner model, via an accredited Access Point | [Peppol docs](https://docs.peppol.eu/poac/aunz/) |

**[GAP]** I did not extract the exact `cbc:CustomizationID` / `cbc:ProfileID` URN strings or the Peppol document type identifiers. Pull them directly from https://docs.peppol.eu/poac/aunz/ before coding the envelope. Expect the form `urn:peppol:pint:billing-1@aunz-1` for CustomizationID and `urn:peppol:bis:billing` for ProfileID, but **do not ship on my guess**.

**Build decision:** Do not become an Access Point. Integrate with an existing accredited AP (MessageXchange, Storecove, B2BE, Link4). Model the invoice in UBL 2.1 internally so PINT serialisation is a mapping layer, and keep the *legal* invoice = your own tax invoice record, with the Peppol document as a delivery representation.

### A1.4 AU tax invoice content requirements (this IS mandatory)

A valid **tax invoice** is required for the buyer to claim an input tax credit where the purchase exceeds **A$82.50 (GST-inclusive)**.

Required fields (GST Act s29-70):
1. The words "**Tax invoice**"
2. Seller identity and **seller ABN**
3. Date of issue
4. Brief description of items, quantity, price
5. GST amount payable (or the statement "**Total price includes GST**")
6. Extent to which each sale is taxable
7. **Buyer identity or buyer ABN — required only where the sale is ≥ A$1,000 (ex-GST)**

Sources: [ATO BAS section](https://www.ato.gov.au/print/section/9fc804ad-a043-4a35-b540-16b71d9ca9bf), [MYOB summary](https://www.myob.com/au/resources/guides/invoicing/tax-invoice) **[VERIFY the $1,000 threshold basis is ex-GST — commonly cited both ways]**.

**Recipient Created Tax Invoice (RCTI):** buyer issues, requires a written agreement between the parties; the ledger must flag the document as an RCTI and suppress the supplier's own tax invoice. Model as a distinct `document_subtype`.

**Numbering:** Australia has **no statutory invoice numbering scheme**. Any unique, sequential-ish identifier is acceptable. No gap-free requirement, no government-allocated ranges. This is a major simplification versus Indonesia.

---

## A2. GST and the BAS

### A2.1 Core parameters

| Parameter | Value | Source |
|---|---|---|
| GST rate | **10%** | [ATO](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst) |
| Registration threshold | **A$75,000** GST turnover (**A$150,000** non-profit; **$0** for taxi/rideshare) | [ATO BAS section](https://www.ato.gov.au/print/section/9fc804ad-a043-4a35-b540-16b71d9ca9bf) |
| Simpler BAS threshold | GST turnover **< A$10 million** | [ATO](https://www.ato.gov.au/print/section/9fc804ad-a043-4a35-b540-16b71d9ca9bf) |
| Full reporting method | GST turnover **≥ A$10 million** | same |
| Mandatory monthly cycle | GST turnover **≥ A$20 million** | same |
| Input tax credit doc threshold | **A$82.50** GST-inclusive | same |
| Second-hand goods ITC without tax invoice | ≤ **A$300** | same |

### A2.2 Reporting cycles and due dates

| Cycle | Eligibility | Due date |
|---|---|---|
| **Monthly** | Mandatory ≥$20m turnover; optional below | **21st** of following month |
| **Quarterly** | <$20m turnover (default) | **28 Oct / 28 Feb / 28 Apr / 28 Jul** (Q2 gets the extended 28 Feb) |
| **Annual** | Voluntarily registered, turnover <$75k ($150k NFP) | **31 Oct**, or **28 Feb** if not required to lodge an income tax return |

Source: [ATO BAS section](https://www.ato.gov.au/print/section/9fc804ad-a043-4a35-b540-16b71d9ca9bf).

**Tax-agent concession:** lodging through a registered agent generally adds ~4 weeks to quarterly due dates (electronic lodgment). **[VERIFY exact concession dates per quarter each year from the ATO lodgment program.]**

**Compliance-driven cycle changes — implement this:** From **1 April 2025** the ATO began **compulsorily moving small businesses from quarterly to monthly GST reporting** for poor compliance history (late lodgment/payment, incorrect reporting), for a **minimum of 12 months**; ~3,500 businesses in the first tranche and the ATO says it will continue. Your tenant config must treat `gst_reporting_cycle` as **mutable mid-year, ATO-directed**, with an effective-from date, not a static setup field. Source: [ATO](https://www.ato.gov.au/businesses-and-organisations/corporate-tax-measures-and-assurance/our-focus-areas-for-small-business/small-business-focus-areas/quarterly-to-monthly-gst-reporting), [ATO media](https://www.ato.gov.au/media-centre/ato-shifts-non-compliant-businesses-to-monthly-gst).

### A2.3 BAS label → ledger mapping (the core localisation table)

Source for all labels: [ATO BAS section](https://www.ato.gov.au/print/section/9fc804ad-a043-4a35-b540-16b71d9ca9bf), cross-checked against [e-BAS Accounts pt 1](https://www.e-bas.com.au/bas-labels-explained-part-1/) / [pt 2](https://www.e-bas.com.au/bas-labels-explained-part-2/).

**GST section**

| Label | Name | Derivation from ledger | Simpler BAS? |
|---|---|---|---|
| **G1** | Total sales | Sum of all sale lines: taxable + GST-free + input-taxed. GST-inclusive or exclusive (a per-BAS toggle the user sets — store it) | **Required** |
| **G2** | Export sales | Sale lines with tax code `EXP` (GST-free exports) | Full only |
| **G3** | Other GST-free sales | Sale lines with tax code `FRE` (medical, education, childcare, basic food, going concern) | Full only |
| **G10** | Capital purchases | Purchase lines flagged `is_capital = true` (GST-inclusive) | Full only |
| **G11** | Non-capital purchases | Purchase lines `is_capital = false` (GST-inclusive) | Full only |
| **1A** | GST on sales | Balance of `GST Collected` liability account for the period + adjustments | **Required** |
| **1B** | GST on purchases | Balance of `GST Paid` asset account for the period + adjustments | **Required** |
| 1C / 1D | Wine Equalisation Tax payable / refundable | WET module | Full only |
| 1E / 1F | Luxury Car Tax payable / refundable | LCT module | Full only |

**Simpler BAS (turnover <$10m) requires only G1, 1A, 1B.** G2, G3, G10, G11 are not lodged and no GST calculation worksheet is needed. **Critical design point:** you still need G2/G3/G10/G11 internally (reconciliation, growth past $10m, agents who want them), so *always compute them, conditionally lodge them*. Source: [ATO](https://www.ato.gov.au/print/section/9fc804ad-a043-4a35-b540-16b71d9ca9bf).

**PAYG withholding section**

| Label | Name | Ledger source |
|---|---|---|
| **W1** | Total salary, wages & other payments | Gross payments subject to withholding: salaries, director fees, ETPs, super income streams |
| **W2** | Amounts withheld from W1 | `PAYG Withholding Payable` — employee PAYGW component |
| **W3** | Other amounts withheld | Investment distributions, foreign resident withholding, departing super |
| **W4** | Amounts withheld where **no ABN quoted** | Separate liability sub-account. **47%** withheld |
| **W5** | Total withheld = W2 + W4 + W3 | Copied to summary label **4** |

**PAYG instalments & other**

| Label | Name | Notes |
|---|---|---|
| **5A** | PAYG income tax instalment | Either the ATO-supplied amount (Option 2) or instalment income × rate (Option 1) |
| **5B** | Credit from PAYG instalment variation | |
| **T1** | PAYG instalment income | Ordinary income excluding GST — needed for Option 1 |
| **T2** | ATO-supplied instalment rate | |
| **T3** | Varied rate | User-entered |
| **T4** | Reason code for variation | ATO code list |
| 6A / 6B | FBT instalment payable / credit | |
| **7A** | Fuel tax credit — over claim | Full reporting only |
| **7C / 7D** | Fuel tax credit claimed / adjustment | |
| **8A / 8B** | Total amounts payable / creditable | |
| **9** | **Net amount payable to ATO or refundable** | 8A − 8B |
| **4** | Total PAYG withholding (from W5) | |

**PAYG instalment options** (store as a tenant setting):
- **Option 1** — you calculate: `T1 × instalment rate` → 5A. Lodge activity statement.
- **Option 2** — ATO gives a fixed amount; pay it, no lodgment needed unless varying.
- **Option 3** — annual GST instalment; report actual GST on the annual GST return.

**BAS data-entry rules to enforce in validation:**
- Whole dollars only — "leave cents out and **don't round up**" (i.e. truncate, do not round).
- No negative figures, no arithmetic symbols.
- Each invoice reported once only.
- Blank ≠ zero for non-applicable labels; leave blank.

Source: [ATO](https://www.ato.gov.au/print/section/9fc804ad-a043-4a35-b540-16b71d9ca9bf).

### A2.4 GST treatment taxonomy → suggested tax codes

| Treatment | Meaning | Output GST | Input credits on related costs | Typical code | Examples |
|---|---|---|---|---|---|
| **Taxable** | 10% GST | Yes | Yes | `GST` / `GST on Income`, `GST on Expenses` | Most goods & services |
| **GST-free** | 0% but credits allowed | No | **Yes** | `FRE` | Basic food, most medical & health, education, childcare, exports (`EXP`), sale of a going concern, farmland, water/sewerage |
| **Input-taxed** | No GST, **credits denied** | No | **No** | `INP` / `ITS` | Financial supplies, **residential rent**, sale of existing residential premises, some fundraising |
| **Out of scope / not reportable** | Outside GST | No | No | `N-T`, `BAS Excluded` | Wages, super, dividends, ATO payments, internal transfers, depreciation |

Sources: [ATO GST-free sales](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/when-to-charge-gst-and-when-not-to/gst-free-sales), [ATO input-taxed sales](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/when-to-charge-gst-and-when-not-to/input-taxed-sales), [PwC Worldwide Tax Summaries — Australia](https://taxsummaries.pwc.com/australia/corporate/other-taxes).

**Do not collapse `N-T` and `FRE`.** Australian bookkeepers treat these as distinct and will reject a product that maps wages to "GST-free" — wages must be BAS-excluded so they never hit G1.

**Accounting basis:** cash vs accruals GST. Cash basis available under **A$10m** turnover. This changes the *period* in which 1A/1B recognise, not the amount — implement as a per-tenant `gst_basis` that drives which date (invoice date vs payment date) selects the period. **[VERIFY the $10m cash-basis eligibility threshold against current ATO guidance.]**

---

## A3. Withholding & payroll-adjacent obligations

### A3.1 PAYG withholding
- Employer withholds from salary/wages, director fees, ETPs, and payments under voluntary agreements/labour hire.
- Ledger posts: `Dr Wages Expense` (gross) / `Cr PAYG Withholding Payable` / `Cr Bank` (net) / `Cr Superannuation Payable`.
- Remitted with the BAS/IAS at W2.
- **IAS (Instalment Activity Statement)** is the form used by entities that have PAYGW or PAYG instalments but no GST, and by monthly-PAYGW/quarterly-GST filers in months 1 and 2 of a quarter. **Your form engine must support BAS and IAS as separate document types with overlapping label sets.**

### A3.2 No-ABN withholding — **build this, it's ledger-visible**
- If a supplier does not quote an ABN on an invoice for a taxable supply, the payer must withhold at the **top marginal rate + Medicare = 47%**.
- Exceptions: total payment ≤ **A$75 excluding GST**; supplier provides a **"Statement by a supplier"** form (hobby, not in business, wholly private); supplier is under 18 and payments ≤$350/week; payment is exempt income to the supplier.
- Reported at BAS label **W4**.
- Sources: [ATO Statement by a supplier](https://www.ato.gov.au/forms-and-instructions/statement-by-supplier-not-quoting-an-abn), [ATO BAS section](https://www.ato.gov.au/print/section/9fc804ad-a043-4a35-b540-16b71d9ca9bf). **[VERIFY the $75 and $350 de minimis figures — secondary sourced.]**

**Implementation:** on the supplier record store `abn`, `abn_status` (validated against ABR ABN Lookup), `abn_gst_registered`, `statement_by_supplier_on_file` (bool + document link), `withholding_exempt_reason`. On bill entry, if no valid ABN and no exemption → auto-create a 47% withholding line, `Dr Expense (gross)` / `Cr No-ABN Withholding Payable` / `Cr Accounts Payable (net)`.

**ABN validation** should hit the **ABR** (Australian Business Register, now under ABRS) ABN Lookup web services — free, requires a GUID registration. This also gives you the legal entity name and GST registration status, which you need for tax-invoice validation.

### A3.3 Single Touch Payroll Phase 2 (ledger-level summary)
STP2 is fully in force. What matters for a **ledger** (not a payroll engine):

- Every pay event must be reported to the ATO **on or before the pay date** via an SBR2/STP2 payload.
- **Gross is disaggregated** — you can no longer post a single "Gross Wages" number. Required components: **Gross (residual), Paid Leave (by type: cash-out, unused on termination, paid parental, workers comp, ancillary/defence, other), Allowances (by 10+ ATO categories: car, transport, travel, laundry, meals, tool, qualification, task, KM, other), Overtime, Bonuses & Commissions, Directors' Fees, Lump Sums (A/B/D/E/W), Salary Sacrifice (type S — super, type O — other), ETPs, Deductions (fees, workplace giving, child support deduction/garnishee).**
- **TFN declaration data is embedded in STP** (no separate paper lodgment).
- **Income types & country codes** are mandatory per income stream (SAW, CHP, WHM, SWP, FEI, IAA, VOL, LAB, OSP, JPD).
- **Child support** deductions/garnishees may be reported through STP.
- **Finalisation declaration** replaces payment summaries; due **14 July** for most employers.
- Sources: [Xero STP2 overview](https://www.xero.com/au/resources/single-touch-payroll-phase-2/), [PwC STP2](https://www.pwc.com.au/tax/employment-taxes/single-touch-payroll-phase-2-reporting.html). **[VERIFY the full allowance-category and lump-sum code lists against the current ATO STP Phase 2 employer reporting guidelines before coding enums.]**

**Ledger implication:** your payroll journal schema needs a `stp_component_code` dimension on every wage/allowance/deduction line, not just an account code. If you integrate rather than build payroll, you still must accept and store these components to produce a correct P&L breakdown and W1.

### A3.4 Superannuation — **the biggest AU change landing right now**

| Item | Detail | Source |
|---|---|---|
| SG rate | **12%** (unchanged under the reform) | [ATO Payday Super](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/about-payday-super) |
| **Payday Super start** | **1 July 2026** — already in force as of this brief's date | [ATO](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/about-payday-super), [Fair Work](https://www.fairwork.gov.au/newsroom/news/payday-super-new-rules-starting-1-july-2026) |
| New deadline | Contributions must be **received by the employee's fund within 7 business days of the pay day** (was: 28 days after quarter end) | [ATO](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/about-payday-super) |
| New earnings base | **Qualifying Earnings (QE)** — replaces OTE; brings together OTE **plus** other payments incl. commissions and **salary-sacrificed amounts** | [ATO](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/about-payday-super) |
| SG charge | Now **ATO-assessed**, not self-assessed. Interest **compounds daily at the GIC rate** (was 10% flat). New **administrative uplift**. SGC is now **tax deductible** (was not). | [ATO](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/about-payday-super) |
| STP reporting | Must report **both qualifying earnings and super liability** through STP | [ATO](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/about-payday-super) |
| **SBSCH closed** | New registrations closed **1 Oct 2025**; the ATO **Small Business Superannuation Clearing House closed 1 July 2026** | [ATO](https://www.ato.gov.au/businesses-and-organisations/small-business-newsroom/the-small-business-superannuation-clearing-house-is-closing) |

**Commercial read:** SBSCH closure + 7-business-day settlement has just forced every micro-employer in Australia off the free government clearing house and onto commercial payroll/clearing-house products, in the same month. This is the single largest AU go-to-market opening in the localisation pack. A ledger without a SuperStream-compliant contribution path is now unsellable to employers.

**Ledger postings:** `Dr Superannuation Expense` / `Cr Superannuation Payable` on each pay run; `Dr Superannuation Payable` / `Cr Bank` on remittance. Track `sg_due_date = pay_date + 7 business days` per pay event and expose an ageing/breach report — this is now a per-payday liability, not a per-quarter one.

### A3.5 TPAR — Taxable Payments Annual Report

| Item | Detail |
|---|---|
| Due | **28 August** each year, for the year ended 30 June |
| Who | **Building & construction**; **cleaning**; **courier / road freight**; **IT services**; **security, investigation or surveillance services** — where payments for those services are a material part of business income. Also government entities (grants). |
| What | Per contractor: **ABN, name, address, gross amount paid (incl. GST), GST amount, tax withheld** |
| Sources | [ScaleSuite TPAR 2026](https://www.scalesuite.com.au/resources/tpar-guide-2026), [LINK Books](https://books.link.com.au/blog/bookkeeping-service/everything-you-need-to-know-about-the-taxable-payments-annual-report-tpar) **[VERIFY the industry list and the "material part" test against ATO source — secondary sourced here]** |

**Implementation:** a `tpar_reportable` boolean on the supplier + a `tpar_service_category` on the tenant. Accumulate per-supplier gross-paid (cash basis — **payments made**, not invoices received) across the financial year. Output the ATO TPAR file format (a defined flat/XML spec via SBR). **[GAP — I did not retrieve the TPAR file specification; obtain it from the ATO software developers' portal.]**

---

## A4. Statutory accounts & GAAP (Australia)

### A4.1 Framework
- Standards issued by the **AASB** (Australian Accounting Standards Board), IFRS-aligned.
- **AASB 1053** sets the two-tier differential reporting regime.
- **Tier 1** — full AASB (= full IFRS) recognition, measurement and disclosure. Required for publicly accountable entities and the Australian Government/state governments.
- **Tier 2** — **AASB 1060 *General Purpose Financial Statements — Simplified Disclosures for For-Profit and Not-for-Profit Tier 2 Entities***. Same **recognition and measurement** as Tier 1; **reduced disclosure**. AASB 1060 replaced the old Reduced Disclosure Requirements (RDR) regime and applies for periods beginning on/after **1 July 2021**. Sources: [AASB 1060](https://standards.aasb.gov.au/aasb-1060-mar-2024-0), [KPMG "Farewell SPFS, welcome Simplified Disclosures"](https://kpmg.com/au/en/insights/financial-reporting/farewell-spfs-welcome-simplified-disclosures.html).
- **Special Purpose Financial Statements (SPFS) have been removed** for for-profit private sector entities required by legislation, or by a constitution/document created or amended on or after 1 July 2021, to prepare financial statements *in accordance with Australian Accounting Standards*. Such entities must now prepare **GPFS (Tier 1 or Tier 2)**. Source: [KPMG](https://kpmg.com/au/en/insights/financial-reporting/farewell-spfs-welcome-simplified-disclosures.html), [Pitcher Partners guide](https://www.pitcher.com.au/wp-content/uploads/2021/03/General_Purpose_Financial_Statements_2020.pdf).

**Product consequence:** virtually every mid-market AU client your SaaS touches is a **Tier 2 / AASB 1060** preparer. Your reporting pack should target AASB 1060 disclosures, not full IFRS.

### A4.2 Who must lodge with ASIC — large proprietary company test

A proprietary company is **large** if it meets **at least 2 of 3** for the financial year, on a **consolidated** basis (company + controlled entities):

| Test | Threshold (FY commencing on/after 1 July 2019) | Prior (FY commencing before 1 July 2019) |
|---|---|---|
| Consolidated revenue | **≥ A$50 million** | ≥ A$25m |
| Consolidated gross assets (at year end) | **≥ A$25 million** | ≥ A$12.5m |
| Employees (at year end) | **≥ 100** | ≥ 50 |

Source: [ASIC — Are you a large or small proprietary company](https://www.asic.gov.au/regulatory-resources/financial-reporting-and-audit/preparers-of-financial-reports/are-you-a-large-or-small-proprietary-company) **[SOLID]**.

**Conflict flag:** the [Treasury SME financial reporting factsheet](https://treasury.gov.au/small-business/frt/factsheet) describes the $50m/$25m/100 numbers as a *proposal* against "current" $25m/$12.5m/50 thresholds "unchanged since 2007". Reconciled reading: that factsheet is the **2018–19 consultation material** that produced the 2019 regulation, and the ASIC page reflects the enacted outcome. **Treat $50m / $25m / 100 as current.** **[VERIFY there has been no further increase legislated in 2025–26.]**

**Lodgement obligations (Ch 2M, Corporations Act 2001):**
- **Large proprietary companies** — must prepare a financial report, directors' report, have it **audited**, and **lodge with ASIC** (Form 388) within **4 months** of year end.
- **Small proprietary companies** — generally exempt, unless (a) directed by ASIC or 5% of members, or (b) **foreign-controlled** and not consolidated into audited accounts lodged with ASIC.
- **Public companies, disclosing entities, registered schemes** — always report; disclosing entities also lodge half-year reports within 75 days.
- **"Grandfathered" large proprietary companies** — ASIC has ended tolerance here and is actively pursuing non-lodgement. Source: [ASIC 25-169MR](https://www.asic.gov.au/about-asic/news-centre/find-a-media-release/2025-releases/25-169mr-asic-increases-its-focus-on-lodgement-of-financial-reports-after-finding-poor-compliance-by-grandfathered-companies/).
- **Sustainability reporting (AASB S2)** phased in from **1 January 2025** by group size — Group 3 entities are entering scope now. Sources: [ASIC](https://www.asic.gov.au/regulatory-resources/financial-reporting-and-audit/preparers-of-financial-reports/are-you-a-large-or-small-proprietary-company), [Synectic on Group 3 / AASB S2](https://synecticgroup.com.au/2026/08/preparing-for-aasb-s2-why-this-financial-year-matters-for-group-3-entities/). **[VERIFY current Group 1/2/3 thresholds and dates — a 2026 Budget reform reportedly shifts them: [Accounting Times](https://www.accountingtimes.com.au/profession/shifting-thresholds-what-the-proposed-2026-budget-reforms-mean-for-australias-climate-disclosure-obligations).]**

**Tax year:** Australian **financial year = 1 July – 30 June**. Substituted accounting periods require ATO permission. Your fiscal-calendar model must default AU tenants to a July–June year and must not assume calendar-year = fiscal-year (Indonesia is the opposite).

---

## A5. Numbering, retention, residency, language (Australia)

| Topic | Rule | Source |
|---|---|---|
| **Invoice numbering** | No statutory scheme. No gap-free, no pre-allocation, no government series. | — |
| **Tax record retention (ATO)** | **5 years** from the date the record was prepared/obtained or the transaction completed — whichever is later. Longer where a loss is carried forward or a dispute is open. | [AWTS](https://awts.net.au/blog/how-long-to-keep-tax-records-australia/), [ScaleSuite](https://www.scalesuite.com.au/resources/business-record-retention-requirements-australia-ato) **[VERIFY against ATO primary]** |
| **Company financial records (Corporations Act s286)** | Must keep written financial records that correctly record and explain transactions and enable true-and-fair financial statements to be prepared and audited; retain for **7 years** after the transactions covered are completed. | [Corporations Act 2001 s286 (AustLII)](https://www.austlii.edu.au/au/legis/cth/consol_act/ca2001172/s286.html) **[SOLID]** |
| **Design rule** | Use **7 years** as the AU retention floor; it satisfies both. Never hard-delete; soft-delete + immutable audit journal. | — |
| **Data residency** | **No general residency requirement.** Records may be kept offshore. Practical constraint: records must be **in English** (or readily convertible) and **accessible to the ATO/ASIC on request**. Health, some government, and some state-sector data have separate rules (My Health Records Act prohibits offshore holding of MHR data — not relevant to a general ledger). | **[VERIFY]** — I could not confirm an ATO primary page on offshore record storage in this pass. Confirm the "records in English / accessible in Australia" wording before making residency claims to customers. **[GAP]** |
| **Privacy** | Privacy Act 1988 + APP 8 (cross-border disclosure) governs offshore processing of personal information; APP 11 for security. Notifiable Data Breaches scheme applies. Relevant to your DPA, not your ledger schema. | **[VERIFY]** |
| **Language / currency** | English. Presentation currency AUD for statutory reports; functional currency may differ under AASB 121 with translation. GST amounts on a tax invoice must be expressed in **AUD** where the supply is taxable in Australia. | **[VERIFY the AUD-on-tax-invoice rule — GSTR 2001/2 covers foreign-currency invoicing; confirm exact conversion-rate rules.]** |

---

## A6. Chart of accounts conventions (Australia)

There is **no prescribed statutory COA** in Australia. Practice is set by the incumbents (Xero/MYOB), and accountants expect their shape.

**Xero-style default numbering (the de facto standard your AU users expect):**

| Range | Class |
|---|---|
| 200–299 | Revenue |
| 300–399 | Direct costs / COGS |
| 400–499 | Operating expenses |
| 500–599 | (often further expenses / other) |
| 600–699 | Current assets (610 Accounts Receivable, 620 Prepayments, 630 Inventory) |
| 700–799 | Fixed assets (710 Office Equipment, 711 Accumulated Depreciation …) |
| 800–899 | Current liabilities (800 Accounts Payable, **820 GST**, **825 PAYG Withholding Payable**, **826 Superannuation Payable**, 830 Income Tax Payable, 840 Historical Adjustment) |
| 900–999 | Equity / non-current liabilities (960 Retained Earnings, 970 Owner A Share Capital) |

MYOB uses a different, class-prefixed scheme (`1-xxxx` Assets, `2-xxxx` Liabilities, `3-xxxx` Equity, `4-xxxx` Income, `5-xxxx` Cost of Sales, `6-xxxx` Expenses, `8-xxxx` Other Income, `9-xxxx` Other Expenses). **Support both shapes as importable templates** — migration from Xero/MYOB is the primary acquisition path.

**Non-negotiable AU expectations from accountants:**
1. **One GST control account** ("GST" in Xero, `2-xxxx GST Liabilities` in MYOB) that nets 1A against 1B, **plus** the ability to see GST Collected and GST Paid separately. Xero users expect a single "GST" account; MYOB users expect split "GST Collected"/"GST Paid". Offer both.
2. Separate liability accounts for **PAYG Withholding Payable**, **PAYG Instalments**, **Superannuation Payable**, **No-ABN Withholding**.
3. A **"Rounding"** and a **"Suspense/Historical Adjustment"** account.
4. Every account carries a **default tax code** (`GST`, `FRE`, `EXP`, `INP`, `N-T`/`BAS Excluded`) and a **capital/non-capital flag** (drives G10 vs G11).
5. **Tracking categories / dimensions** (2 in Xero, jobs in MYOB) rather than segmented account codes. Do not force a segmented COA.
6. A **BAS/tax-code-to-label map** must be user-visible and user-editable; AU bookkeepers audit it.

---

## A7. Integrations that matter commercially (Australia)

### A7.1 Bank feeds — the #1 buying criterion
- **CDR / Open Banking** is live for banking and expanding (energy, non-bank lending). Register at [cdr.gov.au](https://www.cdr.gov.au/rollout). Becoming an **Accredited Data Recipient (ADR)** is expensive and slow.
- **Practical path:** use a **CDR Representative** or **Principal ADR** intermediary. Dominant options: **Basiq** (AU-native, ADR, also screen-scraping fallback), **Envestnet | Yodlee**, **Frollo**, **Adatree**.
- Legacy **direct bank feeds** (Xero/MYOB's bilateral agreements with CBA, NAB, ANZ, Westpac) are not open to new entrants at reasonable cost; assume CDR/aggregator.
- Sources: [CDR rollout](https://www.cdr.gov.au/rollout), [ABA Open Banking](https://www.ausbanking.org.au/priorities/open-banking/), [Open Banking Tracker AU](https://www.openbankingtracker.com/country/australia). **[VERIFY current CDR reform status — the government announced changes to CDR scope/obligations; re-check before committing to an ADR strategy: [Open Banking Expo](https://www.openbankingexpo.com/news/australia-opens-the-next-chapter-of-consumer-data-rights/).]**

### A7.2 ABA file (Cemtext) — bulk payment export, still essential
Fixed-width 120-character records, ASCII, CRLF-terminated. Structure:

| Record type | Code | Content |
|---|---|---|
| Descriptive | **`0`** | Reel sequence (01), financial institution abbreviation (3 char, e.g. `CBA`), user preferred name (26), **user ID / APCA number (6 digits)**, description (12, e.g. `PAYROLL`), processing date `DDMMYY` |
| Detail | **`1`** | BSB (`nnn-nnn`), account number (9), indicator, **transaction code (`50` general credit, `53` pay, `54` pension, `56` dividend, `57` debenture; `13` debit)**, amount (10 digits, cents, no decimal), title of account (32), **lodgement reference (18)**, trace BSB + account, remitter name (16), withholding tax amount (8) |
| Total | **`7`** | `999-999`, net total, credit total, debit total, count of type-1 records |

Sources: [Cemtex ABA specification](https://www.cemtexaba.com/aba-format/cemtex-aba-file-format-details/), [ANZ Transactive file formats](https://www.anz.com/content/dam/anzcom/documents/pdf/corporate/transactive/resources/anz-transactive-global-file-formats.pdf), [NAB Connect DE guide](https://www.nab.com.au/content/dam/nab/documents/guides/banking/nab-connect-australian-direct-entry-payments-and-dishonour-report.pdf). **Every bank has minor variations (self-balancing type-1 record required by some, `blank` vs `zero` fill).** Ship a per-bank profile table, not one generator.

### A7.3 BPAY
- Inbound: you are a **biller**; needs a **Biller Code** (4–6 digits) and a **Customer Reference Number (CRN)** per payer/invoice, with a **mod-10 v5 check digit** scheme (issued by the sponsoring bank). Reconciliation arrives via a **BPAY Payment file (BRF/BCF)** from the bank.
- Outbound: pay bills to other billers' Biller Code + CRN — supported in some ABA/H2H variants and in **NPP/PayTo**.
- **NPP / PayID / PayTo** is now the growth surface — real-time, richer remittance data (up to 280 chars), and **PayTo** for direct-debit mandates. Strongly consider PayTo over legacy Direct Debit for SaaS subscription billing and for client-money flows. **[VERIFY current PayTo availability and per-bank coverage.]**

### A7.4 Superannuation clearing house
- **SuperStream** is the mandatory data/payment standard. Contribution messages use the **SuperStream Alternative File Format (SAFF)** or the full ebMS3/AS4 gateway.
- With **SBSCH closed 1 July 2026**, you must either (a) integrate a commercial clearing house (Beam/Australian Retirement Trust, SuperChoice, ClickSuper, QuickSuper/Westpac), or (b) become a SuperStream gateway (don't).
- **7-business-day settlement** under Payday Super makes clearing-house latency a compliance risk you must surface in the UI.
- Sources: [ATO SBSCH closure](https://www.ato.gov.au/businesses-and-organisations/small-business-newsroom/the-small-business-superannuation-clearing-house-is-closing), [ATO transition guidance](https://www.ato.gov.au/businesses-and-organisations/super-for-employers/payday-super-resources/how-to-transition-from-the-small-business-superannuation-clearing-house).

### A7.5 Incumbents to displace / migrate from
- **Xero** — dominant in AU SME and in accounting-practice workflow. Sets every UX expectation (bank rec screen, tracking categories, "GST" account, Simpler BAS). **Migration in/out of Xero is table stakes.**
- **MYOB** — strong in established/older SMEs and in NZ; AccountRight (desktop-hybrid) and Business (cloud).
- **Reckon** — smaller, legacy QuickBooks lineage; **Intuit QuickBooks Online** is a distant third.
- **Practice-side** must-haves: **ATO Online services for agents / Practitioner Lodgment Service (PLS)** via **SBR2**, and integration with **Xero Practice Manager / MYOB AE / FYI Docs / Ignition / Annature (e-sign)**.
- Sources: [ScaleSuite on Xero market share](https://www.scalesuite.com.au/resources/xero-market-share-australian-businesses), [Outbooks 2026 guide](https://outbooks.com.au/best-bookkeeping-software-australia/). **[VERIFY precise market-share figures — vendor-adjacent sources.]**

**ATO machine interface:** all lodgment (BAS, IAS, STP, TPAR, TFN declarations) goes through **Standard Business Reporting (SBR2)** with **Machine Credentials** (RAM/myGovID → now **myID**) and requires **DSP (Digital Service Provider) operational framework** accreditation, including an annual security questionnaire, ISO 27001-or-equivalent controls, and mandatory MFA/audit-logging obligations. **This is a 6–12 month gating dependency — start it before you write the BAS engine.** **[VERIFY current DSP Operational Framework requirements from the ATO Software Developers site — [GAP], not fetched in this pass.]**

---

# PART B — INDONESIA

## B1. E-invoicing: e-Faktur and Coretax

### B1.1 Where Coretax stands now

| Milestone | Date | Source |
|---|---|---|
| Coretax DJP go-live | **1 January 2025** — heavily disrupted; widespread outages, login failures, NSFP problems through H1 2025 | [vatcalc](https://www.vatcalc.com/indonesia/indonesia-e-factur-pajak-electronic-invoicing/), [Klikpajak Coretax error guide](https://klikpajak.id/blog/solusi-coretax-error/) |
| **PER-11/PJ/2025** — the consolidating faktur pajak regulation | Effective **22 May 2025** | [Pajakku](https://pajakku.com/artikel/per-11pj2025-pokok-perubahan-faktur-pajak-dalam-coretax) |
| Full enforcement / end of transitional relief | **31 December 2025** | [vatcalc](https://www.vatcalc.com/indonesia/indonesia-e-factur-pajak-electronic-invoicing/) **[VERIFY]** |
| Steady state | From **1 January 2026** all PKP issue via Coretax; **clearance is a precondition** — a faktur not approved by DJP is **not a faktur pajak** and gives the buyer **no input credit** | [vatcalc](https://www.vatcalc.com/indonesia/indonesia-e-factur-pajak-electronic-invoicing/), [Ortax](https://ortax.org/batas-upload-fp-mundur-jadi-tanggal-20) |

**[VERIFY — material]** vatcalc states e-Faktur Desktop is retained "for specific operational scenarios" and Ortax states the older PER-03/PJ/2022 rules "remain in limited force" for desktop and host-to-host users. DJP has also published that **Coretax auto-adjusts NSFP for invoices created in e-Faktur Desktop** ([Ortax](https://ortax.org/buat-faktur-pajak-di-e-faktur-desktop-coretax-otomatis-sesuaikan-nsfp)), which implies Desktop is **still alive in 2026**. **Confirm the exact 2026 status of e-Faktur Client Desktop with DJP before designing your issuance channel — this is the single most consequential open question in the Indonesian pack.**

### B1.2 The three issuance channels — pick host-to-host

| Channel | Who | Design implication |
|---|---|---|
| **Coretax web portal** | Most SMEs; manual entry or XML/CSV upload | Fine for a low-volume tier; unacceptable UX for a ledger |
| **e-Faktur Client Desktop** | Legacy installed app; local database; batch upload | Avoid building against it. **[VERIFY 2026 status]** |
| **Host-to-Host (H2H) API** | High-volume / ERP-integrated taxpayers | **This is what you build.** Requires DJP approval + a digital certificate. Many SaaS vendors go via a licensed **PJAP / ASP** (Penyedia Jasa Aplikasi Perpajakan) such as OnlinePajak, Pajakku, Klikpajak/Mekari, DDTC, Sobat Pajak rather than direct H2H. |

**Recommendation:** integrate through a **licensed PJAP** for v1. Direct DJP H2H certification is a long, Indonesian-language, in-country process; PJAPs already carry it and absorb Coretax instability. Budget for the PJAP to be a hard dependency and design a queue with retry/backoff — Coretax availability has been the operational story of 2025–26.

### B1.3 NSFP — serial number allocation (the biggest structural difference from AU)

**Old world (pre-Coretax, e-Nofa):**
- PKP applied to DJP via **e-Nofa** for a **block/range** of serial numbers.
- DJP allocated a finite range; the PKP consumed them sequentially.
- Number format was **16 digits**: 2-digit transaction code + 1-digit status code + 13-digit serial (2-digit year + 11-digit sequence).
- Running out mid-month, gaps, and unused-number reporting were constant pain points.
- Source: [OnlinePajak NSFP](https://www.online-pajak.com/tentang-efaktur-ppn/nomor-seri-faktur-pajak/), [Ortax](https://ortax.org/ketentuan-terbaru-kode-transaksi-dan-nomor-seri-faktur-pajak).

**New world (Coretax, PER-11/PJ/2025):**
- **No pre-request.** **No e-Nofa allocation.** The NSFP is **assigned automatically by DJP at the moment the e-Faktur is uploaded and approved.**
- Format is now **17 digits**:

```
NSFP = [TT][SS][YY][NNNNNNNNNNN]
        │   │   │   └── 11 digits: sequence assigned by the DJP system
        │   │   └────── 2 digits: year of e-Faktur creation
        │   └────────── 2 digits: STATUS code (was 1 digit)
        └────────────── 2 digits: TRANSACTION code
```
- Sources: [IKPI](https://ikpi.or.id/en/format-baru-nsfp-era-coretax-kini-17-digit-dan-diberikan-otomatis/), [Ortax](https://ortax.org/ketentuan-terbaru-kode-transaksi-dan-nomor-seri-faktur-pajak), [Enforce A](https://enforcea.com/Blog/format-nomor-seri-faktur-pajak-baru-pada-coretax).

**Engineering consequence — this is the key design point:**
> Your ledger must treat the tax-invoice number as **externally assigned, post-hoc**. Do **not** generate it locally. The internal document must carry your own `internal_invoice_no` plus a nullable `nsfp` that is populated only on DJP approval, and a `faktur_status` state machine:
> `DRAFT → SUBMITTED → APPROVED(nsfp assigned) | REJECTED | CANCELLED | REPLACED`.
> Nothing downstream (PPN output ledger, SPT Masa PPN, customer copy) may be finalised before `APPROVED`.

**Status codes:** `00` = normal (original); `01` = 1st replacement; `02` = 2nd replacement; and so on. Note the widening from 1 to 2 digits — a schema change if you previously modelled this. Source: [Ortax](https://ortax.org/ketentuan-terbaru-kode-transaksi-dan-nomor-seri-faktur-pajak).

### B1.4 Transaction codes (`TT`) — PER-11/PJ/2025

| Code | Meaning |
|---|---|
| **01** | Standard delivery where the **supplier collects** PPN/PPnBM; everything not in 02–10 |
| **02** | Delivery to a **government VAT collector** (bendahara) — buyer withholds/collects |
| **03** | Delivery to a **non-government designated VAT collector** (incl. specified mining/PSC contractors) |
| **04** | Delivery using **DPP Nilai Lain** (other value) per Art. 8A(1) VAT Law — supplier collects. **This is the code that carries the 11/12 mechanism.** |
| **05** | Delivery using **besaran tertentu** (fixed/certain-amount VAT), incl. zero-DPP cases |
| **06** | **VAT refund for foreign tourists** (passport-verified retail) — note: the old code 06 "other deliveries" was replaced; **code 10** now carries "other" |
| **07** | PPN/PPnBM **not collected** (tidak dipungut) or borne by government — projects, bonded zones (KB), strategic goods |
| **08** | PPN/PPnBM **exempt** (dibebaskan) — international transport, diplomatic missions, etc. |
| **09** | Delivery of **assets not originally for sale** (Art. 16D) — supplier collects |
| **10** | **Other deliveries**, including non-standard rates |

Sources: [Ortax on PER-11/PJ/2025 codes](https://ortax.org/ketentuan-terbaru-kode-transaksi-dan-nomor-seri-faktur-pajak), [DJP on transaction codes](https://www.pajak.go.id/en/node/86279). **[VERIFY the 06 → 10 reassignment carefully — Pajakku describes code 10 as "added, replacing the former 06", while Ortax lists 06 as foreign-tourist refunds. Both can be true (06 repurposed), but confirm from PER-11/PJ/2025 itself before hardcoding the enum.]**

### B1.5 Mandatory faktur pajak fields (PER-11/PJ/2025, Pasal 33)

| Field | Requirement |
|---|---|
| Seller | **Name, address, NPWP** of the issuing PKP |
| Buyer — domestic entity or government | **Name, address, NPWP** |
| Buyer — domestic individual | **Name, address, and NPWP *or* NIK** (national ID number) |
| Buyer — foreign individual | **Name, address, passport number** |
| Buyer — foreign entity | **Name and address** only |
| Line detail | Type of goods/services, **selling price / consideration**, **discounts** |
| Tax | **PPN collected**; **PPnBM** where applicable |
| Document | **Transaction code, serial number (NSFP), date of creation** |
| Signature | **Name and signature** of the authorised signatory |
| Retail exception | Buyer identity may be omitted for retail (faktur pajak eceran) |

Source: [Ortax on faktur field completion](https://ortax.org/cara-pengisian-keterangan-pada-faktur-pajak).

**NPWP is now 16 digits** (aligned to NIK) under the NPWP-16 reform. Validate both 15-digit legacy and 16-digit formats and store canonically as 16. **[VERIFY the current mandatory format and whether 15-digit NPWP is still accepted anywhere in Coretax.]**

### B1.6 Timing rules — when the faktur must exist

**Faktur must be *created* at the earliest of:**
1. **Delivery** of taxable goods (BKP) or taxable services (JKP);
2. **Receipt of payment**, if payment precedes delivery (down payment / uang muka);
3. **Receipt of each termin (progress) payment** for staged work;
4. The moment of **export** of goods or services;
5. Other moments specified by MoF regulation.

**Faktur must be *uploaded and approved by DJP* by the 20th of the month following the creation date.** (Extended from the 15th by PER-11/PJ/2025.)

**Consequence of late upload:** DJP **will not approve** it, and "e-Faktur tidak disetujui DJP, e-Faktur tersebut bukanlah faktur pajak" — it is not a tax invoice at all, and is **not creditable** by the buyer.

**Penalty (UU HPP Art. 14(4)):** administrative fine of **1% of the DPP** for failing to issue, or issuing late (reduced from the old 2%). Beyond 3 months late it is treated as not issued at all, plus the 1%. DJP issues an **STP (Surat Tagihan Pajak)**.

Sources: [OnlinePajak on faktur timing](https://www.online-pajak.com/tentang-efaktur-ppn/kapan-faktur-pajak-diterbitkan/), [Ortax on the 20th deadline](https://ortax.org/batas-upload-fp-mundur-jadi-tanggal-20), [Pajakku on late fakturs](https://artikel.pajakku.com/contoh-faktur-pajak-terlambat-dibuat-menurut-per-11pj2025).

**Implementation:** run a **hard monthly job at the 20th** that alerts on any `SUBMITTED`-but-not-`APPROVED` faktur and any `DRAFT` faktur with `created_date` in the prior month. Surface a "days to NSFP expiry" countdown. This is the highest-frequency compliance failure mode in Indonesia and a real differentiator.

### B1.7 Corrections: replacement vs cancellation — get this right

| Situation | Action |
|---|---|
| **Wrong buyer identity (NPWP/NIK/name)** | **Cancel and reissue.** A replacement faktur is **not** permitted. |
| Wrong amount / description / other data | **Faktur pengganti** (replacement), status code increments `01`, `02`, … |
| Returns / cancellations | Handled via **nota retur** / **nota pembatalan**; replacement fakturs must reflect the **net** value after considering returns and cancellations |

Sources: [Pajakku PER-11/PJ/2025](https://pajakku.com/artikel/per-11pj2025-pokok-perubahan-faktur-pajak-dalam-coretax), [Pajakku faktur pengganti](https://pajakku.com/artikel/e-faktur-ganti-cara-buat-faktur-pengganti-via-coretax).

**Schema:** `faktur.replaces_faktur_id` (self-FK), `faktur.replacement_sequence`, plus separate `nota_retur` and `nota_pembatalan` document types with their own numbering and their own effect on the PPN ledger.

### B1.8 e-Bupot — withholding certificates (Coretax module)

Under **PMK 81/2024** the withholding certificate function moved into the **e-Bupot module in Coretax**, consolidating what were previously separate applications.

| Module | Covers | Form/document types |
|---|---|---|
| **e-Bupot Unifikasi** | PPh **4(2), 15, 22, 23, 26** | **BPPU** — domestic taxpayers & PEs; **BPNR** — non-resident (foreign) recipients; **Penyetoran Sendiri** — self-paid; **Pemotongan Secara Digunggung** — aggregated withholding; XML bulk upload for qualifying transactions |
| **e-Bupot 21/26** | Individual income | **BP21** — non-permanent employees; **BP26** — foreign individuals; **BPA1 / BPA2** — annual certificates for permanent employees; monthly certificates for ongoing withholding |

Taxpayers can **create, correct (betulkan), and cancel (batalkan)** bupot electronically. The bupot is the recipient's evidence of a **tax credit** (non-final) or of **final tax paid**.

Source: [Pajakku on e-Bupot in Coretax](https://pajakku.com/artikel/memahami-e-bupot-di-coretax-fungsi-jenis-dan-menu-utamanya).

**Implementation:** a bupot is a **first-class document in your ledger**, not a report artifact. Every vendor bill that triggers withholding must produce a linked bupot record with its own number, status (`DRAFT/ISSUED/CORRECTED/CANCELLED`), PDF, and delivery-to-vendor step. Indonesian vendors **will chase you for the bukti potong** — failure to deliver it is a commercial dispute, not just a tax one.

---

## B2. Indirect tax — PPN, PPnBM, PMSE

### B2.1 The 12% / effective-11% mechanics — exactly what happened

This is the most misreported area in Indonesian tax. The precise position:

1. **UU HPP (UU 7/2021)** legislated a PPN rate rise to **12% from 1 January 2025**.
2. Days before commencement, the government issued **PMK 131/2024**. It did **not** repeal the 12% rate. The **statutory rate is 12%**.
3. Instead, for **non-luxury** goods and services, the **tax base (DPP) is set to "Nilai Lain" = 11/12 of the selling price**. So: `PPN = 12% × (11/12 × price) = 11% × price`. The **effective burden stays at 11%**.
4. For goods **subject to PPnBM** (luxury: certain motor vehicles, private aircraft, yachts, luxury residences, etc.), DPP = the full selling price, so the **effective rate is a true 12%**.
5. Effective **1 January 2025**; for luxury goods sold to **end consumers**, a one-month transition applied and the 12% effective rate began **1 February 2025**.

Sources: [DJP on PMK 131/2024](https://www.pajak.go.id/en/node/113453), [DDTC — effective rate stays 11%](https://news.ddtc.co.id/berita/nasional/1816162/januari-2025-tarif-efektif-ppn-tetap-11-persen-tak-jadi-12-persen), [OnlinePajak calculation guide](https://www.online-pajak.com/seputar-ppn-efaktur/pmk-131-tahun-2024-dan-cara-hitung-ppn-12-persen/).

**Status in 2026:** unchanged. Kemenkeu confirmed **12% continues to apply to luxury goods in 2026**, i.e. the PMK 131 split remains in force. Sources: [DDTC](https://news.ddtc.co.id/berita/nasional/1812992/tak-berubah-tarif-ppn-12-tetap-berlaku-untuk-barang-mewah-di-2026), [Kontan/Kemenkeu](https://nasional.kontan.co.id/news/kemenkeu-pastikan-tarif-ppn-12-tetap-berlaku-untuk-barang-mewah-pada-2026), [Media Keuangan](https://mediakeuangan.id/detail/478697/tetap-12-persen-ini-aturan-pajak-barang-mewah-untuk-tahun-2026). **[VERIFY there is no 2026 PMK superseding PMK 131/2024 — check pajak.go.id and jdih.kemenkeu.go.id before shipping rate config.]**

**Implementation — do NOT hardcode 11%:**

```
rate            = 0.12                       # statutory, constant
dpp_factor      = 11/12  if not ppnbm_item   # DPP Nilai Lain
                = 1      if ppnbm_item
dpp             = price * dpp_factor
ppn             = round(dpp * rate)
faktur_tx_code  = '04' if dpp_factor != 1 else '01'   # 04 = DPP Nilai Lain
```
The faktur pajak must show the **rate as 12%** and the **DPP as the 11/12 value** — not "11%". A product that prints "PPN 11%" on the faktur is non-compliant. Store `rate`, `dpp_factor`, `dpp`, and `ppn` as separate persisted columns; never derive the historical rate from a constant.

**Rounding:** Indonesian practice rounds to whole Rupiah. **[VERIFY the exact rounding rule DJP applies at faktur validation — mismatches of Rp 1 cause rejections. Confirm from PER-11/PJ/2025 or Coretax validation rules.]**

### B2.2 Other PPN parameters

| Item | Value | Source |
|---|---|---|
| Standard rate | **12%** statutory; **11% effective** on non-luxury via 11/12 DPP | above |
| Export of goods / certain services | **0%** | UU PPN |
| PKP registration threshold | Gross turnover **> Rp 4.8 billion** per year (below this, registration is optional) | **[VERIFY — widely cited (PMK 197/PMK.03/2013 as amended); confirm current figure]** |
| Non-taxable (non-BKP/JKP) & exempt | Basic necessities, medical & health services, education, social & religious services, financial services, insurance, certain public transport, etc. (UU PPN Art. 4A, as amended by UU HPP) | **[VERIFY the current Art. 4A list — UU HPP moved several items from "non-BKP" to "exempt", which changes the faktur transaction code from none to 08]** |

### B2.3 PPnBM (Sales Tax on Luxury Goods)

Levied **in addition to** PPN, **once**, at import or at delivery by the manufacturer. Not creditable.

| Group | Rate band | Examples |
|---|---|---|
| I | **10%–25%** | Luxury residences/apartments, certain electronics, certain motor vehicles |
| II | **25%–50%** | Hot-air balloons, ammunition, mid-range luxury vessels |
| III | **50%–75%** | Helicopters, private aircraft, firearms |
| IV | **100%–200%** | Alcoholic beverages, extremely luxurious goods |

Statutory maximum under UU HPP: **200%** (and 0% on exports). **Battery electric vehicles: 0% PPnBM** (policy incentive).

Legal basis: **UU 42/2009** as amended by **UU HPP 7/2021**; **PP 61/2020** (non-motor-vehicle goods); **PP 74/2021** (motor vehicles); **PMK 141/PMK.010/2021** (vehicle classification); **PMK 12/2025** (EV/hybrid incentives). Sources: [OnlinePajak PPnBM rates](https://www.online-pajak.com/pajak/tarif-ppnbm), [Pajakku on PMK 12/2025](https://artikel.pajakku.com/pmk-122025-ketentuan-insentif-pajak-mobil-listrik-dan-hybrid-2025). **[VERIFY specific rates per HS/tariff line — the bands are wide and item-specific.]**

**Implementation:** `item.ppnbm_rate` (nullable) on the product master, and `item.is_ppnbm` driving the `dpp_factor = 1` branch above. PPnBM posts to a **separate liability account** and a separate faktur field; it is **never** part of the PPN base and **never** creditable.

### B2.4 PPN PMSE — VAT on cross-border digital goods and services

- Foreign sellers/providers/marketplaces ("PMSE") **designated by DJP** must collect Indonesian PPN on B2C digital supplies to Indonesian customers.
- Rate follows the general rule (currently **11% effective** for non-luxury digital services). **[VERIFY whether PMSE collectors apply the 11/12 DPP mechanism or a flat 11% — this is a real ambiguity; check the DJP PMSE guidance.]**
- DJP maintains and publishes a **register of appointed PMSE collectors** — 151 collectors and **Rp 12.57 trillion** collected as at DJP's published update. Names include Netflix, Google, Meta, TikTok, Tencent Cloud, Perplexity AI.
- Sources: [DJP — 151 PMSE collectors](https://pajak.go.id/en/node/97122), [DJP — earlier 144 collectors](https://pajak.go.id/en/node/94358), [DDTC](https://news.ddtc.co.id/berita/nasional/1801281/djp-tambah-lagi-4-perusahaan-pemungut-ppn-pmse-ada-tencent-cloud), [Ortax](https://ortax.org/simak-ketentuan-terbaru-ppn-pmse).

**This applies to *you*.** A foreign-domiciled SaaS accounting product selling to Indonesian customers is squarely a PMSE supply. Once your Indonesian revenue/traffic crosses the designation thresholds, DJP will appoint you as a PMSE collector, and you must charge PPN on your own subscriptions, remit monthly, and file a quarterly PMSE return. **Model this in your own billing stack before you launch in Indonesia.** For B2B customers, the PMSE collector issues a **commercial invoice/receipt stating the PPN** which the Indonesian buyer can credit — **not** a faktur pajak. **[VERIFY the current designation thresholds (historically Rp 600m/yr revenue or 12,000 traffic/yr) and the input-credit treatment of PMSE documents.]**

### B2.5 Filing calendar (post-PMK 81/2024)

**PMK 81/2024** (effective **1 January 2025**) harmonised payment deadlines to the **15th** for most monthly taxes.

| Tax | Pay (setor) by | File (lapor) by |
|---|---|---|
| **PPh 21/26 (employment)** | **15th** of following month | **20th** of following month |
| **PPh 23/26** | **15th** of following month | **20th** of following month |
| **PPh 4(2) final** | **15th** of following month | **20th** of following month |
| **PPh 15** | **15th** of following month | **20th** of following month |
| **PPh 22 (collected by collector)** | **15th** of following month (customs-collected: with duty / 1 business day) | **20th** of following month |
| **PPh 25 (instalment)** | **15th** of following month | Deemed filed on payment (SSP validation) |
| **PPN / PPnBM (SPT Masa PPN)** | **End of the following month**, and in any case **before the SPT Masa PPN is filed** | **End of the following month** |
| **PPN — collected by a VAT collector (bendahara/BUMN)** | Varies by collector type | **[VERIFY]** |

Sources: [Ortax on PMK 81/2024 deadlines](https://ortax.org/jatuh-tempo-pembayaran-pajak-masa-menurut-pmk-81-2024), [MUC](https://muc.co.id/en/article/dgt-through-pmk-812024-the-tax-payment-deadline-is-uniformly-set-for-the-15th-of-the-following-month), [DDTC](https://news.ddtc.co.id/berita/nasional/1806640/pmk-812024-terbit-coretax-seragamkan-tanggal-setor-pajak), [DJP PPh 23/26 (20-day filing)](https://pajak.go.id/en/node/34298).

**If a deadline falls on a holiday or weekend it moves to the next business day.** Your calendar engine needs the **Indonesian national holiday + cuti bersama** calendar, which is published annually by SKB 3 Menteri and changes every year. Do not compute it — ingest it.

**Annual:** SPT Tahunan **PPh Badan** (corporate) due **4 months** after year end = **30 April** for calendar-year taxpayers; individuals **31 March**. **[VERIFY against PMK 81/2024, which restated some annual deadlines.]**

---

## B3. Withholding tax (Indonesia) — what a ledger must post

Indonesia is a **withholding-heavy jurisdiction**. Unlike Australia, withholding on **ordinary B2B service payments is the norm, not the exception**. This is the #1 reason a generic ledger fails in Indonesia.

### B3.1 Which apply to ordinary business payments

| Article | Applies to | Who withholds | Ledger impact |
|---|---|---|---|
| **PPh 21** | Payments to **individuals** for employment, services, honoraria | Employer/payer | High volume, payroll-linked |
| **PPh 22** | Imports; sales to/purchases by government treasurers & BUMN; specified industries | Collector (customs, treasurer, designated manufacturer) | Occasional |
| **PPh 23** | **Domestic** payments for **services, rent (non-land/building), royalties, interest, dividends, prizes** | The **payer** | **Very high volume — the default on almost every vendor service bill** |
| **PPh 26** | Payments to **non-residents** | The payer | Medium; treaty-rate handling required |
| **PPh 4(2)** | **Final** taxes — land/building rent, construction services, deposit interest, certain dividends, MSME turnover tax, land/building transfer | Payer (or self-paid) | High volume; **final = no credit** |
| **PPh 15** | Deemed-profit regimes (shipping, airlines, certain foreign trade reps) | Payer | Niche |

### B3.2 Rates — PPh 23 / 26

| Object | Rate | Notes |
|---|---|---|
| **Interest, royalties, prizes/awards/bonuses** (not already PPh 21) | **15%** of gross | PPh 23 |
| **Dividends** (to domestic corporate, where not exempt) | **15%** | PPh 23 |
| **Rent of assets other than land & building** | **2%** of gross | PPh 23 (land/building rent is PPh 4(2) at 10%) |
| **Technical, management, construction, consulting and other specified services** | **2%** of gross | PPh 23. The "other services" list is enumerated by PMK — **60+ categories** |
| **No NPWP** | **Rate is increased by 100%** → 30% instead of 15%, **4% instead of 2%** | PPh 23 |
| **PPh 26 — all payments to non-residents** (dividends, interest, royalties, services, rent, prizes) | **20%** of gross | Reducible by **tax treaty (P3B)** on production of a valid **DGT Form / Certificate of Domicile (SKD)** |

Source: [DJP — PPh Pasal 23/26](https://pajak.go.id/en/node/34298).

**Critical implementation detail — the "other services" list.** PPh 23 at 2% applies only to services **enumerated** in the governing PMK (currently PMK 141/PMK.03/2015 as amended). A service not on the list is not subject to PPh 23. You need a **maintained service-type reference table** keyed to the PMK list, mapped to your product/service master, with the rate and the e-Bupot object code. **[GAP — I did not retrieve the enumerated list; obtain PMK 141/PMK.03/2015 Annex and the current Coretax object-code list.]**

### B3.3 Rates — PPh 4(2) final

| Object | Rate | Base |
|---|---|---|
| **Rent of land and/or buildings** | **10%** | Gross rent. Final. |
| Construction — **execution**, small qualified | **1.75%** | Gross contract value |
| Construction — **execution**, medium/large qualified | **2.65%** | |
| Construction — **execution**, unqualified | **4%** | |
| Construction — **planning/supervision (consultant)**, qualified | **3.5%** | |
| Construction — **planning/supervision**, unqualified | **6%** | |
| **Deposit / savings interest** | **20%** | |
| Bond interest | **15%–20%** (varies by recipient) | |
| **Dividends to resident individuals** | **10%** (exempt if reinvested per UU HPP) | |
| Lottery/gambling prizes | **25%** | |
| **Transfer of land/buildings** | **2.5%** (0.5% for simple housing; 1% certain) | Gross transfer value |
| Share transactions on IDX | **0.1%** (+0.5% for founder shares) | |
| **MSME final tax (PP 55/2022)** | **0.5%** | Gross turnover, for eligible taxpayers under Rp 4.8bn |

Sources: [Klikpajak PPh 4(2)](https://klikpajak.id/blog/pph-pasal-4-ayat-2/) (rates per **PP 9/2022** for construction), [DJPb Kemenkeu](https://djpb.kemenkeu.go.id/kppn/bandaaceh/id/layanan/perpajakan/pph-pasal-4-ayat-2.html). **[VERIFY the land/building transfer and share-transaction rates — ranges cited; confirm exact per-case rates.]**

### B3.4 Rates — PPh 22 (selected)

| Object | Rate |
|---|---|
| Import (general, with API) | 2.5% |
| Import (without API) | 7.5% |
| Import of specified consumer goods | up to 10% |
| **Government treasurer / BUMN purchases of goods** | **1.5%** of purchase price (ex-VAT) |
| Cement (manufacturer sales to distributors) | 0.25% |
| Paper | 0.1% |
| Steel (upstream) | 0.3% |
| Automotive (manufacturer/ATPM sales) | 0.45% |
| Pharmaceuticals | 0.3% |
| Fuel/lubricants | 0.25%–0.3% |
| Mining commodity purchases | 1.5% |
| Very luxurious goods (property) | 1% |
| Very luxurious goods (other) | 5% |
| Export of specified commodities | 1.5% |

Source: [Ortax PPh 22 guide](https://ortax.org/panduan-pph-pasal-22-objek-tarif-dan-administrasinya), [DJP PPh 22](https://pajak.go.id/en/node/34299). Recent basis: **PMK 51/2025**. **[VERIFY — the Ortax table cites PMK 51/2025; confirm it is in force and the rates above are current.]** Non-NPWP surcharge for PPh 22 is generally **+100%**. **[VERIFY]**

### B3.5 PPh 21 — the TER regime (summary; you need this even if you don't build payroll)

**PP 58/2023** (effective **1 January 2024**) introduced the **TER (Tarif Efektif Rata-rata / average effective rate)** method:
- **Months 1–11:** withhold using a **monthly TER** applied to **gross monthly income**. TER is selected by category:
  - **TER A** — PTKP status TK/0, TK/1, K/0
  - **TER B** — TK/2, TK/3, K/1, K/2
  - **TER C** — K/3
  - **TER Harian** — daily/casual workers
- **Month 12 (December / final month):** compute the **annual** liability using the progressive Art. 17 rates (5% / 15% / 25% / 30% / 35%) less PTKP and deductions, and true up against TER already withheld.
- Sources: [Klikpajak PPh 21](https://klikpajak.id/blog/pajak-penghasilan-pasal-21-2/), [BINUS on PP 58/2023](https://online.binus.ac.id/accounting/2024/01/08/pp-58-tahun-2023/), [Pajakku on TER changes](https://artikel.pajakku.com/perubahan-tarif-pemotongan-ter-pph-21-terbaru-tarif-efektif-hingga-contoh-perhitungan).

**[VERIFY]** Pajakku's headline refers to "perubahan tarif pemotongan TER terbaru" — **check whether the TER tables were revised for 2025/2026**. The TER brackets are numerous (roughly 44/40/41 bands across A/B/C); obtain them from the PP 58/2023 annex or the current amending regulation and load them as **data, not code**.

**Ledger implication:** even if payroll is outsourced, your ledger must post PPh 21 as a distinct liability and must reconcile to the e-Bupot 21/26 module output, and the **December true-up creates a material month-12 swing** you must not smooth.

### B3.6 The bukti potong obligation and the journals

**Obligation:** the withholder **must** issue a **bukti potong** (withholding slip) to the payee for every withholding event, via **e-Bupot** in Coretax, and report it in the **SPT Masa PPh Unifikasi** (for 4(2)/15/22/23/26) or **SPT Masa PPh 21/26**. Source: [DJP](https://pajak.go.id/en/node/34298), [Pajakku](https://pajakku.com/artikel/memahami-e-bupot-di-coretax-fungsi-jenis-dan-menu-utamanya).

**Journals — you are the payer (withholding on a vendor bill).** Example: Rp 100,000,000 consulting fee, PPN 11% effective, PPh 23 at 2%.

| | Dr | Cr |
|---|---|---|
| Consulting Expense | 100,000,000 | |
| PPN Masukan (Input VAT — asset) | 11,000,000 | |
| &nbsp;&nbsp;Accounts Payable — Vendor | | 109,000,000 |
| &nbsp;&nbsp;**Utang PPh 23** (PPh 23 payable) | | 2,000,000 |

*(Note: PPh 23 is computed on the **gross fee ex-VAT**, 2% × 100,000,000. PPN is computed on DPP = 11/12 × 100,000,000 × 12% = 11,000,000.)*

On remittance (by the 15th):

| | Dr | Cr |
|---|---|---|
| Utang PPh 23 | 2,000,000 | |
| &nbsp;&nbsp;Bank | | 2,000,000 |

**Journals — you are the payee (a customer withholds from you).** Rp 100,000,000 fee you invoice, customer withholds PPh 23 2%:

| | Dr | Cr |
|---|---|---|
| Accounts Receivable | 111,000,000 | |
| &nbsp;&nbsp;Revenue | | 100,000,000 |
| &nbsp;&nbsp;PPN Keluaran (Output VAT) | | 11,000,000 |

On receipt of cash + bukti potong:

| | Dr | Cr |
|---|---|---|
| Bank | 109,000,000 | |
| **PPh 23 Dibayar Dimuka** (prepaid tax — asset, creditable) | 2,000,000 | |
| &nbsp;&nbsp;Accounts Receivable | | 111,000,000 |

**This second pattern is the one generic ledgers get wrong.** The receivable does **not** clear to cash; a residual must be cleared against a **prepaid-tax asset**, and that asset is only supportable if you hold the **bukti potong**. Your AR application UI **must** allow "settle with withholding" and must attach/track the bupot document.

**For final taxes (PPh 4(2))** the withheld amount is **not** a prepaid asset — it is an **expense** (or a reduction of revenue, per policy), because it cannot be credited. Model `withholding_type = CREDITABLE | FINAL` and branch the posting.

**Required tracking per bupot (for the credit to survive audit):** bupot number, date, withholder NPWP & name, object code, gross base, rate, amount, tax period, and the PDF. Build a **"missing bukti potong" ageing report** — this is a genuinely differentiating feature in Indonesia.

---

## B4. Statutory accounts & GAAP (Indonesia)

### B4.1 The four-pillar SAK structure

| Framework | For | Basis | Status |
|---|---|---|---|
| **SAK (PSAK/ISAK)** | Publicly accountable entities: listed companies, banks, insurers, entities holding assets in a fiduciary capacity | **IFRS-converged** | Current |
| **SAK EP** — *Entitas Privat* | Private (non-publicly-accountable) entities | **IFRS for SMEs**-based, 35 chapters | **Effective 1 January 2025**, replacing **SAK ETAP** |
| **SAK EMKM** | Micro, small & medium entities | Very simplified, historical cost | Current |
| **SAK Syariah** | Sharia transactions | — | Current |

Sources: [IAI — SAK EP effective 1 Jan 2025](https://web.iaiglobal.or.id/SAK-EP-Efektif/SAK%20Entitas%20Privat%20Efektif%20Per%201%20Januari%202025), [IAI — About SAK EP](https://web.iaiglobal.or.id/SAK-IAI/Tentang%20SAK%20Entitas%20Privat%20(EP)), [SW Indonesia](https://sw-indonesia.com/insights/standar-baru-akuntansi-untuk-entitas-privat/), [Acclime PSAK guide](https://indonesia.acclime.com/guides/psak-financial-reporting-standards/).

**[VERIFY]** IAI's page does not explicitly state SAK EP *replaced* SAK ETAP; secondary sources uniformly say it did (ETAP withdrawn effective 1 Jan 2025). Confirm whether SAK ETAP is formally withdrawn or still permitted for a transition cohort.

### B4.2 PSAK renumbering — **confirmed, effective 1 January 2024**

DSAK-IAI renumbered all PSAK/ISAK to align with IFRS numbering. **The renumbering is presentational only — "it does not affect the substance of the regulations."**

Scheme:
- **PSAK 1xx** — standards referring to **IFRS Accounting Standards** (i.e. IFRS 1–19). New number = 100 + IFRS number.
- **PSAK 2xx** — standards referring to **IAS**. New number = 200 + IAS number.
- **PSAK 3xx / 4xx** — standards **not** referring to IFRS (Indonesia-specific).
- **ISAK** renumbered on the same logic (IFRIC → 1xx, SIC → 2xx).

Key mappings your reporting templates must handle:

| Old | New | IFRS/IAS | Title |
|---|---|---|---|
| PSAK 1 | **PSAK 201** | IAS 1 | Presentation of Financial Statements |
| PSAK 2 | **PSAK 207** | IAS 7 | Statement of Cash Flows |
| PSAK 3 | **PSAK 234** | IAS 34 | Interim Financial Reporting |
| PSAK 4 | **PSAK 227** | IAS 27 | Separate Financial Statements |
| PSAK 5 | **PSAK 108** | IFRS 8 | Operating Segments |
| PSAK 7 | **PSAK 224** | IAS 24 | Related Party Disclosures |
| PSAK 8 | **PSAK 210** | IAS 10 | Events after the Reporting Period |
| PSAK 10 | **PSAK 221** | IAS 21 | Effects of Changes in Foreign Exchange Rates |
| PSAK 13 | **PSAK 240** | IAS 40 | Investment Property |
| PSAK 14 | **PSAK 202** | IAS 2 | Inventories |
| PSAK 15 | **PSAK 228** | IAS 28 | Investments in Associates and Joint Ventures |
| PSAK 16 | **PSAK 216** | IAS 16 | Property, Plant and Equipment |
| PSAK 19 | **PSAK 238** | IAS 38 | Intangible Assets |
| PSAK 22 | **PSAK 103** | IFRS 3 | Business Combinations |
| PSAK 24 | **PSAK 219** | IAS 19 | Employee Benefits |
| PSAK 25 | **PSAK 208** | IAS 8 | Accounting Policies, Changes in Estimates and Errors |
| PSAK 26 | **PSAK 223** | IAS 23 | Borrowing Costs |
| PSAK 46 | **PSAK 212** | IAS 12 | Income Taxes |
| PSAK 48 | **PSAK 236** | IAS 36 | Impairment of Assets |
| PSAK 50 | **PSAK 232** | IAS 32 | Financial Instruments: Presentation |
| PSAK 53 | **PSAK 102** | IFRS 2 | Share-based Payment |
| PSAK 55 | **PSAK 239** | IAS 39 | Financial Instruments: Recognition & Measurement |
| PSAK 56 | **PSAK 233** | IAS 33 | Earnings per Share |
| PSAK 57 | **PSAK 237** | IAS 37 | Provisions, Contingent Liabilities and Contingent Assets |
| PSAK 58 | **PSAK 105** | IFRS 5 | Non-current Assets Held for Sale & Discontinued Operations |
| PSAK 60 | **PSAK 107** | IFRS 7 | Financial Instruments: Disclosures |
| PSAK 62 | **PSAK 104** | IFRS 4 | Insurance Contracts |
| PSAK 63 | **PSAK 229** | IAS 29 | Financial Reporting in Hyperinflationary Economies |
| PSAK 64 | **PSAK 106** | IFRS 6 | Exploration for and Evaluation of Mineral Resources |
| PSAK 65 | **PSAK 110** | IFRS 10 | Consolidated Financial Statements |
| PSAK 66 | **PSAK 111** | IFRS 11 | Joint Arrangements |
| PSAK 67 | **PSAK 112** | IFRS 12 | Disclosure of Interests in Other Entities |
| PSAK 68 | **PSAK 113** | IFRS 13 | Fair Value Measurement |
| PSAK 69 | **PSAK 241** | IAS 41 | Agriculture |
| PSAK 71 | **PSAK 109** | IFRS 9 | Financial Instruments |
| PSAK 72 | **PSAK 115** | IFRS 15 | Revenue from Contracts with Customers |
| PSAK 73 | **PSAK 116** | IFRS 16 | Leases |
| PSAK 74 | **PSAK 117** | IFRS 17 | Insurance Contracts |

Sources: [IAI official renumbering paper (PDF)](https://web.iaiglobal.or.id/assets/files/file_publikasi/Perubahan_Penomoran_PSAK_ISAK_dalam_SAK_Indonesia.pdf), [IAI comparison table (PDF)](https://web.iaiglobal.or.id/assets/files/file_publikasi/Komparasi%20Perubahan%20Penomoran%20PSAK%20ISAK%20SAK%20Indonesia_FINAL.pdf), [KAP TWJ mapping](https://www.kaptwj.com/post/updated-psak-numbering-effective-january-2024), [IAI SAK update page](https://web.iaiglobal.or.id/Berita-IAI/detail/sak_indonesia_update_-_psak_berlaku_efektif_2024_dan_setelahnya), [PwC PSAK Pocket Guide 2025 (PDF)](https://www.pwc.com/id/en/publications/assurance/psak-pocket-guide-2025.pdf), [Deloitte guide 2024 (PDF)](https://www.deloitte.com/content/dam/assets-zone1/southeast-asia/en/docs/services/audit-assurance/2025/id-aud-guidances-to-the-indonesian-financial-accounting-standards-2024.pdf).

**Note: the table above is transcribed from a secondary source (KAP TWJ). Reconcile it against the IAI comparison PDF before shipping.** **[VERIFY]** Also note PwC's pocket guide is the best single reference for *effective dates* of each standard — the renumbering (2024) is separate from the *substantive* new standards (**PSAK 117 / IFRS 17 insurance contracts**, effective **1 January 2025**; sources: [IAI press release](https://web.iaiglobal.or.id/Berita-IAI/detail/siaran_pers_-_psak_117_meningkatkan_keberlanjutan_industri_asuransi), [Antara](https://www.antaranews.com/berita/5675049/aaji-psak-117-ubah-standar-laporan-keuangan-perusahaan-asuransi)).

**Product consequence:** your Indonesian report templates, disclosure checklists, and any "prepared in accordance with PSAK X" boilerplate must use the **new numbers**. Indonesian accountants in 2026 still say "PSAK 72" colloquially — support **both** in search and label the new number as canonical.

### B4.3 Who must file / audit
- **PT (limited liability companies)** must prepare annual financial statements under UU 40/2007 (Company Law), approved at the AGM.
- **Audit is mandatory** where the company: is a **Perseroan Terbuka** (public); collects/manages public funds; issues debt instruments; is a **BUMN**; has **assets ≥ Rp 50 billion**; or is required by other legislation. **[VERIFY the Rp 50bn threshold and the full list against UU 40/2007 Art. 68.]**
- **LKTP (Laporan Keuangan Tahunan Perusahaan)** must be filed with the **Ministry of Trade** for certain companies (foreign investment/PMA, public companies, debtors with audited statements, companies with assets ≥ Rp 25bn). **[VERIFY — legal basis UU 3/1982 + Permendag; confirm current thresholds and whether the filing is still active.]**
- **OJK-supervised entities** (banks, insurers, listed issuers, multifinance, fintech) have their own periodic reporting into **SPRINT/APOLO/SIPP** systems, with prescribed taxonomies. Out of scope for a general ledger, but relevant if you target financial-services clients.
- **[GAP]** — I did not verify these filing thresholds from primary sources in this pass.

### B4.4 Fiscal year
- Indonesian tax year defaults to the **calendar year (1 Jan – 31 Dec)**. Non-calendar years are permitted if consistently applied and notified. Contrast with Australia's July–June — your fiscal-calendar abstraction must handle both cleanly.

---

## B5. Numbering, retention, residency, language (Indonesia)

### B5.1 Numbering
- **Faktur pajak (NSFP):** government-assigned, 17 digits, auto-allocated on approval — see **B1.3**. **This is the defining Indonesian localisation constraint.**
- **Bukti potong:** numbered by the e-Bupot module in Coretax.
- **Commercial invoices:** no statutory scheme; internal numbering is free. Common practice is `INV/{YYYY}/{MM}/{seq}` or a department-prefixed scheme.
- **Design rule:** your Indonesian tenants need **two number series per sale** — an internal commercial invoice number you control, and a faktur pajak NSFP you do not. Never conflate them.

### B5.2 Retention

| Basis | Period | Applies to |
|---|---|---|
| **UU KUP Art. 28(11)** | **10 years** | Books, records, and the **underlying documents/source documents**, plus records of data processed electronically or online. Retained in Indonesia. |
| **UU 8/1997 (Dokumen Perusahaan)** | **10 years** for financial documents (from the end of the accounting year); other documents per the company's own retention schedule | Company documents generally |

Sources: [DDTC on the 10-year rule](https://news.ddtc.co.id/berita/nasional/1805429/alasan-dokumen-dasar-pembukuan-wajib-disimpan-selama-10-tahun), [Gosri Consulting on KUP Art. 28](https://www.gosriconsulting.com/pasal-28-uu-ketentuan-umum-dan-tata-cara-perpajakan-kup-mengenai-pembukuan), [UU 8/1997 text](http://hukum.unsrat.ac.id/uu/uu_8_97.htm), [Pratama Institute](https://pratamainstitute.com/kewajiban-menyimpan-dokumen).

**Design rule: 10-year retention floor for Indonesia, with the data physically retrievable in Indonesia.** The 10-year period is tied to the statute of limitations for tax assessment. Note UU KUP Art. 28(11) also requires books/records/documents to be **kept in Indonesia** — for the taxpayer's own records. **[VERIFY the exact "kept in Indonesia" wording in Art. 28(11) — this is the closest thing Indonesia has to an accounting-data residency rule and it matters more to your customers than PP 71/2019 does.]**

### B5.3 Data residency — what actually applies

This is widely misunderstood. Three separate regimes:

1. **PP 71/2019** (Penyelenggaraan Sistem dan Transaksi Elektronik), replacing PP 82/2012:
   - **Public-scope ESOs** (*Penyelenggara Sistem Elektronik Lingkup Publik* — government bodies and institutions performing government functions) **must** manage, process and store electronic systems/data **in Indonesian territory**, with limited exceptions.
   - **Private-scope ESOs** (*Lingkup Privat* — commercial operators, which is what a SaaS accounting product is) **may manage, process and store data outside Indonesia**, provided they guarantee access for supervision and law enforcement by Indonesian authorities.
   - Sources: [PP 71/2019 at peraturan.bpk.go.id](https://peraturan.bpk.go.id/Details/122030/pp-no-71-tahun-2019), [Komdigi JDIH](https://jdih.komdigi.go.id/produk_hukum/view/id/695/t/peraturan+pemerintah+nomor+71+tahun+2019), [CRMS Indonesia analysis](https://crmsindonesia.org/publications/pp-712019-implikasi-peraturan-sistem-dan-transaksi-elektronik-terbaru/). **[VERIFY the public/private distinction and the access-guarantee condition directly from the PP text — my fetch of the Hukumonline analysis failed and this summary rests on secondary characterisation. This is a claim you will make to customers; source it properly.]**
   - **Also:** private ESOs must **register with Komdigi (formerly Kominfo)** as a PSE Lingkup Privat if they serve Indonesian users. A foreign SaaS product with Indonesian users is expected to register. **[VERIFY the current registration obligation and process — Permenkominfo 5/2020 as amended.]**

2. **OJK POJK 11/POJK.03/2022** (Penyelenggaraan Teknologi Informasi oleh Bank Umum):
   - Applies **only to commercial banks**, not to their software vendors directly — but it flows down contractually.
   - Permits banks to place data centres/DRCs and use **cloud** offshore, **subject to OJK notification/approval** and conditions (risk assessment, audit rights, exit plan, OJK access).
   - Sources: [OJK summary PDF](https://www.ojk.go.id/id/regulasi/Documents/Pages/Penyelenggaraan-Teknologi-Informasi-Oleh-Bank-Umum/RINGKASAN%20POJK%2011%20-%2003%20-%202022.pdf), [OJK FAQ PDF](https://ojk.go.id/id/regulasi/Documents/Pages/Penyelenggaraan-Teknologi-Informasi-Oleh-Bank-Umum/FAQ%20POJK%2011%20-%2003%20-%202022.pdf), [Bisnis.com](https://finansial.bisnis.com/read/20220731/90/1561194/ada-pojk-penyelenggara-teknologi-informasi-pusat-data-diatur-ulang).
   - **Relevance to you:** only if you sell to banks/OJK-supervised entities, or if you want bank partnerships. Expect the bank's vendor-risk team to demand in-country hosting, audit rights, and OJK notification support.

3. **UU 27/2022 (PDP — Personal Data Protection Law)**: no hard residency requirement, but cross-border transfer requires adequacy, appropriate safeguards, or consent. Fully in force since **October 2024** (2-year transition ended). **[VERIFY the implementing regulation (RPP PDP) status — it was pending for a long time.]**

**Practical build guidance:** for a general accounting SaaS, **PP 71/2019 does not force in-country hosting**. But (a) UU KUP Art. 28(11) points toward keeping the taxpayer's books accessible in Indonesia, (b) enterprise and financial-services buyers will demand it, and (c) Coretax/PJAP integration is latency-sensitive. **Recommendation: deploy an Indonesian region (Jakarta — AWS ap-southeast-3, GCP asia-southeast2, Azure Indonesia Central) as a first-class tenancy option, and register as a PSE Lingkup Privat.** Treat it as a commercial requirement even though the legal case is weaker than commonly claimed — and be honest in your marketing about which it is.

### B5.4 Language and currency

| Rule | Detail | Source |
|---|---|---|
| **Bookkeeping default** | Books must be maintained in **Indonesian**, in **Rupiah**, using **Latin script and Arabic numerals**, in Indonesia (UU KUP Art. 28) | [Gosri on KUP Art. 28](https://www.gosriconsulting.com/pasal-28-uu-ketentuan-umum-dan-tata-cara-perpajakan-kup-mengenai-pembukuan) |
| **Exception** | **English + US Dollar** permitted **with prior DGT approval** | below |
| **Who may apply** | (1) **PMA / foreign investment companies**; (2) **BUT / permanent establishments**; (3) taxpayers bound by **government agreements** (PSC/Contracts of Work); (4) certain corporate entities (incl. those registered on a foreign exchange, investment funds, and subsidiaries of foreign parents where USD is the functional currency) | [DJP](https://pajak.go.id/en/node/65840) |
| **Deadline to apply** | **At least 3 months before the start of the fiscal year** to be covered; or from the date of establishment for new taxpayers | [DJP](https://pajak.go.id/en/node/65840) |
| **Required with the application** | Statement that books will be in English with **all** assets, liabilities, equity, income and expenses in USD; a valid **SKF (Surat Keterangan Fiskal)** verification code; plus category-specific evidence (foreign listing letter, parent-company functional-currency statement, the governing agreement requiring English/USD) | [DJP](https://pajak.go.id/en/node/65840) |
| **Decision time** | DGT approves or rejects **within 1 month** of a complete application | [DJP](https://pajak.go.id/en/node/65840) |
| **Legal basis** | **PER-24/PJ/2020** (effective 28 December 2020), replacing PER-11/PJ/2010; underlying **PMK 123/PMK.03/2019** | [DJP](https://pajak.go.id/en/node/65840), [PMK 123/PMK.03/2019 (Kemenkeu JDIH PDF)](https://jdih.kemenkeu.go.id/api/download/fulltext/2019/123~PMK.03~2019Per.pdf) |
| **Note** | It is **English + USD only** — not any language, not any currency. Approval is a package. | [Ortax](https://ortax.org/ini-syarat-pembukuan-pencatatan-dalam-bahasa-inggris-dan-dolar-as) |

**Contracts:** **UU 24/2009** + **Perpres 63/2019** require agreements involving Indonesian parties to be made in **Bahasa Indonesia** (a foreign-language version may accompany it; case law has voided Indonesian-language-only-absent contracts). Relevant to your **customer terms of service and DPA** for Indonesian customers — you should have a bilingual ToS. Sources: [Hukumonline](https://www.hukumonline.com/berita/a/mengenal-kewajiban-penggunaan-bahasa-indonesia-dalam-perjanjian-bisnis-lt5f6aada1062c1/), [Hukumonline Klinik](https://www.hukumonline.com/klinik/a/wajibkah-membuat-kontrak-dalam-dua-bahasa-jika-melibatkan-pihak-asing--lt4dd480ffe6cb1/).

**Product requirement — non-negotiable:**
1. **Full Bahasa Indonesia UI and all printed documents in Indonesian.** English-only will not sell.
2. **IDR base currency with no decimals** displayed (Rupiah amounts are whole; store with decimals internally but present as whole rupiah with `.` thousands separators and `,` decimal separator — Indonesian locale is `id-ID`, opposite to en-AU).
3. **Multi-currency transactions with IDR functional currency**, translated at the **Ministry of Finance weekly tax exchange rate (KMK kurs pajak)** for tax purposes — **not** the BI middle rate, and **not** your accounting rate. You need **two rate tables**: an accounting rate (PSAK 221/IAS 21) and the **KMK tax rate** for faktur pajak and withholding. This is a common failure in ported products.
4. A **USD/English mode** for approved PMA taxpayers, with the approval reference stored.

---

## B6. Chart of accounts conventions (Indonesia)

No statutory COA for commercial entities. The convention is a **numeric class-prefixed scheme**, and Accurate/Zahir/Jurnal have standardised it:

| Prefix | Class | Indonesian label |
|---|---|---|
| **1** | Assets | **Aset / Aktiva** |
| **2** | Liabilities | **Liabilitas / Kewajiban** |
| **3** | Equity | **Ekuitas / Modal** |
| **4** | Revenue | **Pendapatan / Penjualan** |
| **5** | Cost of goods sold | **Harga Pokok Penjualan (HPP)** |
| **6** | Operating expenses | **Beban Operasional / Biaya** |
| **7** | Other income | **Pendapatan Lain-lain** |
| **8** | Other expenses | **Beban Lain-lain** |
| **9** | Tax / extraordinary | **Pajak Penghasilan** |

Typical codes: `1-1100 Kas`, `1-1200 Bank`, `1-1300 Piutang Usaha`, `1-1400 Persediaan`, `1-1500 PPN Masukan`, `1-1600 PPh 23 Dibayar Dimuka`, `1-2100 Aset Tetap`, `1-2200 Akumulasi Penyusutan`, `2-1100 Utang Usaha`, `2-1200 PPN Keluaran`, `2-1300 Utang PPh 21`, `2-1310 Utang PPh 23`, `2-1320 Utang PPh 4(2)`, `2-1400 Utang Gaji`, `3-1000 Modal Saham`, `3-3000 Laba Ditahan`, `4-1000 Penjualan`, `5-1000 HPP`, `6-xxxx Beban ...`.

Sources: [OnlinePajak COA](https://www.online-pajak.com/tentang-pajak/chart-of-account/), [Mekari Jurnal COA classification](https://www.jurnal.id/id/blog/mempelajari-klasifikasi-sistem-kode-akuntansi-chart-of-account/), [Accurate COA](https://accurate.id/akuntansi/pengertian-chart-of-account/), [Solusi Kita on tax-aware COA](https://cvsolusikita.com/coa-akuntansi-pajak/).

**What Indonesian accountants specifically expect — build these or you will lose deals:**
1. **`PPN Masukan` (input VAT) and `PPN Keluaran` (output VAT) as separate accounts**, never netted in the ledger. They net only in the SPT Masa PPN. Add a `PPN Kurang/Lebih Bayar` clearing account.
2. **A separate payable account per PPh article** — `Utang PPh 21`, `Utang PPh 22`, `Utang PPh 23`, `Utang PPh 26`, `Utang PPh 4(2)`, `Utang PPh 25/29`. Do not use one "tax payable".
3. **`PPh 23 Dibayar Dimuka` / `PPh 22 Dibayar Dimuka` / `PPh 25 Dibayar Dimuka`** as *creditable prepaid-tax assets*, reconciled to bukti potong received. These roll into the annual SPT Tahunan tax computation.
4. **A rekonsiliasi fiskal (fiscal reconciliation) capability** — Indonesian accounts must be reconciled from commercial profit to taxable profit, with **koreksi fiskal positif/negatif** classified as **beda tetap (permanent)** vs **beda waktu (temporary)**. Expect the ability to tag accounts and journal lines with a fiscal-correction category and to generate the reconciliation schedule for the SPT Tahunan. **This is the single most-requested Indonesian feature that global products lack.**
5. **`Biaya` vs `Beban`** terminology — use `Beban` for P&L expenses; `Biaya` reads as cost. Get the Indonesian labels right; accountants notice.
6. **HPP (COGS) as its own class**, with the perpetual/periodic distinction and **weighted-average** as the default costing method (FIFO also common; **LIFO is not permitted** under PSAK 202/IAS 2).
7. **Departemen / proyek dimensions** rather than segmented account codes.

---

## B7. Integrations that matter commercially (Indonesia)

### B7.1 Bank connectivity
- **No CDR-equivalent open banking mandate.** Access is bilateral, per bank, commercial.
- **SNAP (Standar Nasional Open API Pembayaran)** — Bank Indonesia's **National Open API Payment Standard**. This is the closest thing to a standard and the right thing to build against. It standardises API contracts, security (asymmetric signature, OAuth2), and message formats across Indonesian banks and PJPs. Sources: [BI SNAP](https://www.bi.go.id/en/layanan/standar/snap/default.aspx), [BCA SNAP migration](https://www.bca.co.id/en/Campaign/2023/Migrasi-SNAP), [Hybrid.co.id on SNAP](https://hybrid.co.id/post/snap-tandai-dimulainya-standardisasi-open-banking-indonesia/).
- **Direct bank APIs:** [BCA Developer Portal](https://developer.bca.co.id/id/Dokumentasi), [Mandiri API](https://www.bankmandiri.co.id/en/mandiri-api), BNI, BRI, Permata, CIMB Niaga. Each requires a commercial agreement; onboarding is slow and relationship-driven.
- **Aggregators:** Brick, Ayoconnect, Finfini, OY!, Flip for Business. **Recommended path for v1** — an aggregator gets you statement fetch + disbursement across banks without N bilateral contracts. **[VERIFY current aggregator licensing status with BI/OJK before relying on one.]**
- **Statement import fallback is mandatory.** Indonesian bank CSV/XLS/PDF statement formats are inconsistent; build a robust per-bank statement parser library. Many Indonesian SMEs will use this rather than an API for years.

### B7.2 Payment acceptance — QRIS and Virtual Account
- **QRIS** (Quick Response Code Indonesian Standard) — BI's mandated national QR standard; interoperable across all banks and e-wallets (GoPay, OVO, DANA, ShopeePay, LinkAja). Modes: **MPM** (Merchant Presented Mode — static or dynamic QR) and **CPM** (Customer Presented Mode). **Dynamic MPM with an embedded amount + reference is what an invoicing product needs**: generate a QR per invoice, get a webhook on payment, auto-reconcile. Source: [QRIS overview](https://en.wikipedia.org/wiki/QRIS), [Colabs on QRIS integration 2026](https://www.colabs.id/en/articles/integrasi-payment-gateway-qris-bisnis-indonesia-2026). **[VERIFY current QRIS MDR (merchant discount rate) tiers — BI has repeatedly adjusted them, including 0% for micro merchants.]**
- **Virtual Account (VA)** — the dominant B2B collection rail. A unique per-customer or per-invoice account number under the merchant's bank prefix; the payer transfers to it and the merchant gets an instant, unambiguously-matched credit. **Closed VA** (fixed amount, single use — ideal per-invoice) vs **Open VA** (any amount). **Build VA-per-invoice; it makes AR reconciliation near-automatic and Indonesian finance teams expect it.**
- **Payment gateways** that wrap QRIS + VA + cards + e-wallets in one API: **Xendit**, **Midtrans** (GoTo), **DOKU**, **iPaymu**, **Faspay**. **Recommendation: integrate one gateway (Xendit or Midtrans) for v1** rather than direct bank VA.
- **BI-FAST** — real-time low-cost interbank transfer (Rp 2,500 cap), the modern rail for disbursements. Use for vendor payment runs.

### B7.3 Incumbents
| Product | Position |
|---|---|
| **Accurate Online / Accurate 5 Desktop** (CPSSoft) | The **incumbent**. Deep penetration in Indonesian SMEs and with local accountants/consultants; strong local tax features, extensive reseller/consultant channel. **The one to benchmark against.** |
| **Mekari Jurnal** (jurnal.id) | Leading cloud-native local SaaS; part of the Mekari suite (Talenta payroll, Klikpajak tax, Qontak CRM). **Klikpajak is a licensed PJAP** — Mekari's tax integration is a genuine moat. Sources: [Mekari Jurnal](https://www.jurnal.id/en/), [Capterra](https://www.capterra.com/p/199870/Jurnal/) |
| **Zahir Accounting** | Long-established local desktop + cloud; strong in traditional SMEs and education |
| **HashMicro, MASERP, SAP B1 / Odoo localisations** | Mid-market / ERP tier |
| **Xero / QuickBooks** | Weak in Indonesia — **no faktur pajak / Coretax integration** is the reason. This is exactly the gap a localised product exploits. |
Source: [HashMicro 2026 roundup](https://www.hashmicro.com/id/blog/rekomendasi-software-akuntansi-di-indonesia/), [Tofu roundup](https://www.gotofu.com/blog/best-bookkeeping-software-indonesia). **[VERIFY — vendor-adjacent sources; no reliable independent market-share data was found.]**

**The commercial thesis for Indonesia:** the product that wins is not the one with the best ledger — it is the one that makes **faktur pajak issuance + NSFP handling + bukti potong + SPT Masa prep** disappear. Partner with or become a **PJAP**.

---

# PART C — CROSS-CUTTING BUILD NOTES

## C1. What the two countries have in common (build once)
- Double-entry ledger, multi-currency with functional-currency translation, accrual + cash basis reporting.
- Period locking, immutable audit trail, soft-delete only (both jurisdictions have long retention).
- Tax code / tax rate as **temporal, versioned data** with effective-from/to. Never a constant.
- Tax-authority filing as an **asynchronous, retryable job with a state machine and full request/response archival**. Both ATO (SBR2) and DJP (Coretax) will time out, reject, and change schemas.
- Document numbering as a **pluggable strategy**: `LOCAL_SEQUENTIAL` (AU) vs `EXTERNALLY_ASSIGNED` (ID faktur pajak).

## C2. Where they diverge hardest (build separately)

| Dimension | Australia | Indonesia |
|---|---|---|
| Fiscal year | **1 Jul – 30 Jun** | **1 Jan – 31 Dec** |
| Indirect tax rate | Flat **10%** | **12% statutory / 11% effective** via 11/12 DPP factor |
| Tax invoice number | Free, self-assigned | **Government-assigned 17-digit NSFP, post-approval** |
| E-invoicing | Voluntary Peppol (B2G targets only) | **Mandatory clearance** — no clearance, no valid invoice, no input credit |
| Withholding on B2B services | Rare (no-ABN only) | **Default** (PPh 23 at 2%, and PPh 4(2)) |
| Withholding certificate | None | **Bukti potong is a mandatory, deliverable document** |
| Small-entity GAAP | AASB 1060 (Tier 2 Simplified Disclosures) | SAK EP / SAK EMKM |
| Language | English | **Bahasa Indonesia mandatory** (English+USD by DGT permission only) |
| Retention | **7 years** (Corporations Act) / 5 (ATO) | **10 years** (UU KUP Art. 28(11)) |
| Residency | None general | None general for private ESOs — but strong commercial + KUP-adjacent pressure to host in Indonesia |
| Currency formatting | `en-AU`, 2 decimals, `1,234.56` | `id-ID`, whole rupiah, `1.234,56` |
| FX rate for tax | ATO published rates | **KMK weekly tax rate**, distinct from the accounting rate |
| Payroll-adjacent | STP2 per-pay reporting + **Payday Super 7 business days** | PPh 21 TER monthly + December true-up; BPJS |

## C3. Suggested build order (highest leverage first)
1. **Indonesia: faktur pajak lifecycle + NSFP state machine + PJAP integration.** Nothing else in Indonesia matters until this works.
2. **Indonesia: PPh 23 / 4(2) withholding on AP and AR, with bukti potong tracking.** The AR-side "settle with withholding" flow is the differentiator.
3. **Australia: BAS/IAS engine with the label map, Simpler BAS branching, and SBR2 lodgment.** Start the ATO DSP accreditation immediately — it is the long pole.
4. **Australia: bank feeds via a CDR intermediary.** This is the primary purchase driver.
5. **Australia: Payday Super liability tracking + SuperStream clearing-house integration.** Timely — SBSCH just closed.
6. **Indonesia: SPT Masa PPN and SPT Masa Unifikasi preparation + rekonsiliasi fiskal.**
7. **Both: statutory report packs** — AASB 1060 for AU, PSAK (new numbering) / SAK EP for ID.
8. **Australia: Peppol via an accredited AP** — valuable, but not a blocker. Do it when you chase government-supplier customers.

## C4. Open items to close before writing the spec
1. **[ID]** Exact 2026 status of **e-Faktur Client Desktop** and whether the PER-03/PJ/2022 rules still apply to any cohort.
2. **[ID]** PMK 141/PMK.03/2015 enumerated **PPh 23 "other services"** list and the Coretax object-code table.
3. **[ID]** Current **TER tables** (A/B/C/Harian) and whether they were revised for 2025/2026.
4. **[ID]** Coretax **rounding and validation rules** for DPP/PPN (Rp 1 mismatches cause rejections).
5. **[ID]** PP 71/2019 **primary text** on the public/private ESO residency split, and the Komdigi PSE registration obligation for foreign SaaS.
6. **[ID]** PMSE designation thresholds and the input-credit treatment of PMSE-issued documents.
7. **[ID]** Confirm no 2026 PMK supersedes **PMK 131/2024**.
8. **[AU]** **PINT A-NZ CustomizationID / ProfileID / document-type identifier strings** from docs.peppol.eu.
9. **[AU]** **ATO DSP Operational Framework** requirements and lead time — this gates everything.
10. **[AU]** **TPAR file specification** and the definitive industry-scope test.
11. **[AU]** Confirm large-proprietary thresholds unchanged at **$50m/$25m/100**, and current **AASB S2 Group 1/2/3** thresholds after the 2026 Budget reforms.
12. **[AU]** ATO position on **offshore record storage** and records-in-English.
13. **[Both]** Current per-bank ABA variations (AU) and per-bank statement formats (ID).
