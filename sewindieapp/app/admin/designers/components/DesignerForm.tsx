"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

interface DesignerFormProps {
  designer?: {
    id: number
    name: string | null
    logo_url?: string | null
    url?: string | null
  }
}

export default function DesignerForm({ designer }: DesignerFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: designer?.name || "",
    logo_url: designer?.logo_url || "",
    url: designer?.url || "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = designer ? `/api/designers/${designer.id.toString()}` : "/api/designers"
      const method = designer ? "PUT" : "POST"
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        // Get the error message from the API response
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save designer")
      }

      router.push("/admin/designers")
      router.refresh()
    } catch (error) {
      console.error("Error saving designer:", error)
      // Display the specific error message in the alert
      alert((error as Error).message)
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
        <label htmlFor="logo_url" className="form-label">
          Logo URL
        </label>
        <input
          type="url"
          className="form-control"
          id="logo_url"
          name="logo_url"
          value={formData.logo_url}
          onChange={handleChange}
        />
        {formData.logo_url && (
          <div className="mt-2">
            <Image
              src={formData.logo_url || "/placeholder.svg"}
              alt="Logo preview"
              width={100}
              height={100}
              className="rounded border"
            />
          </div>
        )}
      </div>
      <div className="mb-3">
        <label htmlFor="url" className="form-label">
          Website URL *
        </label>
        <input
          type="url"
          className="form-control"
          id="url"
          name="url"
          value={formData.url}
          onChange={handleChange}
          required
        />
      </div>
      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Designer"}
        </button>
        <Link href="/admin/designers" className="btn btn-outline-secondary">
          Cancel
        </Link>
      </div>
    </form>
  )
}
