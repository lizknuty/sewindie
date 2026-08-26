"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { FolderPlus, Check, Plus, Loader2 } from "lucide-react"

type CollectionOption = {
  id: number
  name: string
  patternCount: number
  hasPattern: boolean
}

export default function AddToCollection({ patternId }: { patternId: number }) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [collections, setCollections] = useState<CollectionOption[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Fetched on first open rather than on mount, so pattern pages don't make a
  // collections request for visitors who never touch the button.
  useEffect(() => {
    if (!open || loaded || !session) return

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/collections?patternId=${patternId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Could not load collections")
        if (cancelled) return
        setCollections(
          data.collections.map((c: CollectionOption) => ({
            id: c.id,
            name: c.name,
            patternCount: c.patternCount,
            hasPattern: Boolean(c.hasPattern),
          })),
        )
        setLoaded(true)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load collections")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, loaded, session, patternId])

  // Click-outside and Escape both close the popover, which is what users expect
  // from a menu anchored to a button.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  if (!session) return null

  const toggleMembership = async (collection: CollectionOption) => {
    setBusyId(collection.id)
    setError(null)
    const adding = !collection.hasPattern

    try {
      const res = adding
        ? await fetch(`/api/collections/${collection.id}/patterns`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patternId }),
          })
        : await fetch(
            `/api/collections/${collection.id}/patterns?patternId=${patternId}`,
            { method: "DELETE" },
          )

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not update collection")

      setCollections((prev) =>
        prev.map((c) =>
          c.id === collection.id
            ? { ...c, hasPattern: adding, patternCount: data.patternCount ?? c.patternCount }
            : c,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update collection")
    } finally {
      setBusyId(null)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return

    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not create collection")

      // Created then immediately filled, so the button does what its label
      // implies in one click instead of leaving an empty collection behind.
      const created = data.collection
      const addRes = await fetch(`/api/collections/${created.id}/patterns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patternId }),
      })
      const addData = await addRes.json()
      if (!addRes.ok) throw new Error(addData.error || "Collection created, but adding failed")

      setCollections((prev) => [
        { id: created.id, name: created.name, patternCount: 1, hasPattern: true },
        ...prev,
      ])
      setNewName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create collection")
    } finally {
      setCreating(false)
    }
  }

  const savedCount = collections.filter((c) => c.hasPattern).length

  return (
    <div className="atc" ref={popoverRef}>
      <button
        type="button"
        className={`atc-trigger ${savedCount > 0 ? "atc-trigger-on" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <FolderPlus size={18} aria-hidden="true" />
        {savedCount > 0 ? `In ${savedCount} ${savedCount === 1 ? "collection" : "collections"}` : "Add to collection"}
      </button>

      {open && (
        <div className="atc-pop" role="dialog" aria-label="Add to collection">
          {loading ? (
            <p className="atc-status">
              <Loader2 size={14} className="atc-spin" aria-hidden="true" />
              Loading…
            </p>
          ) : (
            <>
              {collections.length > 0 && (
                <ul className="atc-list">
                  {collections.map((collection) => (
                    <li key={collection.id}>
                      <button
                        type="button"
                        className="atc-row"
                        onClick={() => toggleMembership(collection)}
                        disabled={busyId === collection.id}
                        aria-pressed={collection.hasPattern}
                      >
                        <span
                          className={`atc-check ${collection.hasPattern ? "atc-check-on" : ""}`}
                          aria-hidden="true"
                        >
                          {collection.hasPattern && <Check size={12} />}
                        </span>
                        <span className="atc-row-name">{collection.name}</span>
                        <span className="atc-row-count">{collection.patternCount}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <form className="atc-new" onSubmit={handleCreate}>
                <input
                  className="atc-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New collection…"
                  maxLength={120}
                  disabled={creating}
                  aria-label="New collection name"
                />
                <button
                  type="submit"
                  className="atc-new-btn"
                  disabled={creating || !newName.trim()}
                  aria-label="Create collection and add this pattern"
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </form>

              {error && (
                <p className="atc-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
