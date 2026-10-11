import { NextResponse } from "next/server"
import { checkAdminAccess } from "@/lib/admin-middleware"
import { fetchShopifyProducts } from "@/lib/pattern-sync/adapters/shopify-feed"

// TEMPORARY: metadata discovery for the Shopify designer batch. Shopify blocks
// the build sandbox's IP, so this runs the read from the deployed app instead.
// Read-only, admin-only, allowlisted stores only (not an open proxy).
// Delete once the Shopify batch's metadata mappings are built.

export const dynamic = "force-dynamic"
export const maxDuration = 60

const STORES: Record<string, { label: string; base: string }> = {
  "fibre-mood": { label: "Fibre Mood", base: "https://www.fibremood.com" },
  "petite-stitchery": { label: "Petite Stitchery", base: "https://petitestitchery.com" },
  "violette-field-threads": { label: "Violette Field Threads", base: "https://violettefieldthreads.com" },
  jalie: { label: "Jalie", base: "https://jalie.com" },
  "ellie-and-mac": { label: "Ellie and Mac", base: "https://www.ellieandmac.com" },
  "maison-fauve": { label: "Maison Fauve", base: "https://www.maison-fauve.com" },
  "pattern-emporium": { label: "Pattern Emporium", base: "https://patternemporium.com" },
  "winter-wear-designs": { label: "Winter Wear Designs", base: "https://www.winterweardesigns.com" },
  winslets: { label: "Winslet's", base: "https://winslets.com" },
}

const BODY_EXCERPT_CHARS = 800

function htmlToText(html: string | null | undefined): string {
  if (!html) return ""
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

function countValues(values: string[]): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

export async function GET(request: Request) {
  const access = await checkAdminAccess()
  if (!access.authorized) return access.response

  const params = new URL(request.url).searchParams
  const slug = params.get("store")

  if (!slug) {
    return NextResponse.json({
      usage: "Add ?store=<slug>, and &download=1 to save the result as a file.",
      stores: Object.entries(STORES).map(([key, { label }]) => ({
        slug: key,
        label,
        open: `/api/admin/shopify-probe?store=${key}`,
        download: `/api/admin/shopify-probe?store=${key}&download=1`,
      })),
    })
  }

  const store = STORES[slug]
  if (!store) {
    return NextResponse.json({ error: `Unknown store "${slug}"` }, { status: 400 })
  }

  let products
  try {
    products = await fetchShopifyProducts(store.base)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: `Could not read ${store.label}: ${message}` }, { status: 502 })
  }

  const result = {
    store: { slug, label: store.label, base: store.base },
    fetchedAt: new Date().toISOString(),
    productCount: products.length,
    productTypes: countValues(products.map((p) => p.product_type?.trim() || "(none)")),
    tags: countValues(products.flatMap((p) => p.tags ?? [])),
    products: products.map((p) => ({
      handle: p.handle,
      title: p.title,
      product_type: p.product_type ?? null,
      tags: p.tags ?? [],
      body: htmlToText(p.body_html).slice(0, BODY_EXCERPT_CHARS),
    })),
  }

  const headers: Record<string, string> = { "Cache-Control": "no-store" }
  if (params.get("download") === "1") {
    headers["Content-Disposition"] = `attachment; filename="shopify-probe-${slug}.json"`
  }
  return NextResponse.json(result, { headers })
}
