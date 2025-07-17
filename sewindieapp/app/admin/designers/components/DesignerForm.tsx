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
    email?: string | null
    address?: string | null
    facebook?: string | null
    instagram?: string | null
    pinterest?: string | null
    youtube?: string | null
  }
}

export default function DesignerForm({ designer }: DesignerFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: designer?.name || "",
    logo_url: designer?.logo_url || "",
    url: designer?.url || "",
    email: designer?.email || "",
    address: designer?.address || "",
    facebook: designer?.facebook || "",
    instagram: designer?.instagram || "",
    pinterest: designer?.pinterest || "",
    youtube: designer?.youtube || "",
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
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save designer")
      }

      router.push("/admin/designers")
      router.refresh()
    } catch (error) {
      console.error("Error saving designer:", error)
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred."
      alert(`Failed to save designer: ${errorMessage}`)
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
              onError={(e) => {
                e.currentTarget.src = "/placeholder.svg?height=100&width=100"
              }}
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

      <div className="mb-3">
        <label htmlFor="email" className="form-label">
          Email
        </label>
        <input
          type="email"
          className="form-control"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
        />
      </div>

      <div className="mb-3">
        <label htmlFor="address" className="form-label">
          Address
        </label>
        <textarea
          className="form-control"
          id="address"
          name="address"
          rows={3}
          value={formData.address}
          onChange={handleChange}
        />
      </div>

      <h5 className="mt-4 mb-3">Social Media</h5>
      <div className="mb-3">
        <label htmlFor="facebook" className="form-label">
          Facebook URL
        </label>
        <input
          type="url"
          className="form-control"
          id="facebook"
          name="facebook"
          value={formData.facebook}
          onChange={handleChange}
        />
      </div>
      <div className="mb-3">
        <label htmlFor="instagram" className="form-label">
          Instagram URL
        </label>
        <input
          type="url"
          className="form-control"
          id="instagram"
          name="instagram"
          value={formData.instagram}
          onChange={handleChange}
        />
      </div>
      <div className="mb-3">
        <label htmlFor="pinterest" className="form-label">
          Pinterest URL
        </label>
        <input
          type="url"
          className="form-control"
          id="pinterest"
          name="pinterest"
          value={formData.pinterest}
          onChange={handleChange}
        />
      </div>
      <div className="mb-3">
        <label htmlFor="youtube" className="form-label">
          YouTube URL
        </label>
        <input
          type="url"
          className="form-control"
          id="youtube"
          name="youtube"
          value={formData.youtube}
          onChange={handleChange}
        />
      </div>

      <div className="d-flex gap-2 mt-4">
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
