// Independent check of the 19 craft-agnostic thumbnail matches.
//
// The script chose those images by GARMENT NAME. This verifies them against a
// completely unrelated key that happens to be embedded in the data: the legacy
// PrestaShop product id.
//
// Every one of these rows still carries its old shop.fibremood.com url, whose
// handle begins with that numeric id ("409-fleur-vest-pdf-pattern"). Fibre
// Mood carried the same id into the Shopify asset filename ("409_0.jpg"). So
// if the id in the row's url equals the id in the name-chosen image filename,
// two independent keys agree on the same product.

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const STORE = "https://www.fibremood.com"

// id -> image the craft tier chose, taken straight from the dry-run output.
const CHOSEN = {
  2296: "1286_0.jpg",
  2488: "409_0.jpg",
  2561: "299_0.jpg",
  2609: "195_0.jpg",
  2612: "1279_0.jpg",
  2695: "339_0.jpg",
  2698: "298_0.jpg",
  2759: "250_0.jpg",
  2792: "382_0.jpg",
  2804: "4941.jpg",
  2825: "408_0.jpg",
  2872: "284_0.jpg",
  2879: "197_0.jpg",
  2886: "340_0.jpg",
  2903: "289_0.jpg",
  2978: "1285_0.jpg",
  2979: "1278_0.jpg",
  2988: "399_0.jpg",
  3041: "384_0.jpg",
}

const legacyId = (url) => {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean)
    const handle = parts[parts.length - 1] ?? ""
    const match = handle.match(/^(\d+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

const imageId = (filename) => {
  const match = filename.match(/^(\d+)/)
  return match ? match[1] : null
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_PRISMA_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    const rows = await prisma.pattern.findMany({
      where: { id: { in: Object.keys(CHOSEN).map(Number) } },
      select: { id: true, name: true, url: true },
      orderBy: { id: "asc" },
    })

    let agree = 0
    const mismatch = []

    for (const row of rows) {
      const fromUrl = legacyId(row.url)
      const fromImage = imageId(CHOSEN[row.id])
      const ok = fromUrl !== null && fromUrl === fromImage

      if (ok) agree++
      else mismatch.push({ row, fromUrl, fromImage })

      console.log(
        `  ${ok ? "AGREE   " : "MISMATCH"} url-id=${String(fromUrl).padEnd(6)} image-id=${String(fromImage).padEnd(6)} ${row.name}`,
      )
    }

    console.log(`\nlegacy id agreement: ${agree}/${rows.length}`)

    if (mismatch.length > 0) {
      console.log(`\n=== ${mismatch.length} needing a closer look ===`)
      for (const item of mismatch) {
        console.log(`  [${item.row.id}] ${item.row.name}`)
        console.log(`      url        : ${item.row.url}`)
        console.log(`      url id     : ${item.fromUrl}`)
        console.log(`      image id   : ${item.fromImage}`)

        // Resolve the garment on the live store by search to see what it is.
        const term = item.row.name
          .replace(/(?:\.{3}|\u2026)+$/, "")
          .replace(/\b(digital|paper|knitting|pattern)\b/gi, " ")
          .trim()
        const res = await fetch(`${STORE}/search/suggest.json?q=${encodeURIComponent(term)}&resources[type]=product`, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          signal: AbortSignal.timeout(30000),
        }).catch(() => null)

        if (res?.ok) {
          const found = (await res.json())?.resources?.results?.products ?? []
          console.log(`      store search "${term}" -> ${found.length} hit(s)`)
          found.slice(0, 4).forEach((p) => console.log(`        ${p.title}  |  ${p.image ?? "(no image)"}`))
        }
      }
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("FAILED:", error.message)
  process.exitCode = 1
})
