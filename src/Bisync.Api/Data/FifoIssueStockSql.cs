namespace Bisync.Api.Data;

/// <summary>
/// Canonical PostgreSQL FIFO issuance DDL. Live deductions call <c>issue_fifo_stock</c>.
/// Adapted from the platform Ref &amp; Library standard for Bisync component identity
/// (TEXT component id, location, UOM, numeric qty/cost) while preserving strict FIFO,
/// FOR UPDATE locking, audit lines, and zero-tolerance insufficient-stock abort.
/// </summary>
public static class FifoIssueStockSql
{
    public const string FunctionName = "issue_fifo_stock";

    public const string CreateTablesAndFunction = """
        CREATE TABLE IF NOT EXISTS inventory_batches (
            batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            component_id TEXT NOT NULL,
            location_external_id TEXT NOT NULL DEFAULT '',
            uom TEXT NOT NULL DEFAULT '',
            receipt_date TIMESTAMPTZ NOT NULL,
            original_qty NUMERIC(18,4) NOT NULL,
            remaining_qty NUMERIC(18,4) NOT NULL,
            unit_cost NUMERIC(18,4) NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            source_purchase_id INTEGER NULL,
            company_id INTEGER NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS ix_inventory_batches_fifo
            ON inventory_batches (component_id, location_external_id, uom, status, receipt_date);

        CREATE INDEX IF NOT EXISTS ix_inventory_batches_source_purchase
            ON inventory_batches (source_purchase_id)
            WHERE source_purchase_id IS NOT NULL;

        CREATE TABLE IF NOT EXISTS transactions (
            transaction_id UUID PRIMARY KEY,
            transaction_type VARCHAR NOT NULL,
            reference_id VARCHAR,
            component_id TEXT NULL,
            location_external_id TEXT NULL,
            uom TEXT NULL,
            qty_required NUMERIC(18,4) NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS transaction_lines (
            line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            transaction_id UUID NOT NULL REFERENCES transactions(transaction_id) ON DELETE CASCADE,
            batch_id UUID NOT NULL REFERENCES inventory_batches(batch_id),
            qty_deducted NUMERIC(18,4) NOT NULL,
            unit_cost NUMERIC(18,4) NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS ix_transaction_lines_tx
            ON transaction_lines (transaction_id);

        CREATE OR REPLACE FUNCTION issue_fifo_stock(
            p_component_id TEXT,
            p_location_external_id TEXT,
            p_uom TEXT,
            p_qty_required NUMERIC,
            p_transaction_type VARCHAR,
            p_reference_id VARCHAR
        ) RETURNS UUID AS $$
        DECLARE
            v_transaction_id UUID;
            v_remaining_to_fulfill NUMERIC(18,4) := ROUND(p_qty_required::numeric, 4);
            v_batch RECORD;
            v_qty_to_deduct NUMERIC(18,4);
            v_component_id TEXT := TRIM(p_component_id);
            v_location TEXT := TRIM(COALESCE(p_location_external_id, ''));
            v_uom TEXT := UPPER(TRIM(COALESCE(p_uom, '')));
        BEGIN
            IF v_component_id IS NULL OR v_component_id = '' THEN
                RAISE EXCEPTION 'Component id is required.';
            END IF;
            IF v_remaining_to_fulfill IS NULL OR v_remaining_to_fulfill <= 0 THEN
                RAISE EXCEPTION 'Quantity required must be greater than zero.';
            END IF;

            v_transaction_id := gen_random_uuid();

            INSERT INTO transactions (
                transaction_id, transaction_type, reference_id,
                component_id, location_external_id, uom, qty_required
            )
            VALUES (
                v_transaction_id, p_transaction_type, p_reference_id,
                v_component_id, v_location, v_uom, v_remaining_to_fulfill
            );

            FOR v_batch IN
                SELECT batch_id, remaining_qty, unit_cost
                FROM inventory_batches
                WHERE component_id = v_component_id
                  AND location_external_id = v_location
                  AND UPPER(TRIM(uom)) = v_uom
                  AND status = 'ACTIVE'
                  AND remaining_qty > 0
                ORDER BY receipt_date ASC, batch_id ASC
                FOR UPDATE
            LOOP
                IF v_batch.remaining_qty >= v_remaining_to_fulfill THEN
                    v_qty_to_deduct := v_remaining_to_fulfill;
                ELSE
                    v_qty_to_deduct := v_batch.remaining_qty;
                END IF;

                UPDATE inventory_batches
                SET remaining_qty = ROUND(remaining_qty - v_qty_to_deduct, 4),
                    status = CASE
                                 WHEN ROUND(remaining_qty - v_qty_to_deduct, 4) <= 0 THEN 'DEPLETED'
                                 ELSE 'ACTIVE'
                             END
                WHERE batch_id = v_batch.batch_id;

                INSERT INTO transaction_lines (line_id, transaction_id, batch_id, qty_deducted, unit_cost)
                VALUES (
                    gen_random_uuid(),
                    v_transaction_id,
                    v_batch.batch_id,
                    v_qty_to_deduct,
                    ROUND(COALESCE(v_batch.unit_cost, 0), 4)
                );

                v_remaining_to_fulfill := ROUND(v_remaining_to_fulfill - v_qty_to_deduct, 4);
                EXIT WHEN v_remaining_to_fulfill <= 0;
            END LOOP;

            IF v_remaining_to_fulfill > 0 THEN
                RAISE EXCEPTION 'Insufficient stock. Short by % units.', v_remaining_to_fulfill;
            END IF;

            RETURN v_transaction_id;
        END;
        $$ LANGUAGE plpgsql;
        """;

    /// <summary>Reference SQL shown in Dev Console Ref &amp; Library (canonical form).</summary>
    public const string ReferenceFunctionSql = """
CREATE OR REPLACE FUNCTION issue_fifo_stock(
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
$$ LANGUAGE plpgsql;
""";
}
