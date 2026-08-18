# 02 — Localisation Pack Framework

**Status** Ready to develop · **Phase** 2 (framework lands in Phase 1) · **Owner** Platform

This is the most important document in the set. Whether adding country nine takes
two weeks or two quarters is decided here.

**Rule with no exceptions: there is no `if country == "MY"` anywhere outside a
pack.** If you find one in review, it is a defect, not a shortcut.

---

## 1. What a pack is

A pack is a **versioned, effective-dated bundle of data and adapters** for one
jurisdiction. It is loaded per legal entity, not per tenant — a tenant with a
Malaysian Sdn Bhd and a Singaporean Pte Ltd runs two packs simultaneously and
they must not interfere.

```
pack/
  manifest.yaml            id, version, effective_from, capabilities, dependencies
  chart/                   statutory COA + mapping rules to the internal chart
  tax/                     tax codes, rate schedules, determination rules
  numbering/               series rules, format masks, gapless/chronology policy
  documents/               invoice content rules + syntax bindings
  transmission/            adapter config (clearance | peppol | none)
  returns/                 return definitions as declarative aggregations
  exports/                 statutory file formats (XBRL, SAF-T-like, CSV)
  archive/                 retention, residency, what must be retained
  fixtures/                golden test documents + expected outputs
```

### 1.1 The eleven capabilities

Every pack declares which of these it implements. Anything not declared falls
back to a documented default, and the fallback is always the conservative one.

| Capability | Question it answers |
|---|---|
| `chart_of_accounts` | Is a statutory chart prescribed, and how does the internal chart map to it? |
| `tax_determination` | Given a transaction, which tax code, rate and base apply? |
| `tax_point` | *When* does the liability arise — invoice date, payment date, delivery? |
| `rounding_policy` | Line, tax-category, or invoice-level? Which rounding mode? Which unit? |
| `numbering_rules` | Gapless? Chronological? Externally assigned? Format mask? Reset cadence? |
| `document_content` | Which fields are mandatory on a compliant invoice, in which language? |
| `transmission` | Clearance, Peppol 4/5-corner, e-mail, or nothing? |
| `withholding` | Which payments carry withholding, at what rate, with what certificate? |
| `returns` | Which periodic returns exist, and how do they aggregate from the ledger? |
| `statutory_exports` | Annual filing formats (XBRL taxonomies, e-filing schemas) |
| `archive_policy` | Retention years, residency constraints, what artefact must be kept |

### 1.2 Capability matrix — the six launch markets

| | MY | SG | AU | ID | TH | US |
|---|---|---|---|---|---|---|
| Indirect tax model | **SST — no input credit** | GST, fully recoverable | GST, fully recoverable | PPN, recoverable | VAT, recoverable | Sales tax, **not** recoverable |
| Standard rate | 5/10% sales; 6/8% service | 9% | 10% | 12% statutory / 11% effective | 7% | ~13,000 jurisdictions |
| Tax point | Invoice (service tax; verify per group) | Invoice / accounting basis | Invoice or cash (<A$10m) | Delivery/invoice | **Services: payment received** | Invoice |
| E-invoicing | **Clearance (MyInvois)** | **Peppol 5-corner (InvoiceNow)** | Peppol 4-corner, voluntary | **Clearance (Coretax)** | Voluntary, ETDA-certified | None (DBNA voluntary) |
| Invoice number | Self-assigned | Self-assigned | Self-assigned | **DJP-assigned post-hoc** | Self-assigned | Self-assigned |
| Gapless required | Practical yes | No | No | N/A (external) | Practical yes | **No** |
| Withholding on B2B | Non-residents only | Non-residents only | No-ABN 47% | **Yes, routinely** | **Yes, routinely** | Backup withholding only |
| Statutory COA | No (conventional) | No | No | No | **No** | No |
| Annual e-filing | MBRS 2.0 XBRL | ACRA BizFinx XBRL | ASIC (threshold) | DJP SPT Tahunan | DBD e-Filing XBRL | IRS forms |
| Records in-country | **Yes — ITA s82(8)** | No | No | Verify (PP 71/2019) | Verify | No |
| Language | EN or BM | EN | EN | **Bahasa Indonesia** | **Thai** | EN |
| Books currency | MYR (exceptions) | Any, SGD returns | AUD | **IDR (permission for USD)** | **THB (exceptions)** | USD |

**Three architectural consequences fall straight out of that table:**

1. **The tax engine cannot be one engine.** Malaysia's SST has no input tax
   credit — purchase tax is a *cost*, posted to expense. Singapore's GST is a
   recoverable *asset*. The US is neither: sales tax is a cost to the buyer and
   a liability to the seller with no netting. Model `recoverability` as a first
   class property of a tax code, not an afterthought.
2. **The document number is not always yours.** Indonesia's Coretax assigns the
   NSFP on approval. The ledger must carry `internal_document_no` (always yours,
   always immediately available) alongside a nullable `statutory_document_no`
   populated by the transmission adapter. Phase 0 already numbers at post, so
   this is an additive change — but it *must* be additive, not a rewrite.
3. **APAC is not one region.** Malaysia's Income Tax Act s82(8) requires
   business records to be kept in Malaysia. Singapore has no such requirement.
   You cannot put both in one Singapore region and call it done.

---

## 2. Pack interface

### 2.1 Manifest

```yaml
id: my
version: 2026.8.0                # CalVer: packs track legislation, not semver
effective_from: 2026-01-01
effective_to: null
jurisdiction: { country: MY, subdivisions: [] }
capabilities:
  - chart_of_accounts
  - tax_determination
  - tax_point
  - rounding_policy
  - numbering_rules
  - document_content
  - transmission
  - withholding
  - returns
  - statutory_exports
  - archive_policy
requires: { platform: ">=1.0" }
supersedes: 2025.7.0
```

**Versioning is CalVer and effective-dated, never edited in place.** Reproducing
how a document was generated in 2027 while auditing it in 2032 is a hard
requirement in every one of these six markets. A pack version is immutable once
any document has been produced under it.

### 2.2 Ports the platform provides

Packs implement interfaces; they never import platform internals.

```python
class TaxDeterminationPort(Protocol):
    def determine(self, ctx: TxContext) -> list[TaxLine]: ...
    # ctx carries: entity, counterparty (incl. registration numbers and country),
    # lines (with product classification), dates, place of supply, currency.
    # Returns tax lines with: code, rate, base, base_factor, amount,
    # recoverability, return_box_tags, and the rule id that produced it.

class TaxPointPort(Protocol):
    def tax_point(self, doc: Document, event: Event) -> date | None: ...

class NumberingPort(Protocol):
    def series_for(self, doc: Document) -> SeriesSpec: ...
    def is_externally_assigned(self) -> bool: ...

class DocumentContentPort(Protocol):
    def validate(self, doc: Document) -> list[Violation]: ...
    def render(self, doc: Document, syntax: str) -> bytes: ...

class TransmissionPort(Protocol):
    def submit(self, doc: Document) -> SubmissionResult: ...
    def poll(self, ref: str) -> SubmissionStatus: ...
    def cancel(self, ref: str, reason: str) -> CancellationResult: ...

class ReturnPort(Protocol):
    def definitions(self) -> list[ReturnDefinition]: ...
    def prepare(self, entity, period) -> ReturnDraft: ...
```

**`determine()` must return the rule id that produced each tax line.** When a
customer asks "why 8% and not 6%?", the answer has to be a query.

### 2.3 Returns are declarative, not code

Every return in all six markets is an aggregation over tagged transactions. Do
not write six report generators.

```yaml
# returns/gst_f5.yaml  (Singapore)
id: gst_f5
frequency: quarterly            # cycle assigned by IRAS at registration — store it
due: { after_period_end: P1M }
currency: SGD
boxes:
  - { id: "1",  label: "Standard-rated supplies",  source: sum(net) where tax_code.group == "SR" }
  - { id: "2",  label: "Zero-rated supplies",      source: sum(net) where tax_code.group == "ZR" }
  - { id: "3",  label: "Exempt supplies",          source: sum(net) where tax_code.group == "EX" }
  - { id: "4",  label: "Total supplies",           source: box(1) + box(2) + box(3) }
  - { id: "5",  label: "Taxable purchases",        source: sum(net) where tax_code.group in ["TX","IM"] }
  - { id: "6",  label: "Output tax due",           source: balance("GST Output Tax") }
  - { id: "7",  label: "Input tax claimed",        source: balance("GST Input Tax") }
  - { id: "8",  label: "Net GST",                  source: box(6) - box(7), posts_to: "GST Control" }
  - { id: "14", label: "Reverse charge imports",   source: sum(net) where tax_code == "RC" }
```

**Corollary that saves you months: every tax code carries its return-box tags.**
The return becomes a pure aggregation. Adding a country's return is a YAML file,
not a sprint.

### 2.4 Chart of accounts

None of the six markets prescribes a chart of accounts. That is a genuine relief
relative to France or Romania — but do **not** conclude you can skip the mapping
layer, because Thailand's DBD XBRL and Indonesia's SPT both require mapping the
free-form chart to a **statutory element**, and the US requires mapping to tax
return lines (Schedule C / 1120 / 1120-S / 1065).

Build **one** versioned mapping subsystem and all six become data:

```
account            (tenant, id, code, name, type, normal_balance)
statutory_element  (pack_id, version, element_id, label, parent_id)
statutory_map      (tenant, entity, pack_id, version, account_id, element_id,
                    effective_from, weight)
```

`weight` handles the case where one account splits across two statutory
elements. Mapping completeness is a pre-filing validation, not a runtime error.

---

## 3. Transmission adapters

Three shapes cover all six markets, plus a null adapter.

### 3.1 Clearance (Malaysia, Indonesia)

The tax authority is in the delivery path. The document is not legally valid
until the authority validates it.

```
DRAFT → VALIDATING → CLEARED(statutory_no, qr, link) → shared with buyer
                   ↘ REJECTED(errors) → corrected → resubmit
CLEARED → CANCELLED (only inside the statutory window)
```

**Malaysia:** LHDN returns a UIN, a validation link and a QR code, all of which
the supplier must convey to the buyer. There is a hard **72-hour cancellation
window from validation** — after that, correction is by credit/debit/refund
note, never cancellation. Model the window as a pack-supplied duration, and
surface a countdown in the UI; support tickets about this will otherwise
dominate.

**Indonesia:** DJP assigns the 17-digit NSFP on approval. Nothing downstream —
output PPN ledger, SPT Masa PPN, the customer's copy — may be finalised before
`APPROVED`. Upload deadline is the **20th of the following month**; miss it and
the document is not a faktur pajak at all and the buyer loses the input credit.
That deadline needs a scheduled sweep and an escalating alert, not a hope.

### 3.2 Peppol (Singapore, Australia)

Four-corner delivery, with Singapore adding IRAS as corner five. The document is
valid on issue; transmission is delivery plus (in SG) reporting.

Use one Access Point integration behind the port. Both markets are **PINT**
profiles now — PINT-SG and PINT A-NZ v1.1.2 (BIS Billing 3.0 is no longer
accepted on the A-NZ network). Bind syntax at the edge: your semantic model
carries the superset, and the pack maps it.

### 3.3 Certified provider (Thailand)

ETDA-certified service provider or the e-mail scheme for small businesses.
Voluntary as of August 2026 — no mandate legislated for 2026 or 2027.

**The engineering item that surprises people: Thailand's XML is UN/CEFACT CII
(`<rsm:CrossIndustryInvoice>`, ETDA Rec. 3-2560 v2.0), not UBL.** If your
Peppol work has produced a UBL serializer, Thailand needs a second one. Budget
it explicitly; it is the largest single item in the Thai pack.

### 3.4 Null (United States)

No mandate. DBNAlliance exists and is voluntary. The pack implements
`transmission` as PDF + e-mail and declares nothing else.

---

## 4. Testing a pack

A pack is not done until all five gates pass. This section is the acceptance
criteria for every country story in the backlog.

| Gate | What it checks |
|---|---|
| **G1 Golden documents** | Each `fixtures/*.json` renders to a byte-comparable expected output. Fixtures come from the authority's own published samples where they exist |
| **G2 Schema validation** | Rendered output validates against the official XSD/schematron. Vendored, versioned, and checked into the repo — never fetched at runtime |
| **G3 Sandbox round-trip** | Submit to the authority's sandbox, assert the expected acceptance or the expected error code. Runs nightly, not per-PR |
| **G4 Return reconciliation** | For a seeded book, every return box equals an independently computed value from `journal_line`. Any divergence fails |
| **G5 Determination coverage** | Every tax code in the pack is exercised by at least one test; every rule reachable. Uncovered rules fail the build |

Plus one cross-cutting gate: **no pack may import from `ledger.*` internals.**
Enforce with an import-linter contract in CI.

### 4.1 Sandbox availability, by market

| Market | Sandbox | Notes |
|---|---|---|
| MY | MyInvois preprod | Available; 60-minute token lifetime; intermediary auth model for software vendors |
| SG | IRAS C5 sandbox | Available; note error reporting differs between sandbox and production — do not assume parity |
| AU | ATO DSP | **Accreditation takes 6–12 months and gates all lodgment.** Start it before you write the pack |
| ID | Coretax | Verify current host-to-host availability; e-Faktur Desktop status is the biggest open question in the ID pack |
| TH | ETDA-certified provider | Via provider, not direct |
| US | Vendor (Avalara/Anrok/Stripe Tax) | Vendor sandboxes |

**Start ATO DSP accreditation in the same week you start Phase 2.** It is the
longest lead-time item in the whole programme and it is pure calendar, not
effort.

---

## 5. Pack development checklist

Copy this into the ticket for each new market.

- [ ] Manifest with CalVer version and `effective_from`
- [ ] Tax code taxonomy, each code tagged with return boxes and recoverability
- [ ] Rate schedules effective-dated (never a constant in code)
- [ ] Tax point rule — and a test that proves it differs from invoice date where it does
- [ ] Rounding policy incl. level and mode, with a test at a half-unit boundary
- [ ] Numbering: gapless / chronological / external, format mask, reset cadence
- [ ] Document content validation with the authority's own field list
- [ ] Syntax binding + vendored schema
- [ ] Transmission adapter + state machine + cancellation/correction rules
- [ ] Withholding rules and certificate generation, if applicable
- [ ] Return definitions as YAML + G4 reconciliation test
- [ ] Statutory export mapping (XBRL taxonomy or return-line map)
- [ ] Archive policy: retention years, residency, artefacts retained
- [ ] Seeded default chart + statutory mapping
- [ ] G1–G5 green
- [ ] Compliance sign-off recorded by a named local qualified accountant

**The last line is not ceremony.** Every pack must be signed off by someone
qualified in that jurisdiction, and the sign-off recorded against the pack
version. It is what you show an auditor, and it is what protects you when a rule
changes.
