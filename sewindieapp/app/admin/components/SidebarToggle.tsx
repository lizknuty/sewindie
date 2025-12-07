"use client"

import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"

interface SidebarToggleProps {
  targetId: string
}

export default function SidebarToggle({ targetId }: SidebarToggleProps) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleSidebar = () => {
    console.log("[v0] toggleSidebar called, current isOpen:", isOpen)
    const sidebar = document.getElementById(targetId)
    const backdrop = document.getElementById(`${targetId}-backdrop`)

    console.log("[v0] sidebar element:", sidebar)
    console.log("[v0] backdrop element:", backdrop)

    if (sidebar && backdrop) {
      if (isOpen) {
        sidebar.classList.remove("show")
        backdrop.classList.remove("show")
        document.body.style.overflow = ""
      } else {
        sidebar.classList.add("show")
        backdrop.classList.add("show")
        document.body.style.overflow = "hidden"
      }
      setIsOpen(!isOpen)
    }
  }

  // Hide sidebar when clicking/touching outside on mobile
  useEffect(() => {
    const handleOutsideInteraction = (event: MouseEvent | TouchEvent) => {
      const sidebar = document.getElementById(targetId)
      const toggleButton = document.getElementById("sidebar-toggle-button")
      const backdrop = document.getElementById(`${targetId}-backdrop`)
      const target = event.target as Node

      if (sidebar && isOpen && !sidebar.contains(target) && toggleButton && !toggleButton.contains(target)) {
        sidebar.classList.remove("show")
        if (backdrop) backdrop.classList.remove("show")
        document.body.style.overflow = ""
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleOutsideInteraction)
    document.addEventListener("touchstart", handleOutsideInteraction)

    return () => {
      document.removeEventListener("mousedown", handleOutsideInteraction)
      document.removeEventListener("touchstart", handleOutsideInteraction)
    }
  }, [isOpen, targetId])

  // Hide sidebar on window resize (if screen becomes larger)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        const sidebar = document.getElementById(targetId)
        const backdrop = document.getElementById(`${targetId}-backdrop`)
        if (sidebar) {
          sidebar.classList.remove("show")
          if (backdrop) backdrop.classList.remove("show")
          document.body.style.overflow = ""
          setIsOpen(false)
        }
      }
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [targetId])

  return (
    <button
      id="sidebar-toggle-button"
      type="button"
      className="p-2 rounded-md border border-gray-300 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
      onClick={(e) => {
        console.log("[v0] onClick triggered")
        e.stopPropagation()
        toggleSidebar()
      }}
      onTouchStart={(e) => {
        console.log("[v0] onTouchStart triggered")
      }}
      onTouchEnd={(e) => {
        console.log("[v0] onTouchEnd triggered")
        e.preventDefault()
        e.stopPropagation()
        toggleSidebar()
      }}
      aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
      aria-expanded={isOpen}
      style={{
        minWidth: "44px",
        minHeight: "44px",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        cursor: "pointer",
      }}
    >
      {isOpen ? <X size={24} /> : <Menu size={24} />}
    </button>
  )
}
