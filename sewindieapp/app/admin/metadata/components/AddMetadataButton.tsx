"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Plus, ChevronDown } from "lucide-react"
import { METADATA_TABS, type MetadataTab } from "../config"

export default function AddMetadataButton({ activeTab }: { activeTab: MetadataTab }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
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

  return (
    <div className="metadata-add" ref={wrapRef}>
      <Link href={`${activeTab.basePath}/new`} className="btn-add-pattern metadata-add-main">
        <Plus size={18} />
        Add {activeTab.singular}
      </Link>
      <button
        type="button"
        className="btn-add-pattern metadata-add-caret"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Add another metadata type"
      >
        <ChevronDown size={16} className={open ? "is-open" : ""} />
      </button>

      {open && (
        <div className="metadata-add-menu" role="menu">
          {METADATA_TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <Link
                key={tab.key}
                href={`${tab.basePath}/new`}
                className="metadata-add-menu-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <Icon size={15} strokeWidth={1.75} />
                {tab.singular}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
