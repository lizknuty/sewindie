"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Menu, X } from "lucide-react"
import AccountMenu from "./AccountMenu"

const NAV_LINKS = [
  { href: "/designers", label: "Designers" },
  { href: "/patterns", label: "Patterns" },
  { href: "/contribute", label: "Contribute" },
]

export default function Navbar() {
  const { data: session, status } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Collapse the mobile panel on navigation.
  useEffect(() => setMobileOpen(false), [pathname])

  return (
    <nav className="site-header" aria-label="Main navigation">
      <div className="container site-header-inner">
        <Link href="/" className="site-brand">
          <Image src="/logo.png" alt="" width={36} height={36} aria-hidden="true" />
          <span className="site-brand-name">SewIndie</span>
        </Link>

        <button
          type="button"
          className="site-nav-toggle"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-controls="site-nav-panel"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X size={22} strokeWidth={1.75} /> : <Menu size={22} strokeWidth={1.75} />}
        </button>

        <div id="site-nav-panel" className={`site-nav ${mobileOpen ? "is-open" : ""}`}>
          <ul className="site-nav-links">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`site-nav-link ${pathname.startsWith(link.href) ? "is-current" : ""}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="site-nav-auth">
            {/* `status` gates this so the logged-out buttons don't flash for a
                signed-in user while the session is still resolving. */}
            {status === "loading" ? (
              <span className="site-account-placeholder" aria-hidden="true" />
            ) : session ? (
              <AccountMenu user={session.user} />
            ) : (
              <>
                <Link href="/login" className="site-btn site-btn-light">
                  Log In
                </Link>
                <Link href="/create-account" className="site-btn site-btn-dark">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
