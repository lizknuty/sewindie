import Link from "next/link"
import Image from "next/image"
import { Pencil } from "lucide-react"
import BlogStatusBadge from "./BlogStatusBadge"
import type { AdminBlogPost } from "@/admin/blog/types"

function formatDate(value: string | null) {
  if (!value) return "Not published"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function BlogPostsGrid({ posts }: { posts: AdminBlogPost[] }) {
  return (
    <div className="patterns-grid">
      {posts.map((post) => (
        <div key={post.id} className="pattern-card">
          <div className="pattern-card-media">
            {post.coverImageUrl ? (
              <Image src={post.coverImageUrl || "/placeholder.svg"} alt={post.title} width={220} height={220} />
            ) : (
              <div className="pattern-card-media-empty" aria-hidden="true" />
            )}
            <div className="pattern-card-status">
              <BlogStatusBadge published={post.published} />
            </div>
          </div>
          <div className="pattern-card-body">
            <h3 className="pattern-card-title">{post.title}</h3>
            <p className="pattern-card-designer">{post.User?.name ?? "—"}</p>
            <div className="pattern-card-footer">
              <span className="designer-pattern-count">{formatDate(post.publishedAt)}</span>
              <Link
                href={`/admin/blog/${post.id}/edit`}
                className="action-icon-btn"
                aria-label={`Edit ${post.title}`}
                title="Edit post"
              >
                <Pencil size={16} />
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
