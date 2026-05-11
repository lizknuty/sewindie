"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { UserX, UserCheck, Trash2, AlertTriangle } from "lucide-react"

interface User {
  id: number
  name: string | null
  email: string
  role: string | null
  status: string
  lastLogin: string | null
  createdAt: string
}

interface UsersTableProps {
  initialUsers: User[]
  currentUserEmail: string
}

type StatusFilter = "all" | "ACTIVE" | "SUSPENDED" | "PENDING"

export default function UsersTable({ initialUsers, currentUserEmail }: UsersTableProps) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [isLoading, setIsLoading] = useState<Record<number, boolean>>({})
  const [isBulkLoading, setIsBulkLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [sortBy, setSortBy] = useState<"createdAt" | "lastLogin">("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  // Filter users by status
  const filteredUsers = users
    .filter((user) => {
      if (filter === "all") return true
      return user.status === filter
    })
    .sort((a, b) => {
      const aVal = sortBy === "lastLogin" ? a.lastLogin : a.createdAt
      const bVal = sortBy === "lastLogin" ? b.lastLogin : b.createdAt
      
      // Handle null values for lastLogin - put "Never" at top when sorting desc
      if (sortBy === "lastLogin") {
        if (aVal === null && bVal === null) return 0
        if (aVal === null) return sortDir === "desc" ? -1 : 1
        if (bVal === null) return sortDir === "desc" ? 1 : -1
      }
      
      if (sortDir === "asc") {
        return new Date(aVal!).getTime() - new Date(bVal!).getTime()
      }
      return new Date(bVal!).getTime() - new Date(aVal!).getTime()
    })

  // Check if a user can be modified (not admin, not self)
  const canModifyUser = (user: User) => {
    return user.role !== "ADMIN" && user.email !== currentUserEmail
  }

  // Get selectable users from filtered list
  const selectableUsers = filteredUsers.filter(canModifyUser)

  // Toggle single selection
  const toggleSelection = (userId: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedIds(newSelected)
  }

  // Toggle all selectable users
  const toggleSelectAll = () => {
    if (selectedIds.size === selectableUsers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableUsers.map((u) => u.id)))
    }
  }

  // Update single user status
  const updateUserStatus = async (userId: number, newStatus: string) => {
    setIsLoading((prev) => ({ ...prev, [userId]: true }))

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update user")
      }

      // Update local state
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, status: newStatus } : user))
      )
    } catch (error) {
      console.error("Error updating user status:", error)
      alert(error instanceof Error ? error.message : "Failed to update user status")
    } finally {
      setIsLoading((prev) => ({ ...prev, [userId]: false }))
    }
  }

  // Bulk update status
  const bulkUpdateStatus = async (action: "suspend" | "activate") => {
    if (selectedIds.size === 0) return

    setIsBulkLoading(true)

    try {
      const response = await fetch("/api/admin/users/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: Array.from(selectedIds),
          action,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update users")
      }

      // Update local state
      const newStatus = action === "suspend" ? "SUSPENDED" : "ACTIVE"
      setUsers((prev) =>
        prev.map((user) => (selectedIds.has(user.id) ? { ...user, status: newStatus } : user))
      )

      setSelectedIds(new Set())
      alert(data.message)
    } catch (error) {
      console.error("Error in bulk update:", error)
      alert(error instanceof Error ? error.message : "Failed to update users")
    } finally {
      setIsBulkLoading(false)
    }
  }

  // Bulk delete users
  const bulkDeleteUsers = async () => {
    if (selectedIds.size === 0) return

    setIsBulkLoading(true)

    try {
      const response = await fetch("/api/admin/users/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: Array.from(selectedIds),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete users")
      }

      // Update local state
      setUsers((prev) => prev.filter((user) => !selectedIds.has(user.id)))
      setSelectedIds(new Set())
      setShowDeleteModal(false)
      alert(data.message)
    } catch (error) {
      console.error("Error in bulk delete:", error)
      alert(error instanceof Error ? error.message : "Failed to delete users")
    } finally {
      setIsBulkLoading(false)
    }
  }

  // Handle sort toggle
  const handleSort = (column: "createdAt" | "lastLogin") => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortBy(column)
      setSortDir("desc")
    }
  }

  // Status counts for filter badges
  const statusCounts = {
    all: users.length,
    ACTIVE: users.filter((u) => u.status === "ACTIVE").length,
    SUSPENDED: users.filter((u) => u.status === "SUSPENDED").length,
    PENDING: users.filter((u) => u.status === "PENDING").length,
  }

  return (
    <div>
      {/* Filter buttons */}
      <div className="mb-3">
        <div className="btn-group">
          <button
            className={`btn ${filter === "all" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setFilter("all")}
          >
            All <span className="badge bg-light text-dark ms-1">{statusCounts.all}</span>
          </button>
          <button
            className={`btn ${filter === "ACTIVE" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setFilter("ACTIVE")}
          >
            Active <span className="badge bg-light text-dark ms-1">{statusCounts.ACTIVE}</span>
          </button>
          <button
            className={`btn ${filter === "SUSPENDED" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setFilter("SUSPENDED")}
          >
            Suspended <span className="badge bg-light text-dark ms-1">{statusCounts.SUSPENDED}</span>
          </button>
          <button
            className={`btn ${filter === "PENDING" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setFilter("PENDING")}
          >
            Pending <span className="badge bg-light text-dark ms-1">{statusCounts.PENDING}</span>
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="alert alert-info d-flex align-items-center justify-content-between mb-3">
          <span>
            <strong>{selectedIds.size}</strong> user{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="btn-group">
            <button
              className="btn btn-warning btn-sm"
              onClick={() => bulkUpdateStatus("suspend")}
              disabled={isBulkLoading}
            >
              <UserX size={16} className="me-1" />
              Suspend Selected
            </button>
            <button
              className="btn btn-success btn-sm"
              onClick={() => bulkUpdateStatus("activate")}
              disabled={isBulkLoading}
            >
              <UserCheck size={16} className="me-1" />
              Activate Selected
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => setShowDeleteModal(true)}
              disabled={isBulkLoading}
            >
              <Trash2 size={16} className="me-1" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={selectableUsers.length > 0 && selectedIds.size === selectableUsers.length}
                  onChange={toggleSelectAll}
                  disabled={selectableUsers.length === 0}
                />
              </th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th
                style={{ cursor: "pointer" }}
                onClick={() => handleSort("lastLogin")}
                className="user-select-none"
              >
                Last Login {sortBy === "lastLogin" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th
                style={{ cursor: "pointer" }}
                onClick={() => handleSort("createdAt")}
                className="user-select-none"
              >
                Joined {sortBy === "createdAt" && (sortDir === "asc" ? "↑" : "↓")}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-4">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    {canModifyUser(user) ? (
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleSelection(user.id)}
                      />
                    ) : (
                      <input type="checkbox" className="form-check-input" disabled />
                    )}
                  </td>
                  <td>{user.name || <span className="text-muted">No name</span>}</td>
                  <td>{user.email}</td>
                  <td>
                    <span
                      className={`badge ${
                        user.role === "ADMIN"
                          ? "bg-danger"
                          : user.role === "MODERATOR"
                          ? "bg-warning"
                          : "bg-secondary"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        user.status === "ACTIVE"
                          ? "bg-success"
                          : user.status === "SUSPENDED"
                          ? "bg-danger"
                          : "bg-warning"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td>
                    {user.lastLogin ? (
                      formatDistanceToNow(new Date(user.lastLogin), { addSuffix: true })
                    ) : (
                      <span className="text-muted fst-italic">Never</span>
                    )}
                  </td>
                  <td>{formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</td>
                  <td>
                    <div className="btn-group">
                      <Link
                        href={`/admin/users/${user.id}/edit`}
                        className="btn btn-sm btn-outline-secondary"
                      >
                        Edit
                      </Link>
                      {canModifyUser(user) && (
                        <>
                          {user.status === "ACTIVE" || user.status === "PENDING" ? (
                            <button
                              className="btn btn-sm btn-outline-warning"
                              onClick={() => updateUserStatus(user.id, "SUSPENDED")}
                              disabled={isLoading[user.id]}
                              title="Suspend user"
                            >
                              <UserX size={16} />
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-outline-success"
                              onClick={() => updateUserStatus(user.id, "ACTIVE")}
                              disabled={isLoading[user.id]}
                              title="Activate user"
                            >
                              <UserCheck size={16} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">
                  <AlertTriangle size={20} className="me-2" />
                  Confirm Deletion
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowDeleteModal(false)}
                />
              </div>
              <div className="modal-body">
                <p>
                  Are you sure you want to permanently delete{" "}
                  <strong>{selectedIds.size}</strong> user
                  {selectedIds.size !== 1 ? "s" : ""}?
                </p>
                <p className="text-danger mb-0">
                  <strong>This action cannot be undone.</strong> All associated data will be
                  removed.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isBulkLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={bulkDeleteUsers}
                  disabled={isBulkLoading}
                >
                  {isBulkLoading ? "Deleting..." : "Delete Users"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
