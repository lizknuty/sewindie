import DesignerForm from "@/app/admin/designers/components/DesignerForm"

export default function NewDesignerPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Add New Designer</h1>
      <DesignerForm />
    </div>
  )
}
