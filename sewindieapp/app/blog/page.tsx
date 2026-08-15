import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Blog | SewIndie",
  description:
    "News, sewing tips, designer spotlights, and updates from the SewIndie community of independent sewing pattern lovers.",
}

type BlogPost = {
  slug: string
  title: string
  excerpt: string
  category: string
  author: string
  date: string
  readTime: string
}

const posts: BlogPost[] = [
  {
    slug: "welcome-to-the-sewindie-blog",
    title: "Welcome to the SewIndie Blog",
    excerpt:
      "We're launching a space to share designer spotlights, sewing tips, and behind-the-scenes updates from the indie pattern world.",
    category: "News",
    author: "The SewIndie Team",
    date: "2026-08-01",
    readTime: "3 min read",
  },
  {
    slug: "choosing-the-right-fabric",
    title: "Choosing the Right Fabric for Your Next Pattern",
    excerpt:
      "Fabric choice can make or break a make. Here's how to match fabric weight, drape, and stretch to the pattern you love.",
    category: "Tips",
    author: "The SewIndie Team",
    date: "2026-07-18",
    readTime: "6 min read",
  },
  {
    slug: "designer-spotlight-summer-collections",
    title: "Designer Spotlight: Summer Collections",
    excerpt:
      "A look at some of the independent designers releasing bright, breezy patterns perfect for warm-weather sewing.",
    category: "Spotlight",
    author: "The SewIndie Team",
    date: "2026-07-02",
    readTime: "5 min read",
  },
]

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export default function BlogPage() {
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

          {featured && (
            <article className="card border-0 shadow-sm mb-5">
              <div className="card-body p-4 p-md-5">
                <span className="badge bg-primary mb-3">{featured.category}</span>
                <h2 className="h3 mb-3">
                  <Link href={`/blog/${featured.slug}`} className="text-decoration-none text-reset">
                    {featured.title}
                  </Link>
                </h2>
                <p className="mb-4">{featured.excerpt}</p>
                <div className="d-flex flex-wrap align-items-center gap-2 text-muted small">
                  <span>{featured.author}</span>
                  <span aria-hidden="true">&middot;</span>
                  <time dateTime={featured.date}>{formatDate(featured.date)}</time>
                  <span aria-hidden="true">&middot;</span>
                  <span>{featured.readTime}</span>
                </div>
              </div>
            </article>
          )}

          <h2 className="h5 mb-4">More posts</h2>
          <div className="row g-4">
            {rest.map((post) => (
              <div key={post.slug} className="col-md-6">
                <article className="card h-100 border-0 shadow-sm">
                  <div className="card-body d-flex flex-column p-4">
                    <span className="badge bg-secondary align-self-start mb-3">{post.category}</span>
                    <h3 className="h5 mb-2">
                      <Link href={`/blog/${post.slug}`} className="text-decoration-none text-reset">
                        {post.title}
                      </Link>
                    </h3>
                    <p className="mb-4 flex-grow-1">{post.excerpt}</p>
                    <div className="d-flex flex-wrap align-items-center gap-2 text-muted small">
                      <time dateTime={post.date}>{formatDate(post.date)}</time>
                      <span aria-hidden="true">&middot;</span>
                      <span>{post.readTime}</span>
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </div>

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
