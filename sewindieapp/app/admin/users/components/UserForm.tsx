"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface UserFormProps {
  user?: {
    id: number
    name: string | null
    email: string
    role: string | null
  }
}

interface UserFormData {
  name: string
  email: string
  role: string
}

export default function UserForm({ user }: UserFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<UserFormData>({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "USER",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = user ? `/api/admin/users/${user.id}` : "/api/admin/users"
      const method = user ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save user")
      }

      router.push("/admin/users")
      router.refresh()
    } catch (error) {
      console.error("Error saving user:", error)
      alert(error instanceof Error ? error.message : "Failed to save user. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="name" className="form-label">
          Name *
        </label>
        <input
          type="text"
          className="form-control"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="mb-3">
        <label htmlFor="email" className="form-label">
          Email *
        </label>
        <input
          type="email"
          className="form-control"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>

      {!user && (
        <p className="form-text mb-3">
          The user can set their password using &quot;Forgot password&quot; on the login page.
        </p>
      )}

      <div className="mb-3">
        <label htmlFor="role" className="form-label">
          Role
        </label>
        <select className="form-select" id="role" name="role" value={formData.role} onChange={handleChange}>
          <option value="USER">User</option>
          <option value="MODERATOR">Moderator</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save User"}
        </button>
        <Link href="/admin/users" className="btn btn-outline-secondary">
          Cancel
        </Link>
      </div>
    </form>
  )
}
