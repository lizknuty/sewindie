import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Plus } from "lucide-react"

export const dynamic = "force-dynamic"

function formatDate(date: Date | null) {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default async function AdminBlogPage() {
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: "desc" },
    include: { User: { select: { id: true, name: true } } },
  })

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Blog</h1>
        <Link href="/admin/blog/new" className="btn btn-primary">
          <Plus size={18} className="me-2" />
          New Post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="alert alert-secondary">No blog posts yet. Create your first post to get started.</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-hover align-middle">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Author</th>
                <th>Published</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>{post.title}</td>
                  <td>
                    {post.published ? (
                      <span className="badge bg-success">Published</span>
                    ) : (
                      <span className="badge bg-secondary">Draft</span>
                    )}
                  </td>
                  <td>{post.author?.name || "—"}</td>
                  <td>{formatDate(post.publishedAt)}</td>
                  <td>{formatDate(post.updatedAt)}</td>
                  <td>
                    <div className="btn-group">
                      <Link href={`/admin/blog/${post.id}/edit`} className="btn btn-sm btn-outline-secondary">
                        Edit
                      </Link>
                      {post.published && (
                        <Link
                          href={`/blog/${post.slug}`}
                          className="btn btn-sm btn-outline-secondary"
                          target="_blank"
                        >
                          View
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
