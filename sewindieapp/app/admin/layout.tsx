import type React from "react"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { redirect } from "next/navigation"
import AdminSidebar from "@/admin/components/AdminSidebar"
import AdminShell from "@/admin/components/AdminShell"
import "./admin.css"

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

  // The shell is a client component because it owns the mobile drawer state;
  // the sidebar is passed in as a prop so this layout stays a server component
  // and keeps doing the session check above on the server.
  return <AdminShell sidebar={<AdminSidebar user={user} />}>{children}</AdminShell>
}
