import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"
import { slugify } from "@/lib/blog"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const resolvedParams = await params
    const postId = Number.parseInt(resolvedParams.id, 10)
    if (isNaN(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 })
    }

    const post = await prisma.blogPost.findUnique({
      where: { id: postId },
      include: { author: { select: { id: true, name: true } } },
    })

    if (!post) {
      return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error("Error fetching blog post:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch blog post" }, { status: 500 })
  }
}

async function generateUniqueSlug(base: string, excludeId: number): Promise<string> {
  const root = slugify(base) || "post"
  let candidate = root
  let suffix = 1

  while (true) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: candidate } })
    if (!existing || existing.id === excludeId) return candidate
    suffix += 1
    candidate = `${root}-${suffix}`
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const resolvedParams = await params
    const postId = Number.parseInt(resolvedParams.id, 10)
    if (isNaN(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 })
    }

    const data = await request.json()

    if (!data.title || typeof data.title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }
    if (!data.content || typeof data.content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const existing = await prisma.blogPost.findUnique({ where: { id: postId } })
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    const slug = await generateUniqueSlug(data.slug?.trim() ? data.slug : data.title, postId)
    const published = Boolean(data.published)

    // Set publishedAt when transitioning to published; clear it when unpublished.
    let publishedAt = existing.publishedAt
    if (published && !existing.published) {
      publishedAt = new Date()
    } else if (!published) {
      publishedAt = null
    }

    const post = await prisma.blogPost.update({
      where: { id: postId },
      data: {
        title: data.title.trim(),
        slug,
        excerpt: data.excerpt?.trim() || null,
        content: data.content,
        coverImageUrl: data.coverImageUrl?.trim() || null,
        published,
        publishedAt,
      },
    })

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error("Error updating blog post:", error)
    return NextResponse.json({ success: false, error: "Failed to update blog post" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const resolvedParams = await params
    const postId = Number.parseInt(resolvedParams.id, 10)
    if (isNaN(postId)) {
      return NextResponse.json({ error: "Invalid post ID" }, { status: 400 })
    }

    const existing = await prisma.blogPost.findUnique({ where: { id: postId } })
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    await prisma.blogPost.delete({ where: { id: postId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting blog post:", error)
    return NextResponse.json({ success: false, error: "Failed to delete blog post" }, { status: 500 })
  }
}
