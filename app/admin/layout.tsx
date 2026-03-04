import type React from "react"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { redirect } from "next/navigation"
import AdminSidebar from "@/admin/components/AdminSidebar"
import SidebarToggle from "@/admin/components/SidebarToggle"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  const userRole = session?.user?.role?.toUpperCase()
  if (userRole !== "ADMIN" && userRole !== "MODERATOR") {
    redirect("/login?callbackUrl=/admin")
  }

  const user = session!.user

  return (
    <div className="layout-container">
      <div id="admin-sidebar" className="sidebar-column">
        <AdminSidebar user={user} />
      </div>
      <div className="content-wrapper">
        <header className="content-header relative z-50 flex items-center justify-between">
          <SidebarToggle targetId="admin-sidebar" />
          <h1 className="d-none d-md-block">Admin Dashboard</h1>
        </header>
        <main className="content-main p-4">{children}</main>
      </div>
    </div>
  )
}
