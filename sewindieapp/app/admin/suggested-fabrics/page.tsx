import Link from "next/link"
import prisma from "@/lib/prisma"
import { Plus } from "lucide-react"

export default async function SuggestedFabricsPage() {
  const suggestedFabrics = await prisma.suggestedFabric.findMany({
    orderBy: {
      name: "asc",
    },
    include: {
      PatternSuggestedFabric: true,
    },
  })

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Suggested Fabrics</h1>
        <Link href="/admin/suggested-fabrics/new" className="btn btn-primary">
          <Plus size={18} className="me-2" />
          Add Suggested Fabric
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
            {suggestedFabrics.map((suggestedFabric) => (
              <tr key={suggestedFabric.id}>
                <td>{suggestedFabric.name}</td>
                <td>{suggestedFabric.PatternSuggestedFabric?.length || 0}</td>
                <td>
                  <div className="btn-group">
                    <Link
                      href={`/admin/suggested-fabrics/${suggestedFabric.id}/edit`}
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
