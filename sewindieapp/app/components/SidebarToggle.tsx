"use client"

import { useEffect } from "react"

interface SidebarToggleProps {
  targetId: string
}

const SidebarToggle = ({ targetId }: SidebarToggleProps) => {
  const toggleSidebar = () => {
    const sidebar = document.getElementById(targetId)
    sidebar?.classList.toggle("show")
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById(targetId)
      const toggleButton = document.querySelector(`[data-target-id="${targetId}"]`)

      if (
        sidebar &&
        sidebar.classList.contains("show") &&
        !sidebar.contains(event.target as Node) &&
        !toggleButton?.contains(event.target as Node)
      ) {
        sidebar.classList.remove("show")
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [targetId])

  return (
    <button
      className="btn btn-link d-md-none"
      onClick={toggleSidebar}
      data-target-id={targetId}
      aria-label="Toggle sidebar"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </button>
  )
}

export default SidebarToggle
