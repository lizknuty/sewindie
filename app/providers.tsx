"use client"

import type React from "react"

import { SessionProvider } from "next-auth/react"
import { SidebarProvider } from "@/hooks/use-sidebar" // Import the SidebarProvider
import { Toaster } from "@/components/ui/toaster" // Assuming you have a Toaster component

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SidebarProvider>
        {children}
        <Toaster /> {/* Place Toaster here if you want it globally available */}
      </SidebarProvider>
    </SessionProvider>
  )
}
