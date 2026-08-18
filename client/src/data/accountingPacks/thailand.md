# 07 — Localisation Pack: Thailand (`th`)

Two items dominate the engineering estimate and both are easy to miss: the XML
is **CII, not UBL**, and the **VAT tax point for services is receipt of payment,
not the invoice date**.

**Facts current as at 17 August 2026.** ⚠️ items in §9.

---

## 1. e-Tax Invoice & e-Receipt

**Status: voluntary.** No mandate is legislated for 2026 or 2027.

### 1.1 Two schemes

| Scheme | For | Mechanism |
|---|---|---|
| **e-Tax Invoice & e-Receipt** | General | XML signed with a digital certificate, submitted to the Revenue Department, usually via an ETDA-certified service provider |
| **e-Tax Invoice by Email** | Small businesses | Simpler flow via a time-stamping service |

### 1.2 The XML standard — CII, not UBL

**Root element `<rsm:CrossIndustryInvoice>`. UN/CEFACT Cross Industry Invoice,
ETDA Recommendation 3-2560 v2.0.** Verified against ETDA's own English
documentation.

> **Engineering consequence:** if Singapore and Australia have produced a UBL/PINT
> serializer, Thailand needs a **second serializer**. This is the largest single
> item in the Thai pack. Budget it explicitly rather than assuming the Peppol
> work carries over — the semantic model is shared, the syntax binding is not.

A digital certificate is required for signing. Certificate lifecycle management
(issuance, renewal, expiry alerting) is part of the pack, not an afterthought.

### 1.3 Incentives

A **200% deduction** for e-tax invoice adoption costs and a reduced **1% flat
e-withholding tax** rate were extended to 31 Dec 2027 by Cabinet decision on
16 Jun 2026 — but ⚠️ **the Royal Decree was still pending at last report.** Do
not present the 1% rate as live in the product until the decree is published.

---

## 2. VAT

| Item | Value |
|---|---|
| Rate | **7%**, now extended to **30 September 2027** (Cabinet, 27 Jul 2026) |
| Registration threshold | THB 1.8m annual turnover |
| Return | **PP30**, monthly |
| Due | 15th of the following month (23rd for e-filing) |
| Recoverability | Full, with exclusions |

### 2.1 The tax point — the thing that breaks generic ledgers

**For services, the VAT tax point is receipt of payment, not the invoice date.**
For goods it is delivery.

Without handling this you overstate the VAT liability every single month. The
pack needs four accounts, and the SLA rule engine already has the roles:

```
undue_output_vat    liability   Output VAT not yet due (services invoiced, unpaid)
tax_output_payable  liability   Output VAT due this period
undue_input_vat     asset       Input VAT not yet claimable
tax_input_receivable asset      Input VAT claimable this period
```

Flow on a service invoice:

```
Invoice:   Dr AR            107     Cr Revenue           100
                                    Cr Undue output VAT    7
Receipt:   Dr Bank          107     Cr AR                107
           Dr Undue output VAT 7    Cr Output VAT payable  7   ← tax point
```

The PP30 aggregates only `tax_output_payable` and `tax_input_receivable`. This
is exactly why `TaxPointPort` exists as a separate capability in the framework.

### 2.2 Tax invoice particulars — Revenue Code s.86/4

Mandatory: the words "ใบกำกับภาษี" (tax invoice); supplier name, address and TIN;
buyer name and address; **sequential number** (and book number if applicable);
description, quantity and value; VAT amount shown **separately**; date of issue.

### 2.3 VAT reports — s.87

Input tax and output tax registers must be maintained, with entries made within
**3 working days** of the transaction. This is a real obligation with a real
deadline; model it as a report that must be producible on demand, not a
year-end artefact.

### 2.4 VES

VAT on Foreign Electronic Services — the regime for non-resident digital
service providers. Relevant if your own SaaS sells into Thailand, and relevant
to customers buying foreign software.

---

## 3. Withholding tax

**Withholding on ordinary domestic B2B payments is routine**, as in Indonesia.

| Form | Payee |
|---|---|
| **PND 1** | Employees |
| **PND 3** | Resident **individuals** |
| **PND 53** | Resident **juristic persons** (companies) |
| **PND 54** | Non-residents |

Common rates ⚠️ — **verify each line against Revenue Department orders before
shipping:**

| Payment | Rate |
|---|---|
| Services / professional fees | 3% |
| Rent | 5% |
| Advertising | 2% |
| Transport | 1% |
| Dividends | 10% |
| Interest | 1% (companies) / 15% (individuals) |

**Deadline:** 7th of the following month (extended for e-filing).

**A withholding tax certificate must be issued to the payee.** Same lifecycle
object as Indonesia's bukti potong — reuse the model, change the pack config.

### 3.1 e-Withholding Tax

Remittance through participating banks, with a reduced rate as an incentive
(§1.3). ⚠️ The bank-side mechanics are not well documented publicly; treat as an
integration to scope with a specific bank partner rather than a generic feature.

---

## 4. Numbering, retention, residency, language

| Item | Position |
|---|---|
| Numbering | **Sequential required in practice** ⚠️ (s.86/4 requires a number; strict gaplessness is convention plus audit expectation). Use gapless per (entity, series, year) |
| Retention | **5 years, extendable to 7** by the Revenue Department |
| **Language** | **Thai required** for accounts |
| **Currency** | **THB** functional currency; exceptions require approval ⚠️ |
| Residency | PDPA applies; specific accounting-record residency requirements ⚠️ unclear — verify |

The Thai language requirement affects the chart of accounts, invoice templates
and report labels. Plan for full Thai localisation of the statutory outputs, not
just the UI.

---

## 5. Statutory accounts

| Item | Position |
|---|---|
| Framework | **TFRS** (IFRS-aligned) for publicly accountable entities; **TFRS for NPAEs** for non-publicly-accountable entities |
| Filing | **DBD e-Filing**, in XBRL |
| Taxonomy | ⚠️ Version and submission mechanism unclear — likely an Excel template rather than raw XBRL. **Verify before estimating** |
| **Audit** | **Universal for companies** — every Thai company must be audited |
| Statutory chart | **None.** Thailand does not prescribe a chart of accounts |

**Universal audit is a commercial fact worth designing for.** Every Thai company
customer has an auditor who will ask for a trial balance, a general ledger
listing and supporting documents in a specific format. An "auditor pack" export
is a genuine selling feature here in a way it is not in Australia.

> **Note the structural similarity to the US:** free-form chart plus a mandatory
> mapping to a statutory element (DBD XBRL element here, tax return line there).
> Build the mapping subsystem once (framework doc §2.4) and both packs become
> data rather than code.

---

## 6. Chart of accounts

No prescribed chart. Thai accountants expect Thai account names and a structure
resembling the DBD financial statement presentation. Seed accordingly and map to
DBD elements.

---

## 7. Integrations

| Category | Options |
|---|---|
| Payment rails | **PromptPay**, bank transfer |
| Banking data | Bank APIs (SCB, KBank, Bangkok Bank); coverage varies |
| Migration sources | **Express** (dominant legacy), **FlowAccount**, **PEAK**, SAP B1 partners |

Express is an old but deeply entrenched desktop product. An Express import is
the equivalent of the SQL Accounting import in Malaysia — unglamorous and
decisive.

---

## 8. Pack acceptance criteria

| # | Criterion |
|---|---|
| TH-1 | **CII serializer** produces `<rsm:CrossIndustryInvoice>` validating against ETDA Rec. 3-2560 v2.0 |
| TH-2 | Digital certificate signing implemented, with expiry alerting |
| TH-3 | **Service tax point is payment receipt**; undue output/input VAT accounts used; PP30 excludes undue amounts |
| TH-4 | PP30 reconciles to the ledger for a seeded book including a mixed goods/services case (gate G4) |
| TH-5 | s.86/4 particulars present on the tax invoice, in Thai |
| TH-6 | Input and output VAT registers producible, with the 3-working-day entry rule surfaced |
| TH-7 | PND 3 / 53 / 54 determined correctly by payee type; certificates generated |
| TH-8 | Withholding certificate lifecycle and aging report (shared model with Indonesia) |
| TH-9 | Thai-language chart, templates and statutory reports |
| TH-10 | DBD e-Filing export produced in the current accepted format |
| TH-11 | Auditor pack export (TB, GL listing, supporting document index) |
| TH-12 | Signed off by a named Thai CPA against pack version |

---

## 9. Open items — resolve before ship

1. **DBD XBRL taxonomy version and submission mechanism** (Excel template vs raw
   XBRL). Gates TH-10 and materially changes its estimate.
2. **Withholding rate card** — verify every line against RD orders.
3. Whether the 1% e-WHT Royal Decree has been published.
4. e-WHT bank mechanics — scope with a named bank partner.
5. Tax invoice numbering: how strict is the gaplessness expectation in practice?
6. THB functional currency exception process.
7. Data residency acceptance for cloud-hosted accounting records under PDPA and
   RD practice.
