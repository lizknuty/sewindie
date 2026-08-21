import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Plus } from "lucide-react"
import BlogPostsView from "./components/BlogPostsView"
import type { AdminBlogPost } from "./types"

export const dynamic = "force-dynamic"

export default async function AdminBlogPage() {
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: "desc" },
    include: { User: { select: { id: true, name: true } } },
  })

  const serialized: AdminBlogPost[] = posts.map((post) => ({
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    coverImageUrl: post.coverImageUrl,
    published: post.published,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    User: post.User ? { id: post.User.id, name: post.User.name } : null,
  }))

  return (
    <div className="admin-patterns-page">
      <header className="patterns-page-header">
        <div>
          <h1 className="patterns-title">Blog Posts</h1>
          <p className="patterns-subtitle">Write and publish articles for the SewIndie blog.</p>
        </div>
        <Link href="/admin/blog/new" className="btn-add-pattern">
          <Plus size={18} />
          New Post
        </Link>
      </header>

      <BlogPostsView posts={serialized} />
    </div>
  )
}
