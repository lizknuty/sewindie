import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkModeratorAccess } from "@/lib/admin-middleware"
import { slugify } from "@/lib/blog"

// List all posts (admin view - includes drafts). Requires moderator access.
export async function GET() {
  try {
    const { authorized, response } = await checkModeratorAccess()
    if (!authorized) return response

    const posts = await prisma.blogPost.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        author: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ success: true, posts })
  } catch (error) {
    console.error("Error fetching blog posts:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch blog posts" }, { status: 500 })
  }
}

async function generateUniqueSlug(base: string, excludeId?: number): Promise<string> {
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

export async function POST(request: NextRequest) {
  try {
    const { authorized, response, session } = await checkModeratorAccess()
    if (!authorized) return response

    const data = await request.json()

    if (!data.title || typeof data.title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }
    if (!data.content || typeof data.content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const slug = await generateUniqueSlug(data.slug?.trim() ? data.slug : data.title)
    const published = Boolean(data.published)
    const authorId = session?.user?.id ? Number.parseInt(session.user.id, 10) : null

    const post = await prisma.blogPost.create({
      data: {
        title: data.title.trim(),
        slug,
        excerpt: data.excerpt?.trim() || null,
        content: data.content,
        coverImageUrl: data.coverImageUrl?.trim() || null,
        published,
        publishedAt: published ? new Date() : null,
        authorId: authorId && !Number.isNaN(authorId) ? authorId : null,
      },
    })

    return NextResponse.json({ success: true, post }, { status: 201 })
  } catch (error) {
    console.error("Error creating blog post:", error)
    return NextResponse.json({ success: false, error: "Failed to create blog post" }, { status: 500 })
  }
}
