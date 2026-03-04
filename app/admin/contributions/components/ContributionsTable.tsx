"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Contribution, ContributionStatus, User, Pattern } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"

interface ContributionWithRelations extends Contribution {
  user: Pick<User, "id" | "email" | "name">
  pattern: Pick<Pattern, "id" | "name"> | null
}

interface ContributionsTableProps {
  contributions: ContributionWithRelations[]
}

export default function ContributionsTable({ contributions }: ContributionsTableProps) {
  const router = useRouter()
  const [loadingStates, setLoadingStates] = useState<{ [key: number]: boolean }>({})

  const handleStatusChange = async (id: number, status: ContributionStatus) => {
    setLoadingStates((prev) => ({ ...prev, [id]: true }))
    try {
      const response = await fetch("/api/admin/contributions", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, status }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update contribution status")
      }

      router.refresh() // Revalidate data
    } catch (error) {
      console.error("Error updating contribution status:", error)
      alert(`Failed to update status: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setLoadingStates((prev) => ({ ...prev, [id]: false }))
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pattern</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {contributions.map((contribution) => (
            <tr key={contribution.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{contribution.id}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {contribution.user?.name || contribution.user?.email || "N/A"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {contribution.pattern?.name || "N/A"}
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                <pre className="whitespace-pre-wrap text-xs bg-gray-100 p-2 rounded">
                  {JSON.stringify(contribution.data, null, 2)}
                </pre>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    contribution.status === "PENDING"
                      ? "bg-yellow-100 text-yellow-800"
                      : contribution.status === "APPROVED"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                  }`}
                >
                  {contribution.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(contribution.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleStatusChange(contribution.id, "APPROVED")}
                      disabled={loadingStates[contribution.id] || contribution.status === "APPROVED"}
                    >
                      {loadingStates[contribution.id] ? "Approving..." : "Approve"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange(contribution.id, "REJECTED")}
                      disabled={loadingStates[contribution.id] || contribution.status === "REJECTED"}
                    >
                      {loadingStates[contribution.id] ? "Rejecting..." : "Reject"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
