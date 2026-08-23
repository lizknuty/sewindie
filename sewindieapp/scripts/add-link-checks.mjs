/**
 * Creates the LinkCheck table plus its LinkKind / LinkStatus enums.
 *
 * Idempotent: safe to run repeatedly. Mirrors the raw-SQL approach used by
 * scripts/add-pattern-status.mjs so the database can be migrated without
 * `prisma migrate` (this project has no prisma/migrations directory).
 *
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/add-link-checks.mjs
 */
import pg from "pg"

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL

if (!connectionString) {
  console.error("Missing POSTGRES_URL_NON_POOLING / POSTGRES_URL")
  process.exit(1)
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

const statements = [
  `DO $$ BEGIN
     CREATE TYPE "LinkKind" AS ENUM ('PATTERN_THUMBNAIL', 'PATTERN_PAGE');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,

  `DO $$ BEGIN
     CREATE TYPE "LinkStatus" AS ENUM ('OK', 'BROKEN', 'UNREACHABLE');
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,

  `CREATE TABLE IF NOT EXISTS "LinkCheck" (
     "id"         SERIAL PRIMARY KEY,
     "url"        TEXT NOT NULL,
     "host"       VARCHAR(255) NOT NULL,
     "kind"       "LinkKind" NOT NULL,
     "status"     "LinkStatus" NOT NULL,
     "statusCode" INTEGER,
     "error"      VARCHAR(500),
     "checkedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   );`,

  // Unique on url is what makes the checker's upsert work.
  `CREATE UNIQUE INDEX IF NOT EXISTS "LinkCheck_url_key" ON "LinkCheck"("url");`,
  `CREATE INDEX IF NOT EXISTS "LinkCheck_status_idx" ON "LinkCheck"("status");`,
  `CREATE INDEX IF NOT EXISTS "LinkCheck_kind_status_idx" ON "LinkCheck"("kind", "status");`,
  `CREATE INDEX IF NOT EXISTS "LinkCheck_host_idx" ON "LinkCheck"("host");`,
  `CREATE INDEX IF NOT EXISTS "LinkCheck_checkedAt_idx" ON "LinkCheck"("checkedAt");`,
]

async function main() {
  await client.connect()
  console.log("Connected. Creating LinkCheck table and enums...")

  for (const sql of statements) {
    await client.query(sql)
  }

  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM "LinkCheck"`)
  console.log(`Done. LinkCheck now holds ${rows[0].n} row(s).`)
}

main()
  .catch((error) => {
    console.error("Migration failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await client.end()
  })
