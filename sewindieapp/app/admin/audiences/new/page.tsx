import SimpleEntityForm from "../../components/SimpleEntityForm"

export default function NewAudiencePage() {
  return <SimpleEntityForm entityType="Audience" apiPath="/api/audiences" returnPath="/admin/audiences" />
}
