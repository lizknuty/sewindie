"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, ExternalLink, DownloadCloud } from "lucide-react"
import { KIND_LABELS, type ProductKind } from "@/lib/pattern-sync/types"

type RunSummary = {
  ranAt: string
  found: number
  new: number
  possibleMatches: number
  existing: number
}

type DesignerOption = {
  id: number
  name: string
  patternCount: number
  adapterLabel: string | null
  lastRun: RunSummary | null
}

type Row = {
  name: string
  url: string
  imageUrl: string | null
  releaseDate: string | null
  kind: ProductKind
  sourceId: string
  status: "NEW" | "POSSIBLE_MATCH"
  matchedPattern: { id: number; name: string } | null
}

type CheckResult = {
  designer: { id: number; name: string }
  summary: { found: number; new: number; possibleMatches: number; existing: number; inCatalogue: number }
  lastRun: { ranAt: string } | null
  rows: Row[]
}

type ImportResult = {
  imported: number
  skipped: number
  rejected: { name: string; reason: string }[]
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
]

// "3 hours ago", "just now" -- computed against a client-side `now` so it never
// renders on the server (see the mounted guard below), avoiding a timezone/
// clock hydration mismatch between server render and client.
function formatRelative(iso: string, now: number): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return "just now"
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  for (const [unit, secondsInUnit] of RELATIVE_STEPS) {
    if (abs >= secondsInUnit) return rtf.format(Math.round(seconds / secondsInUnit), unit)
  }
  return "just now"
}

export default function PatternSyncRunner({ designers }: { designers: DesignerOption[] }) {
  const router = useRouter()
  const firstSupported = designers.find((d) => d.adapterLabel)

  const [designerId, setDesignerId] = useState<string>(firstSupported ? String(firstSupported.id) : "")
  const [checking, setChecking] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [imported, setImported] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  // Last-run info per designer, seeded from the server and updated the moment a
  // check finishes so the admin sees "just now" without waiting for a refetch.
  const [lastRuns, setLastRuns] = useState<Record<number, RunSummary | null>>(() =>
    Object.fromEntries(designers.map((d) => [d.id, d.lastRun])),
  )

  // `now` stays null until mount, so the timestamp is a client-only render and
  // can't mismatch the server. It ticks each minute to keep "x ago" honest.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const busy = checking || importing || isPending
  const selectedDesigner = designers.find((d) => String(d.id) === designerId)
  const canRun = Boolean(selectedDesigner?.adapterLabel) && !busy
  const selectedLastRun = selectedDesigner ? lastRuns[selectedDesigner.id] : null

  const rows = result?.rows ?? []
  const selectedRows = useMemo(() => rows.filter((row) => selected.has(row.url)), [rows, selected])

  async function runCheck() {
    setChecking(true)
    setError(null)
    setResult(null)
    setImported(null)
    setSelected(new Set())

    try {
      const res = await fetch("/api/admin/pattern-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designerId: Number(designerId) }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.error ? `${detail.error} (${res.status})` : `Request failed (${res.status})`)
      }
      const data: CheckResult = await res.json()
      setResult(data)
      // Reflect this run in the last-run line right away. Fall back to the
      // client clock if the server couldn't persist the run (lastRun is null).
      setLastRuns((prev) => ({
        ...prev,
        [Number(designerId)]: {
          ranAt: data.lastRun?.ranAt ?? new Date().toISOString(),
          found: data.summary.found,
          new: data.summary.new,
          possibleMatches: data.summary.possibleMatches,
          existing: data.summary.existing,
        },
      }))
      // Pre-select confident finds only: brand-new standalone patterns. Possible
      // matches risk becoming duplicates, and bundles/add-ons aren't really
      // patterns -- both need a human look, so neither is checked by default.
      setSelected(
        new Set(
          data.rows.filter((row) => row.status === "NEW" && row.kind === "pattern").map((row) => row.url),
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed")
    } finally {
      setChecking(false)
    }
  }

  async function runImport() {
    if (selectedRows.length === 0) return
    setImporting(true)
    setError(null)
    setImported(null)

    try {
      const res = await fetch("/api/admin/pattern-sync/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designerId: Number(designerId),
          patterns: selectedRows.map(({ name, url, imageUrl, releaseDate }) => ({ name, url, imageUrl, releaseDate })),
        }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.error ? `${detail.error} (${res.status})` : `Request failed (${res.status})`)
      }
      const data: ImportResult = await res.json()
      setImported(data)
      // Imported rows are no longer new, so drop them from the working list.
      const importedUrls = new Set(selectedRows.map((row) => row.url))
      setResult((prev) => (prev ? { ...prev, rows: prev.rows.filter((row) => !importedUrls.has(row.url)) } : prev))
      setSelected(new Set())
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.url))

  return (
    <div className="admin-sync">
      <div className="admin-sync-controls">
        <label className="admin-sync-label" htmlFor="pattern-sync-designer">
          Designer
        </label>
        <select
          id="pattern-sync-designer"
          className="admin-select"
          value={designerId}
          onChange={(event) => {
            setDesignerId(event.target.value)
            setResult(null)
            setImported(null)
            setError(null)
            setSelected(new Set())
          }}
          disabled={busy}
        >
          {designers.map((designer) => (
            <option key={designer.id} value={String(designer.id)} disabled={!designer.adapterLabel}>
              {designer.name}
              {designer.adapterLabel ? ` (${designer.patternCount} in catalogue)` : " — no script yet"}
            </option>
          ))}
        </select>

        <button type="button" className="admin-ghost-btn" onClick={runCheck} disabled={!canRun}>
          <RefreshCw size={14} className={checking ? "admin-spin" : undefined} aria-hidden="true" />
          {checking ? "Checking store..." : "Check for new patterns"}
        </button>
      </div>

      {selectedDesigner?.adapterLabel && (
        <p className="admin-sync-lastrun">
          {selectedLastRun ? (
            <>
              <span className="admin-sync-lastrun-time">
                Last checked{" "}
                <time dateTime={selectedLastRun.ranAt} title={new Date(selectedLastRun.ranAt).toLocaleString()}>
                  {now === null ? new Date(selectedLastRun.ranAt).toISOString().slice(0, 10) : formatRelative(selectedLastRun.ranAt, now)}
                </time>
              </span>
              <span className="admin-sync-lastrun-outcome">
                {`${selectedLastRun.found} found · ${selectedLastRun.new} new · ${selectedLastRun.possibleMatches} possible · ${selectedLastRun.existing} in catalogue`}
              </span>
            </>
          ) : (
            <span className="admin-sync-lastrun-time">Never checked</span>
          )}
        </p>
      )}

      <p className="admin-recheck-note" role="status" aria-live="polite">
        {error ? (
          <span className="admin-recheck-error">{error}</span>
        ) : imported ? (
          <>
            {`Imported ${imported.imported} pattern${imported.imported === 1 ? "" : "s"}.`}
            {imported.skipped > 0 ? ` ${imported.skipped} skipped.` : null}
          </>
        ) : result ? (
          `Found ${result.summary.found} patterns in the store: ${result.summary.new} new, ` +
          `${result.summary.possibleMatches} possible match${result.summary.possibleMatches === 1 ? "" : "es"}, ` +
          `${result.summary.existing} already in the catalogue.`
        ) : (
          "Select a designer and run a check. Nothing is written until you import."
        )}
      </p>

      {imported && imported.rejected.length > 0 && (
        <ul className="admin-sync-rejected">
          {imported.rejected.map((row) => (
            <li key={`${row.name}-${row.reason}`}>
              {row.name} — {row.reason}
            </li>
          ))}
        </ul>
      )}

      {result && rows.length === 0 && !imported && (
        <p className="admin-empty">No new patterns found. The catalogue is up to date with this store.</p>
      )}

      {rows.length > 0 && (
        <>
          <div className="admin-sync-actions">
            <button
              type="button"
              className="admin-form-btn admin-form-btn-primary"
              onClick={runImport}
              disabled={busy || selectedRows.length === 0}
            >
              <DownloadCloud size={14} className={importing ? "admin-spin" : undefined} aria-hidden="true" />
              {importing ? "Importing..." : `Import selected (${selectedRows.length})`}
            </button>
          </div>

          <div className="admin-sync-wrap">
            <table className="admin-table admin-sync-table">
              <thead>
                <tr>
                  <th scope="col" className="admin-sync-check">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.url)))}
                      aria-label={allSelected ? "Deselect all patterns" : "Select all patterns"}
                      disabled={busy}
                    />
                  </th>
                  <th scope="col">Pattern</th>
                  <th scope="col">Status</th>
                  <th scope="col">Released</th>
                  <th scope="col">Link</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.url} className={selected.has(row.url) ? "is-selected" : undefined}>
                    <td className="admin-sync-check">
                      <input
                        type="checkbox"
                        checked={selected.has(row.url)}
                        onChange={() => toggle(row.url)}
                        aria-label={`Select ${row.name}`}
                        disabled={busy}
                      />
                    </td>
                    <td>
                      <span className="admin-sync-pattern">
                        {row.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.imageUrl}
                            alt=""
                            className="admin-sync-thumb"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="admin-sync-thumb is-empty" aria-hidden="true" />
                        )}
                        <span>
                          <span className="admin-sync-name">{row.name}</span>
                          {row.kind !== "pattern" && <span className="admin-soon-tag">{KIND_LABELS[row.kind]}</span>}
                        </span>
                      </span>
                    </td>
                    <td>
                      {row.status === "NEW" ? (
                        <span className="admin-sync-tag is-new">New</span>
                      ) : (
                        <span className="admin-sync-tag is-maybe">
                          Possible match
                          {row.matchedPattern ? `: ${row.matchedPattern.name}` : null}
                        </span>
                      )}
                    </td>
                    <td>{row.releaseDate ? new Date(row.releaseDate).toLocaleDateString() : "—"}</td>
                    <td>
                      <a href={row.url} target="_blank" rel="noopener noreferrer" className="admin-sync-link">
                        View <ExternalLink size={12} strokeWidth={2} aria-hidden="true" />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
