"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Heart, Star, User, Key, LogOut } from "lucide-react"
import { signOut } from "next-auth/react"

interface AccountSidebarProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export default function AccountSidebar({ user }: AccountSidebarProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + "/")
  }

  return (
    <div
      className="d-flex flex-column flex-shrink-0 p-3 text-white sidebar-container"
      style={{ height: "100vh", backgroundColor: "var(--color-muted)" }}
    >
      <Link
        href="/my-account"
        className="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-white text-decoration-none"
      >
        <span className="fs-4">My Account</span>
      </Link>
      <hr />
      <ul className="nav nav-pills flex-column mb-auto">
        <li className="nav-item">
          <Link
            href="/my-account"
            className={`nav-link ${isActive("/my-account") && pathname === "/my-account" ? "active" : ""}`}
          >
            <User className="me-2" size={18} />
            Profile
          </Link>
        </li>
        <li>
          <Link
            href="/my-account/favorites"
            className={`nav-link ${isActive("/my-account/favorites") ? "active" : ""}`}
          >
            <Heart className="me-2" size={18} />
            Favorites
          </Link>
        </li>
        <li>
          <Link href="/my-account/ratings" className={`nav-link ${isActive("/my-account/ratings") ? "active" : ""}`}>
            <Star className="me-2" size={18} />
            Ratings
          </Link>
        </li>
        <li>
          <Link
            href="/my-account/change-password"
            className={`nav-link ${isActive("/my-account/change-password") ? "active" : ""}`}
          >
            <Key className="me-2" size={18} />
            Change Password
          </Link>
        </li>
      </ul>
      <hr />
      <div className="d-flex align-items-center mb-3">
        <span className="text-white">{user.name || user.email}</span>
      </div>
      <button onClick={() => signOut({ callbackUrl: "/" })} className="btn btn-primary d-flex align-items-center">
        <LogOut className="me-2" size={18} />
        Sign out
      </button>
    </div>
  )
}
