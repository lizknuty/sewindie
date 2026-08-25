/**
 * Adds the Collections feature and the two new Designer copy columns.
 *
 * This repo has no prisma/migrations directory -- schema changes ship as
 * idempotent one-off scripts (see add-designer-status.mjs). Every statement is
 * guarded so this can be re-run safely against an already-migrated database.
 *
 * Run with:
 *   node --env-file-if-exists=.env.development.local scripts/add-collections.mjs
 */
import pg from "pg"

const { Client } = pg

async function main() {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL

  if (!connectionString) {
    throw new Error("POSTGRES_URL_NON_POOLING (or POSTGRES_URL) must be set")
  }

  const client = new Client({ connectionString })
  await client.connect()

  try {
    // Designer copy fields, surfaced in the hero tagline and About tab.
    await client.query(`
      ALTER TABLE "Designer"
        ADD COLUMN IF NOT EXISTS "tagline" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "about" TEXT
    `)
    console.log("[v0] Designer.tagline / Designer.about ready")

    // CREATE TYPE has no IF NOT EXISTS, so swallow the duplicate_object error.
    await client.query(`
      DO $$
      BEGIN
        CREATE TYPE "CollectionVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `)
    console.log("[v0] CollectionVisibility enum ready")

    await client.query(`
      CREATE TABLE IF NOT EXISTS "Collection" (
        "id"          SERIAL PRIMARY KEY,
        "userId"      INTEGER NOT NULL,
        "name"        VARCHAR(120) NOT NULL,
        "description" TEXT,
        "visibility"  "CollectionVisibility" NOT NULL DEFAULT 'PRIVATE',
        "createdAt"   TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"   TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Collection_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS "Collection_userId_idx" ON "Collection"("userId")`)
    await client.query(`CREATE INDEX IF NOT EXISTS "Collection_visibility_idx" ON "Collection"("visibility")`)
    console.log("[v0] Collection table ready")

    await client.query(`
      CREATE TABLE IF NOT EXISTS "CollectionPattern" (
        "id"           SERIAL PRIMARY KEY,
        "collectionId" INTEGER NOT NULL,
        "patternId"    INTEGER NOT NULL,
        "addedAt"      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CollectionPattern_collectionId_fkey"
          FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE,
        CONSTRAINT "CollectionPattern_patternId_fkey"
          FOREIGN KEY ("patternId") REFERENCES "Pattern"("id") ON DELETE CASCADE
      )
    `)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "CollectionPattern_collectionId_patternId_key"
        ON "CollectionPattern"("collectionId", "patternId")
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS "CollectionPattern_patternId_idx"
        ON "CollectionPattern"("patternId")
    `)
    console.log("[v0] CollectionPattern table ready")

    const { rows } = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM "Collection")        AS collections,
        (SELECT COUNT(*) FROM "CollectionPattern") AS collection_patterns
    `)
    console.log("[v0] Row counts:", rows[0])
  } finally {
    await client.end()
  }
}

main()
  .then(() => {
    console.log("[v0] Migration complete")
    process.exit(0)
  })
  .catch((error) => {
    console.error("[v0] Migration failed:", error)
    process.exit(1)
  })
