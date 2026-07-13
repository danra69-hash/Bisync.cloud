-- Phase 1 — Location LIST partitions (auto-migrator documentation)
--
-- Implemented by LocationPartitionService.EnsureLocationListPartitionsAsync()
-- which runs at API startup after SchemaPatcher (before EnsurePartitionsForAllLocationsAsync).
-- Do NOT run this file manually in production unless you are mirroring the auto migrator.

-- Tables converted when not already partitioned:
--   InventoryMovements
--   InventoryPurchases   (adds LocationExternalId if missing; backfills from LocationIdsJson[0] or '')
--   ProductProductionLogs (same LocationExternalId backfill)
--   WastageEntries       (if table exists; already has LocationExternalId)

-- Auto migrator steps per table:
-- 1. Ensure "LocationExternalId" TEXT NOT NULL DEFAULT '' (Purchases + ProductionLogs).
-- 2. Backfill LocationExternalId from first JSON string in LocationIdsJson, else ''.
-- 3. Drop foreign keys that reference or originate from the table.
-- 4. RENAME TABLE "{Table}" → "{Table}_legacy_part".
-- 5. CREATE TABLE "{Table}" (LIKE legacy INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING IDENTITY)
--      PARTITION BY LIST ("LocationExternalId");
-- 6. ALTER TABLE ADD PRIMARY KEY ("Id", "LocationExternalId");
--    (EF models keep single Id key; PG identity remains unique in practice.)
-- 7. CREATE TABLE "{Table}_default" PARTITION OF "{Table}" DEFAULT;
-- 8. CREATE TABLE "{Table}_loc_{sanitized}" PARTITION OF "{Table}" FOR VALUES IN ('{externalId}')
--    for each distinct LocationExternalId + each Locations.ExternalId.
--    Suffix is sanitized to [A-Za-z0-9_] max 40 chars (SQL injection safe identifiers).
-- 9. INSERT INTO parent SELECT * FROM legacy; DROP legacy; resync identity sequence.

-- Ongoing: LocationPartitionService.EnsurePartitionsForLocationAsync creates child partitions
-- when locations are created (Auth complete-location-onboarding + LocationsController CreateConfig)
-- and at startup via EnsurePartitionsForAllLocationsAsync. Safe no-op until parent is partitioned.

SELECT 'Location LIST partitions are applied automatically by LocationPartitionService.' AS note;
