import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
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
    include: { designer: { select: { id: true, name: true, logo_url: true } } },
  })
  return rows.map((row) => ({
    id: row.designer.id,
    name: row.designer.name,
    imageUrl: row.designer.logo_url,
  }))
}

async function getFeaturedPatterns(): Promise<CurationItem[]> {
  const rows = await prisma.featuredPattern.findMany({
    orderBy: { position: "asc" },
    include: {
      pattern: {
        select: {
          id: true,
          name: true,
          thumbnail_url: true,
          designer: { select: { name: true } },
        },
      },
    },
  })
  return rows.map((row) => ({
    id: row.pattern.id,
    name: row.pattern.name,
    imageUrl: row.pattern.thumbnail_url,
    subtitle: row.pattern.designer?.name ?? null,
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
          visibleSlots={6}
          initialItems={designers}
        />
        <CurationRail
          kind="pattern"
          title="New & Noteworthy"
          description="Pinned patterns lead the rail. Remaining slots fill with the most recently added patterns."
          visibleSlots={12}
          initialItems={patterns}
        />
      </div>
    </div>
  )
}
