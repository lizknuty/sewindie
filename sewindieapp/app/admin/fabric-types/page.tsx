import Link from "next/link"
import prisma from "@/lib/prisma"
import { Plus } from "lucide-react"

export default async function FabricTypesPage() {
  const fabricTypes = await prisma.fabricType.findMany({
    orderBy: {
      name: "asc",
    },
    include: {
      PatternFabricType: true,
    },
  })

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Fabric Types</h1>
        <Link href="/admin/fabric-types/new" className="btn btn-primary">
          <Plus size={18} className="me-2" />
          Add Fabric Type
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
            {fabricTypes.map((fabricType) => (
              <tr key={fabricType.id}>
                <td>{fabricType.name}</td>
                <td>{fabricType.PatternFabricType?.length || 0}</td>
                <td>
                  <div className="btn-group">
                    <Link
                      href={`/admin/fabric-types/${fabricType.id}/edit`}
                      className="btn btn-sm btn-outline-secondary"
                    >
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
