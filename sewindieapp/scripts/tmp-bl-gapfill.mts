import { prisma } from "../app/lib/prisma"
import { booAndLuAdapter } from "../app/lib/pattern-sync/adapters/boo-and-lu"
import { applyMetadata, loadVocab } from "../app/lib/pattern-sync/metadata/writer"

const EXECUTE = process.env.EXECUTE === "1"
const slugOf = (url: string) => url.replace(/\/+$/, "").split("/").pop()?.toLowerCase() ?? ""
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

async function main() {
  const designer = await prisma.designer.findFirst({ where: { url: { contains: "booandlu" } }, select: { id: true } })
  if (!designer) throw new Error("Boo and Lu designer not found")

  const scraped = await booAndLuAdapter.fetchCatalogue()
  const bySlug = new Map(scraped.map((s) => [slugOf(s.url), s]))
  const byName = new Map(scraped.map((s) => [norm(s.name), s]))

  const rows = await prisma.pattern.findMany({ where: { designer_id: designer.id }, select: { id: true, name: true, url: true } })
  const vocab = await loadVocab(prisma)

  let enriched = 0
  const added = { audience: 0, category: 0 }
  const missing = new Set<string>()
  const changes: string[] = []
  const stillMissingCat: string[] = []
  const stillMissingAud: string[] = []

  for (const row of rows) {
    const s = bySlug.get(slugOf(row.url)) ?? byName.get(norm(row.name))
    if (!s?.metadata) continue
    if (s.metadata.categories.length === 0) stillMissingCat.push(row.name)
    if (s.metadata.audiences.length === 0) stillMissingAud.push(row.name)
    const plan = await applyMetadata(prisma, row.id, s.metadata, vocab, EXECUTE)
    plan.vocabMissing.forEach((m) => missing.add(`${m.dimension}:${m.name}`))
    const a = plan.toAdd.audience.length
    const c = plan.toAdd.category.length
    if (a + c > 0) {
      enriched++
      added.audience += a
      added.category += c
      changes.push(`  ${row.name}  | aud+ ${plan.toAdd.audience.join(", ") || "-"} | cat+ ${plan.toAdd.category.join(", ") || "-"}`)
    }
  }

  console.log(`${EXECUTE ? "EXECUTED" : "DRY RUN"}: ${rows.length} rows, ${enriched} enriched, audience+${added.audience}, category+${added.category}`)
  console.log(`VOCAB MISSING: ${[...missing].join("; ") || "none"}`)
  console.log("CHANGES:\n" + changes.join("\n"))
  console.log(`STILL NO CATEGORY (${stillMissingCat.length}): ${stillMissingCat.join(" | ")}`)
  console.log(`STILL NO AUDIENCE (${stillMissingAud.length}): ${stillMissingAud.join(" | ")}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
