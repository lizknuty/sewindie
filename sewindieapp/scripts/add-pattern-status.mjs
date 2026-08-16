import pg from "pg"

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL

if (!connectionString) {
  console.error("[migrate] No Postgres connection string found in env")
  process.exit(1)
}

const pool = new pg.Pool({ connectionString })

const sql = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PatternStatus') THEN
    CREATE TYPE "PatternStatus" AS ENUM ('PUBLISHED', 'IN_TESTING', 'DISCONTINUED');
  END IF;
END
$$;

ALTER TABLE "Pattern"
  ADD COLUMN IF NOT EXISTS "status" "PatternStatus" NOT NULL DEFAULT 'PUBLISHED';
`

try {
  await pool.query(sql)
  const { rows } = await pool.query(
    `SELECT status, COUNT(*)::int AS count FROM "Pattern" GROUP BY status ORDER BY status`,
  )
  console.log("[migrate] Pattern.status applied. Distribution:")
  console.table(rows)
} catch (err) {
  console.error("[migrate] Failed:", err)
  process.exitCode = 1
} finally {
  await pool.end()
}
