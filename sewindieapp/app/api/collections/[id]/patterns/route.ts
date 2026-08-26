import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/api/auth/[...nextauth]/options'

async function getUserId(email: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error('User not found')
  return user.id
}

/**
 * Confirms the collection exists AND belongs to this user. Returns null when it
 * does not, which callers surface as a 404 -- deliberately not a 403, so we
 * don't leak the existence of other people's collections.
 */
async function assertOwned(collectionId: number, userId: number) {
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
    select: { id: true },
  })
  return collection
}

/** POST /api/collections/[id]/patterns — adds a pattern to the collection. */
export async function POST(
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

  let body: { patternId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const patternId = typeof body.patternId === 'number' ? body.patternId : Number.NaN
  if (!Number.isInteger(patternId) || patternId < 1) {
    return NextResponse.json({ error: 'Valid pattern ID is required' }, { status: 400 })
  }

  try {
    const userId = await getUserId(session.user.email)

    if (!(await assertOwned(collectionId, userId))) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    const pattern = await prisma.pattern.findUnique({
      where: { id: patternId },
      select: { id: true },
    })
    if (!pattern) {
      return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
    }

    // Idempotent: the @@unique([collectionId, patternId]) means a repeated add
    // is a no-op rather than a duplicate row or an error.
    await prisma.collectionPattern.upsert({
      where: { collectionId_patternId: { collectionId, patternId } },
      create: { collectionId, patternId },
      update: {},
    })

    // Touch the parent so "recently updated" ordering reflects content changes.
    await prisma.collection.update({
      where: { id: collectionId },
      data: { updatedAt: new Date() },
    })

    const patternCount = await prisma.collectionPattern.count({ where: { collectionId } })
    return NextResponse.json({ success: true, patternCount })
  } catch (error) {
    console.error('Error adding pattern to collection:', error)
    return NextResponse.json({ error: 'Failed to add pattern' }, { status: 500 })
  }
}

/**
 * DELETE /api/collections/[id]/patterns?patternId=N — removes a pattern from
 * the collection.
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

  const { searchParams } = new URL(request.url)
  const patternId = Number.parseInt(searchParams.get('patternId') ?? '', 10)
  if (!Number.isInteger(patternId) || patternId < 1) {
    return NextResponse.json({ error: 'Valid pattern ID is required' }, { status: 400 })
  }

  try {
    const userId = await getUserId(session.user.email)

    if (!(await assertOwned(collectionId, userId))) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    const result = await prisma.collectionPattern.deleteMany({
      where: { collectionId, patternId },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Pattern not in collection' }, { status: 404 })
    }

    await prisma.collection.update({
      where: { id: collectionId },
      data: { updatedAt: new Date() },
    })

    const patternCount = await prisma.collectionPattern.count({ where: { collectionId } })
    return NextResponse.json({ success: true, patternCount })
  } catch (error) {
    console.error('Error removing pattern from collection:', error)
    return NextResponse.json({ error: 'Failed to remove pattern' }, { status: 500 })
  }
}
