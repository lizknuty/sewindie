import SimpleEntityForm from "../../components/SimpleEntityForm"

export default function NewAttributePage() {
  return (
    <div>
      <h1 className="mb-4">Add New Attribute</h1>
      <SimpleEntityForm entityType="Attribute" apiPath="/api/attributes" returnPath="/admin/attributes" />
    </div>
  )
}
