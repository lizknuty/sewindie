import type React from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/options"
import { redirect } from "next/navigation"
import AccountSidebar from "@/app/my-account/components/AccountSidebar"
import SidebarToggle from "@/app/components/SidebarToggle" // Import the toggle button
import { Toaster } from "@/components/ui/toaster"

export default async function MyAccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    redirect("/login?callbackUrl=/my-account")
  }

  return (
    <div className="flex min-h-screen">
      <AccountSidebar />
      <div className="flex-1 flex flex-col">
        <header className="w-full bg-background border-b p-4 md:hidden flex items-center justify-between">
          <h1 className="text-xl font-bold">My Account</h1>
          <SidebarToggle />
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
      <Toaster />
    </div>
  )
}
