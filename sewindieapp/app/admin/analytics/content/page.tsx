import type { Prisma } from "@prisma/client"
import Link from "next/link"
import { ArrowLeft, ClipboardCheck, AlertTriangle, Scissors, Palette, ImageOff, Archive } from "lucide-react"
import { prisma } from "@/lib/prisma"

// A field counts as "in use" once at least this share of the catalogue has it.
// Anything below is reported separately as unused rather than being folded into
// the completeness score, where it would swamp the real gaps.
const IN_USE_THRESHOLD = 5

// Each audited field paired with the `where` clause that matches patterns
// MISSING it. Declared once so the counts, the score, and the attention list
// can't drift apart.
const FIELDS = [
  { key: "thumbnail", label: "Image", missing: { OR: [{ thumbnail_url: null }, { thumbnail_url: "" }] } },
  { key: "format", label: "Format", missing: { PatternFormat: { none: {} } } },
  { key: "audience", label: "Audience", missing: { PatternAudience: { none: {} } } },
  { key: "category", label: "Category", missing: { PatternCategory: { none: {} } } },
  { key: "fabricType", label: "Fabric type", missing: { PatternFabricType: { none: {} } } },
  { key: "attribute", label: "Attribute", missing: { PatternAttribute: { none: {} } } },
  { key: "sizeChart", label: "Size chart", missing: { PatternSizeChart: { none: {} } } },
  { key: "suggestedFabric", label: "Suggested fabric", missing: { PatternSuggestedFabric: { none: {} } } },
  { key: "difficulty", label: "Difficulty", missing: { OR: [{ difficulty: null }, { difficulty: "" }] } },
  { key: "yardage", label: "Yardage", missing: { OR: [{ yardage: null }, { yardage: "" }] } },
] as const satisfies ReadonlyArray<{ key: string; label: string; missing: Prisma.PatternWhereInput }>

type FieldKey = (typeof FIELDS)[number]["key"]

async function getContentAudit() {
  // One indexed COUNT per field instead of loading all ~8.7k patterns and
  // counting relations in JS.
  const [totalPatterns, designersMissingLogo, designersNoPatterns, ...missingCounts] = await Promise.all([
    prisma.pattern.count(),
    prisma.designer.count({ where: { OR: [{ logo_url: null }, { logo_url: "" }] } }),
    prisma.designer.count({ where: { patterns: { none: {} } } }),
    ...FIELDS.map((f) => prisma.pattern.count({ where: f.missing })),
  ])

  const fields = FIELDS.map((f, i) => {
    const missing = missingCounts[i]
    const coverage = totalPatterns > 0 ? ((totalPatterns - missing) / totalPatterns) * 100 : 100
    return { key: f.key as FieldKey, label: f.label, missing, coverage }
  })

  const tracked = fields.filter((f) => f.coverage >= IN_USE_THRESHOLD)
  const unused = fields.filter((f) => f.coverage < IN_USE_THRESHOLD)

  // Completeness is scored over tracked fields only, so fields the catalogue
  // has never used don't drag the number down to something meaningless.
  const trackedChecks = totalPatterns * tracked.length
  const trackedMissing = tracked.reduce((sum, f) => sum + f.missing, 0)
  const overallPct = trackedChecks > 0 ? Math.round(((trackedChecks - trackedMissing) / trackedChecks) * 100) : 100

  // The attention list only considers tracked fields — otherwise every pattern
  // would be flagged for the same unused fields and the list would be noise.
  const trackedKeys = new Set(tracked.map((f) => f.key))
  const trackedMissingClauses = FIELDS.filter((f) => trackedKeys.has(f.key)).map((f) => f.missing)

  const incompleteTotal = trackedMissingClauses.length
    ? await prisma.pattern.count({ where: { OR: trackedMissingClauses as Prisma.PatternWhereInput[] } })
    : 0

  const attention = trackedMissingClauses.length
    ? await prisma.pattern.findMany({
        where: { OR: trackedMissingClauses as Prisma.PatternWhereInput[] },
        take: 50,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          thumbnail_url: true,
          designer: { select: { name: true } },
          _count: {
            select: {
              PatternCategory: true,
              PatternAudience: true,
              PatternFormat: true,
              PatternFabricType: true,
              PatternAttribute: true,
              PatternSizeChart: true,
              PatternSuggestedFabric: true,
            },
          },
        },
      })
    : []

  // Re-derive which tracked fields each row is missing, for the chips.
  const rows = attention.map((p) => {
    const missing: string[] = []
    const has: Record<FieldKey, boolean> = {
      thumbnail: !!p.thumbnail_url?.trim(),
      format: p._count.PatternFormat > 0,
      audience: p._count.PatternAudience > 0,
      category: p._count.PatternCategory > 0,
      fabricType: p._count.PatternFabricType > 0,
      attribute: p._count.PatternAttribute > 0,
      sizeChart: p._count.PatternSizeChart > 0,
      suggestedFabric: p._count.PatternSuggestedFabric > 0,
      difficulty: false,
      yardage: false,
    }
    for (const f of tracked) {
      if (f.key === "difficulty" || f.key === "yardage") continue
      if (!has[f.key]) missing.push(f.label)
    }
    return { pattern: p, missing }
  })

  return {
    totalPatterns,
    tracked,
    unused,
    overallPct,
    incompleteTotal,
    rows: rows.sort((a, b) => b.missing.length - a.missing.length || a.pattern.name.localeCompare(b.pattern.name)),
    designersMissingLogo,
    designersNoPatterns,
  }
}

function fillClass(pct: number) {
  if (pct >= 95) return "admin-bar-fill--good"
  if (pct >= 70) return "admin-bar-fill--warn"
  return "admin-bar-fill--bad"
}

export default async function ContentAnalyticsPage() {
  const {
    totalPatterns,
    tracked,
    unused,
    overallPct,
    incompleteTotal,
    rows,
    designersMissingLogo,
    designersNoPatterns,
  } = await getContentAudit()

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
            <span className="admin-metric-label">Completeness</span>
          </div>
          <div className="admin-metric-value">{overallPct}%</div>
          <div className="admin-metric-trend admin-metric-trend--muted">
            Across {tracked.length} field{tracked.length === 1 ? "" : "s"} in active use
          </div>
        </div>

        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <Scissors size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Total Patterns</span>
          </div>
          <div className="admin-metric-value">{totalPatterns.toLocaleString()}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">In the catalogue</div>
        </div>

        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <AlertTriangle size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Need Attention</span>
          </div>
          <div className="admin-metric-value">{incompleteTotal.toLocaleString()}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">Missing an in-use field</div>
        </div>
      </div>

      <div className="admin-grid-2">
        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">Coverage by Field</h2>
            <span className="admin-row-sub">Fields in active use</span>
          </div>
          {tracked.length === 0 ? (
            <p className="admin-empty">No fields are populated yet.</p>
          ) : (
            <div className="admin-bars">
              {tracked.map((f) => {
                const pct = Math.round(f.coverage)
                return (
                  <div key={f.key} className="admin-bar-row">
                    <div className="admin-bar-meta">
                      <span className="admin-bar-label">{f.label}</span>
                      <span className="admin-bar-value">
                        {pct}%
                        {f.missing > 0 ? ` · ${f.missing.toLocaleString()} missing` : ""}
                      </span>
                    </div>
                    <div className="admin-bar-track">
                      <div className={`admin-bar-fill ${fillClass(pct)}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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

      {unused.length > 0 && (
        <section className="admin-panel" style={{ marginBottom: "1.5rem" }}>
          <div className="admin-panel-head">
            <h2 className="admin-panel-title">
              <Archive size={16} strokeWidth={1.75} /> Fields Not In Use
            </h2>
            <span className="admin-row-sub">Under {IN_USE_THRESHOLD}% populated</span>
          </div>
          <div className="admin-gap-tags">
            {unused.map((f) => (
              <span key={f.key} className="admin-gap-tag">
                {f.label}
                {f.coverage > 0 ? ` · ${Math.round(f.coverage * 10) / 10}%` : ""}
              </span>
            ))}
          </div>
          <p className="admin-row-sub" style={{ marginTop: "0.75rem" }}>
            These are excluded from the completeness score. If any of them should be part of your cataloguing
            workflow, they represent a much larger backfill than the gaps above.
          </p>
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title">Patterns Needing Attention</h2>
          <span className="admin-row-sub">
            {incompleteTotal > rows.length
              ? `Showing ${rows.length} of ${incompleteTotal.toLocaleString()}`
              : `${incompleteTotal.toLocaleString()} pattern${incompleteTotal === 1 ? "" : "s"}`}
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="admin-empty">
            <span className="admin-gap-none">Every pattern has all in-use fields filled in.</span>
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
              {rows.map(({ pattern, missing }) => (
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
                      {missing.map((label) => (
                        <span key={label} className="admin-gap-tag">
                          {label}
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
