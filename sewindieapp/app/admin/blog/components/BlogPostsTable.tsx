import Link from "next/link"
import { Pencil, ExternalLink } from "lucide-react"
import BlogStatusBadge from "./BlogStatusBadge"
import type { AdminBlogPost } from "@/admin/blog/types"

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function BlogPostsTable({ posts }: { posts: AdminBlogPost[] }) {
  return (
    <div className="patterns-table-wrap">
      <table className="patterns-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Author</th>
            <th>Published</th>
            <th>Updated</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const publishedLabel = formatDate(post.publishedAt)
            return (
              <tr key={post.id}>
                <td>
                  <span className="pattern-name">{post.title}</span>
                  {post.excerpt && <p className="blog-excerpt">{post.excerpt}</p>}
                </td>
                <td>
                  <BlogStatusBadge published={post.published} />
                </td>
                <td className="text-muted-cell">{post.User?.name ?? "—"}</td>
                <td className="text-muted-cell">
                  {publishedLabel ?? <span className="user-never">Not published</span>}
                </td>
                <td className="text-muted-cell">{formatDate(post.updatedAt)}</td>
                <td>
                  <div className="pattern-actions">
                    <Link
                      href={`/admin/blog/${post.id}/edit`}
                      className="action-icon-btn"
                      aria-label={`Edit ${post.title}`}
                      title="Edit post"
                    >
                      <Pencil size={16} />
                    </Link>
                    {post.published && (
                      <Link
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="action-icon-btn"
                        aria-label={`View ${post.title} on the site`}
                        title="View on site"
                      >
                        <ExternalLink size={16} />
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
