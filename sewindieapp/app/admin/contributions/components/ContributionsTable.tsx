"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, Check, X, Download } from "lucide-react"
import type { PatternContribution } from "@/lib/google-sheets"

interface ContributionsTableProps {
  initialContributions: PatternContribution[]
}

export default function ContributionsTable({ initialContributions }: ContributionsTableProps) {
  const router = useRouter()
  const [contributions, setContributions] = useState(initialContributions)
  const [isLoading, setIsLoading] = useState<Record<number, boolean>>({})
  const [filter, setFilter] = useState<string>("all")

  const filteredContributions = contributions.filter((contribution) => {
    if (filter === "all") return true
    if (filter === "pending") return contribution.status === "Pending" || !contribution.status
    if (filter === "approved") return contribution.status === "Approved"
    if (filter === "rejected") return contribution.status === "Rejected"
    if (filter === "imported") return contribution.status === "Imported"
    return true
  })

  const updateStatus = async (rowIndex: number, status: string) => {
    setIsLoading((prev) => ({ ...prev, [rowIndex]: true }))

    try {
      const response = await fetch("/api/admin/contributions", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rowIndex, status }),
      })

      if (!response.ok) {
        throw new Error("Failed to update status")
      }

      // Update local state
      setContributions((prev) =>
        prev.map((contribution) => (contribution.rowIndex === rowIndex ? { ...contribution, status } : contribution)),
      )
    } catch (error) {
      console.error("Error updating contribution status:", error)
      alert("Failed to update status. Please try again.")
    } finally {
      setIsLoading((prev) => ({ ...prev, [rowIndex]: false }))
    }
  }

  const importContribution = async (contribution: PatternContribution) => {
    setIsLoading((prev) => ({ ...prev, [contribution.rowIndex]: true }))

    try {
      const response = await fetch("/api/admin/contributions/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contribution }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to import contribution")
      }

      // Update local state
      setContributions((prev) =>
        prev.map((c) => (c.rowIndex === contribution.rowIndex ? { ...c, status: "Imported" } : c)),
      )

      alert("Pattern imported successfully!")
    } catch (error) {
      console.error("Error importing contribution:", error)
      alert(error instanceof Error ? error.message : "Failed to import contribution. Please try again.")
    } finally {
      setIsLoading((prev) => ({ ...prev, [contribution.rowIndex]: false }))
    }
  }

  return (
    <div>
      <div className="mb-3">
        <div className="btn-group">
          <button
            className={`btn ${filter === "all" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`btn ${filter === "pending" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setFilter("pending")}
          >
            Pending
          </button>
          <button
            className={`btn ${filter === "approved" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setFilter("approved")}
          >
            Approved
          </button>
          <button
            className={`btn ${filter === "rejected" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setFilter("rejected")}
          >
            Rejected
          </button>
          <button
            className={`btn ${filter === "imported" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setFilter("imported")}
          >
            Imported
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>Name</th>
              <th>Designer</th>
              <th>Categories</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredContributions.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4">
                  No contributions found
                </td>
              </tr>
            ) : (
              filteredContributions.map((contribution) => (
                <tr key={contribution.rowIndex}>
                  <td>{contribution.name}</td>
                  <td>{contribution.designer}</td>
                  <td>{contribution.categories}</td>
                  <td>
                    <span
                      className={`badge ${
                        contribution.status === "Approved"
                          ? "bg-success"
                          : contribution.status === "Rejected"
                            ? "bg-danger"
                            : contribution.status === "Imported"
                              ? "bg-info"
                              : "bg-warning"
                      }`}
                    >
                      {contribution.status || "Pending"}
                    </span>
                  </td>
                  <td>
                    <div className="btn-group">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          // Show details in a modal or alert for now
                          alert(
                            `Pattern Details:\n\nName: ${contribution.name}\nDesigner: ${contribution.designer}\nCategories: ${contribution.categories}\nSizes: ${contribution.sizes}\nAudience: ${contribution.audience}\nPublication Date: ${contribution.publicationDate}\nPublished in Print: ${contribution.publishedInPrint}\nPublished Online: ${contribution.publishedOnline}\nPattern URL: ${contribution.patternUrl}\nPrice: ${contribution.price}\nIs Bundle: ${contribution.isBundle}\nIs Knit: ${contribution.isKnit}\nIs Woven: ${contribution.isWoven}\nSuggested Fabrics: ${contribution.suggestedFabrics}\nRequired Notions: ${contribution.requiredNotions}\nTotal Yardage: ${contribution.totalYardage}`,
                          )
                        }}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      {(contribution.status === "Pending" || !contribution.status) && (
                        <>
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={() => updateStatus(contribution.rowIndex, "Approved")}
                            disabled={isLoading[contribution.rowIndex]}
                            title="Approve"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => updateStatus(contribution.rowIndex, "Rejected")}
                            disabled={isLoading[contribution.rowIndex]}
                            title="Reject"
                          >
                            <X size={16} />
                          </button>
                        </>
                      )}
                      {(contribution.status === "Approved" || contribution.status === "Pending") && (
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => importContribution(contribution)}
                          disabled={isLoading[contribution.rowIndex]}
                          title="Import as Pattern"
                        >
                          <Download size={16} />
                        </button>
                      )}
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
