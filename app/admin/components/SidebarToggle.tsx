"use client"

import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"

interface SidebarToggleProps {
  targetId: string
}

export default function SidebarToggle({ targetId }: SidebarToggleProps) {
  const toggleSidebar = () => {
    const sidebar = document.getElementById(targetId)
    const backdrop = document.getElementById(`${targetId}-backdrop`)

    if (sidebar && backdrop) {
      const isOpen = sidebar.classList.contains("show")

      if (isOpen) {
        sidebar.classList.remove("show")
        backdrop.classList.remove("show")
        document.body.style.overflow = ""
      } else {
        sidebar.classList.add("show")
        backdrop.classList.add("show")
        document.body.style.overflow = "hidden"
      }
    }
  }

  return (
    <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleSidebar} aria-label="Toggle sidebar">
      <Menu className="h-6 w-6" />
    </Button>
  )
}
