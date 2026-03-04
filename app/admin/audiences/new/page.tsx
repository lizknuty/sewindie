import SimpleEntityForm from "@/app/admin/components/SimpleEntityForm"

export default function NewAudiencePage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Add New Audience</h1>
      <SimpleEntityForm entityType="audiences" />
    </div>
  )
}
