# Thailand & United States — Accounting/Tax Compliance Implementation Brief
**For a multi-tenant SaaS accounting product · Research date: 17 August 2026**

> **How to read this doc.** Every non-obvious claim carries a source URL inline. Confidence flags:
> - ✅ **CONFIRMED** — verified against a primary source (Revenue Dept, IRS, statute) or two independent secondaries.
> - ⚠️ **LIKELY** — single credible secondary source; verify before shipping.
> - 🔴 **UNCERTAIN / CONFLICTING** — sources disagree or the item is in legal flux. Do not hard-code.
>
> **Golden rule for the localisation pack:** everything with a date attached in this doc is a *versioned, effective-dated rule*, not a constant. Build the rules engine to resolve `(jurisdiction, rule_type, effective_from, effective_to)` before you write a single rate into code.

---

# PART A — THAILAND

## A0. Executive orientation

Thailand is a **post-audit, non-clearance** regime. There is **no B2B e-invoicing mandate** and none legislated for 2026 or 2027. The state's lever is **carrot, not stick**: a 200% (2x) corporate deduction and a reduced 1% e-withholding rate, both now running to 31 Dec 2027.

The three compliance surfaces your ledger must serve:
1. **Revenue Department (RD / กรมสรรพากร)** — VAT, WHT, CIT. Monthly cadence.
2. **Department of Business Development (DBD / กรมพัฒนาธุรกิจการค้า)** — annual statutory financial statements in **XBRL**, via DBD e-Filing only.
3. **TFAC (Federation of Accounting Professions)** — the GAAP setter (TFRS / TFRS for NPAEs).

A Thai SME's month is: issue tax invoices → maintain input/output tax reports → file **PP30** by the 15th → withhold on payments and file **PND 1/3/53/54** by the 7th → annually, audit → AGM → **PND 50** → **DBD XBRL**.

---

## A1. e-Tax Invoice & e-Receipt

### A1.1 Status as of August 2026 ✅ CONFIRMED

**e-Invoicing is VOLUNTARY. There is no mandate, and none legislated for 2026 or 2027.**

- Source: [VATupdate, "E-Invoicing Remains Voluntary — 2026/2027 Updates and Tax Incentives", 15 Jul 2026](https://www.vatupdate.com/2026/07/15/e-invoicing-remains-voluntary-2026-2027-updates-and-tax-incentives/) — "no legislated B2B mandate for 2026 or 2027."
- Source: [VATupdate Thailand Country Booklet, 9 Jul 2026](https://www.vatupdate.com/2026/07/09/thailand-e-invoicing-e-reporting-country-booklet/) — "Thailand explicitly excluded from 2026/2027 global e-invoicing mandates; adoption remains incentive-driven."
- ⚠️ **LIKELY**: commentary points to a **2028 roadmap** for digital reporting. Treat as directional signal only — no legal instrument exists. Design for it; don't build to it.

**Product implication:** e-Tax Invoice is a **premium/opt-in feature**, not a gate on go-live. Do NOT block Thai onboarding on e-Tax Invoice capability. Ship paper/PDF tax invoices that satisfy s.86/4 first.

### A1.2 The two schemes ✅ CONFIRMED

| | **Scheme 1: e-Tax Invoice & e-Receipt** | **Scheme 2: e-Tax Invoice by Email** |
|---|---|---|
| Eligibility | Any VAT-registered business, **no turnover cap** | Small business, **annual revenue ≤ THB 30,000,000** |
| Format | **Structured XML**, ETDA Standard 3-2560 | **PDF/A-3** |
| Integrity mechanism | **Digital signature** — X.509 cert from a CA chaining to Thailand's **NRCA** (National Root Certification Authority); signing via **HSM or USB token** | **ETDA trusted time-stamp** — *no digital certificate required* |
| Route to RD | Issuer (or ETDA-certified service provider) transmits XML to RD | The ETDA time-stamp service **automatically copies the RD** at issuance |
| Deadline to RD | **By the 15th of the following month** | Automatic at issuance |
| Ops burden | High (cert lifecycle, HSM, XML validation) | Very low (email a PDF/A-3 to the ETDA relay address) |

Source for all of the above: [VATupdate Thailand Country Booklet](https://www.vatupdate.com/2026/07/09/thailand-e-invoicing-e-reporting-country-booklet/); [Fiscal Solutions](https://www.fiscal-requirements.com/news/5729).

> 🔴 **UNCERTAIN — verify before building Scheme 2.** The exact ETDA relay email address, the PDF/A-3 embedded-XML requirement (whether an XML attachment inside the PDF/A-3 container is mandatory or optional), and the precise time-stamp token format (RFC 3161?) were not pinned down from primary ETDA sources in this pass. Fetch the ETDA workshop deck at `https://etax.teda.th/etaxdocuments/ETDA_PDFA3_Workshop.pdf` and the `etax.teda.th` portal before implementing.

### A1.3 The XML standard — **CII, NOT UBL** ✅ CONFIRMED (this corrects a common misconception)

**ETDA Recommendation No. 3-2560, "Trade Services Message Standard", Version 2.0** (supersedes ETDA 3-2558 of 2015).

Verified directly against the ETDA English PDF: [ETDA Rec. 3-2560 v3 English, 15 May 2025](https://www.etda.or.th/getattachment/43f4a6d7-946e-4fc3-b5d4-e3c64f9d197a/20250515_ETDA-Rec-3-2560_English-V03.pdf.aspx)

- **Basis: UN/CEFACT Cross Industry Invoice (CII)** — NOT OASIS UBL. The standard cites *UN/CEFACT Business Requirements Specification Cross Industry Invoicing Process v2.00.05* and *Requirements Specification Mapping CII v3.0*.
- **Root element: `<rsm:CrossIndustryInvoice>`**
- Top-level structure:
  - `<rsm:ExchangedDocumentContext>`
  - `<rsm:ExchangedDocument>`
  - `<rsm:SupplyChainTradeTransaction>` → contains `ApplicableHeaderTradeAgreement` / `...Delivery` / `...Settlement`
  - `<ram:IncludedSupplyChainTradeLineItem>` (line items)
- **XSD**: `TaxInvoice_CrossIndustryInvoice_2p0` — available via TEDA repositories ([source](https://www.vatupdate.com/2026/07/09/thailand-e-invoicing-e-reporting-country-booklet/)).
- **Not EN 16931. Not Peppol.** Thailand is not a Peppol authority; there is no evidence of Peppol membership.

**Document type codes** (the `TypeCode` on `ExchangedDocument`):

| Code | Document |
|---|---|
| `INV` | e-Invoice |
| `TIV` | e-Tax Invoice |
| `RCT` | e-Receipt |
| `ABB` | Abbreviated e-Tax Invoice |
| `DCN` | Electronic Debit/Credit Note |
| `CLN` | Electronic Cancellation Note |

**Engineering note:** if your product already emits UBL 2.1 (Peppol/EU markets), Thailand needs a **separate CII serializer**, not a profile of your UBL. Budget accordingly — this is the single largest engineering item in the Thai pack. The semantic model maps reasonably (CII and UBL are both derived from the UN/CEFACT CCTS core), but the syntax is entirely different.

**Party identification:** buyer/seller identified by **TXID scheme** (Thai 13-digit Tax ID) plus country code, with head-office/branch code. See A2.3.

### A1.4 Tax incentives — 200% deduction and 1% e-WHT ✅ CONFIRMED

**Cabinet approval date: 16 June 2026. Both measures now expire 31 December 2027.**

| Incentive | Detail |
|---|---|
| **200% (2x) corporate deduction** | For companies and registered partnerships investing in e-tax infrastructure. Qualifying costs: **software systems, computer hardware, electronic data storage, fees paid to approved e-tax service providers, and ETDA information-system assessment costs.** Expires **31 Dec 2027**. |
| **Reduced e-Withholding Tax rate** | Flat **1%** for **all transaction types** routed through the e-WHT bank scheme (replacing the standard 1%/2%/3%/5% rates). Effective on Cabinet approval **16 Jun 2026**, expires **31 Dec 2027**. Estimated to release ~THB 27bn of private-sector liquidity. |

Sources: [Acclime Thailand](https://thailand.acclime.com/news/e-withholding-tax-cut-digital-tax-incentives-extended/); [Bangkok Post, "Cabinet extends e-withholding tax cut through 2027"](https://www.bangkokpost.com/business/general/3271861/cabinet-extends-ewithholding-tax-cut-through-2027); [HLB Thailand](https://www.hlbthai.com/cabinet-approves-extension-of-tax-measures-to-end-of-2027-to-promote-adoption-of-electronic-tax-systems/); [Mahanakorn Partners](https://mahanakornpartners.com/thailand-approves-two-year-extension-of-electronic-tax-system-incentives/).

> 🔴 **UNCERTAIN.** As at the July 2026 reporting, the **formal Royal Decree and Ministerial Regulation implementing the June 2026 Cabinet resolution were still pending issuance** ([VATupdate](https://www.vatupdate.com/2026/07/15/e-invoicing-remains-voluntary-2026-2027-updates-and-tax-incentives/)). Cabinet approval ≠ law in Thailand. **Do not hard-code the 1% e-WHT rate as live** — make it a config-flagged, effective-dated rate with a "pending decree" state, and verify the Royal Decree number before enabling by default.

### A1.5 Legal instruments (the citation stack)

| Instrument | Covers |
|---|---|
| Ministerial Regulation No. 384 B.E. 2565 (Aug 2022) | Enabling framework for e-tax documents |
| RD Notifications No. 48, 247, 248, 249 (2022) | Operational rules for e-Tax Invoice & e-Receipt |
| ETDA Rec. 3-2560 v2.0 | XML message standard (CII) |
| Revenue Code s.86/4 | Tax invoice mandatory particulars |
| Revenue Code s.89, s.89/1, s.90/4 | Penalties |

Source: [VATupdate Country Booklet](https://www.vatupdate.com/2026/07/09/thailand-e-invoicing-e-reporting-country-booklet/).

### A1.6 Penalties ✅ CONFIRMED
- **s.89** — fine of **2× the tax amount** for issuing a false or unauthorised tax invoice.
- **s.89/1** — **1.5% per month** surcharge on unpaid tax.
- **s.90/4** — criminal: up to **7 years imprisonment** and/or **THB 200,000** for intentional document falsification.

---

## A2. VAT

### A2.1 Rate ✅ CONFIRMED — **7%, now extended to 30 September 2027**

**This is a change since late 2025 and the single most likely thing to be stale in any older spec.**

| Fact | Value |
|---|---|
| Current effective rate | **7%** (inclusive of local tax) |
| Statutory / default rate if the decree lapses | **10%** ⚠️ LIKELY |
| Current extension expires | **30 September 2027** |
| Cabinet approved this extension | **27 July 2026** |
| Prior expiry (superseded) | 30 September 2026 |
| Scope | Sale of goods, provision of services, and imports |

Source: [HLB Thailand, "Cabinet approves 1 year extension of 7% VAT rate until 30 September 2027"](https://www.hlbthai.com/cabinet-approves-1-year-extension-of-7-vat-rate-until-30-september-2027/). Historical context: [Nation Thailand — 34 years of VAT cuts across 23 royal decrees](https://www.nationthailand.com/business/economy/40069837).

> 🔴 **UNCERTAIN — the Royal Decree number for the 2026→2027 extension was not identified.** Thailand has issued 23 successive royal decrees on this since 1992; each is a one-year extension approved by Cabinet then issued as a decree. **Architect for annual renewal.** Your VAT rate table must be effective-dated with a **hard expiry at 2027-09-30** and an alerting job. Never hard-code `0.07`.

**Zero-rated (0%):** exports; services rendered in Thailand but utilised abroad.
**Exempt:** agricultural products, newspapers, textbooks, healthcare, education, professional services, cultural activities. Source: [RD English site — Value Added Tax](https://www.rd.go.th/english/6043.html).

> **Engineering note:** zero-rated ≠ exempt. Zero-rated supplies preserve input tax recovery; exempt supplies do not (and drive input tax apportionment). Model these as two distinct `tax_treatment` enum values from day one — retrofitting this is painful.

### A2.2 Registration threshold ✅ CONFIRMED

- **THB 1,800,000 annual turnover.** Above this, registration is mandatory. Source: [RD English site](https://www.rd.go.th/english/6043.html).
- Voluntary registration is available below the threshold.
- Registration form: **PP01**. VAT certificate: **PP20**.
- ⚠️ **LIKELY**: registration must be filed within **30 days** of exceeding the threshold.

**Product implication:** build a **threshold monitor** — rolling turnover vs THB 1.8m with an alert. This is a high-value feature for the SME segment and cheap to build.

### A2.3 Tax invoice mandatory particulars — Revenue Code s.86/4 ✅ CONFIRMED (primary source)

Verified against [RD English site, Sections 85–86](https://www.rd.go.th/english/37741.html).

**Full tax invoice — required fields:**

| # | s.86/4 requirement | Suggested field name | Notes |
|---|---|---|---|
| 1 | The word **"ใบกำกับภาษี" / "Tax invoice"** in a prominent place | `document_type_label` | Must be visually prominent — not a footnote |
| 2 | Name, address and **taxpayer identification number** of the issuer | `seller.name`, `seller.address`, `seller.tax_id` | 13-digit TIN |
| 3 | Name and address of the **purchaser** | `buyer.name`, `buyer.address` | Buyer TIN is required in practice via Director-General prescription — see below |
| 4 | **Serial number**, and number of the book (if any) | `invoice_number`, `book_number` | See A5.1 |
| 5 | Description, **type, category, quantity and value** of goods or services | `line_items[]` | |
| 6 | **VAT amount, clearly separated** from the value of goods/services | `vat_amount` | Must be a separate visible line — not embedded |
| 7 | **Date of issuance** | `issue_date` | |
| 8 | Other particulars prescribed by the **Director-General** | — | This is the hook under which **buyer TIN and head office/branch code** are required |

**Language & currency (s.86/4 closing paragraph) ✅ CONFIRMED:**
> Tax invoices must be in **Thai language, Thai currency and Thai or Arabic numerals**. Foreign language and/or foreign currency are permitted **only with Director-General approval**.

**Abbreviated tax invoice — s.86/6 ✅ CONFIRMED:**
- Retail only. Omits buyer details.
- Requires **prior Director-General approval**.
- **Buyer CANNOT claim input VAT credit** from an abbreviated tax invoice — no exceptions, no retroactive fix ([source](https://invoicedataextraction.com/blog/thailand-tax-invoice-requirements)).
- **Agents may not issue abbreviated tax invoices.**
- Code systems for goods descriptions require **15 days' advance notice** to the Director-General.
- ⚠️ **LIKELY**: sellers with a monthly tax base under **THB 300,000** may aggregate same-day sales under **THB 1,000** into a single invoice.

**Credit / debit notes ⚠️ LIKELY:**
- **s.86/9 — debit note** (upward adjustment to tax base); **s.86/10 — credit note** (downward adjustment).
- Must be issued **in the same tax month as the triggering event, or at the latest in the following tax month**.
- Must reference **the original tax invoice number and date** plus a reason for adjustment, and carry all mandatory tax invoice fields.
- Source: [invoicedataextraction.com](https://invoicedataextraction.com/blog/thailand-tax-invoice-requirements). **Verify against the statute** before relying on the timing rule — it is a hard constraint on your period-close logic.

> **Engineering note — this is a real design constraint.** A credit note cannot be issued freely against an arbitrarily old invoice. Your credit-note flow must **validate the tax-month window** and warn/block outside it. Most international products get this wrong.

### A2.4 PP30 monthly return ✅ CONFIRMED

| Item | Value |
|---|---|
| Form | **PP30** (P.P.30 / ภ.พ.30) |
| Frequency | **Monthly** (per tax month), even if nil |
| Paper deadline | **Within 15 days of the following month** |
| e-Filing deadline | **23rd of the following month** ⚠️ LIKELY (extension granted by successive RD notifications — verify current validity period) |
| Filed at | Area Revenue Branch Office, or RD e-Filing |
| Core computation | **VAT liability = Output Tax − Input Tax** |
| Excess input tax | Creditable against output tax **within the next 6 months**; refund claimable **within 3 years** |

Source: [RD English site](https://www.rd.go.th/english/6043.html).

**Related forms:**
- **PP36** — self-assessment/reverse-charge VAT remittance by a Thai recipient on services supplied from abroad and utilised in Thailand.
- **PP30.9** — the VES return for registered non-resident e-service providers (see A2.7).

### A2.5 VAT reports — Revenue Code s.87 ✅ CONFIRMED (primary source)

Verified against [RD English site, Sections 87–90](https://www.rd.go.th/english/37747.html).

**Three statutory reports (these are NOT optional and NOT the same as your GL):**

| Report | Thai | Required of |
|---|---|---|
| **Output tax report** (รายงานภาษีขาย) | Sales VAT register | All VAT registrants |
| **Input tax report** (รายงานภาษีซื้อ) | Purchase VAT register | All VAT registrants |
| **Goods and raw materials report** (รายงานสินค้าและวัตถุดิบ) | Stock register | **Only** registrants carrying on business in the **sale of goods** |

**Timing (s.87): entries must be made within 3 working days** from the date of acquisition or disposition of the goods or service.

> **Engineering note — this is a hard, unusual requirement.** A 3-working-day posting window on the VAT registers is stricter than most jurisdictions. If your product allows back-dated entry into closed or near-closed periods, you need a Thai-specific **soft-lock at T+3 working days** on VAT-relevant documents, with an override + audit trail. Also: the "goods and raw materials report" means a **perpetual inventory register is statutorily required** for goods traders — you cannot ship a services-only inventory model to Thai goods businesses.

**Retention (s.87/3) ✅ CONFIRMED:** at least **5 years** from the date of return filing or report making. Kept **at the place of business** where the report is made, or another place prescribed by the Director-General. Exceptions: ceased businesses → **2 years** after closure; Director-General may extend to **7 years**.

### A2.6 Input/Output VAT accounts — ledger design

Minimum Thai VAT account set (map to your CoA template):

| Account | Type | Purpose |
|---|---|---|
| Output VAT (ภาษีขาย) | Liability | VAT charged on sales; credited on invoice |
| Input VAT (ภาษีซื้อ) | Asset | VAT paid on purchases; debited on supplier invoice |
| **Undue Output VAT** (ภาษีขายยังไม่ถึงกำหนด) | Liability | **Critical for Thailand** — service supplies where the tax point is *receipt of payment*, not invoice date |
| **Undue Input VAT** (ภาษีซื้อยังไม่ถึงกำหนด) | Asset | Mirror for purchases of services |
| VAT Payable / (Refundable) | Liability/Asset | Net PP30 position for the month |
| VAT Suspense / Unclaimable Input VAT | Expense | Input VAT denied (abbreviated invoices, non-compliant invoices, entertainment) |

> **Engineering note — the "undue VAT" concept is the #1 Thai localisation trap.** For **services**, the VAT tax point in Thailand is generally **when payment is received**, not when the invoice is issued. For **goods**, it is delivery/transfer. This means a services business must post output VAT to *Undue Output VAT* on invoice and reclassify to *Output VAT* on cash receipt — and only the latter goes on the PP30. Products that treat invoice date as the universal tax point will overstate Thai VAT liabilities every month. ⚠️ **LIKELY** — the goods vs services tax-point split is well established in practice; confirm the precise statutory basis (Revenue Code s.78 for goods, s.78/1 for services) before implementation.

**Input tax apportionment:** where a business makes both taxable and exempt supplies, input tax must be apportioned. Note there was a **2025 revision to the input tax allocation rules** — see [KPMG TaxNewsFlash, Mar 2025](https://kpmg.com/us/en/taxnewsflash/news/2025/03/thailand-revised-input-tax-allocation-registered-operators.html). ⚠️ Verify the current formula before building the apportionment engine.

### A2.7 VAT on Foreign Electronic Services (VES) ✅ CONFIRMED (primary source)

Verified against the RD's own guide: [rd.go.th/fileadmin/download/eService.pdf](https://www.rd.go.th/fileadmin/download/eService.pdf).

| Item | Value |
|---|---|
| **Effective from** | **1 September 2021** |
| Who registers | Non-resident **electronic service providers** and **electronic platform operators** |
| Threshold | **THB 1,800,000** annual income, **cash basis** |
| Registration deadline | Within **30 days** of exceeding the threshold |
| Applies to | **B2C only** — supplies to customers in Thailand who are **NOT** VAT-registered |
| B2B treatment | **Reverse charge** — the Thai VAT-registered customer self-assesses and remits via **PP36**; the foreign provider has no filing obligation for that supply |
| Return form | **PP30.9** |
| Filing window | **1st–23rd of the following month**, monthly, **even if nil** |
| Rate | **7%** on service fees received |
| **Tax invoices** | **PROHIBITED** — a VES registrant "is not allowed to issue a tax invoice", even if its home jurisdiction requires one |
| **Input tax credit** | **NOT permitted** — output tax only, no deduction |
| FX conversion | Actual conversion rate if converted in the liability month; otherwise **Bank of Thailand average rate on the last business day of the liability month** |
| Payment cut-off | 23rd of following month, **3:30 PM** (wire, via Krungthai Bank) or **8:30 PM** (card) |
| Output tax report | Required, retained **5 years**, submitted only on RD request |

**Scope — "electronic service"**: delivered over the internet/electronic network, **essentially automated** and impossible to supply without technology.
- **In scope:** online games, mobile apps, advertising, software, digital products, web hosting, search engines, streaming, marketplace listing fees.
- **Out of scope:** live teaching, professional consulting delivered by email/video (non-automated human services).
- **e-books** (electronic newspapers, magazines, textbooks) are **VAT-exempt** — sellers cannot register for these.

**Penalties:** late filing = **2× the tax due** for that month; late payment surcharge **1.5%/month** capped at the tax amount; criminal 3 months–7 years and/or up to THB 200,000.

> **Product implication — this is directly relevant to YOU as a SaaS vendor selling into Thailand, not just to your customers.** If your own ARR from Thai non-VAT-registered customers exceeds THB 1.8m, you must register for VES, file PP30.9 monthly, charge 7%, and **must not issue a Thai tax invoice**. Simultaneously, your Thai VAT-registered customers will expect a reverse-charge treatment and will self-assess via PP36. Build a **customer VAT-registration-status capture** into Thai signup flow — it determines which of two entirely different tax paths applies.

---

## A3. Withholding Tax

### A3.1 Forms — which PND for which payee ✅ CONFIRMED (structure) / ⚠️ LIKELY (edge cases)

| Form | Thai | Payee | Income |
|---|---|---|---|
| **PND 1** | ภ.ง.ด.1 | Individual — **employees** | Salary, wages, benefits (s.40(1),(2)) |
| **PND 2** | ภ.ง.ด.2 | Individual | Investment income — dividends, interest (s.40(3),(4)) |
| **PND 3** | ภ.ง.ด.3 | **Individual / ordinary partnership** (subject to personal income tax) | Services, professional fees, rent, etc. |
| **PND 53** | ภ.ง.ด.53 | **Juristic person / company** (subject to corporate income tax) | Services, professional fees, rent, dividends, etc. |
| **PND 54** | ภ.ง.ด.54 | **Non-resident** (foreign company not carrying on business in Thailand) | Payments abroad (s.70) |

Source: [Gentle Law](https://www.gentlelawibl.com/post/thailand-withholding-tax-filing-2026-pnd3); [Reliance Consulting](https://www.relianceconsulting.co.th/withholding-tax/).

> **Engineering note:** the PND 3 / PND 53 split is driven **entirely by the payee's legal-entity type**, not by the expense category. Your vendor master **must** carry a mandatory `payee_tax_type` enum (`individual` | `juristic_person` | `non_resident`) for Thai tenants, or you cannot route WHT to the right return. Make it a required field on Thai vendor creation.

### A3.2 Rate card ⚠️ LIKELY — **verify each line against RD orders before shipping**

Domestic payments (resident payees):

| Income type | Individual (PND 3) | Company (PND 53) | Notes |
|---|---|---|---|
| **Services / hire of work** | 3% | 3% | Standard |
| **Professional fees** (s.40(6)) | 3% | 3% | Law, medicine, engineering, architecture, accounting, fine arts |
| **Rent** — immovable property | 5% | 5% | |
| **Rental service fee / parking** | 3% | 3% | ⚠️ conflicting with "rent 5–10%" in one source |
| **Advertising fees** | 2% | 2% | |
| **Transportation** | 1% | 1% | Excludes public transport fares |
| **Royalties** | 3% | 3% | |
| **Interest** | 15% | **1%** | Individual 15% final; company 1% |
| **Dividends** | 10% | 10% (or 0% with exemption) | s.65 bis (10) exemptions may apply for company-to-company |
| **Prizes / contest awards** | 5% | 5% | |
| **Non-life insurance premiums** | 1% | 1% | |
| **Employment income** | 5–35% progressive (PND 1) | n/a | Withheld per PIT scale |

Non-resident payments (PND 54, s.70) — **no treaty**: dividends **10%**, interest **15%**, royalties **15%**, service fees **15%**. Treaty rates override: dividends typically 10%, interest 0–15%, royalties 5–15%. Sources: [PwC Worldwide Tax Summaries — Thailand WHT](https://taxsummaries.pwc.com/thailand/corporate/withholding-taxes); [Forvis Mazars](https://www.forvismazars.com/th/en/insights/doing-business-in-thailand/tax/withholding-tax-in-thailand); [Reliance Consulting](https://www.relianceconsulting.co.th/withholding-tax/).

> 🔴 **CONFLICTING.** Forvis Mazars gives rent 5% and "rental service fee" 3%; Reliance gives rent "5–10%". PwC's public page does not cover service/rent/professional fees at all. **Do not treat this table as authoritative.** Commission a Thai tax adviser to sign off the rate card, and build it as a **data table with effective dates and a per-tenant override**, not as code.

**Two rules that must be in the engine:**
1. **WHT is computed on the amount BEFORE VAT** (the net/base amount). Source: [Forvis Mazars](https://www.forvismazars.com/th/en/insights/doing-business-in-thailand/tax/withholding-tax-in-thailand). Getting this wrong is a systematic error on every single transaction.
2. **De minimis: THB 1,000.** Withholding is generally triggered where payments exceed THB 1,000; for long-term contracts the threshold is applied to the accumulated annual amount. ⚠️ LIKELY.

### A3.3 Deadlines ✅ CONFIRMED

- **Paper: within 7 days from the end of the month in which payment was made.**
- **e-Filing: within 15 days from the end of the month** — i.e. an **8-day extension**. ⚠️ **LIKELY, and time-limited**: one source states the current e-filing extension runs **1 February 2024 to 31 January 2027** ([Gentle Law](https://www.gentlelawibl.com/post/thailand-withholding-tax-filing-2026-pnd3)). **This expires within the planning horizon — flag it as an effective-dated rule with a 2027-01-31 expiry.**
- Penalties: **1.5% per month** (or part month) surcharge, plus fixed fines (~THB 100–200 per week overdue).

### A3.4 Withholding tax certificate ✅ CONFIRMED (obligation) / ⚠️ LIKELY (detail)

The payer **must issue a withholding tax certificate (หนังสือรับรองการหักภาษี ณ ที่จ่าย)** to the payee. It evidences the amount withheld and is the payee's proof for claiming the credit. Statutory basis: **Revenue Code s.50 bis**. ⚠️ The s.50 bis citation was not verified against the statute in this pass.

Certificate content (⚠️ LIKELY — verify): payer name/address/TIN, payee name/address/TIN, sequence number, type of income, date of payment, gross amount, tax withheld, the PND form on which it will be filed, and a signature.

**Copies:** conventionally issued in multiple copies (payee's copy for tax filing, payee's copy for records, payer's file copy). ⚠️ Verify the exact copy-marking convention.

> **Product requirement:** the WHT certificate is a **first-class document type** in Thailand, not a report. It needs its own numbering sequence, PDF template, delivery/reissue workflow, and a "certificates issued vs WHT posted" reconciliation. Do not model it as an ad-hoc report.

### A3.5 Journals the ledger must post

Example: THB 100,000 service fee from a Thai company, 3% WHT, 7% VAT.

**On supplier invoice (accrual):**
```
Dr  Expense / Service fee            100,000
Dr  Input VAT (or Undue Input VAT)     7,000
    Cr  Accounts Payable                    107,000
```

**On payment:**
```
Dr  Accounts Payable                 107,000
    Cr  Bank                                 104,000
    Cr  WHT Payable (ภาษีหัก ณ ที่จ่ายค้างจ่าย)   3,000
```
*(Note WHT = 3% × 100,000 = 3,000 — computed on the pre-VAT base, NOT on 107,000.)*
*(If services and using Undue Input VAT, also reclassify: Dr Input VAT 7,000 / Cr Undue Input VAT 7,000.)*

**On remittance to RD (by the 7th/15th of the following month):**
```
Dr  WHT Payable                        3,000
    Cr  Bank                                   3,000
```

**On the receivable side** (you are the payee and your customer withholds 3%):
```
Dr  Bank                              104,000
Dr  WHT Receivable / Prepaid CIT        3,000    ← asset, credited against PND 50
    Cr  Accounts Receivable                   107,000
```

> **Engineering note:** `WHT Receivable` is a **prepaid corporate income tax asset** that must be tracked per-certificate and carried to the annual PND 50 as a tax credit. A Thai SME can easily hold hundreds of these. You need a **WHT certificate register** on the AR side with an aging/matching view, or your customers will lose real money at year end. This is a genuinely differentiating feature.

### A3.6 e-Withholding Tax (e-WHT) via banks ✅ CONFIRMED (concept) / 🔴 UNCERTAIN (mechanics)

**Concept:** the payer instructs a participating bank to pay the supplier. The bank splits the payment, remits the WHT directly to the Revenue Department, and transmits the withholding data to the RD electronically.

**Claimed benefits:**
- **Reduced rate: flat 1%** (all transaction types) to **31 Dec 2027** — see A1.4.
- ⚠️ **LIKELY**: **no paper WHT certificate needs to be issued** (the bank's electronic record substitutes), and **no separate PND 3/53 filing** is required for e-WHT transactions.

> 🔴 **UNCERTAIN — this is the weakest-evidence area in the Thai section.** I could not retrieve authoritative detail on: (a) the exact list of participating banks, (b) the payment-instruction file format / API the payer must send to the bank, (c) whether the PND filing obligation is genuinely eliminated or merely pre-populated, (d) whether the certificate obligation is genuinely waived, and (e) the decree numbers behind the 3%→2%→1% rate history. One promising source ([Gentle Law e-WHT 2026 guide](https://www.gentlelawibl.com/post/e-withholding-tax-thailand-2026-how-it-works-legal-certificate-rules-and-a-practical-sme-implemen)) was blocked by robots.txt.
>
> **Recommended action:** treat e-WHT as **Phase 2**. For Phase 1, ship classic WHT + certificates + PND filing, and design the WHT engine so the rate and the certificate/filing obligations are **per-payment-method attributes** — so e-WHT can be slotted in later as a payment method that carries `wht_rate_override = 1%`, `certificate_required = false`, `pnd_filing_required = false`. Confirm each of those three flags with a Thai bank's e-WHT product team (Kasikorn, SCB, Krungthai, Bangkok Bank all offer it) before enabling.

---

## A4. Statutory accounts & GAAP

### A4.1 TFRS vs TFRS for NPAEs ✅ CONFIRMED

Thailand runs a **two-tier** GAAP regime set by **TFAC** (Federation of Accounting Professions / สภาวิชาชีพบัญชี).

| Tier | Who | Standard |
|---|---|---|
| **PAEs** — Publicly Accountable Entities | Listed companies; entities with publicly traded equity or debt; entities filing with the SEC/SET; **banks, insurance companies, securities companies, mutual funds**; public companies | **Full TFRS** — a near-verbatim translation of IFRS |
| **NPAEs** — Non-Publicly Accountable Entities | Everyone else — **the overwhelming majority of your addressable market** (private limited companies, SMEs, foreign branches) | **TFRS for NPAEs** — a standalone simplified framework |

Sources: [IFRS Foundation — Thailand jurisdiction profile](https://www.ifrs.org/use-around-the-world/use-of-ifrs-standards-by-jurisdiction/view-jurisdiction/thailand/); [Forvis Mazars](https://www.forvismazars.com/th/en/insights/doing-business-in-thailand/accounting/exposure-draft-of-tfrs-for-npaes); [Fides Audit](https://www.fidesaudit.co.th/difference-between-tfrs-paes-and-npaes-standards-in-thailand.html).

**TFRS for NPAEs — key characteristics** (post the revision effective **1 January 2023**):
- Expanded from **22 chapters to 28** — new chapters on agriculture, government grants, derivatives, business combinations, mineral resource exploration, service concession agreements.
- **Interim financial statements** now permitted (per TAS 34, with exclusions).
- **OCI**: option for a combined or separate statement.
- **Consolidation and equity method** now permitted (TAS 27, TAS 28, TFRS 10, 11, 12).
- **Property revaluation to fair value** now allowed if reliably measurable, revalued every **3–5 years** (previously cost only).
- **Intangibles**: maximum **10-year** amortisation.
- NPAE definition expanded to include pawn shops and private asset management companies.

> **Engineering note — this is a genuine product decision, not a checkbox.** TFRS for NPAEs is materially simpler than IFRS. Notably, **NPAEs are NOT required to apply IFRS 16 / TFRS 16 lease capitalisation, IFRS 9 expected credit loss, or IFRS 15's five-step model in full.** A Thai SME's balance sheet has **no right-of-use assets** and typically uses a simple allowance for doubtful accounts. If you build one global ledger that assumes ASC 842/IFRS 16 lease capitalisation and ASC 606 five-step revenue, you will be **over-engineering** for 95% of Thai tenants. Make the lease and revenue modules **jurisdiction/framework-gated**.
>
> ⚠️ **VERIFY**: the specific carve-outs above (no TFRS 16, no ECL) are my reasoned inference from the NPAE framework's simplified nature and were **not directly confirmed** in this research pass. Confirm with TFAC's NPAE chapter list before designing the module gating.

🔴 **UNCERTAIN — a further NPAE revision may be in flight.** A source titled "New TFRS 2026 — What Accountants Must Prepare" exists ([grandlinux.com](https://www.grandlinux.com/en/blogs/tfrs-2569.html), referencing B.E. 2569 = 2026), and TFRS 18/19 (the IFRS 18/19 equivalents on presentation and disclosure) are being adopted for PAEs ([Forvis Mazars](https://www.forvismazars.com/th/en/insights/doing-business-in-thailand/accounting/tfrs-18-19-presentation-and-disclosure-updates)). **Check TFAC's announcements page (tfac.or.th) for the standards effective for accounting periods beginning 1 Jan 2026 and 1 Jan 2027** — TFRS 18 in particular changes the income statement structure, which would change your P&L templates for PAE tenants.

### A4.2 The statutory chart of accounts question ✅ **ANSWER: NO — Thailand does NOT prescribe a chart of accounts**

Unlike France (PCG), Belgium, or much of Latin America, **Thailand does not mandate a statutory chart of accounts with fixed account codes.** Neither the Accounting Act B.E. 2543 nor the Revenue Code prescribes account numbering. Businesses are free to design their own CoA.

**BUT — and this is the operative constraint — the *output* is standardised.** The DBD requires financial statements filed in **XBRL against a fixed taxonomy** (A4.3), and the RD requires the **PND 50 tax computation** in a fixed format. So while the CoA is free, **every account must map to a DBD XBRL taxonomy element**.

> **This is the correct architecture for Thailand: a free-form CoA plus a mandatory, validated `xbrl_element_mapping` on every account.** Ship a well-designed default Thai CoA template (most competitors do; Express and FlowAccount both ship one) that is *pre-mapped* to the DBD taxonomy, and make the mapping field required-before-filing rather than required-before-posting. This is a strong differentiator: mapping the CoA to XBRL at year-end is a genuine pain point for Thai accountants.
>
> ⚠️ **LIKELY, not confirmed.** The "no prescribed CoA" conclusion is a negative finding — I found no source prescribing one, and searches for a statutory Thai CoA returned nothing. Negative findings are weaker than positive ones. **Have a Thai accountant confirm** before you architect around it, though I regard this as low risk.

### A4.3 DBD e-Filing of financial statements — XBRL ✅ CONFIRMED (mandate) / 🔴 UNCERTAIN (taxonomy version)

**DBD e-Filing is now the ONLY permitted channel** for submitting financial statements and the shareholder list. Source: [Lexology — "Thailand: Financial Statements and Lists of Shareholders Must Be Submitted via the DBD's E-Filing System Only"](https://www.lexology.com/library/detail.aspx?g=4c3b8d73-6c23-4e89-8521-0e7f0f25498b) (page returned 403 on direct fetch — **verify the exact commencement date**); corroborated by [Gentle Law](https://www.gentlelawibl.com/post/thailand-dbd-e-filing-financial-statements-2026-deadlines-boj-5-xbrl-and-a-foreign-sme-roadmap) and [Emerhub](https://emerhub.com/thailand/audited-financial-statements/).

**Format:** XBRL, submitted as a **.zip upload** with scanned PDF supporting documents. Portal: `efiling.dbd.go.th`.

> 🔴 **UNCERTAIN — the taxonomy version and the exact submission mechanics are the biggest open technical question in the Thai pack.** I could not confirm: (a) the current DBD taxonomy version/namespace, (b) whether submission is true XBRL instance documents or the **DBD's Excel/`.xlsm` template that the portal converts to XBRL** (the latter is what most Thai practitioners actually use, and the BOJ 5 is explicitly described as an `.xlsm` template), (c) whether an API exists for programmatic submission.
>
> **Action:** fetch and study these two primary documents before scoping:
> - [DBD e-Filing workshop deck (efiling.dbd.go.th)](https://efiling.dbd.go.th/efiling-documents/workshop2562.pdf)
> - [TFAC DBD e-Filing guidance (PDF, Thai)](https://www.tfac.or.th/upload/9414/dZD8MWcOHS.pdf)
> - Background: [IRIS — "DBD, Thailand Simplifies Regulatory Reporting using XBRL"](https://irisregtech.com/wp-content/uploads/2023/02/DBD-Thailand-Simplifies-Regulatory-Reporting-using-XBRL.pdf)
>
> **Pragmatic Phase 1:** generate the **DBD Excel template**, not raw XBRL. It is what the market uses, it is far cheaper to build, and the portal does the XBRL conversion. Raw XBRL generation is a Phase 2 optimisation.

### A4.4 Audit requirement ✅ CONFIRMED — **universal for companies**

**Every limited company registered in Thailand must have annual financial statements audited by a licensed CPA — regardless of size, revenue, or activity. A dormant company with zero revenue still requires a full audit.**

Source: [Emerhub](https://emerhub.com/thailand/audited-financial-statements/); corroborated by [Kreston Thailand](https://kreston-thailand.com/comprehensive-guide-to-annual-statutory-audit-in-thailand/), [Belaws](https://belaws.com/thailand/annual-audit/).

- Also required: public companies, **foreign branches, representative offices, regional offices, joint ventures**.
- **Narrow exemption:** registered **ordinary partnerships** below ministerial thresholds for capital, assets and income are exempt from *audit* (they must still prepare financial statements). These may use a **licensed Tax Auditor (TA)** rather than a CPA.
- Auditor must be registered with **TFAC** and independent.

> **Product implication — this is a massive positive signal for your product.** 100% of Thai company tenants have an auditor. That means: (a) an **auditor/accountant collaboration role** with scoped read access is table stakes, not a nice-to-have; (b) an **audit trail that survives scrutiny** is a hard requirement; (c) **trial balance and GL export in the formats Thai audit firms expect** is a top-3 feature; (d) accounting firms are your highest-leverage distribution channel — a Thai SME almost always buys the software its accounting firm recommends.

### A4.5 Annual compliance calendar ✅ CONFIRMED (assume 31 December year-end)

| Deadline | Obligation | Statutory basis |
|---|---|---|
| **Within 4 months of year-end** (30 Apr) | Financial statements approved at **AGM** | Civil & Commercial Code |
| **Within 14 days of AGM** | **BOJ 5 / Bor. Chor. 5** shareholder list to DBD (private limited companies) | |
| **Within 1 month of AGM approval** (by ~31 May) | **Financial statements to DBD** via e-Filing (XBRL) | Accounting Act s.11 |
| **Within 150 days of year-end** (~31 May) | **PND 50** annual CIT return + audited FS to Revenue Department | Revenue Code |
| **Within 2 months of the end of the first 6 months** (31 Aug) | **PND 51** half-year CIT return | Revenue Code |

Sources: [Emerhub](https://emerhub.com/thailand/audited-financial-statements/); [Forvis Mazars — CIT obligations](https://www.forvismazars.com/th/en/insights/doing-business-in-thailand/things-you-should-know/what-are-the-corporate-income-tax-obligations).

**Note the Accounting Act s.11 wording:** financial statements must be submitted **within 5 months** of accounts closing, *or* one month post-AGM-approval for limited companies ([Accounting Act B.E. 2543](https://www.samuiforsale.com/law-texts/accounting-act.html)).

**Penalties:** THB 1,000–200,000, applied to **both the company and directors personally**. Failure to file audited statements can attract **THB 100,000 per entity plus THB 100,000 per director** ([Emerhub](https://emerhub.com/thailand/audited-financial-statements/)).

**CIT rates** ⚠️ LIKELY (not verified this pass): standard **20%**; SME reduced rates apply for companies with paid-up capital ≤ THB 5m and revenue ≤ THB 30m (0% / 15% / 20% brackets). **Verify.**

---

## A5. Numbering, retention, residency, language

### A5.1 Tax invoice numbering ⚠️ LIKELY

- **s.86/4(4) requires a "serial number, and number of the book (if any)"** ✅ CONFIRMED from the statute.
- The statute mandates *sequential* numbering. Practitioner guidance states that **"gaps in the sequence or reused numbers are red flags during Revenue Department audits"** and recommends enforcing strict sequentiality ([source](https://invoicedataextraction.com/blog/thailand-tax-invoice-requirements)).
- The "book number" concept explicitly contemplates **multiple concurrent series** (e.g. per branch, per document type).

> 🔴 **UNCERTAIN on the key question: is *gapless* strictly required by law?** The statute requires a serial number; it does not, in the English text I reviewed, use the word "gapless" or explicitly prohibit gaps. Practitioner guidance treats gaps as an audit risk rather than an outright illegality. **My read: treat gapless-within-series as a hard product requirement anyway.** The cost of enforcing it is low; the cost of a Thai RD audit finding is high. Implement:
> - Per-`(tenant, branch, document_type, series, tax_year)` monotonic counters
> - **Number assigned at issuance/commit, never at draft creation** (drafts abandoned mid-flow must not burn numbers)
> - **Cancellation via a Cancellation Note (`CLN`), never via number deletion** — a cancelled invoice retains its number
> - Number reuse structurally impossible (DB unique constraint, not application logic)

**Branch codes:** Thai tax IDs carry a head-office/branch suffix (head office conventionally `00000`, branches `00001`+). Tax invoices must show the correct branch. Build this into the entity model.

### A5.2 Thai language requirement ✅ CONFIRMED

**Two distinct requirements — do not conflate them:**

| Requirement | Source | Rule |
|---|---|---|
| **Tax invoices** | Revenue Code **s.86/4** closing paragraph | **Thai language, Thai currency, Thai or Arabic numerals.** Foreign language/currency **only with Director-General approval.** |
| **Accounting records** | Accounting Act B.E. 2543 **s.21(1)** | Accounts must be in **Thai**, *or* in a foreign language **accompanied by Thai**, *or* in accounting code **with a Thai translation**. |

Sources: [RD s.85–86](https://www.rd.go.th/english/37741.html); [Accounting Act B.E. 2543](https://www.samuiforsale.com/law-texts/accounting-act.html).

> **Engineering note — the Accounting Act rule is more permissive than most people assume.** You do **not** have to force Thai-only bookkeeping. **Bilingual (English + Thai) records satisfy s.21(1).** This is the right architecture: store a `name_th` and `name_en` on every account, product, and party; render bilingual documents. That satisfies the statute, serves the very common foreign-owned-Thai-subsidiary segment, and gives your auditors what they need. Thai-only would actively harm the expat/MNC segment.
>
> Consequence: **every user-facing master-data string in the Thai pack needs a Thai field, and it needs to be populated, not just present.** Thai script (UTF-8), Thai sort collation, and Thai date rendering (Buddhist Era, BE = CE + 543 — the DBD and RD both use BE on forms) are all required. **Buddhist Era date rendering is a genuine, easily-missed requirement.**

### A5.3 THB functional currency and the exception process ⚠️ LIKELY

- The default is **Thai Baht**. Tax invoices must be in Thai currency (s.86/4).
- **Exception process:** apply to the **Director-General of the Revenue Department** for approval to issue tax invoices in foreign currency, under **s.86/4 and s.86/6**, per **item 5(1) and (2) of the Notification of the Director-General on VAT No. 92**. Source: [Panwa/companythailand.net](https://www.companythailand.net/how-to-do-for-issuing-tax-invoice-in-foreign-language-and-foreign-currency/).

> 🔴 **UNCERTAIN.** The exact application form, processing time, whether the VAT amount must nonetheless be stated in THB, and the mandated exchange-rate source were **not established**. There is also a **separate** regime under Revenue Code **s.76 ter / the functional currency election** allowing certain companies to *keep accounts and file CIT* in a foreign functional currency — this is distinct from tax-invoice currency and was not researched. **Both need verification.**
>
> **Safe Phase 1 design:** THB is the functional/base currency for all Thai tenants. Support multi-currency *transactions* with THB revaluation. Foreign functional currency = explicitly out of scope for v1.
>
> **FX rate source:** for VES, the RD mandates the **Bank of Thailand average rate on the last business day of the liability month** ✅ CONFIRMED. Use BOT rates as your Thai default FX source generally.

### A5.4 Retention ✅ CONFIRMED — **5 years, extendable to 7**

**Consistent across three separate statutes — this is solid:**

| Regime | Period | Source |
|---|---|---|
| **Accounting Act s.14(1)** | **Not less than 5 years** from the date accounts are closed. **s.14(2):** Director may extend to **7 years** for specified business categories. | [Accounting Act B.E. 2543](https://www.samuiforsale.com/law-texts/accounting-act.html) |
| **Revenue Code s.87/3** (VAT) | **At least 5 years** from date of return filing or report making. Ceased business: **2 years** after closure. Director-General may extend to **7 years**. Kept at the place of business. | [RD s.87–90](https://www.rd.go.th/english/37747.html) |
| **e-Tax Invoice** | Retain the **original signed XML or time-stamped PDF/A-3** for min **5 years**, extendable to **7**. Integrity guaranteed by the signature/time-stamp. | [VATupdate booklet](https://www.vatupdate.com/2026/07/09/thailand-e-invoicing-e-reporting-country-booklet/) |
| **VES output tax report** | **5 years**, produced on RD request. | [RD eService guide](https://www.rd.go.th/fileadmin/download/eService.pdf) |

> **Design to 7 years, not 5.** The Director-General extension power makes 5 a floor, not a ceiling, and 7 also covers the US bad-debt case (Part B). One global retention policy of **7 years minimum, with legal hold override** satisfies both jurisdictions. Critically: for e-Tax Invoices you must retain the **original signed artefact byte-for-byte**, not a re-rendered PDF — the signature is the evidence. Your document store needs **immutable original-artefact storage** separate from rendered views.

### A5.5 Data residency & PDPA ⚠️ LIKELY / 🔴 UNCERTAIN on specifics

**Key finding: Thailand does NOT impose a general data-localisation mandate for accounting data.** PDPA (Personal Data Protection Act B.E. 2562/2019) governs *personal data*, and regulates **cross-border transfer** rather than prohibiting it.

- PDPA cross-border transfer (s.28/s.29) permits transfer where the destination has adequate protection, or under exceptions/safeguards (consent, contractual necessity, **BCRs**, or standard contractual clauses). Sources: [Securiti — Thailand cross-border transfer](https://securiti.ai/thailand-cross-border-personal-data-transfer-overview/); [Formichella & Sritawat](https://fosrlaw.com/2026/thailand-pdpa-cross-border-data-transfers/).
- Enforcement has **intensified**: 2026 is characterised as an "enhanced enforcement phase" ([pacmap.dev](https://pacmap.dev/regulation/th-pdpa-enforcement-2026)); see also [Chambers Data Protection & Privacy 2026 — Thailand](https://practiceguides.chambers.com/practice-guides/data-protection-privacy-2026/thailand/trends-and-developments).
- **Counter-pressure from the Revenue Code:** s.87/3 requires VAT reports and tax invoices to be kept **"at the place of business ... or other places as prescribed by the Director-General."** ✅ CONFIRMED. This is a *records-location* rule, not a data-residency rule, but a conservative Thai auditor may read cloud-only storage as non-compliant.

> 🔴 **UNCERTAIN and commercially material.** Whether RD/DBD accept purely offshore cloud storage of statutory records, and whether a Director-General prescription is needed, was **not resolved**. This is a **must-verify-with-Thai-counsel item** — it can determine whether you need a Thailand or at least an ASEAN region.
>
> **Recommended posture:** (1) PDPA compliance programme — DPO, consent/lawful basis records, DSAR handling, breach notification, a **Thai-language privacy notice**; (2) cross-border transfer safeguards (SCCs/BCRs) — do this regardless; (3) provision an **ap-southeast-1 (Singapore) or ap-southeast-7 (Thailand, if available) region** for Thai tenant data as a sales-friendly de-risking move; (4) offer **on-demand export of the complete statutory record set** so a tenant can materialise records "at the place of business" on request. (4) is cheap and neutralises most of the audit objection.

---

## A6. Thailand — Integrations

⚠️ **This section is the least-researched in the brief.** Searches returned thin results; treat all of it as leads, not findings.

### A6.1 Banking & payments
- **PromptPay** — the national real-time retail payment rail (BOT-operated, ITMX). Proxy addressing by national ID / mobile number / Tax ID. Ubiquitous **PromptPay QR** (EMVCo-compliant) is *the* B2C and increasingly B2B collection method. **A generated PromptPay QR on every invoice PDF is arguably the single highest-value, lowest-cost Thai feature you can ship.** Background: [Antom guide to PromptPay](https://knowledge.antom.com/guide-to-promptpay-in-thailand).
- **Bank APIs** — the major banks (Kasikorn/KBank "K BIZ" & KBTG open API, SCB "SCB Easy"/API portal, Krungthai, Bangkok Bank, Krungsri) all run developer portals. There is **no PSD2-style mandated open banking**; access is **commercial, bilateral, and per-bank**. Thailand's open banking is BOT-encouraged but voluntary. Source: [AppSynth — Open Banking in Thailand](https://appsynth.net/open-banking-thailand-new-finance/); [OpenBankingTracker — Thailand aggregators](https://www.openbankingtracker.com/api-aggregators?country=TH).
- **Practical implication:** there is **no Plaid-equivalent with broad Thai coverage.** Bank feeds in Thailand realistically mean (a) per-bank direct integration (slow, commercial negotiation per bank), (b) statement file import (**this is what the incumbents actually do** — build robust CSV/Excel/OFX statement parsers per bank), or (c) a regional aggregator. **Plan for statement import as the primary mechanism, direct API as a per-bank premium add-on.**

### A6.2 Incumbent products (migration sources & competitive set)

| Product | Position | Notes |
|---|---|---|
| **Express (เอ็กซ์เพรส)** | The entrenched legacy desktop incumbent. Enormous installed base among Thai SMEs and accounting firms. | ⚠️ Windows desktop, proprietary local database. **Migration path is almost certainly file export (Excel/CSV/DBF), not API.** Building a high-quality Express importer is probably the single highest-ROI go-to-market investment for Thailand. Verify the export formats. |
| **FlowAccount** | Leading Thai-built cloud SME accounting. Has a **public API** ([listed on Apideck](https://www.apideck.com/accounting-software/flowaccount)) and a payroll module ([flowaccount.com/en/payroll](https://flowaccount.com/en/payroll)). | Direct competitor; API-based migration feasible. |
| **PEAK (peakaccount.com)** | Thai cloud accounting, strong with accounting firms. | Direct competitor. API status unverified. |
| **SAP Business One** | Mid-market, via Thai partners with localisation add-ons. | Migration source for upmarket tenants. |
| **Xero / QuickBooks** | Limited Thai localisation; used by foreign-owned entities that then bolt on Thai tax compliance manually. | Realistic source for the expat/MNC-subsidiary segment. |
| **ETDA-certified e-Tax service providers** | Required intermediary for Scheme 1 if you don't build signing yourself. | 🔴 The certified provider list was not retrieved. Get it from `etax.teda.th` / ETDA. |

> **Go-to-market read:** the Thai market is **accounting-firm-mediated**. Firms standardise their clients on one product. Therefore: multi-client/practice-management console, bulk operations, and an **Express importer** matter more than any individual end-user feature.

---

# PART B — UNITED STATES

## B0. Executive orientation

The US has **no federal VAT, no federal e-invoicing mandate, and no gapless numbering requirement.** The complexity is entirely in (a) **~13,000 sales tax jurisdictions across 45 states + DC + home-rule cities**, and (b) **information reporting (1099s)**.

Two things changed materially and recently that any spec written before mid-2026 will have wrong:
1. **California will tax SaaS from 1 January 2027** (SB 122).
2. **OBBBA changed 1099 thresholds** — 1099-NEC/MISC to **$2,000** for 2026 payments; 1099-K **restored to $20,000 / 200 transactions**.

---

## B1. Sales tax

### B1.1 Economic nexus thresholds ⚠️ LIKELY (table) / ✅ CONFIRMED (trend)

Post-*Wayfair* (2018). Source for the table: [TaxCloud — Sales Tax Nexus by State 2026](https://taxcloud.com/blog/sales-tax-nexus-by-state/). Cross-check against [Sales Tax Institute](https://www.salestaxinstitute.com/) and [Avalara](https://www.avalara.com/blog/en/north-america/2025/06/states-eliminating-economic-nexus-transaction-thresholds.html) before shipping.

| State | $ Threshold | Txn Threshold | Measurement Period |
|---|---|---|---|
| Alabama | $250,000 | None | Previous calendar year |
| Alaska (local) | $100,000 | **None — repealed 2025** | Current or previous CY |
| Arizona | $100,000 | None | Current or previous CY |
| Arkansas | $100,000 | **or** 200 | Current or previous CY |
| **California** | **$500,000** | None | Current or previous CY |
| Colorado | $100,000 | **None — repealed 2019** | Current or previous CY |
| Connecticut | $100,000 | **AND** 200 | 12 months ending Sep 30 |
| DC | $100,000 | or 200 | Current or previous CY |
| Florida | $100,000 | None | Previous calendar year |
| Georgia | $100,000 | or 200 | Current or previous CY |
| Hawaii | $100,000 | or 200 | Current or previous CY |
| Idaho | $100,000 | None | Current or previous CY |
| **Illinois** | $100,000 | **None — repealed 2026** | 12-month period |
| Indiana | $100,000 | **None — repealed 2024** | Current or previous CY |
| Iowa | $100,000 | None | Current or previous CY |
| Kansas | $100,000 | None | Current or previous CY |
| Kentucky | $100,000 | or 200 | Current or previous CY |
| Louisiana | $100,000 | **None — repealed 2023** | Current or previous CY |
| Maine | $100,000 | **None — repealed 2022** | Current or previous CY |
| Maryland | $100,000 | or 200 | Current or previous CY |
| Massachusetts | $100,000 | None | Current or previous CY |
| Michigan | $100,000 | or 200 | Previous calendar year |
| Minnesota | $100,000 | or 200 | 12-month period |
| Mississippi | $250,000 | None | 12-month period |
| Missouri | $100,000 | None | 12-month period |
| Nebraska | $100,000 | or 200 | Current or previous CY |
| Nevada | $100,000 | or 200 | Current or previous CY |
| New Jersey | $100,000 | or 200 | Current or previous CY |
| New Mexico | $100,000 | None | Previous calendar year |
| **New York** | **$500,000** | **AND** 100 | Previous four sales tax quarters |
| North Carolina | $100,000 | **None — repealed 2024** | Current or previous CY |
| North Dakota | $100,000 | None | Current or previous CY |
| Ohio | $100,000 | or 200 | Current or previous CY |
| Oklahoma | $100,000 | None | Current or previous CY |
| Puerto Rico | $100,000 | or 200 | Seller's accounting year |
| Rhode Island | $100,000 | or 200 | Previous calendar year |
| South Carolina | $100,000 | None | Current or previous CY |
| South Dakota | $100,000 | None | Current or previous CY |
| Tennessee | $100,000 | None | 12-month period |
| **Texas** | **$500,000** | None | 12-month period |
| Utah | $100,000 | **None — repealed 2025** | Current or previous CY |
| Vermont | $100,000 | or 200 | 12-month period |
| Virginia | $100,000 | or 200 | Current or previous CY |
| Washington | $100,000 | **None — repealed 2019** | Current or previous CY |
| West Virginia | $100,000 | or 200 | Current or previous CY |
| Wisconsin | $100,000 | **None — repealed 2021** | Current or previous CY |
| Wyoming | $100,000 | **None — repealed 2024** | Current or previous CY |
| **Delaware, Montana, New Hampshire, Oregon** | **No sales tax** | — | — |

**The trend ✅ CONFIRMED: states are systematically removing transaction-count thresholds.** Repeals in chronological order: **Colorado & Washington (2019), Wisconsin (2021), Maine (2022), Louisiana (2023), Indiana, North Carolina, Wyoming (2024), Alaska & Utah (2025), Illinois (2026)**. Rationale: transaction counts caught low-dollar, high-volume sellers with trivial revenue. Expect further repeals — **do not treat the transaction threshold as a stable field.**

> **Engineering notes on nexus — the details that bite:**
> - **`AND` vs `OR` is not cosmetic.** Connecticut ($100k **AND** 200) and New York ($500k **AND** 100) require *both*. Everyone else with a count uses **OR**. A boolean operator field is mandatory in the rules table.
> - **Measurement periods differ**: "current or previous calendar year" vs "previous calendar year only" vs "rolling 12 months" vs Connecticut's **12 months ending 30 September** vs New York's **previous four sales tax quarters**. This is four distinct evaluation algorithms.
> - **What counts toward the threshold varies** — gross sales vs retail sales vs taxable sales vs whether marketplace-facilitated sales and exempt sales are included. 🔴 **NOT RESEARCHED and materially important.** Verify per-state.
> - Nexus is **sticky**: once triggered, registration and trailing-nexus obligations persist. Model `nexus_established_date` and `nexus_end_date` per state.

### B1.2 SaaS taxability — including the California answer 🔴 **CONFLICTING SOURCES / ✅ CONFIRMED on California**

#### California — resolving your conflicting information ✅ CONFIRMED

**Your Jan 2027 information is CORRECT. California enacted SB 122, taxing prewritten software including SaaS from 1 January 2027.**

This is a genuine, major reversal of a **30+ year** California position that electronically delivered software was not taxable because it lacked a tangible transfer.

| Item | Detail |
|---|---|
| **Statute** | **Senate Bill 122 (SB 122)**, signed by Governor Newsom |
| **Effective** | **1 January 2027** |
| **What's taxed** | **Prewritten ("canned") computer software regardless of delivery method** — physical media, download, **or remote cloud access**. Covers the right to "access, use, download, or manipulate" |
| **Rate** | ⚠️ **CONFLICTING** — one source states a "state-level sales tax of **7.5%**" ([vatcalc](https://www.vatcalc.com/united-states/california-7-5-sales-tax-on-saas-software-january-2027/)); another says standard CA sales tax rates by location apply ([Sales Tax Institute](https://www.salestaxinstitute.com/resources/california-expands-sales-tax-to-software-and-saas-under-sb-122)). **My read: standard CA state+district rates apply (base 7.25%, districts push it to 7.75–10.75%); the "7.5%" figure is likely an approximation of the combined average.** VERIFY. |
| **Excluded** | **Custom software** written for a single customer; separately stated charges for custom modifications; **digital books, music, streamed audiovisual content, video games**; cryptocurrency/digital assets; **IaaS (cloud infrastructure)**; services involving substantial human effort (consulting, data processing) |
| **$5m threshold** | Where a **purchaser's** annual qualifying digital-product purchases exceed **$5,000,000**, the tax obligation **shifts from seller to buyer**, who self-assesses use tax under a **direct payment permit** |
| **Sourcing** | Purchaser's known address, in hierarchy: **1) billing address → 2) shipping/delivery address → 3) payment instrument address → 4) other known mailing address.** "Place of use" applies for use tax (relevant for distributed workforces). **No multi-state allocation permitted** for remote sales |
| **Revenue estimate** | ~**$2 billion annually** |

Sources: [Sales Tax Institute](https://www.salestaxinstitute.com/resources/california-expands-sales-tax-to-software-and-saas-under-sb-122); [Holland & Knight, "The Party's Over"](https://www.hklaw.com/en/insights/publications/2026/07/the-partys-over-after-more-than-three-decades-california); [BDO](https://www.bdo.com/insights/tax/california-moves-to-subject-digital-prewritten-software-to-sales-and-use-tax); [Avalara](https://www.avalara.com/blog/en/north-america/2026/06/california-sales-tax-software-saas.html); [Baker Tilly](https://www.bakertilly.com/insights/california-software-sales-tax-changes).

> **This is the highest-priority US item in the whole brief.** California is the largest US market. Every SaaS vendor selling into CA — **including you** — acquires a new collection obligation on 2027-01-01. Implications:
> - The **$5m purchaser threshold shifting liability to the buyer** is unusual and requires you to capture and validate **direct payment permits** from large CA customers.
> - **Custom vs prewritten** becomes a taxability determinant. If your product has implementation/customisation SKUs, **separately state them** — separately stated custom charges are excluded.
> - **CDTFA regulations are still pending.** Expect the detail to move. Build this as effective-dated config with a review date of Q4 2026.
> - ⚠️ Colorado is reportedly moving on software taxability in the same window ([Kahn Litwin](https://kahnlitwin.com/blogs/tax-blog/will-your-software-be-taxable-in-2027-california-and-colorado-update-sales-tax-rules); [CLA](https://www.claconnect.com/en/resources/articles/26/saas-sales-tax-california-colorado)). **Not researched — verify.**

#### SaaS taxability by state ⚠️ LIKELY — **treat as a starting matrix only**

Source: [TaxCloud — SaaS Sales Tax by State](https://taxcloud.com/blog/saas-sales-tax-by-state/). 🔴 **Note this source's own internal inconsistency**: it claims "24 states tax SaaS" but enumerates ~19 full + 4 partial. **Do not ship from this table without a second source.** Cross-check: [TaxConnex SaaS taxability map](https://www.taxconnex.com/saas-taxability-by-state-map), [Numeral](https://www.numeral.com/blog/sales-tax-on-saas), [Avalara].

**Taxing SaaS (full):** Arizona (TPT, as rental of TPP), Connecticut, Hawaii (GET), Kentucky, Louisiana, Maryland, Massachusetts, New Mexico (GRT), New York, Pennsylvania, Rhode Island, South Carolina, South Dakota, Tennessee, Utah, Vermont, Washington (+ B&O), Washington DC, West Virginia.

**Partial / conditional — these are the ones that break naive tax engines:**

| State | Rule |
|---|---|
| **Texas** | **80/20 rule** — SaaS taxed as a *data processing service*; **20% of the charge is exempt, 80% taxable**. Effective rate ≈ 6.25% × 80% = **5.0%** state, plus local. See B1.3. |
| **Connecticut** | **1% reduced rate for business/enterprise use**; full rate (6.35%) for personal use. **Requires capturing B2B vs B2C.** |
| **Ohio** | Taxable **only if sold for business use**; **personal use exempt** — the inverse of the usual pattern. |
| **Iowa** | Taxable by default; **exempt for qualifying commercial enterprises**. |
| **Illinois** | **Not taxable statewide**, but **Chicago taxes it at 15%** via the PPLTT. See B1.4. |
| **Maryland** | 6%. ⚠️ MD also has a separate 3% rate for certain digital/IT services (the 2025 "tech tax") — **not researched, verify.** |

**Exempting SaaS:** Alabama, Arkansas, **California (until 2026-12-31)**, Colorado (state level; **some home-rule cities tax it**), Florida, Georgia, Idaho, Indiana, Kansas, Maine, Michigan, Minnesota, Mississippi, Missouri, Nebraska, Nevada, New Jersey, North Carolina, North Dakota, Oklahoma, Virginia, Wisconsin, Wyoming.

**No statewide sales tax:** Alaska (but **100+ taxing municipalities**), Delaware (gross receipts tax instead), Montana, New Hampshire, Oregon.

> **Engineering note:** SaaS taxability requires **at minimum** these inputs, none of which a naive engine collects: `customer_type` (B2B/B2C — CT, OH, IA), `customer_industry/entity_class` (IA), `product_classification` (prewritten vs custom vs IaaS vs digital content — CA), `separately_stated_components` (CA), and full **address-level (not ZIP-level) sourcing**. ZIP-code-based rate lookup is **not acceptable** in the US — ZIPs cross jurisdiction boundaries. Use rooftop/geocoded address sourcing or a commercial engine.

### B1.3 Texas 80/20 rule ✅ CONFIRMED

- **Rule: 34 Tex. Admin. Code § 3.330** (data processing services). Amended **effective 2 April 2025**; marketplace provider provisions effective **1 October 2025**.
- **20% of the charge for data processing services is exempt; 80% is taxable.** The exemption does not apply if the service qualifies as a *different* taxable service type.
- **Definition**: "the computerized entry, retrieval, search, compilation, manipulation, or storage of data or information."
- **Taxable examples**: payroll services, business accounting data production, **internet hosting where the user stores data on the provider's hardware or processes data on software owned/licensed/leased by either party**, data migration, website creation/maintenance involving data manipulation.
- **Non-taxable examples**: financial statement preparation (requires professional discretion), video streaming (taxed as cable/amusement instead), opinion polls where processing is ancillary.
- **2025 change**: the old **"essence of the transaction"** standard was replaced with an **"ancillary" test** — bundled services are now evaluated on whether the processing is *routine* (taxable) vs *specialised* (potentially non-taxable).

Source: [Grant Thornton — Texas updates data processing services tax rule](https://www.grantthornton.com/insights/alerts/tax/2025/salt/p-t/tx-updates-data-processing-services-tax-rule-04-11); [TXCPA](https://www.tx.cpa/news-publications/news-announcements/article/2026/02/06/data-processing-services-saas-and-software-licenses).

> **Note for you specifically: "business accounting data production" and "payroll services" are named as *taxable data processing* in Texas.** Your own product is squarely in scope. Model the 80/20 as a **taxable-basis reduction (multiply base by 0.80), not a rate reduction** — this matters for correct reporting on the TX return and for local rate stacking.

### B1.4 Chicago Personal Property Lease Transaction Tax ✅ CONFIRMED (rate) / ⚠️ LIKELY (history)

**The Chicago "cloud tax" is now 15% — a 4-point increase effective 1 January 2026. This is the single highest sub-national tax rate on SaaS in the United States.**

| Item | Detail |
|---|---|
| **Rate now** | **15%**, effective **1 January 2026** |
| Rate 2025 | **11%** |
| Rate before 2025 | **9%** ⚠️ LIKELY |
| Legal basis | City of Chicago Revenue Ordinance, **Article II, Section 1, § 3-32-030** |
| Applies to | Leases/rentals of personal property used in Chicago, **including nonpossessory computer leases — cloud computing, SaaS, and remotely accessed software** used by Chicago customers |
| Revenue | Chicago retains **100%** — this is a pure city tax, not state-administered |

Sources: [Sales Tax Institute](https://www.salestaxinstitute.com/resources/chicago-personal-property-lease-transaction-tax-increase-2026); [Anrok](https://www.anrok.com/tax-news/chicago-cloud-tax-jumps-to-15-in-2026); [Miles Consulting](https://milesconsultinggroup.com/blog/2026/01/19/understanding-chicagos-personal-property-lease-transaction-tax-what-the-2026-rate-increase-means-for-your-business/); [Cray Kaiser](https://craykaiser.com/chicago-personal-property-lease-transaction-tax-increase-effective-january-1-2026/).

> 🔴 **UNCERTAIN — three important gaps, all commercially relevant:**
> - **The reduced 5.25% rate** that historically applied to certain nonpossessory computer leases (where the customer uses the provider's software to input/modify its own data) — I could **not confirm whether it still exists** after the 2025/2026 increases. Multiple sources are silent. **This materially changes the rate for many SaaS products. Verify with the Chicago Department of Finance.**
> - **Chicago Ruling #12** (the nonpossessory computer lease ruling) and its current status.
> - **Exemptions** — the small-new-business exemption (commonly cited as Exemption 11), Class 7, and the filing form (**Form 7550**) / frequency.
>
> **Also note the "used in Chicago" sourcing test** — this is *location of use*, not billing address. For a SaaS customer with users across Illinois, apportionment may be required. Not researched.

### B1.5 Home-rule jurisdictions ⚠️ LIKELY

**Home-rule states, where local jurisdictions set their own rules and often collect their own tax:**
**Alabama, Alaska, Arizona, Colorado, Idaho, Illinois, Louisiana.** Source: [Numeral](https://www.numeral.com/blog/home-rule-states-sales-tax); [Sales Tax Institute — How Home Rule States Have Responded to Wayfair](https://www.salestaxinstitute.com/resources/how-home-rule-states-have-responded-to-wayfair).

| State | Situation | Simplification programme |
|---|---|---|
| **Colorado** | **70+ home-rule municipalities** self-collect; Denver and Broomfield counties self-collected | **SUTS** (Sales & Use Tax System) — single portal for state + participating locals. ⚠️ Participation by home-rule cities is *voluntary*; some remain outside |
| **Alabama** | **200+** city and county sales taxes | **SSUT** — remote sellers may elect a **flat 8%** simplified sellers use tax, relieving them of most separate state and local compliance. **ONE SPOT** for local filing |
| **Louisiana** | Parish-level collection | **Louisiana Sales and Use Tax Commission for Remote Sellers** — single point for remote sellers. ⚠️ Local-collector complexity persists for in-state sellers |
| **Alaska** | No state tax; **100+ taxing municipalities** with very broad ordinance authority | **ARSSTC** (Alaska Remote Seller Sales Tax Commission) — single registration/filing for member jurisdictions |
| **Arizona** | State + city licences often both required | **TPT** filed through ADOR, which administers most cities |
| **Illinois** | IDOR collects for most jurisdictions **except Chicago** | Chicago PPLTT separately administered — see B1.4 |
| **Idaho** | Resort city local option taxes | Limited |

> 🔴 **The Numeral source did NOT cover Colorado SUTS, Louisiana's commission, or ARSSTC.** Those details are from my prior knowledge and are **unverified**. Verify all three before building.
>
> **Engineering note:** home-rule breaks the "one registration per state" model. Your tax registration entity must be **`(jurisdiction, level)`** where level ∈ {state, county, city, special district}, each with its own registration ID, filing frequency, form, and portal. **Alabama's flat-8% SSUT election is a genuine simplification worth surfacing as a product recommendation** to remote-seller tenants.

### B1.6 Marketplace facilitator rules ⚠️ LIKELY — **not researched in depth**

**All 45 sales-tax states + DC now have marketplace facilitator laws.** The facilitator (not the seller) collects and remits on facilitated sales.

Key design implications:
- **Facilitated sales must be tracked separately from direct sales** — they're reported on the return but not taxed to the seller (in most states).
- **Whether facilitated sales count toward the seller's own economic nexus threshold varies by state.** 🔴 **NOT RESEARCHED — this is a genuine trap.** A seller can be pushed over a threshold by marketplace sales it doesn't itself collect on.
- Definitions of "marketplace facilitator" vary and **may capture your product** if you process payments on behalf of your customers' customers. **Assess this for your own payments feature.**

References: [Streamlined Sales Tax — Marketplace Facilitator State Guidance](https://www.streamlinedsalestax.org/for-businesses/marketplace-facilitator); [Avalara state-by-state guide](https://www.avalara.com/us/en/learn/guides/state-by-state-guide-to-marketplace-facilitator-laws.html); [NCSL model legislation](https://documents.ncsl.org/wwwncsl/Task-Forces/SALT/SALT_Model_Marketplace_Facilitator_Legislation.pdf); [Tax Foundation](https://taxfoundation.org/research/all/state/marketplace-facilitator-laws/).

### B1.7 Exemption certificate management ⚠️ LIKELY

Requirements a compliant system must meet:
1. **Collect before or at the time of the exempt sale** — retroactive collection during audit is possible in some states but risky.
2. **Validate**: correct form for the state, complete fields, valid purchaser permit/registration number, signature, date, and a stated **reason for exemption** (resale, manufacturing, nonprofit, government, direct pay).
3. **Multi-state forms**: **SST Exemption Certificate** (Streamlined member states), **MTC Uniform Sales & Use Tax Exemption Certificate** (accepted in many states, **not all**).
4. **Expiry/renewal**: some states' certificates never expire; others require renewal (commonly 1–5 years). **Track `valid_from` / `valid_to` per certificate per state.**
5. **Link certificate → exempt transactions** so an auditor can trace any untaxed sale to its supporting certificate. **This linkage is what auditors actually test.**
6. **Retention**: keep for the state's audit lookback (commonly 3–4 years, some longer). **7 years is a safe global default.**

References: [Avalara resale certificates by state](https://www.avalara.com/blog/en/north-america/2023/02/a-state-by-state-guide-to-resale-certificates.html); [Galvix](https://www.galvix.com/article/sales-tax-exemption-certificate-guide/); [Source Advisors on documentation failures](https://sourceadvisors.com/tax-news/exemption-certificates-under-scrutiny-five-documentation-failures-that-create-sales-tax-exposure/).

> **The failure mode auditors exploit:** an exempt sale with **no certificate on file, or an incomplete one**, becomes a taxable sale — and the seller owes the tax, plus penalties and interest, **out of its own pocket** since it can no longer collect from the customer. An **"exempt sales without a valid certificate" exception report** is a genuinely valuable feature.

---

## B2. Information reporting

### B2.1 Thresholds — **OBBBA changed these; most specs are stale** ✅ CONFIRMED

**One Big Beautiful Bill Act (OBBBA), signed 4 July 2025.**

| Form | TY2025 threshold | **TY2026 threshold** | Notes |
|---|---|---|---|
| **1099-NEC** | $600 | **$2,000** | Applies to **payments made on or after 1 January 2026**. **Indexed to inflation annually from 2027.** |
| **1099-MISC** | $600 | **$2,000** ⚠️ LIKELY | OBBBA raised the NEC threshold; MISC generally tracks it. **VERIFY per-box** — some boxes (e.g. royalties at $10, backup withholding at $0) have independent thresholds. |
| **1099-K** | $2,500 | **$20,000 AND 200 transactions** | **Restored to the pre-ARPA rule.** Retroactive to tax years beginning after 31 Dec 2021 — no amended forms required for prior over-reporting. |

Sources: [1099online — $2,000 threshold guide](https://www.1099online.com/blog/1099-nec-instructions-guide/); [1099 Pro — 1099-K after OBBBA](https://1099pro.com/content-library/1099-k-in-2026-the-enterprise-compliance-guide-after-obbba/); [RSM — IRS updates 1099-K FAQs for OBBBA thresholds](https://rsmus.com/insights/services/business-tax/irs-updates-obbba-new-reporting-thresholds.html); [Anchin](https://www.anchin.com/articles/preparing-for-1099-filing-season-what-the-obbba-means-for-1099-k-and-other-reporting-thresholds/); [OnPay](https://onpay.com/insights/1099-reporting-threshold-updates/).

**Two critical carve-outs on 1099-K ✅ CONFIRMED:**
1. **Payment card transactions have a ZERO threshold.** Merchant Acquiring Entities must report **all** card volume at any amount. The $20,000/200 rule applies **only to TPSOs** (third-party settlement organisations), not card acquirers.
2. **Backup withholding overrides the threshold entirely.** If backup withholding applies under **IRC §3406(a)**, a 1099-K must be filed **regardless of volume**, plus a **Form 945**.

**State 1099-K thresholds that do NOT conform ✅ CONFIRMED:**

| State | Threshold |
|---|---|
| Massachusetts, Maryland, Virginia, Vermont, DC | **$600** |
| New Jersey | **$1,000** |
| Illinois | **$1,000 AND 4+ transactions** |

Federal compliance does **not** satisfy these. Source: [1099 Pro](https://1099pro.com/content-library/1099-k-in-2026-the-enterprise-compliance-guide-after-obbba/).

> **Engineering note:** thresholds are now **inflation-indexed from 2027**. Hard-coding `2000` is a bug with a known trigger date. Build a **threshold table keyed on `(form_type, box, tax_year, jurisdiction)`**. And note the retroactivity: your product should **not** attempt to amend prior-year 1099-Ks issued under lower thresholds.

### B2.2 Due dates ✅ CONFIRMED

**Form 1099-NEC — the strict one:**
- **Recipient copy AND IRS filing: 31 January**, for both paper and electronic. There is **no extended e-file date** for NEC. Source: [1099online](https://www.1099online.com/blog/1099-nec-instructions-guide/).

**Form 1099-K and most other 1099s (TY2026, filed in 2027):**
| Deliverable | Date |
|---|---|
| Recipient copy | **1 February 2027** (31 Jan is a Sunday) |
| Paper filing to IRS | **1 March 2027** |
| **Electronic filing to IRS** | **31 March 2027** |

Source: [1099 Pro](https://1099pro.com/content-library/1099-k-in-2026-the-enterprise-compliance-guide-after-obbba/).

**Weekend/holiday rule:** dates falling on a weekend or federal holiday roll to the next business day. Implement as a **federal business-day calendar**, not a static date table.

**E-file mandate ✅ CONFIRMED: 10 or more information returns in aggregate (all types combined) must be filed electronically.** This threshold (down from 250) means **essentially every business with contractors must e-file.** Paper filing is a legacy path only.

### B2.3 W-9, TIN matching, backup withholding

**Form W-9** — collect from every US payee **before the first payment**. Captures: name, business name, **federal tax classification** (individual/sole prop, C corp, S corp, partnership, trust/estate, LLC + its tax classification), exempt payee codes, address, **TIN (SSN or EIN)**, and certification signature.

> **Engineering note:** the W-9's **tax classification** field is the determinant of whether a 1099 is required at all — **payments to C corporations and S corporations are generally exempt from 1099-NEC/MISC reporting** (with named exceptions: attorney fees, medical/health care payments, gross proceeds to attorneys). Your vendor master must store `federal_tax_classification` and the 1099 engine must apply the corporate exclusion. Missing this generates thousands of spurious 1099s. ⚠️ Verify the exception list against the current Form 1099-NEC/MISC instructions.

**TIN Matching** — the IRS **TIN Matching Program** (via e-Services) validates name/TIN pairs against IRS records *before* filing. Returns a match/mismatch indicator. **Use it.** It prevents CP2100/CP2100A notices ("B-notices") and the resulting penalty cascade. ⚠️ Enrolment requirements and API/bulk-match availability not researched.

**Backup withholding — IRC §3406 ✅ CONFIRMED rate: 24%.** Triggered when:
- The payee fails to furnish a TIN, or furnishes an obviously invalid one,
- The IRS notifies the payer of an incorrect TIN (B-notice) and the payee doesn't cure, or
- The payee fails to certify non-subjection to backup withholding.

Withheld amounts are reported on **Form 945** (Annual Return of Withheld Federal Income Tax) and in the withholding box of the relevant 1099.

> **Ledger requirement:** backup withholding needs the same treatment as Thai WHT — a **`Backup Withholding Payable`** liability account, per-payee tracking, deposit scheduling, and Form 945 reconciliation. Most SMB accounting products handle this badly or not at all.

### B2.4 State 1099 filing and CF/SF ⚠️ LIKELY

**Combined Federal/State Filing (CF/SF)** lets the IRS forward information returns to participating states. Covers **1099-B, DIV, G, INT, K, MISC, NEC, OID, PATR, R and Form 5498**.

| Category | States |
|---|---|
| **CF/SF participation satisfies the state requirement** | Alabama, Arizona, Arkansas, California, Colorado, Connecticut, Hawaii, Idaho, Kansas, Louisiana, New Jersey, New Mexico, North Carolina, North Dakota, Ohio, South Carolina, Wisconsin |
| **Partial** | **Oklahoma** — 1099-NEC must be filed **directly**; other forms via CF/SF. **Florida, Illinois, New York, Tennessee** — 1099-K only |
| **Must file DIRECTLY (CF/SF insufficient)** | Delaware, DC, Georgia, Indiana, Maine, Maryland, Massachusetts, Montana, Nebraska, Pennsylvania, West Virginia |
| **Not in CF/SF (generally no requirement — no income tax)** | Alaska, Nevada, New Hampshire, South Dakota, Texas, Washington, Wyoming |

Source: [BoomTax — CF/SF comprehensive list](https://blog.boomtax.com/combined-federal-state-filing-program/); [IRS CF/SF coordinator FAQs](https://www.irs.gov/e-file-providers/combined-federal-state-filing-cfsf-program-state-coordinator-information-faqs); [IRS Topic 804](https://www.irs.gov/taxtopics/tc804).

> 🔴 **CRITICAL CAVEAT — CF/SF is much weaker than it looks.** The same BoomTax source lists a large "**may require direct filing**" set that **overlaps heavily with the "CF/SF satisfies" list** (Alabama, Arizona, Arkansas, Colorado, Connecticut, Idaho, Kansas, New Jersey, New Mexico, North Carolina, North Dakota, Ohio, South Carolina, Wisconsin, plus Kentucky, Michigan, Minnesota, Mississippi). The near-universal reason is **state income tax withholding**: if you withheld state tax, most states require a **direct filing plus a reconciliation return** (e.g. the state's annual W-2/1099 transmittal) regardless of CF/SF.
>
> **Safe product rule: CF/SF covers the no-withholding case only. If any state withholding exists on a 1099, file directly with that state.** Encode this as a per-state matrix with a `state_withholding_present` dimension.

**IRIS vs FIRE ⚠️ LIKELY:** the IRS has been migrating information return e-filing from the legacy **FIRE** system to **IRIS** (Information Returns Intake System, which offers both a portal and an **A2A API**). 🔴 **The current FIRE retirement date was NOT confirmed** in this research. **Build to IRIS/A2A**, and verify FIRE's status before relying on it. See [BoomTax IRIS CF/SF guide](https://boomtax.com/tax-forms/iris-combined-federal-state-filing-program).

---

## B3. US GAAP items that shape the ledger

### B3.1 The honest framing

**Most US small businesses do not keep GAAP books.** They keep **tax-basis** or **modified-cash-basis** books, and their CPA converts to a tax return. GAAP matters when there is an external stakeholder: a bank covenant, an investor, an audit, or an acquisition. Build the ledger so GAAP treatments are **opt-in modules**, not the default. A default-GAAP product is over-engineered for the majority of the SMB market and will lose on simplicity.

### B3.2 Cash vs accrual ✅ CONFIRMED (concept) / ⚠️ (thresholds)

- Small businesses may use the **cash method** for tax if average annual gross receipts are under the **§448(c) gross receipts test** — **$25 million indexed**, which is approximately **$30–31 million** for recent tax years. ⚠️ **The exact indexed figure for 2026 was not verified — look it up.** Entities with inventory also get relief under §471(c).
- Many SMBs run **accrual books, cash tax return** — or, more commonly, **modified cash** (cash plus AR/AP tracking).

> **Product requirement: dual-basis reporting is table stakes for the US.** The same transaction set must produce both a cash-basis and an accrual-basis P&L on demand. QuickBooks' cash/accrual toggle is the benchmark, and users expect it. Architecturally this means retaining **both** the accrual event date and the settlement date on every transaction, and deriving basis at report time — not storing two ledgers.

### B3.3 ASC 606 — Revenue from Contracts with Customers

The five steps: (1) identify the contract; (2) identify **performance obligations**; (3) determine the transaction price; (4) **allocate** the price to performance obligations on **standalone selling price**; (5) recognise revenue **as (or when) each obligation is satisfied**.

**Ledger implications for a SaaS product:**
- **Deferred revenue (contract liability)** and **unbilled receivable / contract asset** are first-class accounts, and the distinction between them matters (contract asset = conditional right; receivable = unconditional).
- **Revenue schedules** — ratable recognition over the service period is the SaaS default, requiring a subledger that generates period recognition entries independent of invoicing.
- **Multi-element arrangements** (subscription + implementation + training) require SSP allocation.
- **Contract cost capitalisation (ASC 340-40)** — incremental costs of obtaining a contract (sales commissions) are capitalised and amortised over the expected customer life. Frequently missed.
- **Variable consideration** — usage-based/overage billing requires estimation with a constraint.

> **Scope call:** full ASC 606 machinery (SSP allocation engine, ASC 340-40 commission amortisation) is **mid-market, not SMB**. A basic **deferred revenue schedule** covers 90% of SMB need. Ship the schedule; gate the allocation engine.

### B3.4 ASC 842 — Leases ✅ CONFIRMED (effective)

**Effective for private companies for fiscal years beginning after 15 December 2021** — so fully in force. Sources: [PwC Viewpoint](https://viewpoint.pwc.com/dt/us/en/pwc/accounting_guides/leases/leases__4_US/chapter_1_introducti__2_US/12_highlevel_overvie_US.html); [FinQuery](https://finquery.com/blog/asc-842-summary-new-lease-accounting-standards/).

**Core change: virtually all leases go on the balance sheet.** Lessee recognises a **right-of-use (ROU) asset** and a **lease liability** for both finance and operating leases.

| | Operating lease | Finance lease |
|---|---|---|
| Balance sheet | ROU asset + lease liability | ROU asset + lease liability |
| Income statement | **Single straight-line lease expense** | **Interest expense + amortisation** (front-loaded) |
| Cash flow | Operating | Interest = operating; principal = financing |

- **Short-term exception**: leases with a term of **12 months or less** may be excluded (policy election by class).
- **Private company practical expedient**: may use the **risk-free rate** by class of underlying asset instead of the incremental borrowing rate.

**Accounts needed:** `ROU Asset – Operating`, `ROU Asset – Finance`, `Lease Liability – Current`, `Lease Liability – Non-current`, `Accumulated Amortisation – ROU`.

> **Scope call:** a lease subledger (schedule, discount rate, remeasurement on modification) is a **substantial** build. For SMB, most tenants have 0–3 leases (office, vehicle, copier). A **simple lease schedule generator** producing the monthly journal is sufficient; full remeasurement/modification handling is mid-market. **And remember: Thai NPAE tenants do not need this at all** — gate it by framework.

### B3.5 ASC 740 — Income Taxes (summary)

- Recognise **current tax** (payable/receivable for the period) and **deferred tax** (temporary differences between book and tax bases of assets and liabilities), measured at **enacted** rates.
- **Valuation allowance** against deferred tax assets where realisation is not "more likely than not."
- **Uncertain tax positions** — two-step recognition/measurement.
- **Pass-through entities (S corps, partnerships, most LLCs) generally have no federal income tax provision** — income flows to owners. ASC 740 is largely a **C corporation** concern. State-level entity taxes and PTE elections are exceptions.

> **Scope call: ASC 740 is out of scope for an SMB product.** The overwhelming majority of your US SMB tenants are pass-throughs with no provision. Provide a simple `Income Tax Expense` / `Income Taxes Payable` account pair and let the CPA handle the provision. Do not build a deferred tax engine.

### B3.6 Entity types and return mapping — **this is the highest-value US ledger feature**

| Entity | Federal return | Income reporting to owners | Notes |
|---|---|---|---|
| **Sole proprietor / single-member LLC** | **Schedule C** (attached to Form 1040) | n/a — flows to 1040 | Self-employment tax on Schedule SE |
| **Partnership / multi-member LLC** | **Form 1065** | **Schedule K-1 (1065)** | |
| **S corporation** | **Form 1120-S** | **Schedule K-1 (1120-S)** | Reasonable-compensation requirement for owner-employees |
| **C corporation** | **Form 1120** | Dividends on 1099-DIV | Entity-level tax; ASC 740 applies |

> **This is where a US accounting product actually earns its keep.** Every account in the chart should carry a **tax line mapping** to the relevant line of Schedule C / 1065 / 1120-S / 1120. This is what makes the year-end handoff to the CPA (or the export to tax software) work, and it is exactly analogous to the Thai DBD XBRL element mapping in A4.2.
>
> **Architectural insight worth acting on: Thailand and the US need the same abstraction.** In both jurisdictions you have a **free-form chart of accounts** plus a **mandatory mapping from each account to an external statutory reporting element** (DBD XBRL element in Thailand; tax return line in the US). Build **one** `account → statutory_element` mapping subsystem, parameterised by `(jurisdiction, scheme, version)`, and both localisation packs become data rather than code. Ship default mappings per entity type; let users override.
>
> ⚠️ Note that Schedule C/1065/1120 line numbers change between tax years. **Version the mapping scheme by tax year.**

---

## B4. E-invoicing in the US

### B4.1 Status ✅ CONFIRMED — **no mandate, none proposed**

**There is no federal e-invoicing mandate in the United States, no state mandate, and no B2G requirement that public entities receive e-invoices.** Source: [dddinvoices — USA e-invoicing guide](https://dddinvoices.com/learn/e-invoicing-usa-digital-business-networks-alliance): "B2G e-invoicing is not yet possible as public entities are not required to process and receive e-invoices in the USA."

This is the structural opposite of Thailand: the US has **no tax-authority involvement in invoicing at all**. Invoicing is purely commercial. This is why US accounting products can ship invoicing as a simple PDF/email feature and be fully compliant.

### B4.2 DBNAlliance ⚠️ LIKELY

The **Digital Business Networks Alliance** operates the **US Open Exchange Network** — a voluntary, industry-led B2B document exchange network, explicitly modelled as **"the North American counterpart to the European Peppol network."**

| Aspect | Detail |
|---|---|
| Model | **Four-corner model** — sender, sender's Access Point, receiver's Access Point, receiver. Trading partners need not share an Access Point |
| Document format | **OASIS UBL** ⚠️ LIKELY ([dddinvoices](https://dddinvoices.com/learn/e-invoicing-usa-digital-business-networks-alliance)) |
| Transport | 🔴 **NOT CONFIRMED** — Peppol-derived architecture strongly implies **AS4** with **SMP/SML** discovery, but this was not verified |
| Participant IDs | 🔴 **NOT CONFIRMED** |
| Governance | Chair: Dolf Kars. Membership & Market Adoption Chair: Alex Baulf. Full and Associate member tiers |
| Notable members | Chevron, ConocoPhillips, Microsoft, Halliburton, Weatherford |
| Mandatory? | **No.** Entirely voluntary |
| 2026 milestones | E-Invoicing Conference, **22 April 2026**, New York City. Annual Members Meeting & Board Elections, **16 September 2026**, Microsoft Miami campus. Recent: **"Mass Adoption API"** for faster onboarding |

Sources: [dbnalliance.org](https://dbnalliance.org/); [PRNewswire — NYC conference](https://www.prnewswire.com/news-releases/dbnalliance-to-host-united-states-e-invoicing-conference-in-new-york-city-on-april-22-302744325.html); [PRNewswire — North American interoperability platform](https://www.prnewswire.com/news-releases/digital-business-networks-alliance-officially-a-north-american-interoperability-platform-302248670.html); [EDICOM](https://edicomgroup.com/blog/the-united-states-begins-an-electronic-invoicing-pilot-project).

> **Recommendation: DBNAlliance is NOT a v1 requirement.** Adoption is concentrated in large enterprises (note the member list — oil & gas majors and Microsoft, not SMBs). Membership costs money and delivers little SMB value today. **Revisit in 12–18 months.** The "Mass Adoption API" suggests they know onboarding friction is the blocker.
>
> **However:** the four-corner + UBL architecture means that if you build a **Peppol-capable UBL exchange layer** for other markets (EU, Singapore, Australia/NZ, Malaysia), DBNAlliance becomes a relatively cheap incremental addition. **Note the contrast with Thailand, which is CII** — so a global e-invoicing strategy needs *both* UBL and CII serialisers regardless.

### B4.3 Federal B2G ⚠️ LIKELY
The US Treasury's **Invoice Processing Platform (IPP)** exists for federal agency invoicing. 🔴 **Whether it is mandatory for federal suppliers was NOT confirmed** — the source explicitly said no IPP mandate is mentioned. Irrelevant to the SMB segment; verify only if you target government contractors.

---

## B5. Numbering, retention, residency (US)

### B5.1 Invoice numbering ✅ **CONFIRMED: there is NO gapless or sequential numbering requirement in the US**

**Confirming your assumption.** No federal statute, IRS regulation, or state sales tax law imposes a gapless, sequential, or tamper-evident invoice numbering requirement on commercial invoices. Invoice numbering is a purely commercial/internal-control matter.

> This is a **negative finding** — no source *says* "there is no requirement." The confidence comes from: (a) the US has no VAT and therefore no invoice-based tax credit mechanism to protect; (b) there is no tax-authority role in invoicing at all (B4.1); (c) no such requirement surfaced in any sales tax or IRS recordkeeping source reviewed. I regard this as high confidence, but it is inferential.
>
> **Design consequence — and this is the important one:** because Thailand *does* effectively require gapless numbering (A5.1) and the US does not, **numbering policy must be a per-jurisdiction, per-tenant configuration**, not a global product behaviour. Do not impose Thai-strength numbering rigidity on US tenants (it creates support burden for no benefit), and do not offer US-style free-form numbering to Thai tenants. Model as: `numbering_policy: {strategy: gapless|freeform, scope: [tenant, entity, branch, doc_type, year], on_cancel: void_retain_number|release}`.

### B5.2 IRS record retention ✅ CONFIRMED (primary source)

Verified against [IRS Publication 583 (Rev. Dec 2024), "Starting a Business and Keeping Records"](https://www.irs.gov/publications/p583) — Table 3, Period of Limitations.

| Situation | Retention period |
|---|---|
| Standard (you owe additional tax) | **3 years** |
| **Unreported income exceeding 25% of gross income shown** | **6 years** |
| **Fraudulent return** | **No limit** |
| **No return filed** | **No limit** |
| Claim for credit or refund | Later of **3 years**, or **2 years after the tax was paid** |
| **Bad debt deduction / worthless securities** | **7 years** |
| Employment tax records | **4 years** ⚠️ (widely cited, per Pub. 15; Pub. 583 references Pub. 15 rather than stating it) |
| Property/asset records | Until the **period of limitations expires for the year the property is disposed of** — can be decades |

**Electronic recordkeeping requirements ✅ CONFIRMED — quote from Pub. 583.** The system must:
- "Index, store, preserve, retrieve, and reproduce the electronically stored books and records in **legible format**"
- Provide "a complete and accurate record of your data that is **accessible to the IRS**"
- Be "**tested** to establish that the hard copy books and records are being reproduced in compliance with IRS requirements"

**Supporting documents to retain:** gross receipts (cash register tapes, deposit slips, invoices, credit card slips); inventory purchases (cancelled cheques, invoices, sales slips); business expenses; asset records (purchase invoices, closing statements).

> **Practical policy: 7 years minimum, with indefinite retention for asset/basis records and legal-hold override.** 7 covers the bad-debt case and the Thai 7-year extension. **Asset basis records must be retained beyond 7 years** — until disposal plus the limitation period. Model `retention_class` per document type; do not apply one flat TTL.

### B5.3 State-level requirements ⚠️ LIKELY
State sales tax audit lookback is commonly **3–4 years**, longer where no return was filed or fraud is alleged. Example: [California CDTFA Publication 116 — Sales and Use Tax Records](https://www.cdtfa.ca.gov/formspubs/pub116/retaining-records.htm). **Not systematically researched.** The 7-year global policy covers nearly all of it.

### B5.4 Data residency ✅ (effectively none) / SOC 2
- **No US data-residency requirement for accounting records.** The IRS requires records be *accessible*, not *located* anywhere in particular.
- **SOC 2 Type II is a de facto commercial requirement**, not a legal one — but for a multi-tenant SaaS accounting product handling financial data, **it will be demanded in enterprise and accounting-firm sales cycles and by many mid-market buyers.** Trust Services Criteria: **Security (mandatory), Availability, Processing Integrity, Confidentiality, Privacy.**
  - **Processing Integrity is unusually relevant** for an accounting ledger and is often skipped by SaaS vendors — including it is a differentiator with CPA firms.
  - Type II requires an observation window (typically 3–12 months). **Start the clock early**; it is a common go-to-market blocker.
- ⚠️ Adjacent regimes to assess, **not researched**: **CCPA/CPRA** (California, if you meet thresholds), state privacy laws (VA, CO, CT, UT and ~a dozen more), **GLBA Safeguards Rule** (if you're deemed a financial institution — plausible if you handle bank data), and **PCI DSS** (if you touch card data).

---

## B6. US Integrations

### B6.1 Bank feeds — and the Section 1033 situation ✅ CONFIRMED (status)

**Aggregators:** **Plaid** (largest; strongest developer experience and coverage), **MX** (strong data enrichment/cleansing), **Finicity** (Mastercard-owned; strong for lending/verification), **Akoya** (bank-consortium-owned, API-only, no credential sharing), **Yodlee** (Envestnet; long tail, legacy).

References: [OpenBankingTracker — banking data aggregation APIs 2026](https://www.openbankingtracker.com/banking-data-aggregation); [Fintegration — Plaid vs MX vs Finicity](https://www.fintegrationfs.com/post/bank-account-linking-api-integration-for-us-fintech-products-plaid-vs-mx-vs-finicity).

#### **Section 1033 / CFPB Open Banking — status: ENJOINED and under reconsideration** ✅ CONFIRMED

**This is important and frequently misreported. The 2024 Personal Financial Data Rights rule is NOT in force.**

| Date | Event |
|---|---|
| Oct 2024 | CFPB finalises the Personal Financial Data Rights rule (12 CFR Part 1033) |
| — | Bank Policy Institute, Kentucky Bankers Association and **Forcht Bank** sue in **E.D. Kentucky** |
| May 2025 | **The CFPB sides with the plaintiffs**, moving to set aside its own rule as unlawful |
| Aug 2025 | CFPB publishes an **ANPRM** reopening four areas — notably **whether data providers may charge fees** for data access (reversing the 2024 fee prohibition) |
| ~29 Oct 2025 | Court grants a **preliminary injunction** barring enforcement pending reconsideration |
| **1 Apr 2026** | The original Tier 1 compliance date (depositories ≥$250bn; non-depositories ≥$10bn receipts) **passed WITHOUT becoming a binding enforcement trigger** |
| 2027–2030 | Tiers 2–5 remain on paper, suspended |

Sources: [OpenBankingTracker — Section 1033 status](https://www.openbankingtracker.com/guides/section-1033-status); [Cozen O'Connor](https://www.cozen.com/news-resources/publications/2026/section-1033-compliance-date-open-banking-rule-enjoined-and-under-reconsideration); [Federal Register — Personal Financial Data Rights Reconsideration](https://www.federalregister.gov/documents/2025/08/22/2025-16139/personal-financial-data-rights-reconsideration); [CFPB](https://www.consumerfinance.gov/personal-financial-data-rights/); [Congressional Research Service IF13117](https://www.congress.gov/crs-product/IF13117); [PYMNTS, 2026](https://www.pymnts.com/bank-regulation/2026/data-aggregators-push-secure-access-as-rule-1033-rewrite-looms/).

> **What to do about it:**
> 1. **Do not plan around free, mandated bank data access.** The fee prohibition is precisely what the CFPB reopened; **priced data access is a live possibility.** Model aggregator cost as a **variable per-connection COGS** that could rise, not a fixed platform fee. This is a real unit-economics risk for a low-ARPU SMB accounting product.
> 2. **Build to the FDX standard** (Financial Data Exchange) — **CFPB-recognised as a standard-setting body in January 2025, with recognition running through 2030.** FDX is the stable technical target regardless of how the rule lands.
> 3. **Do not build direct credential-based scraping.** It's being phased out industry-wide and Akoya/FDX-style tokenised API access is the direction of travel.
> 4. Expect a **revised proposed rule**; keep this on a watch list.

### B6.2 Payment rails ⚠️ LIKELY

| Rail | Operator | Speed | Notes |
|---|---|---|---|
| **ACH** | Nacha / Federal Reserve & EPN | 1–2 business days | Cheapest. Dominant for B2B. **Reversible** (returns, R-codes) — your reconciliation engine must handle returns and NOCs |
| **Same Day ACH** | Nacha | Same business day (3 windows) | Per-transaction limit raised to **$1,000,000** ⚠️ verify current |
| **RTP®** | The Clearing House | **Instant, 24/7/365** | Bank-owned. **Credit-push only, irrevocable.** Transaction limit **$10,000,000** ⚠️ verify. Broad large-bank coverage |
| **FedNow®** | Federal Reserve | **Instant, 24/7/365** | Launched Jul 2023. Broader reach into small/community banks than RTP. Default limit **$100,000**, raisable to **$1,000,000** ⚠️ verify — Fed has adjusted these |
| **Wire (Fedwire/CHIPS)** | Fed / TCH | Same day | High value, high cost, irrevocable |
| **Cards** | Networks | — | Interchange makes these unattractive for large B2B |

References: [Nacha ACH Payments Fact Sheet](https://www.nacha.org/content/ach-payments-fact-sheet); [fi-nex — which rail for B2B 2026](https://www.fi-nex.com/insights/which-rail-for-b2b-payments.html); [eco.com — FedNow vs RTP 2026](https://eco.com/support/en/articles/15650251-fednow-vs-rtp-2026-real-time-payment-rails-compared).

> 🔴 **All transaction limits above are from prior knowledge and were NOT verified in this pass.** They change. Verify against Nacha, TCH, and the Federal Reserve directly before displaying limits to users.
>
> **Reconciliation design point:** ACH returns arrive **days after** the original settlement, and instant rails (RTP/FedNow) are **irrevocable with no return mechanism**. These are fundamentally different reconciliation state machines. Model `payment_status` with rail-specific terminal states, and never treat an ACH credit as final on day 1.

### B6.3 Payroll providers ⚠️ LIKELY

| Provider | Segment | Integration |
|---|---|---|
| **Gusto** | SMB, developer-friendly | Public API + partner programme; good accounting integrations |
| **ADP** | SMB→enterprise (RUN, Workforce Now) | **ADP Marketplace** — partner approval required, more gated than Gusto |
| **Rippling** | SMB/mid-market, HR+IT+payroll | API available; partner programme |
| **Paychex** | SMB/mid-market | API available |
| **Paylocity, Justworks, TriNet, Deel, Remote** | Various / PEO / global | Varies |
| **Unified API aggregators** | — | **Merge.dev, Finch, Knit, Apideck, Unified.to** — one integration, many providers. **Strongly recommended for v1** |

References: [Knit — Payroll API integration developer guide 2026](https://www.getknit.dev/blog/payroll-api-integration-developer-guide-to-adp-gusto-rippling-paychex); [Unified.to — 15 payroll APIs 2026](https://unified.to/blog/15_payroll_apis_to_integrate_with_in_2026_adp_gusto_paychex).

> **Recommendation: use a unified payroll API (Finch or Merge) for v1** rather than building N direct integrations. Direct integration with Gusto (best DX, SMB-dominant) is the one worth building natively if you build any.
>
> **What you actually need from payroll** is narrow: the **payroll journal entry** (gross wages, employer taxes, employee deductions, net pay, employer benefit costs) posted per pay run, plus **contractor payments** for 1099 purposes. You do not need full HRIS data. Scope accordingly — this keeps the integration shallow and reliable.

### B6.4 Incumbent products — migration sources

| Product | Segment | Migration notes |
|---|---|---|
| **QuickBooks Online** | Dominant US SMB. **The single most important migration source.** | Robust public API (Intuit Developer, OAuth 2.0). Full entity coverage: CoA, customers, vendors, invoices, bills, payments, JEs, items. **Also QuickBooks Desktop** — still a very large installed base, migration via IIF/QBXML or file export. **Do not overlook Desktop.** |
| **Xero** | SMB; strong outside the US, growing within | Excellent public API, OAuth 2.0. Clean migration path |
| **FreshBooks / Wave / Zoho Books** | Micro/small | APIs available; smaller populations |
| **Sage Intacct** | Mid-market | API available; different buyer, longer cycle |
| **NetSuite** | Mid-market/upper | SuiteTalk (SOAP/REST) + SuiteQL. Complex; enterprise sales motion |
| **Sage 50 / Sage 100** | Legacy desktop | File export |

> **Go-to-market read:** **a genuinely excellent QuickBooks Online importer is the highest-ROI US engineering investment**, and its Thai analogue is an **Express importer** (A6.2). In both markets, migration friction — not feature gaps — is the primary barrier to switching. Note the symmetry: in each country the dominant incumbent is a **desktop-legacy product with a huge installed base** (QuickBooks Desktop, Express) plus a **cloud leader** (QBO, FlowAccount).
>
> **Migration fidelity matters more than breadth.** Bringing over historical GL detail, open AR/AP, bank reconciliation state, and — critically — **prior-period comparatives that tie to the previously filed returns** is what makes a switch safe. A migration that doesn't reproduce last year's filed numbers is unusable.

---

# PART C — Cross-cutting: what this means for the localisation pack

## C1. The single most important architectural insight

**Thailand and the US differ on almost every rule but share one shape:**

> a **free-form chart of accounts** + a **mandatory mapping from each account to an external statutory reporting element**
> (Thailand: DBD XBRL taxonomy element · US: Schedule C / 1065 / 1120-S / 1120 tax line)

Build **one** versioned `account → statutory_element` mapping subsystem keyed on `(jurisdiction, scheme, scheme_version, effective_year)`, with shipped defaults and user override. Both localisation packs then become **data, not code** — and the next country (which will have its own variant of the same thing) is cheap.

## C2. Recommended localisation pack structure

```
pack/
  <jurisdiction>/          # TH | US
    meta.yaml              # currency, locale(s), fiscal calendar, date era (CE|BE)
    rates/
      indirect_tax.yaml    # effective-dated; TH VAT 7% expiry 2027-09-30
      withholding.yaml     # TH PND rate card; US backup withholding 24%
      nexus.yaml           # US only: $ and txn thresholds, AND/OR operator, period type
      taxability.yaml      # US only: product_class × state × customer_type matrix
    documents/
      numbering.yaml       # TH: gapless per (branch,type,series,year); US: freeform
      templates/           # TH: bilingual th/en, BE dates; US: plain
      formats/             # TH: CII XML (rsm:CrossIndustryInvoice), PDF/A-3
    accounts/
      coa_template.yaml    # default CoA
      statutory_mapping/   # TH: DBD XBRL elements | US: tax return lines (per year)
    returns/
      calendar.yaml        # TH: PP30 15th/23rd, PND 7th/15th, PND50 150d
                           # US: 1099-NEC Jan 31, 1099-K Mar 31 e-file
      forms/               # PP30, PND1/3/53/54, PND50/51 | 1099-NEC/MISC/K, 945
    retention.yaml         # both: 7y default; US asset basis = indefinite
    validation/            # field-level rules (TH s.86/4 particulars, US W-9 class)
```

## C3. The dozen things most likely to be wrong in an existing spec

| # | Claim you may be carrying | Reality |
|---|---|---|
| 1 | Thai e-invoicing is/will be mandatory | **Voluntary. No mandate for 2026 or 2027.** |
| 2 | Thai e-Tax Invoice XML is **UBL** | **It is UN/CEFACT CII** — `<rsm:CrossIndustryInvoice>` |
| 3 | Thai VAT 7% expires 30 Sep **2026** | **Extended to 30 Sep 2027** (Cabinet, 27 Jul 2026) |
| 4 | e-WHT reduced rate is 2%, or expires 2025 | **1% flat, to 31 Dec 2027** (Cabinet 16 Jun 2026) — **decree still pending** |
| 5 | California does not tax SaaS | **SB 122 taxes it from 1 Jan 2027** — your info was right |
| 6 | Chicago cloud tax is 9% (or 11%) | **15% from 1 Jan 2026** |
| 7 | 1099-NEC threshold is $600 | **$2,000 for 2026 payments**, inflation-indexed from 2027 |
| 8 | 1099-K threshold is $600 / $2,500 | **$20,000 AND 200 transactions** — restored by OBBBA |
| 9 | CFPB 1033 open banking is live from Apr 2026 | **Enjoined; the Apr 2026 date passed without effect.** Build to **FDX** |
| 10 | Thai VAT tax point = invoice date | **Services: receipt of payment.** You need **Undue VAT** accounts |
| 11 | Thai accounts must be Thai-only | **Bilingual (foreign + Thai) satisfies Accounting Act s.21(1)** |
| 12 | Transaction-count nexus thresholds are stable | **10 states have repealed them since 2019**; Illinois in 2026 |

## C4. Top open questions to resolve before scoping (ranked)

1. **DBD XBRL taxonomy version and submission mechanism** — Excel template vs raw XBRL vs API? *(largest unknown in the Thai build)*
2. **Thai e-WHT mechanics** — bank file formats; are the certificate and PND filing obligations genuinely waived?
3. **Chicago PPLTT reduced rate** — does the ~5.25% nonpossessory-computer-lease rate still exist at the 15% level?
4. **Thai VAT tax point statutory basis** (s.78 / s.78/1) — confirm the goods/services split before building Undue VAT.
5. **Thai WHT rate card** — resolve the rent 5% vs 5–10% conflict; get adviser sign-off on every line.
6. **CDTFA regulations under CA SB 122** — pending; will determine product-classification boundaries and the direct-pay-permit workflow.
7. **US economic nexus measurement base** — gross vs retail vs taxable sales; are marketplace-facilitated sales included?
8. **Thai data residency** — will RD/DBD accept offshore cloud storage of statutory records? *(may determine your region strategy)*
9. **IRS FIRE retirement date** and IRIS A2A availability.
10. **Thai foreign functional currency election** (Revenue Code s.76 ter) — separate from tax-invoice currency; unresearched.
11. **TFRS/NPAE standards effective 1 Jan 2026 and 1 Jan 2027** — check TFAC; TFRS 18 changes P&L structure for PAEs.
12. **1099-MISC per-box thresholds** under OBBBA — does every box move to $2,000?

---

*Compiled 17 August 2026. Every rate, threshold and date in this document is effective-dated and volatile. Nothing here is tax advice; the Thai WHT rate card and the US state taxability matrix in particular require professional sign-off before use in production.*
