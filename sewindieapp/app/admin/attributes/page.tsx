import Link from "next/link"
import prisma from "@/lib/prisma"
import { Plus } from "lucide-react"

export default async function AttributesPage() {
  const attributes = await prisma.attribute.findMany({
    orderBy: {
      name: "asc",
    },
    include: {
      PatternAttribute: true,
    },
  })

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Attributes</h1>
        <Link href="/admin/attributes/new" className="btn btn-primary">
          <Plus size={18} className="me-2" />
          Add Attribute
        </Link>
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>Name</th>
              <th>Patterns</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {attributes.map((attribute) => (
              <tr key={attribute.id}>
                <td>{attribute.name}</td>
                <td>{attribute.PatternAttribute?.length || 0}</td>
                <td>
                  <div className="btn-group">
                    <Link href={`/admin/attributes/${attribute.id}/edit`} className="btn btn-sm btn-outline-secondary">
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
