"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Tag,
  Shapes,
  Palette,
  Type,
  Scissors,
  FileText,
  BarChart2,
  Heart,
  Star,
  LogOut,
  BookUser,
  FactoryIcon as Fabric,
} from "lucide-react"
import { signOut } from "next-auth/react"
import type { Session } from "next-auth"

interface AdminSidebarProps {
  user: Session["user"]
}

const AdminSidebar = ({ user }: AdminSidebarProps) => {
  const pathname = usePathname()

  const menuItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/patterns", label: "Patterns", icon: Scissors },
    { href: "/admin/designers", label: "Designers", icon: BookUser },
    { href: "/admin/categories", label: "Categories", icon: Tag },
    { href: "/admin/attributes", label: "Attributes", icon: Shapes },
    { href: "/admin/fabric-types", label: "Fabric Types", icon: Fabric },
    { href: "/admin/suggested-fabrics", label: "Suggested Fabrics", icon: Palette },
    { href: "/admin/formats", label: "Formats", icon: Type },
    { href: "/admin/audiences", label: "Audiences", icon: Users },
    { href: "/admin/contributions", label: "Contributions", icon: FileText },
    {
      label: "Analytics",
      icon: BarChart2,
      subItems: [
        { href: "/admin/analytics/favorites", label: "Favorites", icon: Heart },
        { href: "/admin/analytics/ratings", label: "Ratings", icon: Star },
      ],
    },
  ]

  return (
    <div className="sidebar-container">
      <div className="sidebar-header">
        <h5 className="sidebar-username">Admin Panel</h5>
      </div>
      <ul className="sidebar-menu">
        {menuItems.map((item) =>
          item.subItems ? (
            <li key={item.label} className="sidebar-item">
              <div className="sidebar-link">
                <item.icon className="sidebar-icon" />
                <span>{item.label}</span>
              </div>
              <ul className="sidebar-submenu">
                {item.subItems.map((subItem) => (
                  <li key={subItem.href} className={`sidebar-subitem ${pathname === subItem.href ? "active" : ""}`}>
                    <Link href={subItem.href} className="sidebar-sublink">
                      <subItem.icon className="sidebar-icon" />
                      <span>{subItem.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ) : (
            <li key={item.href} className={`sidebar-item ${pathname === item.href ? "active" : ""}`}>
              <Link href={item.href!} className="sidebar-link">
                <item.icon className="sidebar-icon" />
                <span>{item.label}</span>
              </Link>
            </li>
          ),
        )}
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

export default AdminSidebar
