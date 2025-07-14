import type React from "react"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { redirect } from "next/navigation"
import AccountSidebar from "./components/AccountSidebar"
import SidebarToggle from "../components/SidebarToggle"

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    redirect("/login?callbackUrl=/my-account")
  }

  return (
    <div className="layout-container">
      <div id="account-sidebar" className="sidebar-column">
        <AccountSidebar user={session.user} />
      </div>
      <div className="content-wrapper">
        <header className="content-header">
          <SidebarToggle targetId="account-sidebar" />
          <h1 className="d-none d-md-block">My Account</h1>
        </header>
        <main className="content-main p-4">{children}</main>
      </div>
    </div>
  )
}
