"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface SimpleEntityFormProps {
  entity?: {
    id: number
    name: string | null
  }
  entityType: string
  apiPath: string
  returnPath: string
}

export default function SimpleEntityForm({ entity, entityType, apiPath, returnPath }: SimpleEntityFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState(entity?.name || "")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = entity ? `${apiPath}/${entity.id}` : apiPath

      const method = entity ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        throw new Error(`Failed to save ${entityType.toLowerCase()}`)
      }

      router.push(returnPath)
      router.refresh()
    } catch (error) {
      console.error(`Error saving ${entityType.toLowerCase()}:`, error)
      alert(`Failed to save ${entityType.toLowerCase()}. Please try again.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // The back link label comes from the return path ("/admin/fabric-types" ->
  // "Fabric Types") so callers don't have to pass a second, plural label that
  // could drift out of sync with where the link actually goes.
  const backLabel = (returnPath.split("/").filter(Boolean).pop() ?? "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

  return (
    <div className="admin-form-page admin-form-page--narrow">
      <header className="admin-form-header">
        <Link href={returnPath} className="admin-form-back">
          <ArrowLeft size={15} />
          Back to {backLabel}
        </Link>
        <h1 className="admin-form-title">{entity ? `Edit ${entityType}` : `Add New ${entityType}`}</h1>
        {entity?.name && <p className="admin-form-subtitle">{entity.name}</p>}
      </header>

      <form className="admin-form" onSubmit={handleSubmit}>
        <section className="admin-form-card">
          <div className="admin-form-card-head">
            <h2 className="admin-form-card-title">{entityType} Details</h2>
            <p className="admin-form-card-desc">
              The name shown wherever this {entityType.toLowerCase()} appears in the directory and in pattern filters.
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>
        </section>

        <div className="admin-form-actions">
          <button type="submit" className="admin-form-btn admin-form-btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : entity ? `Save ${entityType}` : `Create ${entityType}`}
          </button>
          <Link href={returnPath} className="admin-form-btn">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
