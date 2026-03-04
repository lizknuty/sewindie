"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface SimpleEntityFormProps {
  entityType: string // e.g., "attributes", "categories", "formats"
  entityId?: string // Optional, for edit mode
}

export default function SimpleEntityForm({ entityType, entityId }: SimpleEntityFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({ name: "", description: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditMode = !!entityId

  useEffect(() => {
    if (isEditMode) {
      const fetchEntity = async () => {
        try {
          const response = await fetch(`/api/${entityType}/${entityId}`)
          if (!response.ok) {
            throw new Error("Failed to fetch entity")
          }
          const data = await response.json()
          setFormData({ name: data.name || data.label, description: data.description || "" })
        } catch (err) {
          console.error(`Error fetching ${entityType}:`, err)
          setError(`Failed to load ${entityType}.`)
        }
      }
      fetchEntity()
    }
  }, [entityType, entityId, isEditMode])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const payload = {
      name: formData.name,
      description: formData.description,
    }

    // Special handling for 'attributes' which uses 'label' instead of 'name'
    if (entityType === "attributes") {
      ;(payload as any).label = formData.name
      delete (payload as any).name
    }

    try {
      const url = isEditMode ? `/api/${entityType}/${entityId}` : `/api/${entityType}`
      const method = isEditMode ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to save ${entityType}`)
      }

      router.push(`/admin/${entityType}`)
      router.refresh() // Revalidate data on the page
    } catch (err) {
      console.error(`Error saving ${entityType}:`, err)
      setError(err instanceof Error ? err.message : `Failed to save ${entityType}.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          {entityType === "attributes" ? "Label" : "Name"} *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
      {entityType !== "attributes" && ( // Attributes don't have a description in the current schema
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : `Save ${entityType.slice(0, -1)}`}
        </button>
        <Link
          href={`/admin/${entityType}`}
          className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
