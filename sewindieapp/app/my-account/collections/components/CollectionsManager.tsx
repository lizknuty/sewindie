"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, Globe, Lock, Trash2, Pencil, X } from "lucide-react"
import CollectionCard from "@/components/CollectionCard"

type Collection = {
  id: number
  name: string
  description: string | null
  visibility: "PUBLIC" | "PRIVATE"
  patternCount: number
  previews: { id: number; name: string; thumbnail_url: string | null }[]
}

export default function CollectionsManager({
  initialCollections,
}: {
  initialCollections: Collection[]
}) {
  const [collections, setCollections] = useState(initialCollections)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tracks the row being edited or deleted so only that row's buttons disable.
  const [busyId, setBusyId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState("")

  const resetCreateForm = () => {
    setName("")
    setDescription("")
    setIsPublic(false)
    setError(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Give your collection a name.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          visibility: isPublic ? "PUBLIC" : "PRIVATE",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not create collection")

      setCollections((prev) => [
        { ...data.collection, description: data.collection.description ?? null, previews: [] },
        ...prev,
      ])
      resetCreateForm()
      setCreating(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create collection")
    } finally {
      setSaving(false)
    }
  }

  const patchCollection = async (id: number, body: Record<string, unknown>) => {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not save changes")
      setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, ...body } : c)))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes")
      return false
    } finally {
      setBusyId(null)
    }
  }

  const handleToggleVisibility = (collection: Collection) =>
    patchCollection(collection.id, {
      visibility: collection.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC",
    })

  const handleRename = async (id: number) => {
    if (!editName.trim()) return
    const ok = await patchCollection(id, { name: editName.trim() })
    if (ok) setEditingId(null)
  }

  const handleDelete = async (collection: Collection) => {
    const confirmed = window.confirm(
      `Delete "${collection.name}"? The patterns inside stay in the library — only the collection is removed.`,
    )
    if (!confirmed) return

    setBusyId(collection.id)
    setError(null)
    try {
      const res = await fetch(`/api/collections/${collection.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Could not delete collection")
      }
      setCollections((prev) => prev.filter((c) => c.id !== collection.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete collection")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="cmgr">
      <div className="cmgr-bar">
        {creating ? (
          <button type="button" className="account-btn account-btn-quiet" onClick={() => { setCreating(false); resetCreateForm() }}>
            <X size={16} aria-hidden="true" />
            Cancel
          </button>
        ) : (
          <button type="button" className="account-btn" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            New collection
          </button>
        )}
      </div>

      {creating && (
        <form className="account-form cmgr-form" onSubmit={handleCreate}>
          <div className="account-field">
            <label className="account-label" htmlFor="collection-name">
              Name
            </label>
            <input
              id="collection-name"
              className="account-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Summer capsule"
              disabled={saving}
              autoFocus
            />
          </div>

          <div className="account-field">
            <label className="account-label" htmlFor="collection-desc">
              Description <span className="cmgr-optional">(optional)</span>
            </label>
            <input
              id="collection-desc"
              className="account-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Linen separates I want to make this year"
              disabled={saving}
            />
          </div>

          <label className="cmgr-check">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={saving}
            />
            <span>
              Make this collection public
              <span className="account-help">
                Public collections show up on the designer pages of the patterns inside them.
              </span>
            </span>
          </label>

          <button type="submit" className="account-btn" disabled={saving}>
            {saving ? "Creating…" : "Create collection"}
          </button>
        </form>
      )}

      {error && (
        <p className="cmgr-error" role="alert">
          {error}
        </p>
      )}

      {collections.length === 0 ? (
        <div className="account-empty">
          <p className="account-empty-title">No collections yet</p>
          <p className="account-empty-text">
            Collections are your own groupings of patterns. Make one here, then use “Add to
            collection” on any pattern page.
          </p>
          <Link href="/patterns" className="account-btn account-empty-cta">
            Browse patterns
          </Link>
        </div>
      ) : (
        <div className="ccard-grid">
          {collections.map((collection) => (
            <div key={collection.id} className="cmgr-item">
              {editingId === collection.id ? (
                <div className="cmgr-rename">
                  <label className="account-label" htmlFor={`rename-${collection.id}`}>
                    Collection name
                  </label>
                  <input
                    id={`rename-${collection.id}`}
                    className="account-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={120}
                    disabled={busyId === collection.id}
                    autoFocus
                  />
                  <div className="cmgr-rename-actions">
                    <button
                      type="button"
                      className="account-btn"
                      onClick={() => handleRename(collection.id)}
                      disabled={busyId === collection.id}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="account-btn account-btn-quiet"
                      onClick={() => setEditingId(null)}
                      disabled={busyId === collection.id}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <CollectionCard
                  id={collection.id}
                  name={collection.name}
                  description={collection.description}
                  visibility={collection.visibility}
                  patternCount={collection.patternCount}
                  previews={collection.previews}
                  showVisibility
                />
              )}

              <div className="cmgr-actions">
                <button
                  type="button"
                  className="cmgr-action"
                  onClick={() => handleToggleVisibility(collection)}
                  disabled={busyId === collection.id}
                >
                  {collection.visibility === "PUBLIC" ? (
                    <>
                      <Lock size={14} aria-hidden="true" />
                      Make private
                    </>
                  ) : (
                    <>
                      <Globe size={14} aria-hidden="true" />
                      Make public
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="cmgr-action"
                  onClick={() => {
                    setEditingId(collection.id)
                    setEditName(collection.name)
                  }}
                  disabled={busyId === collection.id}
                >
                  <Pencil size={14} aria-hidden="true" />
                  Rename
                </button>

                <button
                  type="button"
                  className="cmgr-action cmgr-action-danger"
                  onClick={() => handleDelete(collection)}
                  disabled={busyId === collection.id}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
