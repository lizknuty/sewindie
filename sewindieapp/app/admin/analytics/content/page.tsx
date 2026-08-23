import type { Prisma } from "@prisma/client"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  ClipboardCheck,
  AlertTriangle,
  Scissors,
  Palette,
  Archive,
  Link2Off,
  ExternalLink,
} from "lucide-react"
import { prisma } from "@/lib/prisma"
import RecheckLinksButton from "./RecheckLinksButton"

export const dynamic = "force-dynamic"

// A field counts as "in use" once at least this share of the catalogue has it.
// Anything below is reported separately as unused rather than being folded into
// the completeness score, where it would swamp the real gaps.
const IN_USE_THRESHOLD = 5

const PATTERN_LIMIT = 40
const DESIGNER_LIMIT = 12

// Each audited field paired with the `where` clause that matches patterns
// MISSING it. Declared once so the counts, the score, the designer rollup and
// the filtered list can't drift apart.
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

const KIND_LABEL: Record<string, string> = {
  PATTERN_THUMBNAIL: "Image",
  PATTERN_PAGE: "Pattern page",
}

function findField(key: string | undefined) {
  return FIELDS.find((f) => f.key === key)
}

async function getContentAudit(activeKey: FieldKey | null) {
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
  const anyGap = FIELDS.filter((f) => trackedKeys.has(f.key)).map((f) => f.missing) as Prisma.PatternWhereInput[]
  const hasTracked = anyGap.length > 0

  // Filter tabs narrow to a single field; otherwise "any tracked gap".
  const activeField = activeKey ? fields.find((f) => f.key === activeKey) : null
  const listWhere: Prisma.PatternWhereInput | null = activeKey
    ? (findField(activeKey)!.missing as Prisma.PatternWhereInput)
    : hasTracked
      ? { OR: anyGap }
      : null

  const [incompleteTotal, attention, designerRollup, brokenLinks, linkStatus, uncheckedRow] = await Promise.all([
    hasTracked ? prisma.pattern.count({ where: { OR: anyGap } }) : 0,
    listWhere
      ? prisma.pattern.findMany({
          where: listWhere,
          take: PATTERN_LIMIT,
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            thumbnail_url: true,
            difficulty: true,
            yardage: true,
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
      : [],
    // Gaps arrived per-designer during import, so ranking by designer usually
    // reveals whole batches that can be fixed together.
    hasTracked
      ? prisma.designer.findMany({
          where: { patterns: { some: { OR: anyGap } } },
          select: {
            id: true,
            name: true,
            _count: { select: { patterns: { where: { OR: anyGap } } } },
          },
          orderBy: { patterns: { _count: "desc" } },
          take: DESIGNER_LIMIT,
        })
      : [],
    prisma.linkCheck.findMany({
      where: { status: "BROKEN" },
      select: { url: true, host: true, kind: true, statusCode: true, error: true },
      orderBy: { checkedAt: "desc" },
      take: 25,
    }),
    prisma.linkCheck.groupBy({ by: ["status"], _count: { _all: true } }),
    // Distinct catalogue URLs that have never been probed.
    prisma.$queryRaw<{ n: bigint }[]>`
      WITH candidates AS (
        SELECT DISTINCT thumbnail_url AS url FROM "Pattern"
        WHERE thumbnail_url IS NOT NULL AND thumbnail_url <> ''
        UNION
        SELECT DISTINCT url FROM "Pattern" WHERE url IS NOT NULL AND url <> ''
      )
      SELECT COUNT(*)::bigint AS n
      FROM candidates c LEFT JOIN "LinkCheck" lc ON lc.url = c.url
      WHERE lc.id IS NULL
    `,
  ])

  // Re-derive which tracked fields each row is missing, for the chips.
  const rows = attention.map((p) => {
    const has: Record<FieldKey, boolean> = {
      thumbnail: !!p.thumbnail_url?.trim(),
      format: p._count.PatternFormat > 0,
      audience: p._count.PatternAudience > 0,
      category: p._count.PatternCategory > 0,
      fabricType: p._count.PatternFabricType > 0,
      attribute: p._count.PatternAttribute > 0,
      sizeChart: p._count.PatternSizeChart > 0,
      suggestedFabric: p._count.PatternSuggestedFabric > 0,
      difficulty: !!p.difficulty?.trim(),
      yardage: !!p.yardage?.trim(),
    }
    const missing = tracked.filter((f) => !has[f.key]).map((f) => f.label)
    return { pattern: p, missing }
  })

  // Map each broken URL back to the patterns using it, so a fix is one click away.
  const brokenUrls = brokenLinks.map((l) => l.url)
  const referencing = brokenUrls.length
    ? await prisma.pattern.findMany({
        where: { OR: [{ thumbnail_url: { in: brokenUrls } }, { url: { in: brokenUrls } }] },
        select: { id: true, name: true, thumbnail_url: true, url: true },
      })
    : []

  const byUrl = new Map<string, { id: number; name: string }[]>()
  for (const p of referencing) {
    for (const u of [p.thumbnail_url, p.url]) {
      if (!u) continue
      const list = byUrl.get(u)
      if (list) list.push({ id: p.id, name: p.name })
      else if (brokenUrls.includes(u)) byUrl.set(u, [{ id: p.id, name: p.name }])
    }
  }

  const tally = new Map(linkStatus.map((s) => [s.status, s._count._all]))

  return {
    totalPatterns,
    tracked,
    unused,
    overallPct,
    incompleteTotal,
    activeField,
    rows: rows.sort(
      (a, b) => b.missing.length - a.missing.length || a.pattern.name.localeCompare(b.pattern.name),
    ),
    designerRollup,
    designersMissingLogo,
    designersNoPatterns,
    brokenLinks: brokenLinks.map((l) => ({ ...l, patterns: byUrl.get(l.url) ?? [] })),
    linkStats: {
      broken: tally.get("BROKEN") ?? 0,
      unreachable: tally.get("UNREACHABLE") ?? 0,
      checkedTotal: linkStatus.reduce((s, r) => s + r._count._all, 0),
      unchecked: Number(uncheckedRow[0]?.n ?? 0),
    },
  }
}

function fillClass(pct: number) {
  if (pct >= 95) return "admin-bar-fill--good"
  if (pct >= 70) return "admin-bar-fill--warn"
  return "admin-bar-fill--bad"
}

export default async function ContentAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ gap?: string }>
}) {
  const { gap } = await searchParams
  if (gap && !findField(gap)) notFound()
  const activeKey = (gap as FieldKey | undefined) ?? null

  const {
    totalPatterns,
    tracked,
    unused,
    overallPct,
    incompleteTotal,
    activeField,
    rows,
    designerRollup,
    designersMissingLogo,
    designersNoPatterns,
    brokenLinks,
    linkStats,
  } = await getContentAudit(activeKey)

  const listTotal = activeField ? activeField.missing : incompleteTotal

  return (
    <div className="admin-dashboard">
      <Link href="/admin/analytics" className="admin-back-link">
        <ArrowLeft size={14} strokeWidth={2} />
        Back to Analytics
      </Link>

      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Content Coverage</h1>
          <p className="admin-page-sub">
            Where your catalogue has gaps, and which external links have gone dead.
          </p>
        </div>
      </div>

      <div className="admin-metrics admin-metrics--4">
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

        <div className="admin-metric admin-metric--static">
          <div className="admin-metric-head">
            <span className="admin-metric-icon">
              <Link2Off size={18} strokeWidth={1.75} />
            </span>
            <span className="admin-metric-label">Broken Links</span>
          </div>
          <div className="admin-metric-value">{linkStats.broken.toLocaleString()}</div>
          <div className="admin-metric-trend admin-metric-trend--muted">
            {linkStats.checkedTotal > 0
              ? `${linkStats.checkedTotal.toLocaleString()} link${linkStats.checkedTotal === 1 ? "" : "s"} checked`
              : "Not checked yet"}
          </div>
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
              {[...tracked]
                .sort((a, b) => a.coverage - b.coverage)
                .map((f) => {
                  const pct = Math.round(f.coverage)
                  return (
                    <div key={f.key} className="admin-bar-row">
                      <div className="admin-bar-meta">
                        <Link href={`/admin/analytics/content?gap=${f.key}`} className="admin-bar-label">
                          {f.label}
                        </Link>
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
              <Palette size={16} strokeWidth={1.75} /> Designers to Work Through
            </h2>
            <span className="admin-row-sub">Most patterns with gaps</span>
          </div>
          {designerRollup.length === 0 ? (
            <p className="admin-empty">No gaps to attribute.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Designer</th>
                  <th className="admin-num">Patterns</th>
                </tr>
              </thead>
              <tbody>
                {designerRollup.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <p className="admin-row-title">
                        <Link href={`/admin/designers/${d.id}/edit`}>{d.name}</Link>
                      </p>
                    </td>
                    <td className="admin-num">
                      <span className="admin-pill">{d._count.patterns.toLocaleString()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="admin-panel-foot admin-panel-foot--row">
            <span className="admin-row-sub">
              {designersMissingLogo} missing a logo · {designersNoPatterns} with no patterns
            </span>
            <Link href="/admin/designers" className="admin-ghost-btn">
              Manage designers
            </Link>
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title">
            <Link2Off size={16} strokeWidth={1.75} /> Broken External Links
          </h2>
          <span className="admin-row-sub">
            {linkStats.unchecked > 0
              ? `${linkStats.unchecked.toLocaleString()} never checked`
              : "All known links checked"}
          </span>
        </div>

        <RecheckLinksButton unchecked={linkStats.unchecked} />

        {brokenLinks.length === 0 ? (
          <p className="admin-empty">
            {linkStats.checkedTotal === 0
              ? "No links checked yet. Run a check to find dead images and pattern pages."
              : "No broken links found."}
          </p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Link</th>
                <th>Used by</th>
                <th className="admin-num">Status</th>
              </tr>
            </thead>
            <tbody>
              {brokenLinks.map((l) => (
                <tr key={l.url}>
                  <td>
                    <p className="admin-row-title">{KIND_LABEL[l.kind] ?? l.kind}</p>
                    <p className="admin-row-sub">{l.host}</p>
                  </td>
                  <td>
                    {l.patterns.length === 0 ? (
                      <span className="admin-row-sub">—</span>
                    ) : (
                      <div className="admin-gap-tags">
                        {l.patterns.slice(0, 2).map((p) => (
                          <Link key={p.id} href={`/admin/patterns/${p.id}/edit`} className="admin-row-sub">
                            {p.name}
                          </Link>
                        ))}
                        {l.patterns.length > 2 && (
                          <span className="admin-row-sub">{`+${l.patterns.length - 2} more`}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="admin-num">
                    <span className="admin-gap-tag">{l.statusCode ?? l.error ?? "failed"}</span>{" "}
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${l.host} in a new tab`}
                    >
                      <ExternalLink size={13} strokeWidth={1.75} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {linkStats.unreachable > 0 && (
          <div className="admin-panel-foot">
            <span className="admin-row-sub">
              {linkStats.unreachable.toLocaleString()} link
              {linkStats.unreachable === 1 ? "" : "s"} could not be verified (blocked, rate limited, or
              the host is down). These are not counted as broken.
            </span>
          </div>
        )}
      </section>

      {unused.length > 0 && (
        <section className="admin-panel">
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
            These are excluded from the completeness score. If any should be part of your cataloguing
            workflow, they represent a much larger backfill than the gaps above.
          </p>
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title">Patterns Needing Attention</h2>
          <span className="admin-row-sub">
            {listTotal > rows.length
              ? `Showing ${rows.length} of ${listTotal.toLocaleString()}`
              : `${listTotal.toLocaleString()} pattern${listTotal === 1 ? "" : "s"}`}
          </span>
        </div>

        <nav className="admin-tabs" aria-label="Filter by missing field">
          <Link href="/admin/analytics/content" className={`admin-tab-link${activeKey ? "" : " active"}`}>
            Any gap
          </Link>
          {tracked.map((f) => (
            <Link
              key={f.key}
              href={`/admin/analytics/content?gap=${f.key}`}
              className={`admin-tab-link${activeKey === f.key ? " active" : ""}`}
            >
              {f.label}
              <span className="admin-tab-count">{f.missing.toLocaleString()}</span>
            </Link>
          ))}
        </nav>

        {rows.length === 0 ? (
          <p className="admin-empty">
            <span className="admin-gap-none">Nothing missing here.</span>
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
                    <p className="admin-row-title">
                      <Link href={`/admin/patterns/${pattern.id}/edit`}>{pattern.name}</Link>
                    </p>
                    <p className="admin-row-sub">{pattern.designer?.name ?? "—"}</p>
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
