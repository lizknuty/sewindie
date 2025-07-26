"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { PlusCircle, Edit, Trash2 } from "lucide-react"

interface SizeChart {
  id: number
  label: string
  measurement_unit: string
  Designer: {
    name: string
  }
}

export default function AdminSizeChartsPage() {
  const [sizeCharts, setSizeCharts] = useState<SizeChart[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSizeCharts = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/size-charts")
      if (!response.ok) {
        throw new Error("Failed to fetch size charts")
      }
      const data = await response.json()
      setSizeCharts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSizeCharts()
  }, [])

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this size chart? This action cannot be undone.")) {
      return
    }

    try {
      const response = await fetch(`/api/size-charts/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete size chart")
      }

      fetchSizeCharts() // Refresh the list
    } catch (err) {
      console.error("Error deleting size chart:", err)
      alert(`Failed to delete size chart: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  if (loading) return <div className="p-4">Loading size charts...</div>
  if (error)
    return (
      <div className="p-4 alert alert-danger" role="alert">
        Error: {error}
      </div>
    )

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Size Charts</h1>
        <Link href="/admin/size-charts/new" className="btn btn-primary">
          <PlusCircle className="inline-block me-2" size={18} />
          Add New Size Chart
        </Link>
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>ID</th>
              <th>Label</th>
              <th>Designer</th>
              <th>Unit</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sizeCharts.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4">
                  No size charts found.
                </td>
              </tr>
            ) : (
              sizeCharts.map((chart) => (
                <tr key={chart.id}>
                  <td>{chart.id}</td>
                  <td>{chart.label}</td>
                  <td>{chart.Designer.name}</td>
                  <td>{chart.measurement_unit}</td>
                  <td>
                    <Link href={`/admin/size-charts/${chart.id}/edit`} className="btn btn-sm btn-info me-2">
                      <Edit size={16} />
                    </Link>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(chart.id)}>
                      <Trash2 size={16} />
                    </button>
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
