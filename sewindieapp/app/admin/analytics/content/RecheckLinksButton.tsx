"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

type Result = {
  checked: number
  skipped?: number
  tally?: Record<string, number>
  hasMore?: boolean
  message?: string
}

export default function RecheckLinksButton({ unchecked }: { unchecked: number }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function run() {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/admin/link-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 150 }),
      })
      if (!res.ok) {
        // Prefer the server's message so a real failure isn't hidden behind a
        // bare status code.
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.error ? `${detail.error} (${res.status})` : `Request failed (${res.status})`)
      }
      const data: Result = await res.json()
      setResult(data)
      // Pull fresh server-rendered numbers into the page.
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Link check failed")
    } finally {
      setRunning(false)
    }
  }

  const busy = running || isPending

  return (
    <div className="admin-recheck">
      <button type="button" className="admin-ghost-btn" onClick={run} disabled={busy}>
        <RefreshCw size={14} className={busy ? "admin-spin" : undefined} aria-hidden="true" />
        {busy ? "Checking..." : "Check 150 links"}
      </button>

      <span className="admin-recheck-note" role="status" aria-live="polite">
        {error ? (
          <span className="admin-recheck-error">{error}</span>
        ) : result ? (
          result.checked === 0 ? (
            (result.message ?? "Nothing new to check.")
          ) : (
            <>
              {`Checked ${result.checked}: `}
              {`${result.tally?.OK ?? 0} ok, ${result.tally?.BROKEN ?? 0} broken, ${result.tally?.UNREACHABLE ?? 0} unreachable.`}
              {result.skipped ? ` ${result.skipped} skipped (time limit).` : null}
              {result.hasMore ? " More remain." : " All caught up."}
            </>
          )
        ) : unchecked > 0 ? (
          `${unchecked.toLocaleString()} link${unchecked === 1 ? "" : "s"} never checked.`
        ) : (
          "All known links have been checked."
        )}
      </span>
    </div>
  )
}
