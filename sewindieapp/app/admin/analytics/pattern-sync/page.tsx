import Link from "next/link"
import { ArrowLeft, DownloadCloud } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getAdapterForDesigner } from "@/lib/pattern-sync/registry"
import PatternSyncRunner from "./PatternSyncRunner"

export const dynamic = "force-dynamic"

async function getDesignerOptions() {
  const designers = await prisma.designer.findMany({
    select: {
      id: true,
      name: true,
      url: true,
      _count: { select: { patterns: true } },
    },
    orderBy: { name: "asc" },
  })

  // Resolving adapters on the server keeps the scraping code out of the client
  // bundle -- the browser only needs to know which designers are supported.
  return designers.map((designer) => {
    const adapter = getAdapterForDesigner(designer)
    return {
      id: designer.id,
      name: designer.name,
      patternCount: designer._count.patterns,
      adapterLabel: adapter?.label ?? null,
    }
  })
}

export default async function PatternSyncPage() {
  const designers = await getDesignerOptions()
  const supported = designers.filter((d) => d.adapterLabel)

  return (
    <div className="admin-dashboard">
      <Link href="/admin/analytics" className="admin-back-link">
        <ArrowLeft size={14} strokeWidth={2} />
        Back to Analytics
      </Link>

      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Designer Pattern Sync</h1>
          <p className="admin-page-sub">
            Check a designer&apos;s store for patterns missing from the catalogue, then import the ones you want.
          </p>
        </div>
        <span className="admin-daterange">
          <DownloadCloud size={15} strokeWidth={1.75} />
          {supported.length} script{supported.length === 1 ? "" : "s"}
        </span>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title">Run a Check</h2>
          <span className="admin-row-sub">Nothing is saved until you import</span>
        </div>

        {supported.length === 0 ? (
          <p className="admin-empty">No designer sync scripts are available yet.</p>
        ) : (
          <PatternSyncRunner designers={designers} />
        )}
      </section>
    </div>
  )
}
