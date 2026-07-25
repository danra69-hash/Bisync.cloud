/** FIFO stock reference — canonical SQL + zero-tolerance operating guide (Ref & Library). */

export const FIFO_GUIDE_TITLE = 'FIFO stock issuance (zero tolerance)';

/** Last revised date shown in Ref & Library (display string). */
export const FIFO_GUIDE_REVISED_DATE = '24 July 2026';

export const FIFO_GUIDE_SUMMARY =
  'Platform FIFO issuance is enforced by PostgreSQL issue_fifo_stock: oldest active batch first, FOR UPDATE locking, audit lines per batch, and abort on insufficient stock. Live component deductions call this function; each inbound receipt is stored as a distinct cost-segregated batch.';

export type FifoGuideStep = {
  id: string;
  number: number;
  title: string;
  body: string;
};

export const FIFO_GUIDE_STEPS: FifoGuideStep[] = [
  {
    id: 'batch-cost-segregation',
    number: 1,
    title: 'Batch and Cost Segregation upon Receipt',
    body:
      'Foundation for accurate costing. Every inbound shipment must be recorded on the stock card as a distinct batch. The entry must capture the exact receipt date, quantity, and specific unit cost of that shipment. Zero tolerance requires that costs are never averaged; they remain rigidly tied to their specific receiving event.',
  },
  {
    id: 'strict-issuance',
    number: 2,
    title: 'Strict System-Enforced Issuance',
    body:
      'No manual overrides. When stock is issued, the system must automatically deduct the quantity from the oldest available batch. If an order requires more units than remain in the oldest batch, the logic must deplete the oldest batch to exactly zero before pulling the remainder from the next oldest batch.',
  },
  {
    id: 'inventory-freeze',
    number: 3,
    title: 'Inventory Freeze and Physical Count',
    body:
      'Halt all receiving and issuing activities to lock the stock card balance. Perform a blind physical count (where counters do not know the system quantities).',
  },
  {
    id: 'root-cause',
    number: 4,
    title: 'Root Cause Investigation',
    body:
      'Enforcing zero tolerance. Investigate any variance immediately, regardless of size. Require a secondary recount. You must identify whether the discrepancy stems from physical loss (theft, damage, spoilage) or administrative error (unrecorded transfer, unit-of-measure conversion error) before adjusting the ledger.',
  },
  {
    id: 'shortages',
    number: 5,
    title: 'Treating Shortages (Physical less than System)',
    body:
      'If a physical shortage is confirmed, the stock card must be adjusted downward. Under FIFO logic, you must assume the missing stock was from the earliest available inventory. Deduct the missing units from the oldest available batch(es) currently active on the stock card. The financial write-off is calculated using the unit cost of those specific oldest batches.',
  },
  {
    id: 'overages',
    number: 6,
    title: 'Treating Overages (Physical greater than System)',
    body:
      'If surplus stock is found, it must be added back to the stock card. To maintain FIFO integrity without distorting historical costs, overages are treated as a reversal of a recent incorrect issuance or an unrecorded recent receipt. Add the surplus quantity to the most recent batch (or log it as a new adjustment batch) using the latest known invoice cost.',
  },
  {
    id: 'financial-closure',
    number: 7,
    title: 'Financial Posting and Closure',
    body:
      'Post the financial values of the adjustments calculated in Steps 5 and 6 to the general ledger—typically debiting an Inventory Variance or Shrinkage account for shortages and crediting it for overages. Lock the accounting period on the stock card to prevent backdated transactions that could break the FIFO sequence.',
  },
];

/** Canonical reference function (as specified for the platform library). */
export const FIFO_ISSUE_STOCK_SQL = `CREATE OR REPLACE FUNCTION issue_fifo_stock(
    p_product_id UUID,
    p_qty_required INT,
    p_transaction_type VARCHAR,
    p_reference_id VARCHAR
) RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
    v_remaining_to_fulfill INT := p_qty_required;
    v_batch RECORD;
    v_qty_to_deduct INT;
BEGIN
    -- 1. Create the transaction header
    v_transaction_id := gen_random_uuid();

    INSERT INTO transactions (transaction_id, transaction_type, reference_id)
    VALUES (v_transaction_id, p_transaction_type, p_reference_id);

    -- 2. Loop through active batches in strict FIFO order
    -- FOR UPDATE is the critical lock: it forces concurrent transactions
    -- to wait in line rather than double-booking the same stock.
    FOR v_batch IN
        SELECT batch_id, remaining_qty
        FROM inventory_batches
        WHERE product_id = p_product_id AND status = 'ACTIVE'
        ORDER BY receipt_date ASC
        FOR UPDATE
    LOOP
        -- Determine how much we can pull from the current batch
        IF v_batch.remaining_qty >= v_remaining_to_fulfill THEN
            v_qty_to_deduct := v_remaining_to_fulfill;
        ELSE
            v_qty_to_deduct := v_batch.remaining_qty;
        END IF;

        -- 3. Deduct from the batch and update its status if emptied
        UPDATE inventory_batches
        SET remaining_qty = remaining_qty - v_qty_to_deduct,
            status = CASE
                         WHEN (remaining_qty - v_qty_to_deduct) = 0 THEN 'DEPLETED'
                         ELSE 'ACTIVE'
                     END
        WHERE batch_id = v_batch.batch_id;

        -- 4. Record the specific line movement to maintain the audit trail
        INSERT INTO transaction_lines (line_id, transaction_id, batch_id, qty_deducted)
        VALUES (gen_random_uuid(), v_transaction_id, v_batch.batch_id, v_qty_to_deduct);

        -- Deduct what we just took from our running total
        v_remaining_to_fulfill := v_remaining_to_fulfill - v_qty_to_deduct;

        -- Exit the loop early if we have fulfilled the entire request
        EXIT WHEN v_remaining_to_fulfill = 0;
    END LOOP;

    -- 5. The Zero Tolerance Safety Check
    -- If the loop finishes but we still need more units, we cannot fulfill the order.
    IF v_remaining_to_fulfill > 0 THEN
        -- Raising an exception in PL/pgSQL immediately aborts and rolls back
        -- all INSERTs and UPDATEs made inside this function execution.
        RAISE EXCEPTION 'Insufficient stock. Short by % units.', v_remaining_to_fulfill;
    END IF;

    -- Return the transaction ID so the application layer can reference it
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;`;

export const FIFO_RUNTIME_NOTE =
  'Bisync runtime installs an adapted issue_fifo_stock(component_id, location, uom, qty, type, reference) that uses the same strict FIFO + FOR UPDATE + zero-tolerance rules against inventory_batches keyed by Component ID.';
