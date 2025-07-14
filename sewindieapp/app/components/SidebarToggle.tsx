"use client"

import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"

interface SidebarToggleProps {
  targetId: string
}

export default function SidebarToggle({ targetId }: SidebarToggleProps) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleSidebar = () => {
    const sidebarElement = document.getElementById(targetId)
    if (sidebarElement) {
      sidebarElement.classList.toggle("d-block")
      setIsOpen(!isOpen)
    }
  }

  // Hide sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebarElement = document.getElementById(targetId)
      const toggleButton = document.getElementById("sidebar-toggle-button")

      if (
        sidebarElement &&
        isOpen &&
        !sidebarElement.contains(event.target as Node) &&
        toggleButton &&
        !toggleButton.contains(event.target as Node)
      ) {
        sidebarElement.classList.remove("d-block")
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, targetId])

  // Hide sidebar on window resize (if screen becomes larger)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        const sidebarElement = document.getElementById(targetId)
        if (sidebarElement) {
          sidebarElement.classList.remove("d-block")
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
      className="btn btn-primary sidebar-toggle d-md-none"
      onClick={toggleSidebar}
      aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
    >
      {isOpen ? <X size={24} /> : <Menu size={24} />}
    </button>
  )
}
