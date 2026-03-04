"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/hooks/use-sidebar"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import "@/app/styles/sidebar.css" // Import the CSS for sidebar

export default function AccountSidebar() {
  const pathname = usePathname()
  const { isSidebarOpen, closeSidebar } = useSidebar()

  const navItems = [
    { name: "My Account", href: "/my-account" },
    { name: "Change Password", href: "/my-account/change-password" },
    { name: "My Favorites", href: "/my-account/favorites" },
    { name: "My Ratings", href: "/my-account/ratings" },
  ]

  return (
    <>
      <div className={cn("sidebar", { open: isSidebarOpen })}>
        <div className="flex justify-end md:hidden p-4">
          <Button variant="ghost" size="icon" onClick={closeSidebar}>
            <X className="h-6 w-6" />
            <span className="sr-only">Close Sidebar</span>
          </Button>
        </div>
        <nav className="sidebar-content flex flex-col space-y-2 p-4">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 rounded-md text-sm font-medium",
                pathname === item.href
                  ? "bg-gray-200 text-gray-900"
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
              )}
              onClick={closeSidebar} // Close sidebar on navigation
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
      {isSidebarOpen && <div className="sidebar-backdrop open" onClick={closeSidebar}></div>}
    </>
  )
}
