import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import prisma from '@/lib/prisma'
import { authOptions } from '../auth/[...nextauth]/route'

async function getUserId(email: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error('User not found')
  return user.id
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const patternId = searchParams.get('patternId')

  try {
    const userId = await getUserId(session.user.email)

    if (patternId) {
      // Check if a specific pattern is favorited
      const favorite = await prisma.favorite.findFirst({
        where: {
          userId: userId,
          patternId: parseInt(patternId),
        },
      })
      return NextResponse.json({ isFavorited: !!favorite })
    } else {
      // Fetch all favorited patterns
      const favoritedPatterns = await prisma.favorite.findMany({
        where: {
          userId: userId,
        },
        include: {
          pattern: {
            include: {
              designer: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      return NextResponse.json({
        favoritedPatterns: favoritedPatterns.map(fp => ({
          ...fp.pattern,
          favoritedAt: fp.createdAt,
        })),
      })
    }
  } catch (error) {
    console.error('Error fetching favorites:', error)
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const patternId = body.patternId

  if (!patternId || typeof patternId !== 'number') {
    return NextResponse.json({ error: 'Valid Pattern ID is required' }, { status: 400 })
  }

  try {
    const userId = await getUserId(session.user.email)
    const favorite = await prisma.favorite.create({
      data: {
        userId: userId,
        patternId: patternId,
      },
    })

    return NextResponse.json(favorite)
  } catch (error) {
    console.error('Error creating favorite:', error)
    return NextResponse.json({ error: 'Failed to create favorite' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const patternId = searchParams.get('patternId')

  if (!patternId) {
    return NextResponse.json({ error: 'Pattern ID is required' }, { status: 400 })
  }

  try {
    const userId = await getUserId(session.user.email)
    const result = await prisma.favorite.deleteMany({
      where: {
        userId: userId,
        patternId: parseInt(patternId),
      },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Favorite not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting favorite:', error)
    return NextResponse.json({ error: 'Failed to delete favorite' }, { status: 500 })
  }
}