import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { normalizeUrl } from "../app/lib/pattern-sync/compare"
import {
  extractP4PMetadata,
  fetchP4PStoreProducts,
} from "../app/lib/pattern-sync/metadata/patterns-for-pirates"
import { applyMetadata, loadVocab } from "../app/lib/pattern-sync/metadata/writer"

// One-off: add three owner-approved vocabulary rows that the P4P extractor
// already emits but that had no DB row (so they were reported, never linked):
//   Attribute        "Hood"
//   SuggestedFabric  "Double Brushed Poly"
//   SuggestedFabric  "Waffle Knit"
// Then re-run the ADDITIVE metadata writer over the P4P catalogue so those
// three terms attach to the patterns that want them. The writer never removes
// or duplicates links, so re-running is safe and idempotent.
//
// Dry-run by default; set EXECUTE=1 to commit.

const EXECUTE = process.env.EXECUTE === "1"
const P4P_DESIGNER_ID = 108

const NEW_ATTRIBUTES = ["Hood"]
const NEW_SUGGESTED_FABRICS = ["Double Brushed Poly", "Waffle Knit"]

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.POSTGRES_URL_NON_POOLING })
  const prisma = new PrismaClient({ adapter })

  try {
    console.log(`\n=== P4P vocab add ${EXECUTE ? "(EXECUTE)" : "(dry run)"} ===\n`)

    // 1) Ensure the three vocab rows exist (case-insensitive check).
    for (const name of NEW_ATTRIBUTES) {
      const existing = await prisma.attribute.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true, name: true },
      })
      if (existing) {
        console.log(`Attribute "${name}" already exists (id ${existing.id}) - skip create`)
      } else if (EXECUTE) {
        const row = await prisma.attribute.create({ data: { name }, select: { id: true } })
        console.log(`Attribute "${name}" CREATED (id ${row.id})`)
      } else {
        console.log(`Attribute "${name}" would be CREATED`)
      }
    }
    for (const name of NEW_SUGGESTED_FABRICS) {
      const existing = await prisma.suggestedFabric.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true, name: true },
      })
      if (existing) {
        console.log(`SuggestedFabric "${name}" already exists (id ${existing.id}) - skip create`)
      } else if (EXECUTE) {
        const row = await prisma.suggestedFabric.create({ data: { name }, select: { id: true } })
        console.log(`SuggestedFabric "${name}" CREATED (id ${row.id})`)
      } else {
        console.log(`SuggestedFabric "${name}" would be CREATED`)
      }
    }

    // In a dry run the rows don't exist yet, so the writer still can't resolve
    // them. Report the intended attach counts by scanning the extracted meta.
    const targetNames = new Set([...NEW_ATTRIBUTES, ...NEW_SUGGESTED_FABRICS].map((n) => n.toLowerCase()))

    // 2) Fetch the live P4P catalogue + existing DB rows and match by URL.
    const [storeById, dbPatterns] = await Promise.all([
      fetchP4PStoreProducts(),
      prisma.pattern.findMany({
        where: { designer_id: P4P_DESIGNER_ID },
        select: { id: true, name: true, url: true },
      }),
    ])
    console.log(`\nStore products: ${storeById.size}, DB patterns: ${dbPatterns.length}`)

    const dbByUrl = new Map<string, { id: number; name: string }>()
    for (const p of dbPatterns) {
      const key = normalizeUrl(p.url)
      if (key) dbByUrl.set(key, { id: p.id, name: p.name })
    }

    const vocab = await loadVocab(prisma)

    let matched = 0
    let enriched = 0
    const added = { attribute: 0, suggestedFabric: 0 } as Record<string, number>
    const wantByTerm = new Map<string, number>()
    const vocabMissing = new Map<string, number>()

    for (const product of storeById.values()) {
      const key = normalizeUrl(product.permalink)
      if (!key) continue
      const db = dbByUrl.get(key)
      if (!db) continue
      matched++

      const meta = extractP4PMetadata(product)

      // Count how many patterns *want* each new term (independent of DB state).
      for (const n of [...meta.attributes, ...meta.suggestedFabrics]) {
        if (targetNames.has(n.toLowerCase())) {
          wantByTerm.set(n, (wantByTerm.get(n) ?? 0) + 1)
        }
      }

      const plan = await applyMetadata(prisma, db.id, meta, vocab, EXECUTE)
      const addedHere = plan.toAdd.attribute.length + plan.toAdd.suggestedFabric.length
      if (addedHere > 0) enriched++
      added.attribute += plan.toAdd.attribute.length
      added.suggestedFabric += plan.toAdd.suggestedFabric.length
      for (const m of plan.vocabMissing) {
        vocabMissing.set(m.name, (vocabMissing.get(m.name) ?? 0) + 1)
      }
    }

    console.log(`\nMatched to DB: ${matched}`)
    console.log("\nPatterns wanting each new term (from extractor):")
    for (const [name, count] of [...wantByTerm.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${name}: ${count}`)
    }
    console.log(
      `\nLinks ${EXECUTE ? "added" : "that would be added by the writer this run"}: ` +
        `attribute ${added.attribute}, suggestedFabric ${added.suggestedFabric} (patterns touched: ${enriched})`,
    )
    if (!EXECUTE) {
      console.log(
        "\nNOTE: dry run - the 3 rows don't exist yet, so the writer still reports them\n" +
          "as vocabMissing below. Run with EXECUTE=1 to create the rows AND attach.",
      )
    }
    if (vocabMissing.size) {
      console.log("\nStill vocab-missing (should be empty after EXECUTE for the 3 targets):")
      for (const [name, count] of [...vocabMissing.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${name}: ${count}`)
      }
    }
    console.log("\nDONE.")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
