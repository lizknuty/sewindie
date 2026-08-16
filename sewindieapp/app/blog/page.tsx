import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Blog | SewIndie",
  description:
    "News, sewing tips, designer spotlights, and updates from the SewIndie community of independent sewing pattern lovers.",
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    include: { author: { select: { name: true } } },
  })

  const [featured, ...rest] = posts

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-10">
          <header className="mb-5 text-center">
            <h1 className="mb-3">SewIndie Blog</h1>
            <p className="lead mb-0">
              Designer spotlights, sewing tips, and news from the world of independent patterns.
            </p>
          </header>

          {posts.length === 0 && (
            <div className="text-center text-muted py-5">
              <p className="mb-0">No posts yet. Check back soon!</p>
            </div>
          )}

          {featured && (
            <article className="card border-0 shadow-sm mb-5">
              {featured.coverImageUrl && (
                <img
                  src={featured.coverImageUrl || "/placeholder.svg"}
                  alt=""
                  className="card-img-top"
                  style={{ maxHeight: "22rem", objectFit: "cover" }}
                />
              )}
              <div className="card-body p-4 p-md-5">
                <h2 className="h3 mb-3">
                  <Link href={`/blog/${featured.slug}`} className="text-decoration-none text-reset">
                    {featured.title}
                  </Link>
                </h2>
                {featured.excerpt && <p className="mb-4">{featured.excerpt}</p>}
                <div className="d-flex flex-wrap align-items-center gap-2 text-muted small">
                  {featured.author?.name && <span>{featured.author.name}</span>}
                  {featured.author?.name && featured.publishedAt && <span aria-hidden="true">&middot;</span>}
                  {featured.publishedAt && (
                    <time dateTime={new Date(featured.publishedAt).toISOString()}>
                      {formatDate(featured.publishedAt)}
                    </time>
                  )}
                </div>
              </div>
            </article>
          )}

          {rest.length > 0 && (
            <>
              <h2 className="h5 mb-4">More posts</h2>
              <div className="row g-4">
                {rest.map((post) => (
                  <div key={post.id} className="col-md-6">
                    <article className="card h-100 border-0 shadow-sm">
                      {post.coverImageUrl && (
                        <img
                          src={post.coverImageUrl || "/placeholder.svg"}
                          alt=""
                          className="card-img-top"
                          style={{ maxHeight: "12rem", objectFit: "cover" }}
                        />
                      )}
                      <div className="card-body d-flex flex-column p-4">
                        <h3 className="h5 mb-2">
                          <Link href={`/blog/${post.slug}`} className="text-decoration-none text-reset">
                            {post.title}
                          </Link>
                        </h3>
                        {post.excerpt && <p className="mb-4 flex-grow-1">{post.excerpt}</p>}
                        <div className="d-flex flex-wrap align-items-center gap-2 text-muted small mt-auto">
                          {post.author?.name && <span>{post.author.name}</span>}
                          {post.author?.name && post.publishedAt && <span aria-hidden="true">&middot;</span>}
                          {post.publishedAt && (
                            <time dateTime={new Date(post.publishedAt).toISOString()}>
                              {formatDate(post.publishedAt)}
                            </time>
                          )}
                        </div>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mt-5 pt-3 border-top text-center">
            <p className="mb-0">
              Want to see your work featured? <Link href="/contribute">Contribute to SewIndie</Link> or{" "}
              <Link href="/contact">get in touch</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
