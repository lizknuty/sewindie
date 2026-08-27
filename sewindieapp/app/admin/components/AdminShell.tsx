"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"

/**
 * Admin layout shell that owns the mobile sidebar's open/closed state.
 *
 * This replaces the previous SidebarToggle, which reached for the sidebar with
 * document.getElementById and toggled classes by hand. That approach failed
 * silently for three separate reasons, all of which disappear when React owns
 * the state instead:
 *
 *  1. It bailed out unless BOTH the sidebar and an `#admin-sidebar-backdrop`
 *     element existed -- and no backdrop was ever rendered, so the guard was
 *     always false and the body never ran.
 *  2. It added a `.show` class, but the stylesheet only styles
 *     `.sidebar-column.open`, so even a successful toggle moved nothing.
 *  3. It fired the same toggle from onClick, onTouchEnd AND onPointerUp, so a
 *     single tap ran it repeatedly.
 *
 * Because the open state now drives className directly, the markup and the
 * stylesheet cannot drift apart again the way (1) and (2) did.
 */
export default function AdminShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Tapping a nav link navigates without unmounting this shell, so the drawer
  // would otherwise stay open over the page the user just asked for.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Lock background scrolling while the drawer covers the page. Restoring the
  // previous value rather than "" avoids clobbering a lock set by something
  // else (e.g. an admin modal open underneath).
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  // Above 768px the drawer CSS no longer applies and the toggle is hidden, so a
  // drawer left open while rotating to landscape would strand the scroll lock
  // with no visible control to release it.
  useEffect(() => {
    if (!open) return
    const onResize = () => {
      if (window.innerWidth >= 768) setOpen(false)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [open])

  return (
    <div className="layout-container admin-shell">
      <div id="admin-sidebar" className={`sidebar-column${open ? " open" : ""}`}>
        {/* The drawer covers the header's toggle when open, so it needs its own
            close affordance -- backdrop-tap and Escape alone leave no visible
            way out on a touch device. */}
        {open && (
          <button
            type="button"
            className="admin-sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={22} strokeWidth={2} />
          </button>
        )}
        {sidebar}
      </div>

      {/* Rendered only while open so it can never sit over the page and swallow
          clicks when closed. */}
      {open && (
        <div className="admin-sidebar-backdrop" role="presentation" onClick={() => setOpen(false)} />
      )}

      <div className="content-wrapper">
        <header className="content-header">
          <button
            type="button"
            className="admin-sidebar-toggle"
            // Click alone: it fires for taps, mouse and keyboard activation.
            // Adding touch/pointer handlers re-creates the multi-fire bug.
            onClick={() => setOpen((previous) => !previous)}
            aria-label="Open navigation menu"
            aria-expanded={open}
            aria-controls="admin-sidebar"
          >
            {/* Always the menu icon: while open this button is behind the
                backdrop, so an X here would be an unreachable close control.
                Closing is handled inside the drawer. */}
            <Menu size={24} strokeWidth={2} />
          </button>
        </header>
        <main className="content-main">{children}</main>
      </div>
    </div>
  )
}
