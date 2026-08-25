/**
 * Read-only verification of the shared pattern-sync identity logic.
 *
 * This exercises `normalizeUrl` against every designer's live catalogue rows so
 * a change to URL identity (like preserving Shopify's `?variant=`) can be shown
 * not to fragment or collide identity for the designers that don't use it.
 *
 * Read-only: issues SELECTs only, never writes.
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const DESIGNERS = [
  { id: 108, label: "Patterns for Pirates" },
  { id: 70, label: "Jalie" },
  { id: 57, label: "Greenstyle Creations" },
  { id: 43, label: "Fibre Mood" },
  { id: 112, label: "Seamwork" },
]

/** Designers whose URLs legitimately carry a `?variant=` identity. */
const VARIANT_DESIGNER_IDS = new Set([43])

// Mirrors app/lib/pattern-sync/compare.ts exactly.
function normalizeUrl(url) {
  if (!url) return null
  try {
    const raw = url.trim()
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const parsed = new URL(withScheme)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase()
    const variant = parsed.searchParams.get("variant")?.trim()
    return variant ? `${host}${path}?variant=${variant.toLowerCase()}` : `${host}${path}`
  } catch {
    return null
  }
}

// The pre-change behaviour, to prove nothing regressed for other designers.
function normalizeUrlBefore(url) {
  if (!url) return null
  try {
    const raw = url.trim()
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const parsed = new URL(withScheme)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
    const path = parsed.pathname.replace(/\/+$/, "").toLowerCase()
    return `${host}${path}`
  } catch {
    return null
  }
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    let anyProblem = false

    for (const designer of DESIGNERS) {
      const rows = await prisma.pattern.findMany({
        where: { designer_id: designer.id },
        select: { id: true, name: true, url: true },
      })

      const after = rows.map((r) => normalizeUrl(r.url)).filter(Boolean)
      const before = rows.map((r) => normalizeUrlBefore(r.url)).filter(Boolean)

      const afterUnique = new Set(after).size
      const beforeUnique = new Set(before).size
      const afterCollisions = after.length - afterUnique
      const beforeCollisions = before.length - beforeUnique
      const changed = rows.filter((r) => normalizeUrl(r.url) !== normalizeUrlBefore(r.url)).length
      const nullUrls = rows.filter((r) => !normalizeUrl(r.url)).length

      console.log(`\n=== ${designer.label} (id=${designer.id}) ===`)
      console.log(`  rows: ${rows.length} | unresolvable urls: ${nullUrls}`)
      console.log(`  identity collisions  before: ${beforeCollisions}  ->  after: ${afterCollisions}`)
      console.log(`  rows whose identity changed by the edit: ${changed}`)

      // For every non-variant designer nothing should change at all.
      if (!VARIANT_DESIGNER_IDS.has(designer.id) && changed !== 0) {
        console.log(`  PROBLEM: identity changed for a designer that uses no ?variant= urls`)
        anyProblem = true
      }
      // Collisions must never increase.
      if (afterCollisions > beforeCollisions) {
        console.log(`  PROBLEM: the edit introduced new identity collisions`)
        anyProblem = true
      }
      if (afterCollisions > 0) {
        const seen = new Map()
        for (const r of rows) {
          const key = normalizeUrl(r.url)
          if (!key) continue
          if (seen.has(key)) {
            console.log(`  collision: ${key}`)
            console.log(`     [${seen.get(key).id}] ${seen.get(key).name}`)
            console.log(`     [${r.id}] ${r.name}`)
          } else seen.set(key, r)
        }
      }
    }

    console.log(`\n${anyProblem ? "FAILED: see PROBLEM lines above" : "PASS: no regressions, no collisions"}`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((err) => {
  console.error("ERROR:", err.message)
  process.exit(1)
})
