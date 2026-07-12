-- Phase 1 (manual / future migrator): convert hot tables to LIST partitions by location.
-- Do NOT run blindly in production without a backup and downtime window.
-- LocationPartitionService will create child partitions once parents are partitioned.

-- Example conversion outline for InventoryMovements:
--
-- 1. Rename live table
-- ALTER TABLE "InventoryMovements" RENAME TO "InventoryMovements_legacy";
--
-- 2. Create partitioned parent (LocationExternalId is the partition key today)
-- CREATE TABLE "InventoryMovements" (
--   LIKE "InventoryMovements_legacy" INCLUDING DEFAULTS INCLUDING CONSTRAINTS
-- ) PARTITION BY LIST ("LocationExternalId");
--
-- 3. Attach partitions per location + DEFAULT partition for unknowns
-- CREATE TABLE "InventoryMovements_loc_downtown"
--   PARTITION OF "InventoryMovements" FOR VALUES IN ('downtown');
-- CREATE TABLE "InventoryMovements_default"
--   PARTITION OF "InventoryMovements" DEFAULT;
--
-- 4. Copy data, swap indexes/sequences, drop legacy.
--
-- Repeat for InventoryPurchases (via LocationIdsJson is harder — prefer adding
-- LocationExternalId column first) and ProductProductionLogs.

SELECT 'See comments in this file for partition conversion steps.' AS note;
