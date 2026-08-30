// ---------------------------------------------------------------------------
// Shared scraping helpers for "crawl a listing, then fetch each product page"
// adapters (Payhip, PrestaShop, and any other platform without a JSON feed).
//
// These are intentionally small and dependency-free. Feed/JSON adapters
// (Shopify, WooCommerce) do not need them. The Fitiyoo adapter predates this
// module and keeps its own inlined copies so a verified adapter isn't touched.
// ---------------------------------------------------------------------------

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const REQUEST_TIMEOUT_MS = 20_000
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 300

// Decode the HTML entities that show up in og:title / product names.
export function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&#8217;|&#x2019;/gi, "\u2019")
    .replace(/&#8216;|&#x2018;/gi, "\u2018")
    .replace(/&#8211;|&#x2013;/gi, "\u2013")
    .replace(/&#8212;|&#x2014;/gi, "\u2014")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// Read a <meta property=".."> / <meta name=".."> content value (attribute order
// independent). Returns a decoded string or null.
export function metaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ]
  for (const re of patterns) {
    const match = html.match(re)
    if (match && match[1]) return decodeEntities(match[1])
  }
  return null
}

// Find the first JSON-LD Product node (case-insensitive @type, supports @graph).
export function jsonLdProduct(html: string): { name?: string; image?: string; date?: string } | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1].trim())
      const graph = Array.isArray(parsed) ? parsed : Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed]
      const isProduct = (t: unknown) =>
        typeof t === "string" ? t.toLowerCase() === "product" : Array.isArray(t) && t.some((x) => String(x).toLowerCase() === "product")
      const product = graph.find((node: { "@type"?: unknown }) => isProduct(node?.["@type"]))
      if (product) {
        const image = Array.isArray(product.image) ? product.image[0] : product.image
        return {
          name: product.name ? decodeEntities(String(product.name)) : undefined,
          image: image ? String(image) : undefined,
          date: product.releaseDate || product.datePublished || undefined,
        }
      }
    } catch {
      // ignore malformed blocks
    }
  }
  return null
}

// Fetch text with retry + backoff on 429/network errors.
export async function fetchText(url: string, userAgent: string = DEFAULT_USER_AGENT): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      })
      if (res.status === 429) {
        await sleep(RETRY_BASE_DELAY_MS * (attempt + 1) * 2)
        continue
      }
      if (!res.ok) throw new Error(`${res.status} for ${url}`)
      return await res.text()
    } catch (error) {
      lastError = error
      if (attempt < MAX_RETRIES - 1) await sleep(RETRY_BASE_DELAY_MS * (attempt + 1))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`)
}

// Bounded-concurrency map, preserving input order.
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, worker))
  return results
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
