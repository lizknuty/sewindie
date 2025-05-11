import SimpleEntityForm from "../../components/SimpleEntityForm"

export default function NewFormatPage() {
  return (
    <div>
      <h1 className="mb-4">Add New Format</h1>
      <SimpleEntityForm entityType="Format" apiPath="/api/formats" returnPath="/admin/formats" />
    </div>
  )
}
