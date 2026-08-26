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
 * PATCH /api/collections/[id] — rename, re-describe, or flip visibility.
 * Ownership is enforced by scoping the write to { id, userId } rather than
 * trusting the id alone, so one user can never edit another's collection.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const resolvedParams = await params
  const collectionId = Number.parseInt(resolvedParams.id, 10)
  if (!Number.isInteger(collectionId) || collectionId < 1) {
    return NextResponse.json({ error: 'Invalid collection ID' }, { status: 400 })
  }

  let body: { name?: unknown; description?: unknown; visibility?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const data: {
    name?: string
    description?: string | null
    visibility?: 'PUBLIC' | 'PRIVATE'
  } = {}

  if (body.name !== undefined) {
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
    data.name = name
  }

  if (body.description !== undefined) {
    data.description =
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : null
  }

  if (body.visibility !== undefined) {
    if (body.visibility !== 'PUBLIC' && body.visibility !== 'PRIVATE') {
      return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 })
    }
    data.visibility = body.visibility
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
  }

  try {
    const userId = await getUserId(session.user.email)
    const result = await prisma.collection.updateMany({
      where: { id: collectionId, userId },
      // updatedAt is set explicitly rather than via Prisma's `@updatedAt`,
      // because `prisma db pull` strips that attribute from the schema. Doing
      // it here keeps the timestamp correct regardless of introspection.
      data: { ...data, updatedAt: new Date() },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating collection:', error)
    return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 })
  }
}

/**
 * DELETE /api/collections/[id] — removes the collection. Join rows go with it
 * via the onDelete: Cascade on CollectionPattern.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const resolvedParams = await params
  const collectionId = Number.parseInt(resolvedParams.id, 10)
  if (!Number.isInteger(collectionId) || collectionId < 1) {
    return NextResponse.json({ error: 'Invalid collection ID' }, { status: 400 })
  }

  try {
    const userId = await getUserId(session.user.email)
    const result = await prisma.collection.deleteMany({
      where: { id: collectionId, userId },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting collection:', error)
    return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 })
  }
}
