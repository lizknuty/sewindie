import type React from "react"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { redirect } from "next/navigation"
import AccountSidebar from "./components/AccountSidebar"

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check if user is authenticated
  const session = await getServerSession(authOptions)

  // Redirect to login if not authenticated
  if (!session) {
    redirect("/login?callbackUrl=/my-account")
  }

  return (
    <div className="container-fluid px-0">
      <div className="row g-0">
        <div className="col-md-3 col-lg-2 sticky-top" style={{ height: "100vh" }}>
          <AccountSidebar user={session.user} />
        </div>
        <div className="col-md-9 col-lg-10 p-4" style={{ backgroundColor: "var(--color-light)" }}>
          <div className="account-content">{children}</div>
        </div>
      </div>
    </div>
  )
}
