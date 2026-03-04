"use client"

// This file is a duplicate and should ideally be removed or consolidated.
// The primary Navbar is now located at `components/Navbar.tsx`.
// Keeping it here for now as per previous context, but it's redundant.
// If you wish to remove it, please ensure all imports are updated to "@/components/Navbar".
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MenuIcon } from "lucide-react"
import { useSidebar } from "@/hooks/use-sidebar"

export function Navbar() {
  const { data: session } = useSession()
  const { toggleSidebar } = useSidebar()

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center justify-between py-4">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="md:hidden mr-2" onClick={toggleSidebar}>
            <MenuIcon className="h-6 w-6" />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
          <Link href="/" className="text-2xl font-bold">
            Sewindie
          </Link>
        </div>
        <nav className="hidden md:flex items-center space-x-4">
          <Link href="/patterns" className="text-sm font-medium hover:underline">
            Patterns
          </Link>
          <Link href="/designers" className="text-sm font-medium hover:underline">
            Designers
          </Link>
          {session?.user?.role === "ADMIN" && (
            <Link href="/admin" className="text-sm font-medium hover:underline">
              Admin
            </Link>
          )}
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <span className="sr-only">Open user menu</span>
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold">
                    {session.user.name ? session.user.name[0].toUpperCase() : session.user.email?.[0].toUpperCase()}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem>
                  <Link href="/my-account" className="w-full">
                    My Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link href="/login">Log In</Link>
            </Button>
          )}
        </nav>
        <div className="md:hidden">
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <span className="sr-only">Open user menu</span>
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold">
                    {session.user.name ? session.user.name[0].toUpperCase() : session.user.email?.[0].toUpperCase()}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuItem>
                  <Link href="/my-account" className="w-full">
                    My Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Log In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
