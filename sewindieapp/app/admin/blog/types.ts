export interface AdminBlogPost {
  id: number
  title: string
  slug: string
  excerpt: string | null
  coverImageUrl: string | null
  published: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  User: { id: number; name: string | null } | null
}
