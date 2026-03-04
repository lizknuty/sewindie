import UserForm from "@/app/admin/users/components/UserForm"

export default function NewUserPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Add New User</h1>
      <UserForm />
    </div>
  )
}
