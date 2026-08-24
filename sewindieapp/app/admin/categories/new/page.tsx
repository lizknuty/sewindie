import SimpleEntityForm from "../../components/SimpleEntityForm"

export default function NewCategoryPage() {
  return <SimpleEntityForm entityType="Category" apiPath="/api/categories" returnPath="/admin/categories" />
}
