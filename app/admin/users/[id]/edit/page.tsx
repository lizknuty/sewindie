import UserForm from "@/app/admin/users/components/UserForm"
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const userId = Number.parseInt(params.id, 10)

  if (isNaN(userId)) {
    notFound()
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    notFound()
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit User</h1>
      <UserForm userId={params.id} />
    </div>
  )
}
