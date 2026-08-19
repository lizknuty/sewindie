st"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  Users,
  Search,
  SlidersHorizontal,
  List,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Pencil,
  UserX,
  UserCheck,
  Trash2,
  AlertTriangle,
} from "lucide-react"

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
type SortOption = "joined_desc" | "joined_asc" | "name_asc" | "name_desc" | "lastlogin_desc"

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100]
const ROLE_OPTIONS = ["USER", "MODERATOR", "ADMIN"]

function getInitials(name: string | null, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function statusClass(status: string): string {
  if (status === "ACTIVE") return "status-published"
  if (status === "SUSPENDED") return "status-discontinued"
  return "status-testing"
}

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

export default function UsersTable({ initialUsers, currentUserEmail }: UsersTableProps) {
  const [users, setUsers] = useState(initialUsers)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [roleFilter, setRoleFilter] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [sortOption, setSortOption] = useState<SortOption>("joined_desc")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  const [isBulkLoading, setIsBulkLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const canModifyUser = (user: User) => user.role !== "ADMIN" && user.email !== currentUserEmail

  const filteredUsers = useMemo(() => {
    const query = searchInput.trim().toLowerCase()
    return users
      .filter((u) => (filter === "all" ? true : u.status === filter))
      .filter((u) => (roleFilter ? u.role === roleFilter : true))
      .filter((u) =>
        query
          ? (u.name || "").toLowerCase().includes(query) || u.email.toLowerCase().includes(query)
          : true,
      )
      .sort((a, b) => {
        switch (sortOption) {
          case "joined_asc":
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          case "name_asc":
            return (a.name || a.email).localeCompare(b.name || b.email)
          case "name_desc":
            return (b.name || b.email).localeCompare(a.name || a.email)
          case "lastlogin_desc": {
            if (!a.lastLogin && !b.lastLogin) return 0
            if (!a.lastLogin) return 1
            if (!b.lastLogin) return -1
            return new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime()
          }
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }
      })
  }, [users, filter, roleFilter, searchInput, sortOption])

  const selectableUsers = filteredUsers.filter(canModifyUser)

  const totalUsers = filteredUsers.length
  const totalPages = Math.max(1, Math.ceil(totalUsers / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const rangeStart = totalUsers === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1
  const rangeEnd = Math.min(currentPage * rowsPerPage, totalUsers)
  const paginated = useMemo(
    () => filteredUsers.slice((currentPage - 1) * rowsPerPage, (currentPage - 1) * rowsPerPage + rowsPerPage),
    [filteredUsers, currentPage, rowsPerPage],
  )

  const pageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = []
    const maxToShow = 3
    if (totalPages <= maxToShow + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      for (let i = 1; i <= Math.min(maxToShow, totalPages - 1); i++) pages.push(i)
      if (currentPage > maxToShow && currentPage < totalPages) pages.push("ellipsis", currentPage)
      else pages.push("ellipsis")
      pages.push(totalPages)
    }
    return pages
  }, [totalPages, currentPage])

  const toggleSelection = (userId: number) => {
    const next = new Set(selectedIds)
    next.has(userId) ? next.delete(userId) : next.add(userId)
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableUsers.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(selectableUsers.map((u) => u.id)))
  }

  const bulkUpdateStatus = async (action: "suspend" | "activate") => {
    if (selectedIds.size === 0) return
    setIsBulkLoading(true)
    try {
      const response = await fetch("/api/admin/users/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedIds), action }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update users")
      const newStatus = action === "suspend" ? "SUSPENDED" : "ACTIVE"
      setUsers((prev) => prev.map((u) => (selectedIds.has(u.id) ? { ...u, status: newStatus } : u)))
      setSelectedIds(new Set())
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update users")
    } finally {
      setIsBulkLoading(false)
    }
  }

  const bulkDeleteUsers = async () => {
    if (selectedIds.size === 0) return
    setIsBulkLoading(true)
    try {
      const response = await fetch("/api/admin/users/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedIds) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to delete users")
      setUsers((prev) => prev.filter((u) => !selectedIds.has(u.id)))
      setSelectedIds(new Set())
      setShowDeleteModal(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete users")
    } finally {
      setIsBulkLoading(false)
    }
  }

  const statusCounts = {
    all: users.length,
    ACTIVE: users.filter((u) => u.status === "ACTIVE").length,
    SUSPENDED: users.filter((u) => u.status === "SUSPENDED").length,
    PENDING: users.filter((u) => u.status === "PENDING").length,
  }

  const tabs: { key: StatusFilter; label: string; count: number; dot?: string }[] = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "ACTIVE", label: "Active", count: statusCounts.ACTIVE, dot: "status-dot-active" },
    { key: "SUSPENDED", label: "Suspended", count: statusCounts.SUSPENDED, dot: "status-dot-suspended" },
    { key: "PENDING", label: "Pending", count: statusCounts.PENDING, dot: "status-dot-pending" },
  ]

  const activeFilterCount = roleFilter ? 1 : 0

  const renderActions = (user: User) => (
    <Link
      href={`/admin/users/${user.id}/edit`}
      className="action-icon-btn"
      aria-label={`Edit ${user.name || user.email}`}
      title="Edit user"
    >
      <Pencil size={16} />
    </Link>
  )

  return (
    <div>
      {/* Status tabs */}
      <div className="user-tabs" role="tablist" aria-label="Filter users by status">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={filter === tab.key}
            className={`user-tab ${filter === tab.key ? "is-active" : ""}`}
            onClick={() => {
              setFilter(tab.key)
              setPage(1)
            }}
          >
            {tab.key === "all" ? (
              <Users size={16} className="user-tab-icon" />
            ) : (
              <span className={`status-dot ${tab.dot}`} aria-hidden="true" />
            )}
            <span>{tab.label}</span>
            <span className="user-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="patterns-toolbar">
        <div className="patterns-search">
          <Search size={18} className="patterns-search-icon" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
              setPage(1)
            }}
            placeholder="Search users by name or email..."
            aria-label="Search users"
          />
        </div>

        <button
          type="button"
          className={`filters-toggle-btn ${showFilters ? "is-active" : ""}`}
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal size={16} />
          Filters
          <span className="filters-count">{activeFilterCount}</span>
        </button>

        <div className="patterns-sort">
          <label htmlFor="user-sort">Sort by:</label>
          <select
            id="user-sort"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
          >
            <option value="joined_desc">Joined (Newest)</option>
            <option value="joined_asc">Joined (Oldest)</option>
            <option value="name_asc">Name (A–Z)</option>
            <option value="name_desc">Name (Z–A)</option>
            <option value="lastlogin_desc">Last Login</option>
          </select>
        </div>

        <div className="view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={viewMode === "list" ? "is-active" : ""}
            onClick={() => setViewMode("list")}
            aria-label="List view"
            aria-pressed={viewMode === "list"}
          >
            <List size={18} />
          </button>
          <button
            type="button"
            className={viewMode === "grid" ? "is-active" : ""}
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      {/* Optional role filter panel */}
      {showFilters && (
        <div className="apf-panel user-filter-panel">
          <div className="apf-field" style={{ maxWidth: 260 }}>
            <label className="apf-label" htmlFor="role-filter">
              Role
            </label>
            <select
              id="role-filter"
              className="apf-select"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="user-bulk-bar">
          <span>
            <strong>{selectedIds.size}</strong> user{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="user-bulk-actions">
            <button
              type="button"
              className="bulk-btn bulk-btn-warning"
              onClick={() => bulkUpdateStatus("suspend")}
              disabled={isBulkLoading}
            >
              <UserX size={15} /> Suspend
            </button>
            <button
              type="button"
              className="bulk-btn bulk-btn-success"
              onClick={() => bulkUpdateStatus("activate")}
              disabled={isBulkLoading}
            >
              <UserCheck size={15} /> Activate
            </button>
            <button
              type="button"
              className="bulk-btn bulk-btn-danger"
              onClick={() => setShowDeleteModal(true)}
              disabled={isBulkLoading}
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </div>
      )}

      <div className="patterns-resultbar">
        <span className="patterns-count">
          Showing {rangeStart}–{rangeEnd} of {totalUsers.toLocaleString()} users
        </span>
      </div>

      {/* Content */}
      <div className="patterns-content">
        {totalUsers === 0 ? (
          <div className="patterns-empty">No users found.</div>
        ) : viewMode === "list" ? (
          <div className="patterns-table-wrap">
            <table className="patterns-table">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={selectableUsers.length > 0 && selectedIds.size === selectableUsers.length}
                      onChange={toggleSelectAll}
                      disabled={selectableUsers.length === 0}
                      aria-label="Select all users"
                    />
                  </th>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Joined</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleSelection(user.id)}
                        disabled={!canModifyUser(user)}
                        aria-label={`Select ${user.name || user.email}`}
                      />
                    </td>
                    <td>
                      <div className="user-cell">
                        <span className="user-avatar" aria-hidden="true">
                          {getInitials(user.name, user.email)}
                        </span>
                        <span className="user-name">{user.name || <span className="text-muted-cell">No name</span>}</span>
                      </div>
                    </td>
                    <td className="text-muted-cell">{user.email}</td>
                    <td>
                      <span className="role-pill">{user.role}</span>
                    </td>
                    <td>
                      <span className="user-status">
                        <span className={`status-dot ${statusClass(user.status).replace("status-", "status-dot-")}`} aria-hidden="true" />
                        {statusLabel(user.status)}
                      </span>
                    </td>
                    <td className="text-muted-cell">
                      {user.lastLogin ? (
                        formatDistanceToNow(new Date(user.lastLogin), { addSuffix: true })
                      ) : (
                        <span className="user-never">Never</span>
                      )}
                    </td>
                    <td className="text-muted-cell">
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                    </td>
                    <td>
                      <div className="pattern-actions">{renderActions(user)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="patterns-grid">
            {paginated.map((user) => (
              <div key={user.id} className="pattern-card">
                <div className="user-card-body">
                  <div className="user-card-head">
                    <span className="user-avatar user-avatar-lg" aria-hidden="true">
                      {getInitials(user.name, user.email)}
                    </span>
                    <div className="user-card-select">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleSelection(user.id)}
                        disabled={!canModifyUser(user)}
                        aria-label={`Select ${user.name || user.email}`}
                      />
                    </div>
                  </div>
                  <h3 className="user-card-name">{user.name || "No name"}</h3>
                  <p className="user-card-email">{user.email}</p>
                  <div className="user-card-meta">
                    <span className="role-pill">{user.role}</span>
                    <span className="user-status">
                      <span className={`status-dot ${statusClass(user.status).replace("status-", "status-dot-")}`} aria-hidden="true" />
                      {statusLabel(user.status)}
                    </span>
                  </div>
                  <div className="user-card-footer">
                    <span className="text-muted-cell">
                      Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                    </span>
                    {renderActions(user)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalUsers > 0 && (
          <div className="patterns-footer">
            <div className="rows-per-page">
              <label htmlFor="user-rows">Rows per page:</label>
              <select
                id="user-rows"
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value))
                  setPage(1)
                }}
              >
                {ROWS_PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <nav className="pagination" aria-label="User pages">
              <button
                type="button"
                className="page-arrow"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              {pageNumbers.map((p, i) =>
                p === "ellipsis" ? (
                  <span key={`e-${i}`} className="page-ellipsis">
                    …
                  </span>
                ) : (
                  <button
                    type="button"
                    key={p}
                    className={`page-num ${p === currentPage ? "is-active" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                type="button"
                className="page-arrow"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
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
                  Are you sure you want to permanently delete <strong>{selectedIds.size}</strong> user
                  {selectedIds.size !== 1 ? "s" : ""}?
                </p>
                <p className="text-danger mb-0">
                  <strong>This action cannot be undone.</strong> All associated data will be removed.
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
                <button type="button" className="btn btn-danger" onClick={bulkDeleteUsers} disabled={isBulkLoading}>
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
