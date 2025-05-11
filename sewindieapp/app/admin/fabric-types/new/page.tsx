import SimpleEntityForm from "../../components/SimpleEntityForm"

export default function NewFabricTypePage() {
  return (
    <div>
      <h1 className="mb-4">Add New Fabric Type</h1>
      <SimpleEntityForm entityType="Fabric Type" apiPath="/api/fabric-types" returnPath="/admin/fabric-types" />
    </div>
  )
}
