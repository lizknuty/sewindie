"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Session } from "next-auth"
import { signOut } from "next-auth/react"

interface AccountSidebarProps {
  user: Session["user"]
}

const AccountSidebar = ({ user }: AccountSidebarProps) => {
  const pathname = usePathname()

  const navItems = [
    { href: "/my-account", label: "Profile" },
    { href: "/my-account/favorites", label: "My Favorites" },
    { href: "/my-account/ratings", label: "My Ratings" },
    { href: "/my-account/change-password", label: "Change Password" },
  ]

  return (
    <div className="sidebar-container d-flex flex-column p-3">
      <Link href="/" className="sidebar-brand d-flex align-items-center mb-3 mb-md-0 me-md-auto text-decoration-none">
        <span className="fs-4">My Account</span>
      </Link>
      <hr />
      <ul className="nav nav-pills flex-column mb-auto">
        {navItems.map((item) => (
          <li className="nav-item" key={item.href}>
            <Link href={item.href} className={`nav-link ${pathname === item.href ? "active" : ""}`}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <hr />
      <div className="dropdown">
        <a
          href="#"
          className="d-flex align-items-center text-white text-decoration-none dropdown-toggle"
          id="dropdownUser2"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          <strong>{user?.name || "User"}</strong>
        </a>
        <ul className="dropdown-menu dropdown-menu-dark text-small shadow" aria-labelledby="dropdownUser2">
          <li>
            <button className="dropdown-item" onClick={() => signOut()}>
              Sign out
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default AccountSidebar
