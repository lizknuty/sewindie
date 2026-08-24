import SimpleEntityForm from "../../components/SimpleEntityForm"

export default function NewAttributePage() {
  return <SimpleEntityForm entityType="Attribute" apiPath="/api/attributes" returnPath="/admin/attributes" />
}
