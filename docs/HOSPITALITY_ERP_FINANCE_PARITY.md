# Hospitality ERP Suite — NetSuite-class Finance Parity

**Status:** Binding for product claims · **Date:** 18 August 2026  
**Related:** [`ACCOUNTING_ARCHITECTURE.md`](./ACCOUNTING_ARCHITECTURE.md), [`PRODUCT_TARGET_ARCHITECTURE.md`](./PRODUCT_TARGET_ARCHITECTURE.md), upstream [`10-delivery-backlog.md`](./accounting/upstream/10-delivery-backlog.md)

## Positioning

Bisync.cloud is a **dedicated hospitality ERP suite** (RMS + POS + HR + Team + Sales + Accounting).  
The claim is **full ERP for F&B / hospitality operators**, not a horizontal NetSuite clone.

Finance must still reach **NetSuite-class ticks** for every capability an operator’s accountant expects — shaped for hospitality events (POS day settlement, PO receive, payroll, FIFO COGS) rather than manufacturing WIP or multi-subsidiary consolidation in v1.

**Hard rule (unchanged):** do not market “statutory book of record” or “NetSuite replacement” until the exit criteria in §4 are green.

---

## 1. Suite map (how Bisync claims “full ERP”)

| NetSuite suite area | Bisync module (hospitality-shaped) | Finance tick dependency |
|---|---|---|
| Inventory | RMS stock card / FIFO / central store | Summary journals on affirm / issue |
| Order management | B2B SO + Team RMS PO | AR/AP documents from SO / receive |
| POS / retail | POS floor, menu, EOD | **Daily sales settlement → GL** |
| HR / payroll | HR + Payroll | PAYROLL journal (live) |
| CRM / pipeline | Sales module | Optional AR from won deals later |
| Financials | Accounting / Books | This document |
| Reporting | Books reports + ops reports | Standard statement pack |
| Tax / e-invoice | MY pack → Phase D | SST / MyInvois |

---

## 2. NetSuite finance tick matrix (target)

Legend: ✅ live · 🟡 partial · ⬜ next · ❌ out of v1 hospitality scope

| Tick | Target | Now | Next slice |
|---|---|---|---|
| Chart of accounts | ✅ | ✅ | — |
| Sealed journals + reverse | ✅ | ✅ | — |
| Multi-currency + FX store | ✅ | 🟡 | Realised FX on cross-currency apply |
| Trial balance (balances) | ✅ | ✅ | Comparatives |
| P&L / Balance sheet | ✅ | 🟡 | YTD + prior period |
| Cash flow (indirect) | ✅ | ✅ | Direct method later |
| General ledger enquiry | ✅ | ✅ | Drill to source doc UI |
| Period close / hard-close | ✅ | 🟡 | Broader admin UI |
| AR/AP open items | ✅ | ✅ | — |
| Invoice/bill line items | ✅ | ✅ | Richer picker UX |
| Customer / vendor master | ✅ | ✅ | `CounterpartyRef` `vendor:` / `customer:` |
| Aging detail | ✅ | ✅ | PDF export |
| Apply / credit notes | ✅ | ✅ | Apply posts clearing journals |
| Bank rec + import | ✅ | ✅ | CSV import + match worksheet; OFX later |
| Fixed assets life-cycle | ✅ | ✅ | Acquire + dispose + dep |
| Revenue recognition | ✅ | ✅ | Liability seed + schedule runner |
| POS / sales → GL | ✅ | ✅ | Tender split polish |
| Inventory / COGS → GL | ✅ | ✅ | FIFO issue + vendor CN bridges |
| Payroll → GL | ✅ | ✅ | — |
| Tax returns / e-invoice | ✅ | 🟡 | SST-02 from GL tax roles; MyInvois Phase D |
| Budgets / dimensions | ✅ | ❌ | Location dimension after GL stable |
| Multi-book / consolidation | ✅ | ❌ | Tax book already schedule-only |
| Access control GL/AP/AR | ✅ | ✅ | Catalog task enforce on mutate |
| Migration QBO/Xero | ✅ | ⬜ | After report pack |

---

## 3. Delivery waves (hospitality-first)

### Wave A — Accountant can trust the numbers ✅
1. Cash flow (indirect) + GL enquiry in Books → Reports  
2. Open-item **line items** (document structure)  
3. **POS EOD day settlement → sealed sales journal** (`pos.settlement.posted`)  
4. Source-level regression tests for the above  

### Wave B — Subledger is real ✅ (this pass)
5. Vendor/customer master binding (`CounterpartyRef`)  
6. Per-line GL coding + tax codes from seeded list (+ deferred post from lines)  
7. Apply/unapply posts clearing journals (unapplied cash ↔ control)  
8. Bank CSV import + rec worksheet UI  
9. Aging detail table + control-recon worksheet  

### Wave C — Close & compliance 🟡 (this pass advances)
10. Access Control on post / reverse / approve / close ✅  
11. FIFO issue + vendor CN → GL ✅  
12. FA acquire/dispose; RevRec schedule ✅  
13. SST-02 from GL tax lines ✅ (MyInvois still Phase D)  
14. EF migrations; QBO/Xero take-on ⬜  

### Wave D — Scale ticks (explicitly later)
15. Budgets, saved reports, PDF packs  
16. Location / department dimensions  
17. Multi-entity consolidation  

---

## 4. Exit criteria before “full ERP / NetSuite-class Finance” marketing

All must be true:

1. POS EOD close posts (or explicitly queues) a balanced sales journal for the business day. ✅  
2. AR invoice and AP bill support line items; TB/BS remain balanced after posting. ✅  
3. Books Reports expose TB, P&L, BS, **cash flow**, and **GL enquiry**. ✅  
4. Bank statement can be finalised with opening + lines = closing. ✅  
5. Architecture markers stay honest (C1/C2 🟡 until Wave C item 14 + MyInvois pack path).  
6. Automated tests cover posting balance, POS settlement idempotency, and line-item gross rollup. ✅  

**Marketing posture after Wave B/C this pass:** claim **dedicated hospitality ERP with NetSuite-class finance coverage for operator accounting** — still **not** “statutory book of record” / “NetSuite replacement” until Phase D e-invoice + hash/audit exit in `ACCOUNTING_ARCHITECTURE.md`.

---

## 5. Non-goals (keep the suite hospitality-true)

- Replacing NetSuite manufacturing, SuiteProjects, or SuiteSuccess verticals.  
- Re-implementing FIFO inside the GL (RMS remains cost truth; GL gets summaries).  
- Claiming statutory status before Phase D packs and hash/audit exit criteria in `ACCOUNTING_ARCHITECTURE.md`.
