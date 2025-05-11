import Link from "next/link"
import prisma from "@/lib/prisma"
import { Plus } from "lucide-react"

export default async function FormatsPage() {
  const formats = await prisma.format.findMany({
    orderBy: {
      name: "asc",
    },
    include: {
      PatternFormat: true,
    },
  })

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Formats</h1>
        <Link href="/admin/formats/new" className="btn btn-primary">
          <Plus size={18} className="me-2" />
          Add Format
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
            {formats.map((format) => (
              <tr key={format.id}>
                <td>{format.name}</td>
                <td>{format.PatternFormat?.length || 0}</td>
                <td>
                  <div className="btn-group">
                    <Link href={`/admin/formats/${format.id}/edit`} className="btn btn-sm btn-outline-secondary">
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
