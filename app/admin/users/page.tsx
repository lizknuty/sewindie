"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Search, Pencil, Trash2, Ban, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type UserStatus = "ACTIVE" | "SUSPENDED" | "PENDING"
type UserRole = "USER" | "MODERATOR" | "ADMIN"

type User = {
  id: number
  name: string | null
  email: string
  role: UserRole
  status: UserStatus
  lastLogin: string | null
  createdAt: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (roleFilter) params.set("role", roleFilter)
    if (statusFilter) params.set("status", statusFilter)

    const res = await fetch(`/api/admin/users?${params.toString()}`)
    const data = await res.json()
    setUsers(data)
    setLoading(false)
  }, [search, roleFilter, statusFilter])

  useEffect(() => {
    const debounce = setTimeout(fetchUsers, 300)
    return () => clearTimeout(debounce)
  }, [fetchUsers])

  async function handleStatusToggle(user: User) {
    setActionLoading(user.id)
    const newStatus: UserStatus = user.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    await fetchUsers()
    setActionLoading(null)
  }

  async function handleDelete(user: User) {
    if (!confirm(`Are you sure you want to delete ${user.name || user.email}? This cannot be undone.`)) return
    setActionLoading(user.id)
    await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" })
    await fetchUsers()
    setActionLoading(null)
  }

  const statusBadge = (status: UserStatus) => {
    const styles: Record<UserStatus, string> = {
      ACTIVE: "bg-green-100 text-green-800",
      SUSPENDED: "bg-red-100 text-red-800",
      PENDING: "bg-yellow-100 text-yellow-800",
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
        {status}
      </span>
    )
  }

  const roleBadge = (role: UserRole) => {
    const styles: Record<UserRole, string> = {
      ADMIN: "bg-purple-100 text-purple-800",
      MODERATOR: "bg-blue-100 text-blue-800",
      USER: "bg-gray-100 text-gray-800",
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[role]}`}>
        {role}
      </span>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Users</h1>
        <Button asChild>
          <Link href="/admin/users/new">
            <Plus className="mr-2 h-4 w-4" />
            Add New User
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">All Roles</option>
              <option value="USER">User</option>
              <option value="MODERATOR">Moderator</option>
              <option value="ADMIN">Admin</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500 py-4">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className={user.status === "SUSPENDED" ? "opacity-60" : ""}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.name || "N/A"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{roleBadge(user.role)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{statusBadge(user.status)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/admin/users/${user.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusToggle(user)}
                            disabled={actionLoading === user.id}
                            title={user.status === "SUSPENDED" ? "Unsuspend user" : "Suspend user"}
                          >
                            {user.status === "SUSPENDED"
                              ? <CheckCircle className="h-4 w-4 text-green-600" />
                              : <Ban className="h-4 w-4 text-yellow-600" />
                            }
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(user)}
                            disabled={actionLoading === user.id}
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
