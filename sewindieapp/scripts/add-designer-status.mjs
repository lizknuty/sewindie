import pg from "pg"

const { Client } = pg

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL

async function main() {
  const client = new Client({ connectionString })
  await client.connect()
  console.log("[v0] Connected to database")

  // Create the enum type if it does not already exist
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DesignerStatus') THEN
        CREATE TYPE "DesignerStatus" AS ENUM ('PUBLISHED', 'INACTIVE');
      END IF;
    END
    $$;
  `)
  console.log("[v0] Ensured DesignerStatus enum exists")

  // Add the column with a default; existing rows backfill to PUBLISHED
  await client.query(`
    ALTER TABLE "Designer"
    ADD COLUMN IF NOT EXISTS "status" "DesignerStatus" NOT NULL DEFAULT 'PUBLISHED';
  `)
  console.log("[v0] Ensured Designer.status column exists (existing rows backfilled to PUBLISHED)")

  const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM "Designer";`)
  console.log(`[v0] Designer rows: ${rows[0].count}`)

  await client.end()
  console.log("[v0] Done")
}

main().catch((err) => {
  console.error("[v0] Migration failed:", err)
  process.exit(1)
})
