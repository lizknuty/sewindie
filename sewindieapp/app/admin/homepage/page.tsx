import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { DESIGNER_SLOTS, PATTERN_SLOTS, DESIGNER_VISIBLE } from "@/lib/homepage-rails"
import CurationRail, { type CurationItem } from "./CurationRail"

export const metadata: Metadata = {
  title: "Homepage | Admin",
  description: "Choose which designers and patterns are featured on the homepage.",
}

// Curation changes must show up immediately after saving.
export const dynamic = "force-dynamic"

async function getFeaturedDesigners(): Promise<CurationItem[]> {
  const rows = await prisma.featuredDesigner.findMany({
    orderBy: { position: "asc" },
    include: { Designer: { select: { id: true, name: true, logo_url: true } } },
  })
  return rows.map((row) => ({
    id: row.Designer.id,
    name: row.Designer.name,
    imageUrl: row.Designer.logo_url,
  }))
}

async function getFeaturedPatterns(): Promise<CurationItem[]> {
  const rows = await prisma.featuredPattern.findMany({
    orderBy: { position: "asc" },
    include: {
      Pattern: {
        select: {
          id: true,
          name: true,
          thumbnail_url: true,
          // `designer` stays lowercase: it is a pre-existing relation field, and
          // `prisma db pull` preserves names it has already seen. Only the two
          // new Featured* models get introspection's model-cased defaults.
          designer: { select: { name: true } },
        },
      },
    },
  })
  return rows.map((row) => ({
    id: row.Pattern.id,
    name: row.Pattern.name,
    imageUrl: row.Pattern.thumbnail_url,
    subtitle: row.Pattern.designer?.name ?? null,
  }))
}

export default async function AdminHomepagePage() {
  const [designers, patterns] = await Promise.all([getFeaturedDesigners(), getFeaturedPatterns()])

  return (
    <div>
      <header className="admin-page-head">
        <h1 className="admin-page-title">Homepage</h1>
        <p className="admin-page-sub">
          Pin the designers and patterns you want to lead each homepage rail, and drag to set their
          order. Anything you don&apos;t pin is filled in automatically, so the homepage is never
          short.
        </p>
      </header>

      <div className="curation-grid">
        <CurationRail
          kind="designer"
          title="Featured Designers"
          description="Pinned designers lead the rail. Remaining slots fill with the designers who have the most published patterns."
          totalSlots={DESIGNER_SLOTS}
          visibleSlots={DESIGNER_VISIBLE}
          initialItems={designers}
        />
        <CurationRail
          kind="pattern"
          title="New & Noteworthy"
          description="Pinned patterns lead the rail. Remaining slots fill with the most recently added patterns."
          totalSlots={PATTERN_SLOTS}
          initialItems={patterns}
        />
      </div>
    </div>
  )
}
