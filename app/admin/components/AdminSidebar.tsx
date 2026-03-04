"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect } from "react"
import {
  Users,
  FileText,
  Tag,
  Palette,
  Grid3X3,
  Target,
  Shirt,
  BarChart3,
  Star,
  TrendingUp,
  Upload,
  Ruler,
  User,
} from "lucide-react"
import "@/app/styles/sidebar.css"

const menuItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/patterns", label: "Patterns", icon: FileText },
  { href: "/admin/designers", label: "Designers", icon: User },
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/attributes", label: "Attributes", icon: Palette },
  { href: "/admin/formats", label: "Formats", icon: Grid3X3 },
  { href: "/admin/audiences", label: "Audiences", icon: Target },
  { href: "/admin/fabric-types", label: "Fabric Types", icon: Shirt },
  { href: "/admin/suggested-fabrics", label: "Suggested Fabrics", icon: Palette },
  { href: "/admin/size-charts", label: "Size Charts", icon: Ruler },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/contributions", label: "Contributions", icon: Upload },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/analytics/favorites", label: "Favorites Analytics", icon: Star },
  { href: "/admin/analytics/ratings", label: "Ratings Analytics", icon: TrendingUp },
  { href: "/admin/ratings", label: "Ratings", icon: Star },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  useEffect(() => {
    const handleBackdropClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.id === "admin-sidebar-backdrop") {
        const sidebar = document.getElementById("admin-sidebar")
        const backdrop = document.getElementById("admin-sidebar-backdrop")

        if (sidebar && backdrop) {
          sidebar.classList.remove("show")
          backdrop.classList.remove("show")
          document.body.style.overflow = ""
        }
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      const sidebar = document.getElementById("admin-sidebar")
      const backdrop = document.getElementById("admin-sidebar-backdrop")
      const target = e.target as HTMLElement

      if (sidebar && backdrop && sidebar.classList.contains("show")) {
        if (!sidebar.contains(target) && !target.closest("[data-sidebar-toggle]")) {
          sidebar.classList.remove("show")
          backdrop.classList.remove("show")
          document.body.style.overflow = ""
        }
      }
    }

    document.addEventListener("click", handleBackdropClick)
    document.addEventListener("click", handleClickOutside)

    return () => {
      document.removeEventListener("click", handleBackdropClick)
      document.removeEventListener("click", handleClickOutside)
    }
  }, [])

  return (
    <>
      {/* Mobile backdrop */}
      <div id="admin-sidebar-backdrop" className="sidebar-backdrop" />

      {/* Sidebar */}
      <div id="admin-sidebar" className="admin-sidebar">
        <div className="sidebar-header">
          <h4>Admin Panel</h4>
        </div>
        <nav className="sidebar-nav">
          <ul className="nav flex-column">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <li key={item.href} className="nav-item">
                  <Link href={item.href} className={`nav-link d-flex align-items-center ${isActive ? "active" : ""}`}>
                    <Icon size={18} className="me-2" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </>
  )
}
