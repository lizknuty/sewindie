"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import type { Session } from "next-auth"
import { ChevronDown, Heart, LayoutDashboard, LogOut, Star, User } from "lucide-react"

/** Same initial-derivation as the admin sidebar, so the avatar reads identically. */
function initials(name?: string | null) {
  if (!name) return "U"
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

export default function AccountMenu({ user }: { user: Session["user"] }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // The admin layout grants access to ADMIN and MODERATOR alike, so the
  // dashboard link must use the same test — gating on ADMIN only would hide a
  // page moderators can actually reach.
  const role = user?.role?.toUpperCase()
  const canSeeAdmin = role === "ADMIN" || role === "MODERATOR"

  // Close when navigating, so the panel never lingers over the new page.
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div className="site-account" ref={wrapRef}>
      <button
        type="button"
        className="site-account-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${user?.name || "your account"}`}
      >
        <span className="site-account-avatar" aria-hidden="true">
          {initials(user?.name)}
        </span>
        <ChevronDown size={15} strokeWidth={2} className={`site-account-caret ${open ? "open" : ""}`} />
      </button>

      {open && (
        <div className="site-account-menu" role="menu">
          <div className="site-account-menu-head">
            <span className="site-account-menu-name">{user?.name || "Your account"}</span>
            {user?.email && <span className="site-account-menu-email">{user.email}</span>}
          </div>

          <Link href="/my-account" className="site-account-menu-item" role="menuitem">
            <User size={15} strokeWidth={1.75} />
            Profile
          </Link>
          <Link href="/my-account/favorites" className="site-account-menu-item" role="menuitem">
            <Heart size={15} strokeWidth={1.75} />
            My Favorites
          </Link>
          <Link href="/my-account/ratings" className="site-account-menu-item" role="menuitem">
            <Star size={15} strokeWidth={1.75} />
            My Ratings
          </Link>

          {canSeeAdmin && (
            <Link href="/admin" className="site-account-menu-item" role="menuitem">
              <LayoutDashboard size={15} strokeWidth={1.75} />
              Admin Dashboard
            </Link>
          )}

          <div className="site-account-menu-sep" role="none" />

          <button
            type="button"
            className="site-account-menu-item"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut size={15} strokeWidth={1.75} />
            Log Out
          </button>
        </div>
      )}
    </div>
  )
}
