import SimpleEntityForm from "@/app/admin/components/SimpleEntityForm"

export default function NewFormatPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Add New Format</h1>
      <SimpleEntityForm entityType="formats" />
    </div>
  )
}
