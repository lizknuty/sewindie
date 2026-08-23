import Link from "next/link"
import { ArrowLeft, ClipboardCheck, AlertTriangle, Scissors, Palette, ImageOff } from "lucide-react"
import { prisma } from "@/lib/prisma"

// Each field we audit: how to count patterns that HAVE it, and the chip label
// used when a pattern is missing it.
const FIELDS = [
  { key: "thumbnail", label: "Image" },
  { key: "category", label: "Category" },
  { key: "audience", label: "Audience" },
  { key: "format", label: "Format" },
  { key: "attribute", label: "Attribute" },
  { key: "fabricType", label: "Fabric type" },
  { key: "sizeChart", label: "Size chart" },
  { key: "difficulty", label: "Difficulty" },
  { key: "yardage", label: "Yardage" },
] as const

type FieldKey = (typeof FIELDS)[number]["key"]

async function getContentAudit() {
  const [totalPatterns, totalDesigners, patterns, designersMissingLogo, designersNoPatterns] = await Promise.all([
    prisma.pattern.count(),
    prisma.designer.count(),
    // Only the relation counts are needed to decide presence/absence, so
    // select _count instead of hydrating every join row.
    prisma.pattern.findMany({
      select: {
        id: true,
        name: true,
        thumbnail_url: true,
        difficulty: true,
        yardage: true,
        status: true,
        designer: { select: { id: true, name: true } },
        _count: {
          select: {
            PatternCategory: true,
            PatternAudience: true,
            PatternFormat: true,
            PatternAttribute: true,
            PatternFabricType: true,
            PatternSizeChart: true,
          },
        },
      },
    }),
    prisma.designer.count({ where: { OR: [{ logo_url: null }, { logo_url: "" }] } }),
    prisma.designer.count({ where: { patterns: { none: {} } } }),
  ])

  const missingCounts: Record<FieldKey, number> = {
    thumbnail: 0,
    category: 0,
    audience: 0,
    format: 0,
    attribute: 0,
    fabricType: 0,
    sizeChart: 0,
    difficulty: 0,
    yardage: 0,
  }

  const rows = patterns.map((p) => {
    const missing: FieldKey[] = []

    if (!p.thumbnail_url?.trim()) missing.push("thumbnail")
    if (p._count.PatternCategory === 0) missing.push("category")
    if (p._count.PatternAudience === 0) missing.push("audience")
    if (p._count.PatternFormat === 0) missing.push("format")
    if (p._count.PatternAttribute === 0) missing.push("attribute")
    if (p._count.PatternFabricType === 0) missing.push("fabricType")
    if (p._count.PatternSizeChart === 0) missing.push("sizeChart")
    if (!p.difficulty?.trim()) missing.push("difficulty")
    if (!p.yardage?.trim()) missing.push("yardage")

    for (const key of missing) missingCounts[key] += 1

    return { pattern: p, missing }
  })

  // Worst offenders first, then alphabetical so the list is stable between loads.
  const incomplete = rows
    .filter((r) => r.missing.length > 0)
    .sort((a, b) => b.missing.length - a.missing.length || a.pattern.name.localeCompare(b.pattern.name))

  const fullyComplete = totalPatterns - incomplete.length

  // Average completeness across every audited field.
  const totalChecks = totalPatterns * FIELDS.length
  const totalMissing = Object.values(missingCounts).reduce((a, b) => a + b, 0)
  const overallPct = totalChecks > 0 ? Math.round(((totalChecks - totalMissing) / totalChecks) * 100) : 100

  return {
    totalPatterns,
    totalDesigners,
    missingCounts,
    incomplete: incomplete.slice(0, 25),
    incompleteTotal: incomplete.length,
    fullyComplete,
    overallPct,
    designersMissingLogo,
    designersNoPatterns,
  }
}

function fillClass(pct: number) {
  if (pct >= 90) return "admin-bar-fill--good"
  if (pct >= 60) return "admin-bar-fill--warn"
  return "admin-bar-fill--bad"
}

export default async function ContentAnalyticsPage() {
  const {
    totalPatterns,
    missingCounts,
    incomplete,
    incompleteTotal,
    fullyComplete,
    overallPct,
    designersMissingLogo,
    designersNoPatterns,
  } = await getContentAudit()

  const fieldLabel = new Map(FIELDS.map((f) => [f.key, f.label]))

  return (
    <div className="admin-dashboard">
      <Link href="/admin/analytics" className="admin-back-link">
        <ArrowLeft size={14} strokeWidth={2} />
        Back to Analytics
      </Link>

      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Content Coverage</h1>
          <p className="admin-page-sub">Where your catalogue has gaps, and which patterns need attention first.</p>
        </div>
      </div>

      <div className="admin-metrics admin-metrics--3">
        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <ClipboardCheck size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Overall Completeness</span>
          </div>
          <div className="admin-metric-value">{overallPct}%</div>
          <div className="admin-metric-trend admin-metric-trend--muted">
            Across {FIELDS.length} fields on {totalPatterns.toLocaleString()} patterns
          </div>
        </div>

        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <Scissors size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Fully Complete</span>
          </div>
          <div className="admin-metric-value">{fullyComplete.toLocaleString()}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">Patterns with no gaps</div>
        </div>

        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <AlertTriangle size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Need Attention</span>
          </div>
          <div className="admin-metric-value">{incompleteTotal.toLocaleString()}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">Missing at least one field</div>
        </div>
      </div>

      <div className="admin-grid-2">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">Coverage by Field</h2>
          </div>
          <div className="admin-bars">
            {FIELDS.map(({ key, label }) => {
              const missing = missingCounts[key]
              const present = totalPatterns - missing
              const pct = totalPatterns > 0 ? Math.round((present / totalPatterns) * 100) : 100
              return (
                <div key={key} className="admin-bar-row">
                  <div className="admin-bar-meta">
                    <span className="admin-bar-label">{label}</span>
                    <span className="admin-bar-value">
                      {pct}% &middot; {missing.toLocaleString()} missing
                    </span>
                  </div>
                  <div className="admin-bar-track">
                    <div className={`admin-bar-fill ${fillClass(pct)}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">
              <Palette size={16} strokeWidth={1.75} /> Designer Data
            </h2>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th className="admin-num">Designers</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="admin-row-item">
                    <span className="admin-thumb">
                      <ImageOff size={16} strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="admin-row-title">Missing logo</p>
                      <p className="admin-row-sub">No logo image set</p>
                    </div>
                  </div>
                </td>
                <td className="admin-num">
                  <span className="admin-pill">{designersMissingLogo}</span>
                </td>
              </tr>
              <tr>
                <td>
                  <div className="admin-row-item">
                    <span className="admin-thumb">
                      <Scissors size={16} strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="admin-row-title">No patterns</p>
                      <p className="admin-row-sub">Designer has an empty catalogue</p>
                    </div>
                  </div>
                </td>
                <td className="admin-num">
                  <span className="admin-pill">{designersNoPatterns}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="admin-panel-foot">
            <Link href="/admin/designers" className="admin-ghost-btn">
              Manage designers
            </Link>
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title">Patterns Needing Attention</h2>
          <span className="admin-row-sub">
            {incompleteTotal > incomplete.length
              ? `Showing worst ${incomplete.length} of ${incompleteTotal.toLocaleString()}`
              : `${incompleteTotal.toLocaleString()} pattern${incompleteTotal === 1 ? "" : "s"}`}
          </span>
        </div>
        {incomplete.length === 0 ? (
          <p className="admin-empty">
            <span className="admin-gap-none">Every pattern has complete data.</span>
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Pattern</th>
                <th>Missing</th>
                <th className="admin-num">Gaps</th>
              </tr>
            </thead>
            <tbody>
              {incomplete.map(({ pattern, missing }) => (
                <tr key={pattern.id}>
                  <td>
                    <div className="admin-row-item">
                      <div>
                        <p className="admin-row-title">
                          <Link href={`/admin/patterns/${pattern.id}/edit`}>{pattern.name}</Link>
                        </p>
                        <p className="admin-row-sub">{pattern.designer?.name ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="admin-gap-tags">
                      {missing.map((key) => (
                        <span key={key} className="admin-gap-tag">
                          {fieldLabel.get(key)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="admin-num">
                    <span className="admin-pill">{missing.length}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="admin-panel-foot">
          <Link href="/admin/patterns" className="admin-ghost-btn">
            View all patterns
          </Link>
        </div>
      </section>
    </div>
  )
}
