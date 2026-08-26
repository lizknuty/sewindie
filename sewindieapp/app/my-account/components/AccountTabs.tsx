"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/my-account", label: "Profile" },
  { href: "/my-account/favorites", label: "Favorites" },
  { href: "/my-account/collections", label: "Collections" },
  { href: "/my-account/ratings", label: "Ratings" },
  { href: "/my-account/change-password", label: "Password" },
]

export default function AccountTabs() {
  const pathname = usePathname()

  return (
    <nav className="account-tabs" aria-label="Account sections">
      {TABS.map((tab) => {
        // Exact match only. A `startsWith` test would light up Profile on every
        // sub-page, since "/my-account" prefixes all of them.
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`account-tab${isActive ? " account-tab-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
