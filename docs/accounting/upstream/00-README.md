# Multi-Tenant SaaS Accounting Platform — Developer Documentation

**Version** 1.0 · **17 August 2026** · **Status** Ready to develop

Target markets: **Malaysia · Singapore · Australia · Indonesia · Thailand ·
United States**

---

## What exists already

| | Status |
|---|---|
| Architecture blueprint | Delivered. Tenancy, ledger core, compliance strategy, ADRs, risk register |
| **Phase 0 walking skeleton** | **Shipped and green.** 29 files, ~2,700 lines, 72 tests passing against PostgreSQL. Ledger core, RLS, gapless numbering, period locking, hash chain, outbox, CI gates |
| This documentation set | Phases 1–3 and six localisation packs, ready to build from |

---

## Reading order

| # | Document | Read if you are |
|---|---|---|
| **01** | [Phase 1: Core Accounting](01-phase1-core-accounting.md) | Building SLA, AR, AP, banking, reporting |
| **02** | [Localisation Pack Framework](02-localisation-pack-framework.md) | **Everyone. Read this before any country doc** |
| 03 | [Pack: Malaysia](03-pack-malaysia.md) | MyInvois clearance, SST |
| 04 | [Pack: Singapore](04-pack-singapore.md) | InvoiceNow/Peppol, GST |
| 05 | [Pack: Australia](05-pack-australia.md) | BAS, PAYG, Peppol |
| 06 | [Pack: Indonesia](06-pack-indonesia.md) | Coretax, PPN, PPh |
| 07 | [Pack: Thailand](07-pack-thailand.md) | e-Tax Invoice, VAT, WHT |
| 08 | [Pack: United States](08-pack-united-states.md) | Sales tax, 1099 |
| **09** | [Phase 3: Depth and Scale](09-phase3-depth-and-scale.md) | Fixed assets, revrec, inventory, consolidation |
| **10** | [Delivery Backlog](10-delivery-backlog.md) | Planning, estimating, sequencing |
| — | [appendix/](appendix/) | Raw research briefs with full sourcing (~38,000 words) |

---

## The eight things that matter most

If you read nothing else:

1. **There is no `if country == "XX"` outside a pack.** Finding one in review is
   a defect, not a shortcut. (02)
2. **The tax engine is not one engine.** Malaysia's SST has no input credit,
   Singapore's GST is fully recoverable, US sales tax is neither. Model
   `recoverability` as a first-class property of a tax code. (02 §1.2)
3. **The document number is not always yours.** Indonesia's DJP assigns it after
   you submit. Carry `internal_document_no` always, `statutory_document_no`
   when the authority grants one. (06 §1.1)
4. **APAC is not one region.** Malaysia's ITA s82(8) requires records kept in
   Malaysia; Singapore has no such rule. `tenant_routing.region` exists for
   this. (03 §4)
5. **Thailand's XML is CII, not UBL**, and its **VAT tax point for services is
   payment receipt, not invoice date**. Two separate surprises in one pack. (07)
6. **Withholding on ordinary B2B payments is normal** in Indonesia and Thailand.
   Build it into core AR/AP, not into the packs. (01 §2.2)
7. **Returns are declarative.** Every tax code carries its return-box tags; a
   return is a YAML aggregation, not a report generator. (02 §2.3)
8. **Migration importers close deals.** In all six markets, "can you import my
   existing books?" comes before any feature question. (10 EPIC-14)

---

## Market comparison at a glance

| | MY | SG | AU | ID | TH | US |
|---|---|---|---|---|---|---|
| E-invoicing | Clearance | Peppol 5-corner | Peppol, voluntary | Clearance | Voluntary | None |
| Mandate live? | Yes, ≥RM1m | Phasing to 2031 | B2G only | Yes | No | No |
| Indirect tax | SST 5/10% + 6/8% | GST 9% | GST 10% | PPN 12%/11% eff. | VAT 7% | Sales tax, ~13k jurisdictions |
| Input credit | **No** | Yes | Yes | Yes | Yes | N/A |
| Doc number | Yours | Yours | Yours | **DJP's** | Yours | Yours |
| Gapless | Practical | No | No | N/A | Practical | **No** |
| B2B withholding | Non-res only | Non-res only | No-ABN 47% | **Routine** | **Routine** | Backup only |
| Records in-country | **Yes** | No | No | Verify | Verify | No |
| Language | EN/BM | EN | EN | **ID** | **TH** | EN |
| Pack estimate | 7w | 5w | 6w | 9w | 8w | 5w |

---

## Timeline summary

| When | Milestone |
|---|---|
| End Q4 2026 | Phase 1 done — books can be kept, one country |
| ~Feb 2027 | Malaysia live |
| ~Apr 2027 | Singapore + Australia live; framework proven across three regimes |
| ~Jul 2027 | Thailand, Indonesia, US live |
| ~Q3 2027 | Consolidation shipped; SOC 2 Type II window closes |

**Start immediately, before any code:** ATO DSP accreditation (6–12 months,
gates all Australian lodgment), MyInvois intermediary registration, Malaysian
s82(8) legal advice, and SOC 2 evidence collection.

---

## Confidence and maintenance

Every country document ends with a **§9 open items** list. Those are real: they
are the claims I could not verify against a primary source, or where sources
conflicted. They are not padding — several carry ±2 weeks of estimate risk.

**Assign each open item an owner before its pack starts.** The four that gate
estimates:

1. Malaysia — Service Tax Regulations 2018 First Schedule (Group A–L list and
   per-group thresholds). `mysst.customs.gov.my` was unreachable across repeated
   attempts, so every MY service-tax figure rests on professional-firm summaries
   rather than the gazetted schedule.
2. Indonesia — PMK 141/PMK.03/2015 annex (PPh 23 service list)
3. Indonesia — e-Faktur Desktop / host-to-host status in 2026
4. Thailand — DBD XBRL taxonomy version and submission mechanism

**This set was fact-checked against primary sources after drafting, and ten
material errors were corrected** — including a Malaysian service-tax group that
does not exist, two thresholds that had doubled, a Singaporean withholding rate
that would have under-withheld on every non-resident director fee, and an
Indonesian MSME regime rewritten by PP 20/2026 in April. Four open items were
closed in the same pass. That is the expected error rate for compliance content
drafted from secondary sources, and it is why §9 of each pack exists.

Compliance facts decay. Re-verify each pack's rates and dates at every pack
version bump, and record the qualified accountant's sign-off against that
version. That sign-off record is what you show an auditor and what protects you
when a rule changes.
