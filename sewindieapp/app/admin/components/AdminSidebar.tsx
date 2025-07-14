"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Users,
  UserPlus,
  Scissors,
  Tag,
  PodcastIcon as Audience,
  Layers,
  FactoryIcon as Fabric,
  CheckSquare,
  Settings,
  LogOut,
  FileText,
  BarChart,
  BookOpen,
  Star,
} from "lucide-react"
import { signOut } from "next-auth/react"

interface AdminSidebarProps {
  userRole: string
}

export default function AdminSidebar({ userRole }: AdminSidebarProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + "/")
  }

  const isAdmin = userRole === "ADMIN"

  return (
    <div
      className="d-flex flex-column flex-shrink-0 p-3 text-white sidebar-container"
      style={{
        height: "100%",
        minHeight: "100vh",
        backgroundColor: "var(--color-muted)",
        position: "sticky",
        top: 0,
      }}
    >
      <Link href="/admin" className="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-white text-decoration-none">
        <span className="fs-4">SewIndie Admin</span>
      </Link>
      <hr />
      <ul className="nav nav-pills flex-column mb-auto">
        <li className="nav-item">
          <Link href="/admin" className={`nav-link ${isActive("/admin") && pathname === "/admin" ? "active" : ""}`}>
            <Home className="me-2" size={18} />
            Dashboard
          </Link>
        </li>
        {isAdmin && (
          <li>
            <Link href="/admin/users" className={`nav-link ${isActive("/admin/users") ? "active" : ""}`}>
              <UserPlus className="me-2" size={18} />
              Users
            </Link>
          </li>
        )}
        <li>
          <Link href="/admin/designers" className={`nav-link ${isActive("/admin/designers") ? "active" : ""}`}>
            <Users className="me-2" size={18} />
            Designers
          </Link>
        </li>
        <li>
          <Link href="/admin/patterns" className={`nav-link ${isActive("/admin/patterns") ? "active" : ""}`}>
            <Scissors className="me-2" size={18} />
            Patterns
          </Link>
        </li>
        <li>
          <Link href="/admin/contributions" className={`nav-link ${isActive("/admin/contributions") ? "active" : ""}`}>
            <FileText className="me-2" size={18} />
            Contributions
          </Link>
        </li>
        <li>
          <Link href="/admin/analytics" className={`nav-link ${isActive("/admin/analytics") ? "active" : ""}`}>
            <BarChart className="me-2" size={18} />
            Analytics
          </Link>
        </li>
        <li>
          <Link href="/admin/ratings" className={`nav-link ${isActive("/admin/ratings") ? "active" : ""}`}>
            <Star className="me-2" size={18} />
            Ratings
          </Link>
        </li>
        <li>
          <Link href="/admin/categories" className={`nav-link ${isActive("/admin/categories") ? "active" : ""}`}>
            <Tag className="me-2" size={18} />
            Categories
          </Link>
        </li>
        <li>
          <Link href="/admin/audiences" className={`nav-link ${isActive("/admin/audiences") ? "active" : ""}`}>
            <Audience className="me-2" size={18} />
            Audiences
          </Link>
        </li>
        <li>
          <Link href="/admin/fabric-types" className={`nav-link ${isActive("/admin/fabric-types") ? "active" : ""}`}>
            <Layers className="me-2" size={18} />
            Fabric Types
          </Link>
        </li>
        <li>
          <Link
            href="/admin/suggested-fabrics"
            className={`nav-link ${isActive("/admin/suggested-fabrics") ? "active" : ""}`}
          >
            <Fabric className="me-2" size={18} />
            Suggested Fabrics
          </Link>
        </li>
        <li>
          <Link href="/admin/formats" className={`nav-link ${isActive("/admin/formats") ? "active" : ""}`}>
            <BookOpen className="me-2" size={18} />
            Formats
          </Link>
        </li>
        <li>
          <Link href="/admin/attributes" className={`nav-link ${isActive("/admin/attributes") ? "active" : ""}`}>
            <CheckSquare className="me-2" size={18} />
            Attributes
          </Link>
        </li>
        {isAdmin && (
          <li>
            <Link href="/admin/settings" className={`nav-link ${isActive("/admin/settings") ? "active" : ""}`}>
              <Settings className="me-2" size={18} />
              Settings
            </Link>
          </li>
        )}
      </ul>
      <hr />
      <div className="d-flex align-items-center mb-3">
        <span className="badge bg-light text-dark me-2">Role: {userRole}</span>
      </div>
      <button onClick={() => signOut({ callbackUrl: "/" })} className="btn btn-primary d-flex align-items-center">
        <LogOut className="me-2" size={18} />
        Sign out
      </button>
    </div>
  )
}
