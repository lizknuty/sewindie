import type React from "react"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { redirect } from "next/navigation"
import AdminSidebar from "./components/AdminSidebar"
import SidebarToggle from "../components/SidebarToggle"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user || session.user.role !== "admin") {
    redirect("/login?callbackUrl=/admin")
  }

  return (
    <div className="layout-container">
      <div id="admin-sidebar" className="sidebar-column">
        <AdminSidebar user={session.user} />
      </div>
      <div className="content-wrapper">
        <header className="content-header">
          <SidebarToggle targetId="admin-sidebar" />
          <h1 className="d-none d-md-block">Admin Dashboard</h1>
        </header>
        <main className="content-main p-4">{children}</main>
      </div>
    </div>
  )
}
