"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, Heart, Star, Lock, LogOut } from "lucide-react"
import { signOut } from "next-auth/react"
import type { Session } from "next-auth"

interface AccountSidebarProps {
  user: Session["user"]
}

const AccountSidebar = ({ user }: AccountSidebarProps) => {
  const pathname = usePathname()

  const menuItems = [
    { href: "/my-account", label: "My Profile", icon: User },
    { href: "/my-account/favorites", label: "My Favorites", icon: Heart },
    { href: "/my-account/ratings", label: "My Ratings", icon: Star },
    { href: "/my-account/change-password", label: "Change Password", icon: Lock },
  ]

  return (
    <div className="sidebar-container">
      <div className="sidebar-header">
        <div className="sidebar-avatar">
          {user.image ? (
            <img
              src={user.image || "/placeholder.svg"}
              alt={user.name || "User avatar"}
              className="rounded-circle"
              width="40"
              height="40"
            />
          ) : (
            <User size={40} />
          )}
        </div>
        <h5 className="sidebar-username">{user.name}</h5>
        <p className="sidebar-user-email">{user.email}</p>
      </div>
      <ul className="sidebar-menu">
        {menuItems.map((item) => (
          <li key={item.href} className={`sidebar-item ${pathname === item.href ? "active" : ""}`}>
            <Link href={item.href} className="sidebar-link">
              <item.icon className="sidebar-icon" />
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="sidebar-footer">
        <button onClick={() => signOut({ callbackUrl: "/" })} className="sidebar-link logout-button">
          <LogOut className="sidebar-icon" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}

export default AccountSidebar
