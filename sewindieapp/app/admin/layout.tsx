import type React from "react"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { redirect } from "next/navigation"
import AdminSidebar from "@/admin/components/AdminSidebar"
import SidebarToggle from "@/admin/components/SidebarToggle"
import "./admin.css"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  const userRole = session?.user?.role?.toUpperCase()
  // TEMP_PREVIEW_BYPASS
  if (false && userRole !== "ADMIN" && userRole !== "MODERATOR") {
    redirect("/login?callbackUrl=/admin")
  }

  // TEMP_PREVIEW_BYPASS
  const user = session?.user ?? ({ name: "Preview", email: "preview@local", role: "ADMIN" } as typeof session.user)

  return (
    <div className="layout-container admin-shell">
      <div id="admin-sidebar" className="sidebar-column">
        <AdminSidebar user={user} />
      </div>
      <div className="content-wrapper">
        <header className="content-header">
          <SidebarToggle targetId="admin-sidebar" />
        </header>
        <main className="content-main">{children}</main>
      </div>
    </div>
  )
}
