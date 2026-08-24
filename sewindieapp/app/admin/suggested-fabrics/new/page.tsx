import SimpleEntityForm from "../../components/SimpleEntityForm"

export default function NewSuggestedFabricPage() {
  return (
    <SimpleEntityForm
      entityType="Suggested Fabric"
      apiPath="/api/suggested-fabrics"
      returnPath="/admin/suggested-fabrics"
    />
  )
}
