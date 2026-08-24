"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import Image from "next/image"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Plus, Search, X } from "lucide-react"

export type CurationItem = {
  id: number
  name: string
  imageUrl: string | null
  subtitle?: string | null
}

type Props = {
  kind: "designer" | "pattern"
  title: string
  description: string
  /** How many items the homepage rail loads in total — the real slot count. */
  totalSlots: number
  /**
   * How many are on screen at once, when that differs from `totalSlots`. The
   * designer rail is a scroller showing 6 of its 10, so picks past the 6th are
   * flagged as needing an arrow press. Omitted for the pattern grid, which
   * renders all of its slots at once.
   */
  visibleSlots?: number
  initialItems: CurationItem[]
}

function Thumb({ item, kind }: { item: CurationItem; kind: Props["kind"] }) {
  const [failed, setFailed] = useState(false)
  const initials = item.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()

  // Same fallback rationale as the public rail: logos are hotlinked from each
  // designer's own CDN and some are hotlink-protected or missing.
  if (!item.imageUrl || failed) {
    return <span className="curation-thumb curation-thumb-fallback">{initials}</span>
  }

  return (
    <span className={`curation-thumb${kind === "designer" ? " curation-thumb-round" : ""}`}>
      <Image
        src={item.imageUrl}
        alt=""
        fill
        sizes="48px"
        className="curation-thumb-img"
        onError={() => setFailed(true)}
      />
    </span>
  )
}

function SortableRow({
  item,
  index,
  kind,
  visibleSlots,
  onRemove,
}: {
  item: CurationItem
  index: number
  kind: Props["kind"]
  visibleSlots?: number
  onRemove: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`curation-row${isDragging ? " is-dragging" : ""}`}
    >
      <button
        type="button"
        className="curation-grip"
        aria-label={`Reorder ${item.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <span className="curation-position" aria-hidden="true">
        {index + 1}
      </span>
      <Thumb item={item} kind={kind} />
      <span className="curation-row-text">
        <span className="curation-row-name">{item.name}</span>
        {item.subtitle ? <span className="curation-row-sub">{item.subtitle}</span> : null}
      </span>
      {visibleSlots !== undefined && index >= visibleSlots ? (
        <span className="curation-overflow-tag" title="Reachable with the rail arrows">
          Scroll
        </span>
      ) : null}
      <button
        type="button"
        className="curation-remove"
        onClick={() => onRemove(item.id)}
        aria-label={`Unpin ${item.name}`}
      >
        <X size={15} aria-hidden="true" />
      </button>
    </li>
  )
}

export default function CurationRail({
  kind,
  title,
  description,
  totalSlots,
  visibleSlots,
  initialItems,
}: Props) {
  const [items, setItems] = useState<CurationItem[]>(initialItems)
  const [saved, setSaved] = useState<CurationItem[]>(initialItems)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CurationItem[]>([])
  const [searching, setSearching] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const searchId = useId()
  const pickerRef = useRef<HTMLDivElement>(null)

  const dirty = useMemo(
    () =>
      items.length !== saved.length ||
      items.some((item, index) => item.id !== saved[index]?.id),
    [items, saved],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Debounced typeahead. Runs only while the picker is open so closing it
  // cancels any in-flight lookup.
  useEffect(() => {
    if (!pickerOpen) return
    let active = true
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/homepage/search?kind=${kind}&q=${encodeURIComponent(query)}`,
        )
        if (!res.ok) throw new Error("Search failed")
        const data = (await res.json()) as { results: CurationItem[] }
        if (active) setResults(data.results)
      } catch {
        if (active) setResults([])
      } finally {
        if (active) setSearching(false)
      }
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, kind, pickerOpen])

  // Close the picker on outside click / Escape.
  useEffect(() => {
    if (!pickerOpen) return
    const onDown = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [pickerOpen])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems((current) => {
      const from = current.findIndex((item) => item.id === active.id)
      const to = current.findIndex((item) => item.id === over.id)
      if (from === -1 || to === -1) return current
      return arrayMove(current, from, to)
    })
    setStatus("idle")
  }

  function addItem(item: CurationItem) {
    setItems((current) => (current.some((row) => row.id === item.id) ? current : [...current, item]))
    setStatus("idle")
    setQuery("")
    setPickerOpen(false)
  }

  function removeItem(id: number) {
    setItems((current) => current.filter((item) => item.id !== id))
    setStatus("idle")
  }

  async function save() {
    setStatus("saving")
    setError(null)
    try {
      const res = await fetch("/api/admin/homepage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ids: items.map((item) => item.id) }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "Could not save changes")
      }
      setSaved(items)
      setStatus("saved")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Could not save changes")
    }
  }

  const alreadyPinned = new Set(items.map((item) => item.id))

  return (
    <section className="curation-card">
      <header className="curation-card-head">
        <div>
          <h2 className="curation-card-title">{title}</h2>
          <p className="curation-card-desc">{description}</p>
        </div>
        <div className="curation-actions">
          <div className="curation-picker-wrap" ref={pickerRef}>
            <button
              type="button"
              className="curation-btn"
              onClick={() => setPickerOpen((open) => !open)}
              aria-expanded={pickerOpen}
              aria-controls={searchId}
            >
              <Plus size={15} aria-hidden="true" />
              Add
            </button>
            {pickerOpen ? (
              <div className="curation-picker" id={searchId}>
                <div className="curation-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={`Search ${kind}s`}
                    aria-label={`Search ${kind}s to pin`}
                    className="curation-search-input"
                    autoFocus
                  />
                </div>
                <ul className="curation-results">
                  {searching ? (
                    <li className="curation-result-empty">Searching…</li>
                  ) : results.length === 0 ? (
                    <li className="curation-result-empty">No matches</li>
                  ) : (
                    results.map((result) => {
                      const pinned = alreadyPinned.has(result.id)
                      return (
                        <li key={result.id}>
                          <button
                            type="button"
                            className="curation-result"
                            onClick={() => addItem(result)}
                            disabled={pinned}
                          >
                            <Thumb item={result} kind={kind} />
                            <span className="curation-row-text">
                              <span className="curation-row-name">{result.name}</span>
                              {result.subtitle ? (
                                <span className="curation-row-sub">{result.subtitle}</span>
                              ) : null}
                            </span>
                            {pinned ? <span className="curation-pinned-tag">Pinned</span> : null}
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="curation-btn curation-btn-primary"
            onClick={save}
            disabled={!dirty || status === "saving"}
          >
            {status === "saving" ? "Saving…" : "Save order"}
          </button>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="curation-empty">
          Nothing pinned. The rail is filling all {totalSlots} slots automatically —
          {kind === "designer" ? " designers with the most patterns" : " the newest patterns"} come
          first.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <ol className="curation-list">
              {items.map((item, index) => (
                <SortableRow
                  key={item.id}
                  item={item}
                  index={index}
                  kind={kind}
                  visibleSlots={visibleSlots}
                  onRemove={removeItem}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <footer className="curation-foot">
        <p className="curation-hint" role="status">
          {status === "saved" && !dirty
            ? "Saved. The homepage is updated."
            : status === "error"
              ? error
              : items.length > 0
                ? `${Math.min(items.length, totalSlots)} of ${totalSlots} slots pinned${
                    items.length < totalSlots
                      ? ` — the remaining ${totalSlots - items.length} fill automatically.`
                      : items.length > totalSlots
                        ? ` — ${items.length - totalSlots} past the end of the rail won't show.`
                        : "."
                  }`
                : ""}
        </p>
      </footer>
    </section>
  )
}
