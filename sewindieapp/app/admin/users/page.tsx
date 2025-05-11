import Link from "next/link"
import prisma from "@/lib/prisma"
import { Plus } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { redirect } from "next/navigation"

export default async function UsersPage() {
  // Check if user is admin
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    redirect("/admin")
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Users</h1>
        <Link href="/admin/users/new" className="btn btn-primary">
          <Plus size={18} className="me-2" />
          Add User
        </Link>
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span
                    className={`badge ${
                      user.role === "ADMIN" ? "bg-danger" : user.role === "MODERATOR" ? "bg-warning" : "bg-secondary"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td>{formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</td>
                <td>
                  <div className="btn-group">
                    <Link href={`/admin/users/${user.id}/edit`} className="btn btn-sm btn-outline-secondary">
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
