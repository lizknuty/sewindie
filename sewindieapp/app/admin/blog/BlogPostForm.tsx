"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface BlogPost {
  id: number
  title: string
  slug: string
  excerpt: string | null
  content: string
  coverImageUrl: string | null
  published: boolean
}

interface BlogPostFormProps {
  post?: BlogPost
}

export default function BlogPostForm({ post }: BlogPostFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const [title, setTitle] = useState(post?.title || "")
  const [slug, setSlug] = useState(post?.slug || "")
  const [excerpt, setExcerpt] = useState(post?.excerpt || "")
  const [content, setContent] = useState(post?.content || "")
  const [coverImageUrl, setCoverImageUrl] = useState(post?.coverImageUrl || "")
  const [published, setPublished] = useState(post?.published || false)

  const submit = async (publishState: boolean) => {
    setError(null)

    if (!title.trim()) {
      setError("Title is required.")
      return
    }
    if (!content.trim()) {
      setError("Content is required.")
      return
    }

    setIsSubmitting(true)

    try {
      const url = post ? `/api/blog/${post.id}` : "/api/blog"
      const method = post ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          excerpt,
          content,
          coverImageUrl,
          published: publishState,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Failed to save post")
      }

      router.push("/admin/blog")
      router.refresh()
    } catch (err) {
      console.error("Error saving blog post:", err)
      setError(err instanceof Error ? err.message : "Failed to save post. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit(published)
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="mb-3">
        <label htmlFor="title" className="form-label">
          Title *
        </label>
        <input
          type="text"
          className="form-control"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="mb-3">
        <label htmlFor="slug" className="form-label">
          Slug
        </label>
        <input
          type="text"
          className="form-control"
          id="slug"
          value={slug}
          placeholder="Leave blank to generate from the title"
          onChange={(e) => setSlug(e.target.value)}
        />
        <div className="form-text">The URL path for this post, e.g. /blog/your-slug.</div>
      </div>

      <div className="mb-3">
        <label htmlFor="excerpt" className="form-label">
          Excerpt
        </label>
        <textarea
          className="form-control"
          id="excerpt"
          rows={2}
          value={excerpt}
          maxLength={500}
          placeholder="A short summary shown on the blog index (optional)."
          onChange={(e) => setExcerpt(e.target.value)}
        />
      </div>

      <div className="mb-3">
        <label htmlFor="coverImageUrl" className="form-label">
          Cover Image URL
        </label>
        <input
          type="url"
          className="form-control"
          id="coverImageUrl"
          value={coverImageUrl}
          placeholder="https://..."
          onChange={(e) => setCoverImageUrl(e.target.value)}
        />
      </div>

      <div className="mb-3">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <label htmlFor="content" className="form-label mb-0">
            Content (Markdown) *
          </label>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
        </div>

        {showPreview ? (
          <div className="border rounded p-3 blog-content" style={{ minHeight: "16rem" }}>
            {content.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            ) : (
              <p className="text-muted mb-0">Nothing to preview yet.</p>
            )}
          </div>
        ) : (
          <textarea
            className="form-control font-monospace"
            id="content"
            rows={16}
            value={content}
            placeholder={"Write your post in Markdown.\n\n## A heading\n\nSome **bold** text and a [link](https://example.com)."}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        )}
      </div>

      <div className="form-check mb-4">
        <input
          className="form-check-input"
          type="checkbox"
          id="published"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
        />
        <label className="form-check-label" htmlFor="published">
          Published (visible on the public blog)
        </label>
      </div>

      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : published ? "Save & Publish" : "Save Post"}
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          disabled={isSubmitting}
          onClick={() => submit(false)}
        >
          Save as Draft
        </button>
        <Link href="/admin/blog" className="btn btn-outline-secondary ms-auto">
          Cancel
        </Link>
      </div>
    </form>
  )
}
