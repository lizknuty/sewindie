import type React from "react"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { redirect } from "next/navigation"
import AccountTabs from "@/my-account/components/AccountTabs"

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    redirect("/login?callbackUrl=/my-account")
  }

  // Tabs replace the old pinned sidebar, which overlapped the site header and
  // hid the brand. Each page supplies its own <h1>, so the layout deliberately
  // has no heading of its own — previously "My Account" appeared three times on
  // one screen (navbar, layout header, and page title).
  return (
    <div className="account-page">
      <AccountTabs />
      <main>{children}</main>
    </div>
  )
}
