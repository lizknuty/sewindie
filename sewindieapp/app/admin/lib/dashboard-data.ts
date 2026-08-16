import { prisma } from "@/lib/prisma"
import { getPatternContributions } from "@/lib/google-sheets"

export type Trend = { pct: number; direction: "up" | "down" | "flat" }

function computeTrend(last: number, prev: number): Trend {
  if (prev === 0) {
    if (last === 0) return { pct: 0, direction: "flat" }
    return { pct: 100, direction: "up" }
  }
  const change = ((last - prev) / prev) * 100
  return {
    pct: Math.round(Math.abs(change)),
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
  }
}

export type ActivityKind = "user" | "favorite" | "rating" | "blog"

export type ActivityItem = {
  id: string
  kind: ActivityKind
  title: string
  subtitle: string
  timestamp: Date
}

export type TopPattern = {
  id: number
  name: string
  thumbnail_url: string | null
  designer: { name: string }
  _count: { favorites: number; ratings: number }
}

export type TopDesigner = {
  id: number
  name: string
  logo_url: string | null
  _count: { patterns: number }
}

const DAY = 24 * 60 * 60 * 1000

export async function getDashboardData() {
  const now = new Date()
  const sevenAgo = new Date(now.getTime() - 7 * DAY)
  const fourteenAgo = new Date(now.getTime() - 14 * DAY)

  const [
    userCount,
    designerCount,
    patternCount,
    blogPostCount,
    favoriteCount,
    usersLast7,
    usersPrev7,
    blogLast7,
    blogPrev7,
    favLast7,
    favPrev7,
    recentUsers,
    recentFavorites,
    recentRatings,
    recentBlog,
    topPatterns,
    topDesigners,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.designer.count(),
    prisma.pattern.count(),
    prisma.blogPost.count(),
    prisma.favorite.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: fourteenAgo, lt: sevenAgo } } }),
    prisma.blogPost.count({ where: { createdAt: { gte: sevenAgo } } }),
    prisma.blogPost.count({ where: { createdAt: { gte: fourteenAgo, lt: sevenAgo } } }),
    prisma.favorite.count({ where: { createdAt: { gte: sevenAgo } } }),
    prisma.favorite.count({ where: { createdAt: { gte: fourteenAgo, lt: sevenAgo } } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    prisma.favorite.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        pattern: { select: { name: true } },
      },
    }),
    prisma.rating.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        score: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        pattern: { select: { name: true } },
      },
    }),
    prisma.blogPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, published: true, createdAt: true },
    }),
    prisma.pattern.findMany({
      take: 6,
      orderBy: { favorites: { _count: "desc" } },
      select: {
        id: true,
        name: true,
        thumbnail_url: true,
        designer: { select: { name: true } },
        _count: { select: { favorites: true, ratings: true } },
      },
    }),
    prisma.designer.findMany({
      take: 6,
      orderBy: { patterns: { _count: "desc" } },
      select: {
        id: true,
        name: true,
        logo_url: true,
        _count: { select: { patterns: true } },
      },
    }),
  ])

  let contributionCount = 0
  try {
    const contributions = await getPatternContributions()
    contributionCount = contributions.length
  } catch {
    contributionCount = 0
  }

  const activity: ActivityItem[] = []
  for (const u of recentUsers) {
    activity.push({
      id: `u${u.id}`,
      kind: "user",
      title: `New user registered: ${u.name || u.email}`,
      subtitle: `Role: ${u.role || "Member"}`,
      timestamp: u.createdAt,
    })
  }
  for (const f of recentFavorites) {
    activity.push({
      id: `f${f.id}`,
      kind: "favorite",
      title: `Pattern favorited: ${f.pattern.name}`,
      subtitle: `by ${f.user.name || f.user.email}`,
      timestamp: f.createdAt,
    })
  }
  for (const r of recentRatings) {
    activity.push({
      id: `r${r.id}`,
      kind: "rating",
      title: `New rating: ${r.pattern.name}`,
      subtitle: `${r.score}/5 by ${r.user.name || r.user.email}`,
      timestamp: r.createdAt,
    })
  }
  for (const b of recentBlog) {
    activity.push({
      id: `b${b.id}`,
      kind: "blog",
      title: `Blog post ${b.published ? "published" : "drafted"}: ${b.title}`,
      subtitle: "Blog",
      timestamp: b.createdAt,
    })
  }
  activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return {
    metrics: {
      users: { value: userCount, trend: computeTrend(usersLast7, usersPrev7) },
      designers: { value: designerCount },
      patterns: { value: patternCount },
      blogPosts: { value: blogPostCount, trend: computeTrend(blogLast7, blogPrev7) },
      contributions: { value: contributionCount },
      favorites: { value: favoriteCount, trend: computeTrend(favLast7, favPrev7) },
    },
    activity: activity.slice(0, 6),
    topPatterns: topPatterns as TopPattern[],
    topDesigners: topDesigners as TopDesigner[],
  }
}

export function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}
