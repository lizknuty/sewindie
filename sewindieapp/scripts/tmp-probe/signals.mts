import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const dir = new URL(".", import.meta.url).pathname
const DIFF_TAG = /(beginner|d[ée]butant|intermedi|interm[ée]diaire|advanced|avanc[ée]|expert|easy|complexity|level|niveau|skill|difficult)/i
const FAB_TAG = /(knit|woven|stretch|jersey|maille|cha[iî]ne|tissu|denim|fleece|lycra|spandex)/i
const BODY_DIFF = /(skill level|difficulty|level\s*[:\-]|niveau\s*[:\-]|beginner|confident beginner|intermediate|advanced)/i
const BODY_FAB = /(knit fabric|woven fabric|stretch knit|for knits|for wovens|knit|woven)/i

for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const data = JSON.parse(readFileSync(join(dir, f), "utf8"))
  const products = data.products as { tags: string[]; body: string; product_type: string }[]
  const diffTags: Record<string, number> = {}
  const fabTags: Record<string, number> = {}
  let pDiffTag = 0, pFabTag = 0, pBodyDiff = 0, pBodyFab = 0
  const bodySnips: string[] = []
  for (const p of products) {
    let d = false, fa = false
    for (const t of p.tags) {
      if (DIFF_TAG.test(t)) { diffTags[t] = (diffTags[t] ?? 0) + 1; d = true }
      if (FAB_TAG.test(t)) { fabTags[t] = (fabTags[t] ?? 0) + 1; fa = true }
    }
    if (d) pDiffTag++
    if (fa) pFabTag++
    const body = p.body ?? ""
    const m = body.match(BODY_DIFF)
    if (m) {
      pBodyDiff++
      if (bodySnips.length < 4) bodySnips.push(body.slice(Math.max(0, m.index! - 40), m.index! + 80).replace(/\s+/g, " "))
    }
    if (BODY_FAB.test(body)) pBodyFab++
  }
  const top = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => `${k}=${v}`).join(" | ")
  console.log(`\n===== ${f} products=${products.length}`)
  console.log(`difficulty: products w/ tag=${pDiffTag} body=${pBodyDiff}`)
  console.log("  tags:", top(diffTags))
  console.log("  body:", bodySnips.join(" ;; "))
  console.log(`fabric: products w/ tag=${pFabTag} body=${pBodyFab}`)
  console.log("  tags:", top(fabTags))
}
