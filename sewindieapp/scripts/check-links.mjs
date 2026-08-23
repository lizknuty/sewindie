/**
 * Bulk external link checker.
 *
 * Probes pattern thumbnail and pattern page URLs and records the outcome in
 * LinkCheck. Safe to run repeatedly: it processes the least-recently-checked
 * URLs first, so successive runs work through the catalogue.
 *
 * Usage:
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/check-links.mjs [--limit N] [--stale-hours N]
 *
 * Uses raw pg so it can run without the Prisma client / TS toolchain. The probe
 * and classification rules are intentionally identical to app/lib/link-check.ts.
 */

import pg from "pg"

const args = process.argv.slice(2)
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? Number(args[i + 1]) : fallback
}

const LIMIT = arg("limit", 500)
const STALE_HOURS = arg("stale-hours", 24)

const PER_HOST_CONCURRENCY = 2
const GLOBAL_LANES = 12
const PER_HOST_DELAY_MS = 350
const TIMEOUT_MS = 12_000

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "*/*",
}

function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return "invalid"
  }
}

// 401/403/429 and 5xx are "could not verify", not "dead" - recording them as
// BROKEN would produce false accusations against hotlink-protected CDNs.
function classify(code) {
  if (code >= 200 && code < 400) return "OK"
  if (code === 401 || code === 403 || code === 429) return "UNREACHABLE"
  if (code >= 400 && code < 500) return "BROKEN"
  return "UNREACHABLE"
}

async function fetchWithTimeout(url, method) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { method, redirect: "follow", signal: controller.signal, headers: HEADERS })
  } finally {
    clearTimeout(timer)
  }
}

async function probe({ url, kind }) {
  const host = hostOf(url)
  if (host === "invalid" || !/^https?:\/\//i.test(url)) {
    return { url, host, kind, status: "BROKEN", statusCode: null, error: "Malformed URL" }
  }
  try {
    let res = await fetchWithTimeout(url, "HEAD")
    if (res.status === 405 || res.status === 501 || res.status === 403) {
      res = await fetchWithTimeout(url, "GET")
    }
    return { url, host, kind, status: classify(res.status), statusCode: res.status, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isAbort = message.toLowerCase().includes("abort")
    return {
      url,
      host,
      kind,
      status: "UNREACHABLE",
      statusCode: null,
      error: (isAbort ? "Timeout" : message).slice(0, 500),
    }
  }
}

const client = new pg.Client({
  connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  await client.connect()
  console.log("Connected. Collecting URLs to check...")

  const staleBefore = new Date(Date.now() - STALE_HOURS * 3_600_000)

  const { rows: probes } = await client.query(
    `WITH candidates AS (
       SELECT DISTINCT thumbnail_url AS url, 'PATTERN_THUMBNAIL' AS kind
       FROM "Pattern" WHERE thumbnail_url IS NOT NULL AND thumbnail_url <> ''
       UNION
       SELECT DISTINCT url AS url, 'PATTERN_PAGE' AS kind
       FROM "Pattern" WHERE url IS NOT NULL AND url <> ''
     )
     SELECT c.url, c.kind
     FROM candidates c
     LEFT JOIN "LinkCheck" lc ON lc.url = c.url
     WHERE lc.id IS NULL OR lc."checkedAt" < $1
     ORDER BY lc."checkedAt" ASC NULLS FIRST
     LIMIT $2`,
    [staleBefore, LIMIT],
  )

  if (probes.length === 0) {
    console.log("Nothing to check - every URL has been verified recently.")
    return
  }

  const byHost = new Map()
  for (const p of probes) {
    const h = hostOf(p.url)
    if (byHost.has(h)) byHost.get(h).push(p)
    else byHost.set(h, [p])
  }

  console.log(`Checking ${probes.length} URL(s) across ${byHost.size} host(s)...`)

  const tally = { OK: 0, BROKEN: 0, UNREACHABLE: 0 }
  let done = 0

  // A single pg Client cannot run overlapping queries, and the probe lanes are
  // concurrent, so funnel all writes through one promise chain.
  let writeChain = Promise.resolve()
  function save(r) {
    writeChain = writeChain.then(() => writeOne(r)).catch((err) => {
      console.error(`  ! failed to save ${r.url}: ${err.message}`)
    })
    return writeChain
  }

  async function writeOne(r) {
    await client.query(
      `INSERT INTO "LinkCheck" (url, host, kind, status, "statusCode", error, "checkedAt")
       VALUES ($1,$2,$3::"LinkKind",$4::"LinkStatus",$5,$6, NOW())
       ON CONFLICT (url) DO UPDATE SET
         host = EXCLUDED.host, kind = EXCLUDED.kind, status = EXCLUDED.status,
         "statusCode" = EXCLUDED."statusCode", error = EXCLUDED.error, "checkedAt" = NOW()`,
      [r.url, r.host, r.kind, r.status, r.statusCode, r.error],
    )
  }

  const hostQueue = [...byHost.values()]

  async function drainHost(items) {
    let cursor = 0
    async function worker() {
      while (cursor < items.length) {
        const item = items[cursor++]
        const r = await probe(item)
        tally[r.status]++
        await save(r)
        done++
        if (done % 25 === 0 || done === probes.length) {
          console.log(`  ${done}/${probes.length} - ok ${tally.OK}, broken ${tally.BROKEN}, unreachable ${tally.UNREACHABLE}`)
        }
        if (cursor < items.length) await new Promise((s) => setTimeout(s, PER_HOST_DELAY_MS))
      }
    }
    await Promise.all(Array.from({ length: Math.min(PER_HOST_CONCURRENCY, items.length) }, worker))
  }

  async function lane() {
    while (hostQueue.length > 0) {
      const items = hostQueue.shift()
      if (!items) return
      await drainHost(items)
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(GLOBAL_LANES, hostQueue.length)) }, lane))

  const { rows: totals } = await client.query(
    `SELECT status, COUNT(*)::int n FROM "LinkCheck" GROUP BY status ORDER BY status`,
  )
  console.log("\nThis run:", tally)
  console.log("Stored totals:", totals)

  const { rows: remaining } = await client.query(
    `WITH candidates AS (
       SELECT DISTINCT thumbnail_url AS url FROM "Pattern" WHERE thumbnail_url IS NOT NULL AND thumbnail_url <> ''
       UNION
       SELECT DISTINCT url FROM "Pattern" WHERE url IS NOT NULL AND url <> ''
     )
     SELECT COUNT(*)::int n FROM candidates c LEFT JOIN "LinkCheck" lc ON lc.url = c.url WHERE lc.id IS NULL`,
  )
  console.log(`Never-checked URLs remaining: ${remaining[0].n}`)
}

main()
  .catch((err) => {
    console.error("Link check failed:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await client.end()
  })
