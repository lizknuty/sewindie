"use client"

import { Menu, X } from "lucide-react"
import { useEffect, useState } from "react"

interface SidebarToggleProps {
  targetId: string
}

const SidebarToggle = ({ targetId }: SidebarToggleProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const toggleSidebar = () => {
    const sidebar = document.getElementById(targetId)
    const content = document.querySelector(".content-wrapper")
    if (sidebar && content) {
      sidebar.classList.toggle("open")
      content.classList.toggle("sidebar-open")
      setIsOpen(!isOpen)
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById(targetId)
      if (
        sidebar &&
        !sidebar.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest(".sidebar-toggle")
      ) {
        if (sidebar.classList.contains("open")) {
          toggleSidebar()
        }
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, targetId])

  return (
    <button onClick={toggleSidebar} className="sidebar-toggle d-md-none" aria-label="Toggle sidebar">
      {isOpen ? <X /> : <Menu />}
    </button>
  )
}

export default SidebarToggle
