import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Plus } from "lucide-react"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/api/auth/[...nextauth]/options"
import { redirect } from "next/navigation"
import UsersTable from "./components/UsersTable"

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
      status: true,
      lastLogin: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  // Serialize dates to strings for client component
  const serializedUsers = users.map((user) => ({
    ...user,
    lastLogin: user.lastLogin?.toISOString() || null,
    createdAt: user.createdAt.toISOString(),
  }))

  return (
    <div className="admin-patterns-page admin-users-page">
      <header className="patterns-page-header">
        <div>
          <h1 className="patterns-title">Users</h1>
          <p className="patterns-subtitle">Manage registered users and their accounts.</p>
        </div>
        <Link href="/admin/users/new" className="btn-add-pattern">
          <Plus size={18} />
          Add User
        </Link>
      </header>

      <UsersTable 
        initialUsers={serializedUsers} 
        currentUserEmail={session.user.email!} 
      />
    </div>
  )
}
