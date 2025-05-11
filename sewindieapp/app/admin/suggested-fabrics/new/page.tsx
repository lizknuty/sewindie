import SimpleEntityForm from "../../components/SimpleEntityForm"

export default function NewSuggestedFabricPage() {
  return (
    <div>
      <h1 className="mb-4">Add New Suggested Fabric</h1>
      <SimpleEntityForm
        entityType="Suggested Fabric"
        apiPath="/api/suggested-fabrics"
        returnPath="/admin/suggested-fabrics"
      />
    </div>
  )
}
