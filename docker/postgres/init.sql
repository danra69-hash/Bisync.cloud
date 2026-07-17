-- Runs only on first volume init (empty data directory).
-- POSTGRES_DB already creates "bisync"; these extras are required by the API.
CREATE DATABASE bisync_archive OWNER bisync;
CREATE DATABASE bisync_audit OWNER bisync;
