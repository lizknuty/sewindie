import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import UserForm from "../../components/UserForm"

export default async function EditUserPage({ params }: { params: { id: string } }) {
  // Convert the string ID to a number for Prisma
  const userId = Number.parseInt(params.id, 10)

  if (isNaN(userId)) {
    notFound()
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  })

  if (!user) {
    notFound()
  }

  return (
    <div>
      <h1 className="mb-4">Edit User</h1>
      <UserForm user={user} />
    </div>
  )
}
