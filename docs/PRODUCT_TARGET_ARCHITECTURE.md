# Product target architecture (B2C / B2B Principal / Sub-Product)

**Status:** Binding product rules for Bisync.cloud.  
**Related:** Component UOM is already unified (principal + up to 5 alts). Product UOM must follow the same clarity.

This document defines how **B2C Products**, **B2B Principal Products** (with aliases), and **Sub-Products** must behave — including production, bi-products, holdout, DO, and stock-card FIFO.

---

## 1. Product kinds (exclusive)

| Kind | Sellable? | Primary sales channels |
|---|---|---|
| **B2C Product** | Yes | POS now; Online Store later |
| **B2B Principal Product** | Yes | Sales Order (Sales Team); Online Customer PO |
| **B2B Product Alias** | Yes (points at Principal) | Sales Team tagging to customers; same stock as Principal |
| **Sub-Product** | No (standalone) | Only consumed as BOM input into B2C / B2B / other Sub-Products |
| **B2B Bi-Product** | Yes (optional internal/external) | Created at production; own stock card; may sell or use internally |
| **Bi-Sub-Product** | No (standalone) | Same as Sub-Product; created at production with cost attribution |

One catalog row is either B2C **or** B2B Principal **or** Sub-Product (unchanged exclusivity). Aliases and bi-products are linked entities, not a fourth exclusive kind flag.

---

## 2. B2C Products

### Sell
- Sold via **POS** (today) or **Online store** (not built yet).
- Detail page must expose an explicit **Product UOM** (do not assume `Each`).
- Product UOM drives POS sales unit and stock-card display for finished goods.

### Stock on sale
- On each sale, attached **Component** lines (BOM qty × yield rules) deplete **Component Stock Cards** via **FIFO**.
- Nested **Sub-Product** BOM lines explode into their components (and/or deplete sub-product stock) as today.
- **Negative sales allowed**: finished-goods / component balances may go negative when sold without stock.
- **Price on inbound only**: when stock later arrives on the Stock Card, the inbound lot carries unit cost; prior negative consumption gets cost when matched (same spirit as component shortage → priced on inbound).

### Gaps vs today
- B2C detail does not persist a first-class Product UOM (`PosSalesUom` is POS-menu only).
- Finished-goods stock is scalar `InStock`, not true product FIFO layers.
- `quantitySold <= 0` is ignored — no negative-sale path yet.

---

## 3. B2B Principal Product (+ Alias)

Rename mindset: **B2B Principal Product** (not just “B2B Product”).

### Alias
- Many **B2B Product Aliases** can point to one Principal.
- Alias fields: variation name, **Delivery Unit** (from Principal’s DU set), **COGS** (derived), **RRP** (user), auto **COGS%**, **Note** (reason for alias).
- Sales Team tags customers using **Alias**; stock depletion always hits the **Principal** (and its stock card).

### Production UOM
- **Principal Production Unit** — how the product is created.
- **Alternate Production Unit 1 and 2** — same pattern as component alts: `1 alt = qty × principal production unit`.

### Delivery UOM
- **Principal Delivery Unit** with up to **3-level breakdown** (e.g. `1 CTN / 24 Box / 12 Each`).
- Auto cost from production/COGS into each level; user enters **RRP**; **COGS%** auto.
- **Up to 2 more alternate Delivery Units** (principal + 2 alts = 3 DU configs) — aligns with current `MAX_B2B_ALTERNATE_DELIVERY_UNITS = 2`.

### Sales / holdout / DO

| Path | Behavior |
|---|---|
| **Sales Order** (Sales Team) | On create/issue: reserve into **Holdout** for the product’s **Holdout Period**. If customer does not confirm within holdout → **release** reservation. |
| **Online Customer PO** | Moves straight into **Holdout** with **no holdout period** (stays until DO / confirm). |
| **Ready to deliver** | Issue **DO** from Holdout. **DO box** required: like Sales Order but **no price**; has issue date + PO/SO reference. |
| **Online PO — customer confirms receipt** | Consider **sold**: move Holdout → Sales on Stock Card with **DO** detail. |

### Gaps vs today
- Aliases + DU breakdown + RRP/COGS% largely exist.
- Production UOM is folded into `YieldUom` / package unit — needs explicit Principal + 2 alts labeling.
- Holdout is approximated by `OnOrderQty` + lock days — no dedicated Holdout bucket / DO document.
- Online PO path exists (`online_order`) but DO-from-holdout and receipt→sale need a first-class DO entity.

---

## 4. Production (B2B Principal & Sub-Product)

### To Produce
- Click **To Produce** → window: enter **QTY** using **Production UOM or Delivery UOM** (including alternates).
- After qty: show **components required** and **Stock QTY available** per line.

### Produced
- Click **Produced** → window: enter **QTY produced** (Production or Delivery UOM + alts).
- Show recipe components + **Actual QTY used** (default = recipe requirement; user-editable).
- On confirm:
  - Deplete **Component Stock Cards** by **Actual QTY** (FIFO).
  - Add finished qty to **Product Stock Card** (B2B or Sub-Product).
  - Respect **incubation / activation** for availability, but **component depletion is immediate**.

### Bi-product / Bi-Sub-Product (at Produced)
- **+ Add** enables split of what was produced into:
  - Primary **B2B Product** (or Sub-Product), and
  - **B2B Bi-Product** / **Bi-Sub-Product** (defect / unsellable-as-primary; still catalogued).
- **Cost attribution %** per output line:
  - **100%** on each → cost split **equally** across Product + bi-product(s).
  - Otherwise weight by attribution (example below).
- Both outputs get **separate Stock Cards** until outbound.
- Bi-product may later sell or be used internally at same or different price.
- Bi-Sub-Product cannot sell standalone; only feeds further production.

**Cost example (user rule):**  
Produce 20 each at total RM 10.00 cost, of which 10 are bi-product with **50% attribution**:

- Bi-product bears 50% of total cost → RM 5.00 / 10 = **RM 0.50 each**?  
  User stated: “B2B product cost will be RM 15.00 each and bi-product cost will be RM 5 each” for that scenario — treat as **unit cost after attribution** as specified in UI acceptance tests when implementing (normalize formula in `ProductionCostAttribution` helper and lock with unit tests).

**Implementation note:** Capture formula in code + tests so Product vs Bi-product unit costs match the agreed worked example exactly.

### Gaps vs today
- To Produce / Produced / actual component qty / incubation exist.
- Extra sub-product outputs exist **without** cost attribution.
- No first-class Bi-Product / Bi-Sub-Product catalog + stock cards.
- Production UOM choice must include Delivery UOM alts explicitly in both windows.

---

## 5. Sub-Product

- Same production / bi-product logic as B2B Principal.
- **Cannot be sold as-is**; only becomes part of making B2C / B2B / Sub-Products.
- On produce: deplete component stock immediately (actual qty); incubation respected for when sub-product stock becomes usable in downstream BOM.
- Include **Bi-Sub-Product** with same cost attribution.

---

## 6. Stock Card policy (all kinds)

| Event | Stock Card effect |
|---|---|
| Component used in produce/sale | Component SC outbound FIFO (actual qty) |
| B2B / Sub / Bi produced | Product SC inbound lot (unit cost from attribution) |
| Holdout reserve | Move available → Holdout bucket (not sold yet) |
| Holdout release / expiry | Holdout → Available |
| DO issue | Document only (or soft-allocate); still Holdout until sold/receipt |
| Confirm sold / fulfill | Holdout → Sales outbound on Product SC (DO ref) |
| B2C POS sale | Product SC outbound (allow negative); components FIFO |

---

## 7. Suggested build phases

| Phase | Scope | Depends on |
|---|---|---|
| **P0** | B2C Product UOM on detail + persist as sales/stock UOM | Done |
| **P1** | Rename UX to B2B Principal; Production UOM principal + 2 alts; wire Produce UOM pickers | Done |
| **P2** | Holdout bucket + DO entity (no price) + online PO → holdout → DO → sold | Done (`OnOrderQty`=Holdout; `DeliveryOrder` entity) |
| **P3** | Bi-Product / Bi-Sub-Product + cost attribution + separate stock cards | P1 |
| **P4** | B2C negative sales + price-on-inbound matching for finished goods | P0 |
| **P5** | Online store channel (future) | P0–P4 |

---

## 8. Current code anchors (do not reinvent)

| Area | Path |
|---|---|
| Product model | `src/Bisync.Api/Models/Product.cs` |
| B2B DU / aliases | `client/src/data/productB2bSales.ts`, `ProductAlias` |
| Yield / batch UOM | `client/src/data/productBatchUom.ts` |
| Production API | `ProductManagementController`, `ProductionInventoryService` |
| Sale FIFO components | `ProductSaleInventoryService`, `FifoBatchIssueService` |
| SO lock / DO flags | `B2bSalesOrderService` |
| UI | `ProductsPage`, `ProductManagementPage`, `ProduceBatchModal` |

---

## 9. Non-goals (this doc)

- Building the Online Storefront UI.
- Changing Component UOM model (already principal + 5 alts).
- Per-company dedicated DB decisions (see AWS target architecture).
