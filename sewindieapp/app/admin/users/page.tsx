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
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Users</h1>
        <Link href="/admin/users/new" className="btn btn-primary">
          <Plus size={18} className="me-2" />
          Add User
        </Link>
      </div>

      <UsersTable 
        initialUsers={serializedUsers} 
        currentUserEmail={session.user.email!} 
      />
    </div>
  )
}
