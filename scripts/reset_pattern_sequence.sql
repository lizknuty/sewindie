-- This script resets the sequence for the 'Pattern' table's 'id' column.
-- This is useful after manually inserting data or deleting all rows,
-- to ensure that new IDs start from the correct next available number.

-- Find the maximum ID currently in the Pattern table
SELECT MAX(id) FROM "Pattern";

-- Set the sequence to the maximum ID + 1, or 1 if the table is empty
SELECT setval(pg_get_serial_sequence('"Pattern"', 'id'), COALESCE((SELECT MAX(id) FROM "Pattern") + 1, 1), false);

-- You can verify the current sequence value (optional)
-- SELECT pg_get_serial_sequence('"Pattern"', 'id');
-- SELECT currval(pg_get_serial_sequence('"Pattern"', 'id'));
