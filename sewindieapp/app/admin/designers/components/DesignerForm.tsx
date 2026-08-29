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
    tagline?: string | null
    about?: string | null
    status?: "PUBLISHED" | "INACTIVE" | null
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
    tagline: designer?.tagline || "",
    about: designer?.about || "",
    status: designer?.status || "PUBLISHED",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
    <form className="admin-form" onSubmit={handleSubmit}>
      <section className="admin-form-card">
        <div className="admin-form-card-head">
          <h2 className="admin-form-card-title">Designer Details</h2>
          <p className="admin-form-card-desc">
            The core information used to identify this designer across the directory.
          </p>
        </div>

        <div className="admin-form-grid">
          <div className="admin-field admin-field--full">
            <label htmlFor="name" className="admin-label">
              Name <span className="admin-label-req">*</span>
            </label>
            <input
              type="text"
              className="admin-input"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="admin-field">
            <label htmlFor="url" className="admin-label">
              Website URL <span className="admin-label-req">*</span>
            </label>
            <input
              type="url"
              className="admin-input"
              id="url"
              name="url"
              value={formData.url}
              onChange={handleChange}
              required
            />
          </div>

          <div className="admin-field">
            <label htmlFor="status" className="admin-label">
              Status
            </label>
            <select className="admin-select" id="status" name="status" value={formData.status} onChange={handleChange}>
              <option value="PUBLISHED">Published</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="admin-field admin-field--full">
            <label htmlFor="logo_url" className="admin-label">
              Logo URL
            </label>
            <input
              type="url"
              className="admin-input"
              id="logo_url"
              name="logo_url"
              value={formData.logo_url}
              onChange={handleChange}
            />
            {formData.logo_url && (
              <div className="admin-form-preview">
                <Image
                  src={formData.logo_url || "/placeholder.svg"}
                  alt="Logo preview"
                  width={88}
                  height={88}
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder.svg?height=88&width=88"
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="admin-form-card">
        <div className="admin-form-card-head">
          <h2 className="admin-form-card-title">Profile</h2>
          <p className="admin-form-card-desc">Short public-facing copy shown on the designer&apos;s page.</p>
        </div>

        <div className="admin-form-grid">
          <div className="admin-field admin-field--full">
            <label htmlFor="tagline" className="admin-label">
              Tagline
            </label>
            <input
              type="text"
              className="admin-input"
              id="tagline"
              name="tagline"
              maxLength={255}
              placeholder="A short one-line description"
              value={formData.tagline}
              onChange={handleChange}
            />
          </div>

          <div className="admin-field admin-field--full">
            <label htmlFor="about" className="admin-label">
              About
            </label>
            <textarea
              className="admin-textarea"
              id="about"
              name="about"
              rows={5}
              placeholder="A longer description of this designer"
              value={formData.about}
              onChange={handleChange}
            />
          </div>
        </div>
      </section>

      <section className="admin-form-card">
        <div className="admin-form-card-head">
          <h2 className="admin-form-card-title">Contact</h2>
          <p className="admin-form-card-desc">Used for outreach and contribution follow-ups. Not shown publicly.</p>
        </div>

        <div className="admin-form-grid">
          <div className="admin-field">
            <label htmlFor="email" className="admin-label">
              Email
            </label>
            <input
              type="email"
              className="admin-input"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="address" className="admin-label">
              Address
            </label>
            <textarea
              className="admin-textarea"
              id="address"
              name="address"
              rows={3}
              value={formData.address}
              onChange={handleChange}
            />
          </div>
        </div>
      </section>

      <section className="admin-form-card">
        <div className="admin-form-card-head">
          <h2 className="admin-form-card-title">Social Media</h2>
          <p className="admin-form-card-desc">
            Full profile URLs. Any left blank are simply omitted from the designer&apos;s public page.
          </p>
        </div>

        <div className="admin-form-grid">
          <div className="admin-field">
            <label htmlFor="facebook" className="admin-label">
              Facebook URL
            </label>
            <input
              type="url"
              className="admin-input"
              id="facebook"
              name="facebook"
              value={formData.facebook}
              onChange={handleChange}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="instagram" className="admin-label">
              Instagram URL
            </label>
            <input
              type="url"
              className="admin-input"
              id="instagram"
              name="instagram"
              value={formData.instagram}
              onChange={handleChange}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="pinterest" className="admin-label">
              Pinterest URL
            </label>
            <input
              type="url"
              className="admin-input"
              id="pinterest"
              name="pinterest"
              value={formData.pinterest}
              onChange={handleChange}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="youtube" className="admin-label">
              YouTube URL
            </label>
            <input
              type="url"
              className="admin-input"
              id="youtube"
              name="youtube"
              value={formData.youtube}
              onChange={handleChange}
            />
          </div>
        </div>
      </section>

      <div className="admin-form-actions">
        <button type="submit" className="admin-form-btn admin-form-btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : designer ? "Save Designer" : "Create Designer"}
        </button>
        <Link href="/admin/designers" className="admin-form-btn">
          Cancel
        </Link>
      </div>
    </form>
  )
}
