import SimpleEntityForm from "../../components/SimpleEntityForm"

export default function NewCategoryPage() {
  return (
    <div>
      <h1 className="mb-4">Add New Category</h1>
      <SimpleEntityForm entityType="Category" apiPath="/api/categories" returnPath="/admin/categories" />
    </div>
  )
}
