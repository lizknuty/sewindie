"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Plus } from "lucide-react"
import { useSearchParams } from "next/navigation"
import DesignerSearch from "@/components/DesignerSearch" // Import the new DesignerSearch component

// Define a type for the designer data
type Designer = {
  id: number
  name: string
  logo_url: string | null
  url: string | null
}

export default function DesignersPage() {
  const searchParams = useSearchParams()
  const initialSearchQuery = searchParams.get("search") || ""

  const [designers, setDesigners] = useState<Designer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDesigners = async (search: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) {
        params.set("search", search)
      }
      const response = await fetch(`/api/designers?${params.toString()}`)
      if (!response.ok) {
        throw new Error("Failed to fetch designers")
      }
      const data = await response.json()
      setDesigners(data.designers) // Assuming the API returns an object with a 'designers' array
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDesigners(initialSearchQuery)
  }, [initialSearchQuery])

  if (loading) return <div className="p-4">Loading designers...</div>
  if (error) return <div className="p-4 text-danger">Error: {error}</div>

  return (
    <div className="container-fluid admin-designers-page">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Designers</h1>
        <Link href="/admin/designers/new" className="btn btn-primary">
          <Plus size={18} className="me-2" />
          Add Designer
        </Link>
      </div>

      {/* Use the new DesignerSearch component */}
      <DesignerSearch initialSearch={initialSearchQuery} />

      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>Logo</th>
              <th>Name</th>
              <th>Website</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {designers.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-4">
                  No designers found.
                </td>
              </tr>
            ) : (
              designers.map((designer) => (
                <tr key={designer.id}>
                  <td>
                    {designer.logo_url ? (
                      <Image
                        src={designer.logo_url || "/placeholder.svg"}
                        alt={designer.name}
                        width={50}
                        height={50}
                        className="rounded"
                      />
                    ) : (
                      <div className="bg-secondary rounded" style={{ width: 50, height: 50 }}></div>
                    )}
                  </td>
                  <td>{designer.name}</td>
                  <td>
                    {designer.url ? (
                      <a href={designer.url} target="_blank" rel="noopener noreferrer" className="text-primary">
                        {designer.url}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <div className="btn-group">
                      <Link href={`/admin/designers/${designer.id}/edit`} className="btn btn-sm btn-outline-secondary">
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
