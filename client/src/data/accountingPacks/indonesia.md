# 06 — Localisation Pack: Indonesia (`id`)

**The hardest pack in the set.** Two things define it, and both break assumptions
baked into most accounting products: the tax invoice number is assigned by the
government *after* you submit, and withholding tax applies to ordinary B2B
payments as a matter of course.

**Facts current as at 17 August 2026.** ⚠️ items in §9.

---

## 1. E-invoicing — e-Faktur under Coretax

**Model: clearance, with externally assigned numbering.**

### 1.1 NSFP — the structural difference

**Old world (pre-Coretax, e-Nofa):** the taxable entrepreneur (PKP) requested a
*block* of serial numbers from DJP in advance and consumed them sequentially.
16 digits. Running out mid-month and reporting unused numbers were constant pain.

**New world (Coretax, PER-11/PJ/2025): there is no pre-request.** DJP assigns the
number automatically when the e-Faktur is uploaded and approved.

```
NSFP = [TT][SS][YY][NNNNNNNNNNN]      17 digits
        │   │   │   └── 11 digits, sequence assigned by DJP
        │   │   └────── 2 digits, year of creation
        │   └────────── 2 digits, STATUS code (was 1 digit — schema change)
        └────────────── 2 digits, TRANSACTION code
```

Status codes: `00` original, `01` first replacement, `02` second, and so on.

> **The design point that everything else follows from:** the ledger must treat
> the tax invoice number as **externally assigned, post-hoc**. Never generate it
> locally. The document carries your own `internal_document_no` (always present,
> always immediately available) plus a nullable `statutory_document_no`
> populated only on approval, with a state machine:
>
> `DRAFT → SUBMITTED → APPROVED(nsfp) | REJECTED | CANCELLED | REPLACED`
>
> **Nothing downstream may finalise before `APPROVED`** — not the output PPN
> ledger, not the SPT Masa PPN, not the customer's copy.

### 1.2 Timing — the 20th

The e-Faktur must be uploaded by the **20th of the following month**. Miss it and
the document **is not a faktur pajak at all**, and your customer's customer loses
the input credit. That is a commercial injury, not a compliance ticket.

Build a scheduled sweep with escalating alerts from the 10th. This deserves a
dashboard tile, not a log line.

### 1.3 Transaction codes (`TT`) — PER-11/PJ/2025

| Code | Meaning |
|---|---|
| 01 | Standard delivery, supplier collects PPN/PPnBM |
| 02 | Delivery to a government VAT collector (bendahara) |
| 03 | Delivery to a non-government designated VAT collector |
| **04** | **DPP Nilai Lain** — carries the 11/12 mechanism (§2.1) |
| 05 | Besaran tertentu (fixed-amount VAT) |
| 06 | VAT refund for foreign tourists ⚠️ |
| 07 | PPN not collected (bonded zones, strategic goods, government-borne) |
| 08 | PPN exempt (international transport, diplomatic missions) |
| 09 | Delivery of assets not originally for sale (Art. 16D) |
| 10 | Other deliveries, including non-standard rates ⚠️ |

⚠️ Sources disagree on the 06 → 10 reassignment. Confirm against PER-11/PJ/2025
itself before hardcoding the enum.

### 1.4 Corrections

Replacement (`SS` increments) versus cancellation are different operations with
different downstream effects. Get this right early — retrofitting a correction
model onto a cleared-document store is expensive.

### 1.5 e-Bupot

Withholding certificates are issued through the Coretax e-Bupot module. See §3.

---

## 2. Indirect tax — PPN

### 2.1 The 12% / effective-11% mechanics

**This is the most misreported area in Indonesian tax. Get it exactly right.**

1. UU HPP legislated a rise to **12% from 1 January 2025**.
2. PMK 131/2024 did **not** repeal it. **The statutory rate is 12%.**
3. For **non-luxury** goods and services, the tax base (DPP) is set to
   "Nilai Lain" = **11/12 of the selling price**. So
   `PPN = 12% × (11/12 × price) = 11% × price`. The effective burden stays 11%.
4. For **PPnBM (luxury)** goods, DPP is the full price, so the effective rate is
   a true 12%.
5. Confirmed still in force for 2026.

```python
rate       = Decimal("0.12")                    # statutory, constant
dpp_factor = Decimal(1) if is_ppnbm else Decimal(11)/Decimal(12)
dpp        = price * dpp_factor
ppn        = round_idr(dpp * rate)
tx_code    = "01" if dpp_factor == 1 else "04"  # 04 = DPP Nilai Lain
```

> **The faktur must print the rate as 12% and the DPP as the 11/12 value — not
> "11%". A product that prints "PPN 11%" is non-compliant.**
>
> Persist `rate`, `dpp_factor`, `dpp` and `ppn` as **separate columns**. Never
> derive a historical rate from a constant.

⚠️ Verify no 2026 PMK supersedes PMK 131/2024 before shipping rate config, and
confirm DJP's exact rounding rule — a Rp 1 mismatch causes validation rejection.

### 2.2 Other parameters

| Item | Value |
|---|---|
| Export of goods / certain services | 0% |
| PKP registration threshold | Turnover > Rp 4.8 billion/year ⚠️ |
| Non-taxable / exempt | Basic necessities, medical, education, social, religious, financial, insurance, certain public transport (UU PPN Art. 4A as amended) ⚠️ |
| PPN PMSE | VAT on cross-border digital goods and services |
| Filing | **SPT Masa PPN**, monthly |

⚠️ UU HPP moved several items from "non-BKP" to "exempt", which changes the
faktur transaction code from none to `08`. Verify the current Art. 4A list.

---

## 3. Withholding tax — the flow that breaks generic ledgers

**In Indonesia, withholding on ordinary B2B payments is the default, not the
exception.** Your customer's customer will withhold when paying them, and your
customer will withhold when paying suppliers.

### 3.1 PPh 23 / 26

| Object | Rate |
|---|---|
| Interest, royalties, prizes | 15% |
| Dividends (domestic corporate, where not exempt) | 15% |
| Rent of assets **other than** land and building | **2%** |
| Technical, management, construction, consulting and other specified services | **2%** |
| **No NPWP** | **Rate increased by 100%** — 30% instead of 15%, 4% instead of 2% |
| **PPh 26** — all payments to non-residents | **20%**, reducible by treaty on a valid DGT Form / certificate of domicile |

⚠️ **PPh 23 at 2% applies only to services enumerated in the governing PMK**
(currently PMK 141/PMK.03/2015 as amended, 60+ categories). A service not on the
list is not subject to PPh 23. You need a maintained service-type reference
table keyed to the PMK list and mapped to the product/service master, carrying
the rate and the e-Bupot object code. **Obtain the annex — this is a gating
item.**

### 3.2 PPh 4(2) final

| Object | Rate |
|---|---|
| **Rent of land and/or buildings** | **10%** final |
| Construction — execution, small/medium/large qualified | 1.75% / 2.65% / 4% (unqualified) |
| Construction — planning or supervision, qualified / unqualified | 3.5% / 6% |
| Deposit and savings interest | 20% |
| Dividends to resident individuals | 10% (exempt if reinvested per UU HPP) |
| Transfer of land/buildings | 2.5% (0.5% simple housing) ⚠️ |
| **MSME final tax** (PP 55/2022 **as amended by PP 20/2026**) | **0.5%** of gross turnover — see below, the rules changed materially in April 2026 |

**The MSME 0.5% final regime matters commercially:** a large share of your
Indonesian SME market pays 0.5% of turnover and files accordingly, which is a
completely different reporting shape from corporate income tax.

**PP 20/2026, effective 22 April 2026, rewrote it in ways that break a naive
model:**

| Change | Consequence for the product |
|---|---|
| Eligibility narrowed to **individuals (WP OP), PT Perorangan and domestic cooperatives** | **CV, firma and ordinary PT can no longer use 0.5%** and must use standard corporate rates. Eligibility is not a free-form election — it is derived from legal form |
| The Art. 59 **time limits are deleted** (was 7 years for individuals, 4 for PT Perorangan) | The rate now applies indefinitely while criteria are met. Do not build a countdown |
| The Rp 4.8bn test now **aggregates spousal and multi-entity/foreign-source turnover** | Threshold evaluation spans entities and related parties, not one book |
| Individual MSMEs retain the **first Rp 500m of turnover tax-free** | A band, not a flat rate — 0.5% applies only above Rp 500m for individuals |

Model MSME status as **derived from legal form + aggregated turnover**, revalidated
each period — not as a boolean the user ticks.

### 3.3 Journals and the bukti potong

**Receiving a payment with withholding (AR side):**
```
Invoice:  Dr AR                         100,000,000
              Cr Revenue                            100,000,000
              (plus PPN output)
Receipt:  Dr Bank                        98,000,000
          Dr Prepaid PPh 23 (asset)       2,000,000
              Cr AR                                 100,000,000
```

**Paying a supplier with withholding (AP side):**
```
Dr Expense              100,000,000
    Cr PPh 23 payable                     2,000,000
    Cr AP                                98,000,000
```

The **bukti potong** is a document with its own lifecycle
(`expected → received → matched → claimed`). The prepaid-tax asset is only
recoverable against the annual return if the certificate exists. An unmatched
certificate at year end is a real cash loss for the customer — build the aging
report.

---

## 4. Numbering, retention, residency, language

| Item | Position |
|---|---|
| Numbering | **NSFP externally assigned** (§1.1). Your internal numbering is free |
| Retention | 10 years ⚠️ (confirm current basis) |
| **Residency** | PP 71/2019 and OJK electronic system rules ⚠️ — secondary sources suggest private-scope operators *may* host offshore, but the primary analysis could not be retrieved. **Do not repeat this claim to customers until sourced properly** |
| **Language** | **Bahasa Indonesia** required for bookkeeping |
| **Currency** | **IDR** required; USD/English bookkeeping requires **prior permission from the Ministry of Finance** |

The language and currency rules are not cosmetic — they affect the chart of
accounts (account names in Indonesian), the invoice template, and the functional
currency on the entity. Model `bookkeeping_language` and the MoF permission state
on the entity.

---

## 5. Statutory accounts

| Item | Position |
|---|---|
| Framework | **SAK** four-pillar structure: PSAK (full, IFRS-converged), **SAK EP** (private entities, replaced SAK ETAP from 1 Jan 2025), SAK EMKM (micro), SAK Syariah |
| **PSAK renumbering** | **Confirmed effective 1 January 2024** — PSAK 72→115, 73→116, 71→109, 1→201, etc. Presentational only, but your statutory element set must use the new numbers |
| Filing | DJP SPT Tahunan; audit for entities above thresholds |
| Fiscal year | Calendar by default |

---

## 6. Chart of accounts

No prescribed chart. Account names should be in Bahasa Indonesia by default.
Seed a chart matching the conventions used by Accurate and Jurnal, since those
are the migration sources.

---

## 7. Integrations

| Category | Options |
|---|---|
| Payment rails | **QRIS**, Virtual Account, bank transfer |
| Banking data | Bank APIs (BCA, Mandiri, BNI, BRI); coverage varies |
| Migration sources | **Accurate**, **Jurnal (Mekari)**, **Zahir**, SAP B1 for larger SMEs |

---

## 8. Pack acceptance criteria

| # | Criterion |
|---|---|
| ID-1 | e-Faktur state machine implemented; no downstream artefact finalises before `APPROVED` |
| ID-2 | NSFP stored as externally assigned, 17 digits, 2-digit status; internal numbering independent |
| ID-3 | 20th-of-month upload deadline monitored with escalating alerts from the 10th |
| ID-4 | PPN computed as 12% × (11/12 × price) for non-luxury, 12% × price for PPnBM; **faktur prints 12%** |
| ID-5 | `rate`, `dpp_factor`, `dpp`, `ppn` persisted separately; historical documents reproduce exactly |
| ID-6 | Transaction code selected correctly (01 vs 04 vs 07/08) per fixture set |
| ID-7 | PPh 23/26/4(2) determined from the PMK service list; no-NPWP doubling applied |
| ID-8 | Bukti potong lifecycle tracked with an aging report; prepaid tax asset reconciles |
| ID-9 | MSME final regime **derived** from legal form and aggregated turnover per PP 20/2026 — including the Rp 500m tax-free band for individuals and the exclusion of CV/firma/ordinary PT — never a user-set flag |
| ID-10 | Replacement vs cancellation both implemented with correct downstream effects |
| ID-11 | Bookkeeping in IDR and Bahasa Indonesia by default; MoF permission state modelled |
| ID-12 | SPT Masa PPN reconciles to the ledger for a seeded book (gate G4) |
| ID-13 | Signed off by a named Indonesian tax consultant / akuntan against pack version |

---

## 9. Open items — resolve before ship

1. **e-Faktur Desktop status in 2026** — the single most consequential unresolved
   question in this pack. Determine whether host-to-host API is generally
   available and stable post-Coretax rollout.
2. **PMK 141/PMK.03/2015 annex** — the enumerated PPh 23 service list and current
   Coretax object codes. Gates ID-7.
3. ~~Confirm no 2026 PMK supersedes PMK 131/2024~~ — **closed.** 12% statutory
   with 11/12 DPP remains in force for 2026.
4. DJP's exact rounding rule at faktur validation.
5. Transaction code 06 vs 10 reassignment, from PER-11/PJ/2025 directly.
6. Current UU PPN Art. 4A exempt list.
7. PKP registration threshold (Rp 4.8bn widely cited — confirm).
8. **PP 71/2019 data residency** — source this properly before making any
   customer-facing claim.
9. Retention period and legal basis.
