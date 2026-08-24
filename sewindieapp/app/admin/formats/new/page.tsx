import SimpleEntityForm from "../../components/SimpleEntityForm"

export default function NewFormatPage() {
  return <SimpleEntityForm entityType="Format" apiPath="/api/formats" returnPath="/admin/formats" />
}
