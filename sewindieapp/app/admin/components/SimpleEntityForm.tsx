"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

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
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : `Save ${entityType}`}
        </button>
        <Link href={returnPath} className="btn btn-outline-secondary">
          Cancel
        </Link>
      </div>
    </form>
  )
}
