"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import type { Session } from "next-auth"

interface AdminSidebarProps {
  user: Session["user"]
}

const AdminSidebar = ({ user }: AdminSidebarProps) => {
  const pathname = usePathname()
  const userRole = user?.role?.toUpperCase()

  const navItems = [
    { href: "/admin", label: "Dashboard", roles: ["ADMIN", "MODERATOR"] },
    { href: "/admin/users", label: "Users", roles: ["ADMIN"] },
    { href: "/admin/patterns", label: "Patterns", roles: ["ADMIN", "MODERATOR"] },
    { href: "/admin/designers", label: "Designers", roles: ["ADMIN", "MODERATOR"] },
    { href: "/admin/categories", label: "Categories", roles: ["ADMIN"] },
    { href: "/admin/attributes", label: "Attributes", roles: ["ADMIN"] },
    { href: "/admin/audiences", label: "Audiences", roles: ["ADMIN"] },
    { href: "/admin/fabric-types", label: "Fabric Types", roles: ["ADMIN"] },
    { href: "/admin/formats", label: "Formats", roles: ["ADMIN"] },
    { href: "/admin/suggested-fabrics", label: "Suggested Fabrics", roles: ["ADMIN"] },
    { href: "/admin/contributions", label: "Contributions", roles: ["ADMIN", "MODERATOR"] },
    {
      href: "/admin/analytics",
      label: "Analytics",
      roles: ["ADMIN"],
      subItems: [
        { href: "/admin/analytics/favorites", label: "Favorites" },
        { href: "/admin/analytics/ratings", label: "Ratings" },
      ],
    },
  ]

  return (
    <div className="sidebar-container d-flex flex-column p-3">
      <Link href="/" className="sidebar-brand d-flex align-items-center mb-3 mb-md-0 me-md-auto text-decoration-none">
        <span className="fs-4">SewIndie Admin</span>
      </Link>
      <hr />
      <ul className="nav nav-pills flex-column mb-auto">
        {navItems.map(
          (item) =>
            userRole &&
            item.roles.includes(userRole) && (
              <li className="nav-item" key={item.href}>
                <Link href={item.href} className={`nav-link ${pathname === item.href ? "active" : ""}`}>
                  {item.label}
                </Link>
                {item.subItems && pathname.startsWith(item.href) && (
                  <ul className="nav flex-column ms-3">
                    {item.subItems.map((subItem) => (
                      <li className="nav-item" key={subItem.href}>
                        <Link
                          href={subItem.href}
                          className={`nav-link sub-link ${pathname === subItem.href ? "active" : ""}`}
                        >
                          {subItem.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ),
        )}
      </ul>
      <hr />
      <div className="dropdown">
        <a
          href="#"
          className="d-flex align-items-center text-white text-decoration-none dropdown-toggle"
          id="dropdownUser1"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          <strong>{user?.name || "User"}</strong>
        </a>
        <ul className="dropdown-menu dropdown-menu-dark text-small shadow" aria-labelledby="dropdownUser1">
          <li>
            <Link className="dropdown-item" href="/my-account">
              My Account
            </Link>
          </li>
          <li>
            <hr className="dropdown-divider" />
          </li>
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

export default AdminSidebar
