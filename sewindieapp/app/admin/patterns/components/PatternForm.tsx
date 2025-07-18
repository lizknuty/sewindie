import Link from "next/link"
import Image from "next/image"
import prisma from "@/lib/prisma"
import { Plus } from "lucide-react"

function formatDate(date: Date | null | undefined) {
  if (!date) return "-"
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default async function PatternsPage() {
  const patterns = await prisma.pattern.findMany({
    include: {
      designer: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  })

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Patterns</h1>
        <Link href="/admin/patterns/new" className="btn btn-primary">
          <Plus size={18} className="me-2" />
          Add Pattern
        </Link>
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-hover">
          <thead>
            <tr>
              <th>Thumbnail</th>
              <th>Name</th>
              <th>Designer</th>
              <th>Difficulty</th>
              <th>Released</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {patterns.map((pattern) => (
              <tr key={pattern.id}>
                <td>
                  {pattern.thumbnail_url ? (
                    <Image
                      src={pattern.thumbnail_url || "/placeholder.svg"}
                      alt={pattern.name}
                      width={50}
                      height={50}
                      className="rounded"
                    />
                  ) : (
                    <div className="bg-secondary rounded" style={{ width: 50, height: 50 }}></div>
                  )}
                </td>
                <td>{pattern.name}</td>
                <td>{pattern.designer?.name}</td>
                <td>{pattern.difficulty || "-"}</td>
                <td>{formatDate(pattern.release_date)}</td>
                <td>
                  <div className="btn-group">
                    <Link href={`/admin/patterns/${pattern.id}/edit`} className="btn btn-sm btn-outline-secondary">
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
