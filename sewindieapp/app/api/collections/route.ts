import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/api/auth/[...nextauth]/options'

const NAME_MAX = 120

async function getUserId(email: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error('User not found')
  return user.id
}

/**
 * GET /api/collections
 * Lists the signed-in user's own collections (public and private both, since
 * these are theirs). Pass ?patternId=N to also get an `hasPattern` flag per
 * collection, which is what the AddToCollection picker needs to render its
 * checkboxes without a second round trip.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const patternIdParam = searchParams.get('patternId')
  const patternId = patternIdParam ? Number.parseInt(patternIdParam, 10) : null

  if (patternIdParam && (!Number.isInteger(patternId) || patternId! < 1)) {
    return NextResponse.json({ error: 'Invalid pattern ID' }, { status: 400 })
  }

  try {
    const userId = await getUserId(session.user.email)

    const collections = await prisma.collection.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { patterns: true } },
        // Only pull the join row for the pattern being asked about, so this
        // stays a single query instead of loading every membership.
        patterns: patternId
          ? { where: { patternId }, select: { id: true } }
          : false,
      },
    })

    return NextResponse.json({
      collections: collections.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        visibility: c.visibility,
        patternCount: c._count.patterns,
        updatedAt: c.updatedAt,
        hasPattern: patternId ? c.patterns.length > 0 : undefined,
      })),
    })
  } catch (error) {
    console.error('Error fetching collections:', error)
    return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 })
  }
}

/** POST /api/collections — creates a collection owned by the signed-in user. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { name?: unknown; description?: unknown; visibility?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'Collection name is required' }, { status: 400 })
  }
  if (name.length > NAME_MAX) {
    return NextResponse.json(
      { error: `Collection name must be ${NAME_MAX} characters or fewer` },
      { status: 400 },
    )
  }

  const visibility = body.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE'
  const description =
    typeof body.description === 'string' && body.description.trim()
      ? body.description.trim()
      : null

  try {
    const userId = await getUserId(session.user.email)
    const collection = await prisma.collection.create({
      data: { userId, name, description, visibility },
    })

    return NextResponse.json({
      collection: {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        visibility: collection.visibility,
        patternCount: 0,
      },
    })
  } catch (error) {
    console.error('Error creating collection:', error)
    return NextResponse.json({ error: 'Failed to create collection' }, { status: 500 })
  }
}
