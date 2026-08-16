"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import type { Session } from "next-auth"
import {
  LayoutDashboard,
  Users,
  Palette,
  Scissors,
  Tag,
  SlidersHorizontal,
  Layers,
  FileType,
  Ruler,
  Sprout,
  FileText,
  UsersRound,
  Shirt,
  BarChart3,
  ChevronDown,
  LogOut,
  type LucideIcon,
} from "lucide-react"

interface AdminSidebarProps {
  user: Session["user"]
}

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  roles: string[]
}

type NavGroup = {
  label?: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "MODERATOR"] }],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/users", label: "Users", icon: Users, roles: ["ADMIN"] },
      { href: "/admin/designers", label: "Designers", icon: Palette, roles: ["ADMIN", "MODERATOR"] },
      { href: "/admin/patterns", label: "Patterns", icon: Scissors, roles: ["ADMIN", "MODERATOR"] },
      { href: "/admin/categories", label: "Categories", icon: Tag, roles: ["ADMIN"] },
      { href: "/admin/attributes", label: "Attributes", icon: SlidersHorizontal, roles: ["ADMIN"] },
      { href: "/admin/fabric-types", label: "Fabric Types", icon: Layers, roles: ["ADMIN"] },
      { href: "/admin/suggested-fabrics", label: "Suggested Fabrics", icon: Shirt, roles: ["ADMIN"] },
      { href: "/admin/formats", label: "Formats", icon: FileType, roles: ["ADMIN"] },
      { href: "/admin/size-charts", label: "Size Charts", icon: Ruler, roles: ["ADMIN", "MODERATOR"] },
      { href: "/admin/contributions", label: "Contributions", icon: Sprout, roles: ["ADMIN", "MODERATOR"] },
      { href: "/admin/blog", label: "Blog Posts", icon: FileText, roles: ["ADMIN", "MODERATOR"] },
      { href: "/admin/audiences", label: "Audiences", icon: UsersRound, roles: ["ADMIN"] },
    ],
  },
  {
    label: "Analytics",
    items: [{ href: "/admin/analytics", label: "Analytics", icon: BarChart3, roles: ["ADMIN"] }],
  },
]

function initials(name?: string | null) {
  if (!name) return "U"
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")
}

const AdminSidebar = ({ user }: AdminSidebarProps) => {
  const pathname = usePathname()
  const userRole = user?.role?.toUpperCase()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href))

  return (
    <div className="admin-sidebar">
      <Link href="/" className="admin-brand">
        <span className="admin-brand-mark">SewIndie</span>
        <span className="admin-brand-tag">Admin</span>
      </Link>

      <nav className="admin-nav">
        {NAV_GROUPS.map((group, gi) => {
          const visible = group.items.filter((item) => userRole && item.roles.includes(userRole))
          if (visible.length === 0) return null
          return (
            <div className="admin-nav-group" key={group.label ?? `group-${gi}`}>
              {group.label && <p className="admin-nav-group-label">{group.label}</p>}
              <ul className="admin-nav-list">
                {visible.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link href={item.href} className={`admin-nav-link ${isActive(item.href) ? "active" : ""}`}>
                        <Icon size={17} strokeWidth={1.75} className="admin-nav-icon" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <button type="button" className="admin-profile" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}>
          <span className="admin-profile-avatar">{initials(user?.name).toUpperCase()}</span>
          <span className="admin-profile-meta">
            <span className="admin-profile-name">{user?.name || "User"}</span>
            <span className="admin-profile-role">{userRole === "ADMIN" ? "Administrator" : "Moderator"}</span>
          </span>
          <ChevronDown size={16} strokeWidth={2} className={`admin-profile-caret ${menuOpen ? "open" : ""}`} />
        </button>

        {menuOpen && (
          <div className="admin-profile-menu">
            <Link href="/my-account" className="admin-profile-menu-item" onClick={() => setMenuOpen(false)}>
              My Account
            </Link>
            <button type="button" className="admin-profile-menu-item" onClick={() => signOut()}>
              <LogOut size={15} strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminSidebar
