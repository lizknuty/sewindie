import SimpleEntityForm from "../../components/SimpleEntityForm"

export default function NewFabricTypePage() {
  return <SimpleEntityForm entityType="Fabric Type" apiPath="/api/fabric-types" returnPath="/admin/fabric-types" />
}
