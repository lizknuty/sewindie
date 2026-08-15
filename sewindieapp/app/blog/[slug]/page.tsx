import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await prisma.blogPost.findFirst({ where: { slug, published: true } })

  if (!post) {
    return { title: "Post Not Found | SewIndie" }
  }

  return {
    title: `${post.title} | SewIndie Blog`,
    description: post.excerpt || undefined,
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const post = await prisma.blogPost.findFirst({
    where: { slug, published: true },
    include: { author: { select: { name: true } } },
  })

  if (!post) {
    notFound()
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <Link href="/blog" className="text-decoration-none d-inline-block mb-4">
            &larr; Back to blog
          </Link>

          <article>
            <header className="mb-4">
              <h1 className="mb-3">{post.title}</h1>
              <div className="d-flex flex-wrap align-items-center gap-2 text-muted small">
                {post.author?.name && <span>{post.author.name}</span>}
                {post.author?.name && post.publishedAt && <span aria-hidden="true">&middot;</span>}
                {post.publishedAt && (
                  <time dateTime={new Date(post.publishedAt).toISOString()}>{formatDate(post.publishedAt)}</time>
                )}
              </div>
            </header>

            {post.coverImageUrl && (
              <img
                src={post.coverImageUrl || "/placeholder.svg"}
                alt=""
                className="img-fluid rounded mb-4 w-100"
                style={{ maxHeight: "26rem", objectFit: "cover" }}
              />
            )}

            <div className="blog-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}
