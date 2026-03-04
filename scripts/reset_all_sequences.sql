-- This script resets the auto-incrementing ID sequences for the Pattern table
-- and all of its many-to-many join tables. This is necessary when the
-- sequence counters fall out of sync with the actual data in the tables,
-- causing "Unique constraint failed" errors on the 'id' field during inserts.

-- This version correctly handles empty tables.
-- For an empty table, it sets the sequence so the next value will be 1.
-- For a non-empty table, it sets the sequence so the next value will be MAX(id) + 1.

-- Reset sequence for the main Pattern table
SELECT setval(
  pg_get_serial_sequence('"Pattern"', 'id'),
  COALESCE((SELECT MAX(id) FROM "Pattern"), 1),
  (SELECT MAX(id) IS NOT NULL FROM "Pattern")
);

-- Reset sequence for PatternCategory
SELECT setval(
  pg_get_serial_sequence('"PatternCategory"', 'id'),
  COALESCE((SELECT MAX(id) FROM "PatternCategory"), 1),
  (SELECT MAX(id) IS NOT NULL FROM "PatternCategory")
);

-- Reset sequence for PatternAudience
SELECT setval(
  pg_get_serial_sequence('"PatternAudience"', 'id'),
  COALESCE((SELECT MAX(id) FROM "PatternAudience"), 1),
  (SELECT MAX(id) IS NOT NULL FROM "PatternAudience")
);

-- Reset sequence for PatternFabricType
SELECT setval(
  pg_get_serial_sequence('"PatternFabricType"', 'id'),
  COALESCE((SELECT MAX(id) FROM "PatternFabricType"), 1),
  (SELECT MAX(id) IS NOT NULL FROM "PatternFabricType")
);

-- Reset sequence for PatternSuggestedFabric
SELECT setval(
  pg_get_serial_sequence('"PatternSuggestedFabric"', 'id'),
  COALESCE((SELECT MAX(id) FROM "PatternSuggestedFabric"), 1),
  (SELECT MAX(id) IS NOT NULL FROM "PatternSuggestedFabric")
);

-- Reset sequence for PatternAttribute
SELECT setval(
  pg_get_serial_sequence('"PatternAttribute"', 'id'),
  COALESCE((SELECT MAX(id) FROM "PatternAttribute"), 1),
  (SELECT MAX(id) IS NOT NULL FROM "PatternAttribute")
);

-- Reset sequence for PatternFormat
SELECT setval(
  pg_get_serial_sequence('"PatternFormat"', 'id'),
  COALESCE((SELECT MAX(id) FROM "PatternFormat"), 1),
  (SELECT MAX(id) IS NOT NULL FROM "PatternFormat")
);

-- This script iterates through all tables in the current database
-- and resets the sequence for their primary key 'id' columns.
-- This is useful for development environments after bulk data operations
-- or when resetting the database state.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT relname FROM pg_class WHERE relkind = 'S') LOOP
        EXECUTE 'SELECT setval(''' || r.relname || ''', (SELECT COALESCE(MAX(id), 0) FROM "' || REPLACE(r.relname, '_id_seq', '') || '") + 1, false)';
    END LOOP;
END $$;

-- Optional: You can run this to see the current values of all sequences
-- SELECT
--     relname AS sequence_name,
--     last_value,
--     start_value,
--     increment_by,
--     max_value,
--     min_value,
--     cache_size,
--     is_cycled,
--     is_called
-- FROM
--     pg_sequences
-- WHERE
--     schemaname = 'public'; -- Assuming your tables are in the 'public' schema
