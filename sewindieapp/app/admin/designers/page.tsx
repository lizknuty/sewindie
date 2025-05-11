import Link from "next/link"
import Image from "next/image"
import prisma from "@/lib/prisma"
import { Plus } from "lucide-react"

export default async function DesignersPage() {
  const designers = await prisma.designer.findMany({
    orderBy: {
      name: "asc",
    },
  })

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Designers</h1>
        <Link href="/admin/designers/new" className="btn btn-primary">
          <Plus size={18} className="me-2" />
          Add Designer
        </Link>
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>Logo</th>
              <th>Name</th>
              <th>Website</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {designers.map((designer) => (
              <tr key={designer.id}>
                <td>
                  {designer.logo_url ? (
                    <Image
                      src={designer.logo_url || "/placeholder.svg"}
                      alt={designer.name}
                      width={50}
                      height={50}
                      className="rounded"
                    />
                  ) : (
                    <div className="bg-secondary rounded" style={{ width: 50, height: 50 }}></div>
                  )}
                </td>
                <td>{designer.name}</td>
                <td>
                  {designer.url ? (
                    <a href={designer.url} target="_blank" rel="noopener noreferrer" className="text-primary">
                      {designer.url}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  <div className="btn-group">
                    <Link href={`/admin/designers/${designer.id}/edit`} className="btn btn-sm btn-outline-secondary">
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
