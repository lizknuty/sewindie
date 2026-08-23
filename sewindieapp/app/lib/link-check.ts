import { prisma } from "@/lib/prisma"
import { LinkKind, LinkStatus } from "@prisma/client"

/**
 * Shared link-checking core, used by both scripts/check-links.mjs (bulk, via
 * tsx) and the admin re-check route (small batches). Keeping the probe logic in
 * one place means a fix to redirect/timeout handling applies to both.
 */

/** Per-host concurrency. These are small independent shops; do not hammer them. */
const PER_HOST_CONCURRENCY = 2
/** Global concurrency ceiling across all hosts. */
const GLOBAL_CONCURRENCY = 12
/** Minimum gap between two requests to the same host. */
const PER_HOST_DELAY_MS = 350
const TIMEOUT_MS = 12_000

/** Pretend to be a real browser: some CDNs 403 unknown agents, which would
 *  otherwise look like a broken link. */
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "*/*",
}

export type Probe = { url: string; kind: LinkKind }

export type ProbeResult = {
  url: string
  host: string
  kind: LinkKind
  status: LinkStatus
  statusCode: number | null
  error: string | null
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return "invalid"
  }
}

/**
 * Classify an HTTP status.
 *
 * Only 4xx (excluding the ambiguous 401/403/429) is treated as BROKEN, i.e. the
 * resource is genuinely gone. 401/403/429 and 5xx mean "we could not tell" and
 * are recorded as UNREACHABLE so they never show up as false accusations in the
 * report — a 403 from a hotlink-protected CDN does not mean the image is dead.
 */
function classify(code: number): LinkStatus {
  if (code >= 200 && code < 400) return LinkStatus.OK
  if (code === 401 || code === 403 || code === 429) return LinkStatus.UNREACHABLE
  if (code >= 400 && code < 500) return LinkStatus.BROKEN
  return LinkStatus.UNREACHABLE
}

async function fetchWithTimeout(url: string, method: "HEAD" | "GET") {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: HEADERS,
    })
  } finally {
    clearTimeout(timer)
  }
}

/** Probe a single URL. HEAD first (cheap), falling back to GET because plenty
 *  of servers refuse HEAD with 405/501 even when the resource is fine. */
export async function probe({ url, kind }: Probe): Promise<ProbeResult> {
  const host = hostOf(url)

  if (host === "invalid" || !/^https?:\/\//i.test(url)) {
    return { url, host, kind, status: LinkStatus.BROKEN, statusCode: null, error: "Malformed URL" }
  }

  try {
    let res = await fetchWithTimeout(url, "HEAD")
    if (res.status === 405 || res.status === 501 || res.status === 403) {
      res = await fetchWithTimeout(url, "GET")
    }
    return {
      url,
      host,
      kind,
      status: classify(res.status),
      statusCode: res.status,
      error: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const isAbort = message.includes("aborted") || message.includes("abort")
    return {
      url,
      host,
      kind,
      status: LinkStatus.UNREACHABLE,
      statusCode: null,
      error: (isAbort ? "Timeout" : message).slice(0, 500),
    }
  }
}

/**
 * Run probes with both a global cap and a per-host cap plus delay.
 *
 * Work is bucketed by host and each bucket is drained serially by a small
 * number of workers, so a host with 1,000 thumbnails gets at most
 * PER_HOST_CONCURRENCY in flight regardless of how the global pool schedules.
 */
export async function probeAll(
  probes: Probe[],
  onResult?: (r: ProbeResult, done: number, total: number) => void,
): Promise<ProbeResult[]> {
  const byHost = new Map<string, Probe[]>()
  for (const p of probes) {
    const h = hostOf(p.url)
    const bucket = byHost.get(h)
    if (bucket) bucket.push(p)
    else byHost.set(h, [p])
  }

  const results: ProbeResult[] = []
  const total = probes.length
  let done = 0

  const hostQueue = [...byHost.entries()]
  // Each "lane" owns one host at a time and drains it with limited concurrency.
  const laneCount = Math.max(1, Math.min(GLOBAL_CONCURRENCY, hostQueue.length))

  async function drainHost(items: Probe[]) {
    let cursor = 0
    async function worker() {
      while (cursor < items.length) {
        const item = items[cursor++]
        const r = await probe(item)
        results.push(r)
        done++
        onResult?.(r, done, total)
        if (cursor < items.length) await new Promise((s) => setTimeout(s, PER_HOST_DELAY_MS))
      }
    }
    const workers = Array.from({ length: Math.min(PER_HOST_CONCURRENCY, items.length) }, worker)
    await Promise.all(workers)
  }

  async function lane() {
    while (hostQueue.length > 0) {
      const next = hostQueue.shift()
      if (!next) return
      await drainHost(next[1])
    }
  }

  await Promise.all(Array.from({ length: laneCount }, lane))
  return results
}

/** Upsert probe results, keyed on the unique url column, in one transaction. */
export async function saveResults(results: ProbeResult[]): Promise<void> {
  if (results.length === 0) return

  const now = new Date()
  await prisma.$transaction(
    results.map((r) =>
      prisma.linkCheck.upsert({
        where: { url: r.url },
        create: {
          url: r.url,
          host: r.host,
          kind: r.kind,
          status: r.status,
          statusCode: r.statusCode,
          error: r.error,
          checkedAt: now,
        },
        update: {
          host: r.host,
          kind: r.kind,
          status: r.status,
          statusCode: r.statusCode,
          error: r.error,
          checkedAt: now,
        },
      }),
    ),
  )
}

/**
 * Distinct URLs worth checking, oldest-checked first so repeated runs make
 * progress instead of re-probing the same head of the list.
 *
 * `staleBefore` lets a re-check skip anything already verified recently.
 */
export async function collectProbes(limit: number, staleHours = 24): Promise<Probe[]> {
  const staleBefore = new Date(Date.now() - staleHours * 3_600_000)

  const rows = await prisma.$queryRaw<{ url: string; kind: string }[]>`
    WITH candidates AS (
      SELECT DISTINCT thumbnail_url AS url, 'PATTERN_THUMBNAIL' AS kind
      FROM "Pattern"
      WHERE thumbnail_url IS NOT NULL AND thumbnail_url <> ''
      UNION
      SELECT DISTINCT url AS url, 'PATTERN_PAGE' AS kind
      FROM "Pattern"
      WHERE url IS NOT NULL AND url <> ''
    )
    SELECT c.url, c.kind
    FROM candidates c
    LEFT JOIN "LinkCheck" lc ON lc.url = c.url
    WHERE lc.id IS NULL OR lc."checkedAt" < ${staleBefore}
    ORDER BY lc."checkedAt" ASC NULLS FIRST
    LIMIT ${limit}
  `

  return (rows as { url: string; kind: string }[]).map((r) => ({
    url: r.url,
    kind: r.kind as LinkKind,
  }))
}
