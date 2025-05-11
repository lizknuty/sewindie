import type React from "react"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { redirect } from "next/navigation"
import AdminSidebar from "./components/AdminSidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check if user is authenticated and has admin role
  const session = await getServerSession(authOptions)

  // Redirect to login if not authenticated
  if (!session) {
    redirect("/login?callbackUrl=/admin")
  }

  // Check for admin role
  if (session?.user?.role !== "ADMIN" && session?.user?.role !== "MODERATOR") {
    redirect("/")
  }

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-md-3 col-lg-2 p-0">
          <AdminSidebar userRole={session.user.role || "USER"} />
        </div>
        <div className="col-md-9 col-lg-10 p-4">
          <div className="admin-content">{children}</div>
        </div>
      </div>
    </div>
  )
}
