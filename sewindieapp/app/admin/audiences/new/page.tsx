import SimpleEntityForm from "../../components/SimpleEntityForm"

export default function NewAudiencePage() {
  return (
    <div>
      <h1 className="mb-4">Add New Audience</h1>
      <SimpleEntityForm entityType="Audience" apiPath="/api/audiences" returnPath="/admin/audiences" />
    </div>
  )
}
