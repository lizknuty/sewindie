import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import BlogPostForm from "../../BlogPostForm"

export const dynamic = "force-dynamic"

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const postId = Number.parseInt(resolvedParams.id, 10)

  if (Number.isNaN(postId)) {
    notFound()
  }

  const post = await prisma.blogPost.findUnique({ where: { id: postId } })

  if (!post) {
    notFound()
  }

  return (
    <div>
      <h1 className="mb-4">Edit Blog Post</h1>
      <BlogPostForm
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          coverImageUrl: post.coverImageUrl,
          published: post.published,
        }}
      />
    </div>
  )
}
