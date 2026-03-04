"use client"

import { Menu } from "lucide-react"

interface SidebarToggleProps {
  targetId: string
}

export default function SidebarToggle({ targetId }: SidebarToggleProps) {
  const toggleSidebar = () => {
    const sidebar = document.getElementById(targetId)
    const backdrop = document.getElementById(`${targetId}-backdrop`)

    if (sidebar && backdrop) {
      const isVisible = sidebar.classList.contains("show")

      if (isVisible) {
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
    <button
      className="btn btn-outline-secondary d-md-none"
      onClick={toggleSidebar}
      onTouchEnd={(e) => {
        e.preventDefault()
        toggleSidebar()
      }}
      data-sidebar-toggle="true"
      aria-label="Toggle sidebar"
      style={{
        minWidth: "44px",
        minHeight: "44px",
        touchAction: "manipulation",
      }}
    >
      <Menu size={24} />
    </button>
  )
}
